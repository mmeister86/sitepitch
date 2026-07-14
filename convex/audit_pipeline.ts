"use node"

import { Buffer } from "node:buffer"
import http from "node:http"
import https from "node:https"
import { isIP } from "node:net"

import { v } from "convex/values"

import { internalAction, env } from "./_generated/server"
import { internal } from "./_generated/api"
import type { ActionCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { checkProviderLimit } from "./lib/audit_rate_limit"
import { providerToLimitKind, type ProviderLimitKind } from "./lib/rate_limit_helpers"
import {
  extractSignalsFromHtml,
  extractSignalsFromMarkdown,
  getAuditPipelinePlan,
  normalizeUrlForAudit,
  pickPriorityPages,
  redactSensitiveText,
  sameOrigin,
} from "./lib/audit_pipeline"
import { validatePublicAuditTarget } from "./lib/audit_url"
import { sanitizeError } from "./lib/telemetry_safety"
import {
  AUDIT_CACHE_VERSION,
  buildAuditCacheKey,
  cacheExpiresAt,
  toCacheValue,
  type AuditCacheKind,
} from "./lib/audit_cache"
import {
  buildZeroCost,
  estimateFirecrawlCost,
  estimatePageSpeedCost,
  estimateDirectHtmlCost,
  type ProviderCostRecord,
} from "./lib/provider_costs"

type Claim = {
  auditId: Id<"audits">
  workspaceId: Id<"workspaces">
  batchAuditJobId?: Id<"batchAuditJobs">
  batchAuditItemId?: Id<"batchAuditItems">
  createdByUserId: Id<"users">
  planSnapshot?: "free" | "starter" | "pro" | "agency" | "scale"
  leaseToken: string
  leaseExpiresAt: number
  url: string
  normalizedUrl: string
  domain: string
  auditType: "quick" | "standard" | "local"
  reportLanguage: "de" | "en"
  idempotencyKey: string
}

type CacheProvider =
  | "direct_html"
  | "jina"
  | "firecrawl"
  | "screenshotone"
  | "pagespeed"
  | "local_business_data"
  | "google_places"
  | "openai"
  | "anthropic"
  | "other"

async function readProviderCache<T>(
  ctx: ActionCtx,
  claim: Claim,
  args: { kind: AuditCacheKind; provider: CacheProvider; operation: string; normalizedUrl?: string },
): Promise<T | null> {
  const normalizedUrl = args.normalizedUrl ?? claim.normalizedUrl
  const cacheKey = buildAuditCacheKey({
    workspaceId: claim.workspaceId,
    normalizedUrl,
    auditType: claim.auditType,
    kind: args.kind,
    provider: args.provider,
    operation: args.operation,
  })
  const entry = await ctx.runQuery(internal.audit_cache.getEntry, {
    workspaceId: claim.workspaceId,
    cacheKey,
    now: Date.now(),
  })
  if (!entry?.payload) return null
  await ctx.runMutation(internal.audit_cache.recordHit, {
    auditId: claim.auditId,
    auditCacheEntryId: entry._id,
  })
  return entry.payload as T
}

async function writeProviderCache<T>(
  ctx: ActionCtx,
  claim: Claim,
  value: T,
  args: { kind: AuditCacheKind; provider: CacheProvider; operation: string; normalizedUrl?: string },
) {
  const payload = toCacheValue(value)
  const encoded = JSON.stringify(payload)
  if (encoded.length > 750_000) return
  const normalizedUrl = args.normalizedUrl ?? claim.normalizedUrl
  const cacheKey = buildAuditCacheKey({
    workspaceId: claim.workspaceId,
    normalizedUrl,
    auditType: claim.auditType,
    kind: args.kind,
    provider: args.provider,
    operation: args.operation,
  })
  await ctx.runMutation(internal.audit_cache.putEntry, {
    workspaceId: claim.workspaceId,
    kind: args.kind,
    cacheKey,
    normalizedUrl,
    domain: claim.domain,
    auditType: claim.auditType,
    provider: args.provider,
    operation: args.operation,
    version: AUDIT_CACHE_VERSION,
    sourceAuditId: claim.auditId,
    payload,
    expiresAt: cacheExpiresAt(args.kind),
  })
}

async function readScreenshotCache(
  ctx: ActionCtx,
  claim: Claim,
  targetUrl: string,
  viewport: "desktop" | "mobile",
) {
  const normalizedUrl = normalizeUrlForAudit(targetUrl)
  const cacheKey = buildAuditCacheKey({
    workspaceId: claim.workspaceId,
    normalizedUrl,
    auditType: claim.auditType,
    kind: "screenshot",
    provider: "firecrawl",
    operation: `capture_${viewport}_screenshot`,
  })
  const entry = await ctx.runQuery(internal.audit_cache.getEntry, {
    workspaceId: claim.workspaceId,
    cacheKey,
    now: Date.now(),
  })
  if (!entry?.storageId || !entry.mimeType) return null
  await ctx.runMutation(internal.audit_cache.recordHit, {
    auditId: claim.auditId,
    auditCacheEntryId: entry._id,
  })
  return {
    viewport,
    storageId: entry.storageId,
    mimeType: entry.mimeType,
    auditCacheEntryId: entry._id,
  }
}

type PrimaryFetchResult =
  | {
      finalUrl: string
      httpStatus: number
      sourceProvider: "direct_html"
      html: string
    }
  | {
      finalUrl: string
      httpStatus: number
      sourceProvider: "firecrawl"
      html: string
      markdown: string
      links: string[]
    }

type PriorityPageResult = {
  pageIndex: number
  kind: string
  url: string
  normalizedUrl: string
  httpStatus: number
  finalUrl: string
  html?: string
  markdown?: string
  sourceProvider: "direct_html" | "firecrawl"
}

type FetchResult = {
  statusCode: number
  headers: Record<string, string | string[] | undefined>
  body: Buffer
  finalUrl: string
  redirectChain: string[]
}

class ProviderFetchError extends Error {
  retryable: boolean
  errorCode: string
  statusCode?: number
  retryAfterMs?: number

  constructor(
    errorCode: string,
    message: string,
    options: { retryable: boolean; statusCode?: number; retryAfterMs?: number } = { retryable: false },
  ) {
    super(message)
    this.name = "ProviderFetchError"
    this.retryable = options.retryable
    this.errorCode = errorCode
    this.statusCode = options.statusCode
    this.retryAfterMs = options.retryAfterMs
  }
}

function isRetryableNodeError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : ""
  return [
    "ECONNRESET",
    "ECONNREFUSED",
    "EAI_AGAIN",
    "ETIMEDOUT",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_HEADERS_TIMEOUT",
    "UND_ERR_BODY_TIMEOUT",
    "UND_ERR_SOCKET",
  ].includes(code)
}

function parseRetryAfter(header: string | string[] | undefined) {
  const value = Array.isArray(header) ? header[0] : header
  if (!value) {
    return undefined
  }
  const seconds = Number(value)
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000)
  }
  const parsed = Date.parse(value)
  if (Number.isFinite(parsed)) {
    return Math.max(0, parsed - Date.now())
  }
  return undefined
}

function sanitizeEvidence(input: string) {
  return redactSensitiveText(input)
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRedirect(statusCode: number) {
  return statusCode >= 300 && statusCode < 400
}

function defaultPort(protocol: string) {
  return protocol === "https:" ? 443 : 80
}

function assertSafeOutboundUrl(target: URL) {
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new ProviderFetchError("UNSAFE_URL", "Nur HTTP- und HTTPS-Ziele sind erlaubt.", { retryable: false })
  }
  if (target.username || target.password) {
    throw new ProviderFetchError("UNSAFE_URL", "URLs mit Zugangsdaten sind nicht erlaubt.", { retryable: false })
  }
  if (target.port && target.port !== "80" && target.port !== "443") {
    throw new ProviderFetchError("UNSAFE_URL", "Nur die Web-Ports 80 und 443 sind erlaubt.", { retryable: false })
  }
}

async function assertPublicProviderTarget(inputUrl: string) {
  let target: URL
  try {
    target = new URL(inputUrl)
  } catch {
    throw new ProviderFetchError("INVALID_URL", "Die Ziel-URL ist ungültig.", { retryable: false })
  }
  assertSafeOutboundUrl(target)
  await resolvePinnedHostname(target.hostname)
}

async function resolvePinnedHostname(hostname: string) {
  const validation = await validatePublicAuditTarget(hostname)
  if (!("ok" in validation)) {
    throw new ProviderFetchError(validation.code, validation.message, { retryable: false })
  }
  const pinnedAddress = validation.addresses[0]
  if (!pinnedAddress) {
    throw new ProviderFetchError("UNRESOLVABLE", "Die Website konnte nicht aufgelöst werden.", { retryable: false })
  }
  return pinnedAddress
}

async function requestOnce(
  target: URL,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: Buffer | string
    timeoutMs: number
    bodyLimitBytes: number
  },
): Promise<FetchResult> {
  assertSafeOutboundUrl(target)
  const pinnedAddress = await resolvePinnedHostname(target.hostname)
  const transport = target.protocol === "https:" ? https : http
  const requestHeaders = {
    accept: "*/*",
    "accept-encoding": "identity",
    host: target.host,
    ...options.headers,
  }

  return await new Promise<FetchResult>((resolve, reject) => {
    const req = transport.request(
      {
        protocol: target.protocol,
        hostname: pinnedAddress,
        port: target.port ? Number(target.port) : defaultPort(target.protocol),
        family: isIP(pinnedAddress) || undefined,
        path: `${target.pathname}${target.search}`,
        method: options.method ?? "GET",
        headers: requestHeaders,
        servername: target.hostname,
      },
      (res) => {
        const chunks: Buffer[] = []
        let totalBytes = 0

        res.on("data", (chunk) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          totalBytes += buffer.length
          if (totalBytes > options.bodyLimitBytes) {
            req.destroy(
              new ProviderFetchError("BODY_TOO_LARGE", "Die Antwort war zu groß.", { retryable: false }),
            )
            return
          }
          chunks.push(buffer)
        })

        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
            finalUrl: target.toString(),
            redirectChain: [],
          })
        })
      },
    )

    req.setTimeout(options.timeoutMs, () => {
      req.destroy(new ProviderFetchError("TIMEOUT", "Der Provider hat zu lange gebraucht.", { retryable: true }))
    })

    req.on("error", (error) => {
      if (error instanceof ProviderFetchError) {
        reject(error)
        return
      }
      reject(
        new ProviderFetchError(
          "NETWORK_ERROR",
          error instanceof Error ? error.message : "Netzwerkfehler beim Provideraufruf.",
          { retryable: isRetryableNodeError(error) },
        ),
      )
    })

    if (options.body) {
      req.write(options.body)
    }

    req.end()
  })
}

async function requestWithRedirects(
  inputUrl: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: Buffer | string
    timeoutMs: number
    bodyLimitBytes: number
    maxRedirects?: number
    sameOriginOnly?: boolean
  },
): Promise<FetchResult> {
  let current = new URL(inputUrl)
  assertSafeOutboundUrl(current)
  const redirectChain: string[] = []
  const maxRedirects = options.maxRedirects ?? 5

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const response = await requestOnce(current, options)
    if (isRedirect(response.statusCode)) {
      const locationHeader = response.headers.location
      const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader
      if (!location) {
        throw new ProviderFetchError("REDIRECT_ERROR", "Die Weiterleitung war ungültig.", { retryable: false })
      }
      const next = new URL(location, current)
      assertSafeOutboundUrl(next)
      if (next.protocol !== "http:" && next.protocol !== "https:") {
        throw new ProviderFetchError("REDIRECT_ERROR", "Die Weiterleitung war ungültig.", { retryable: false })
      }
      if (current.protocol === "https:" && next.protocol === "http:") {
        throw new ProviderFetchError("REDIRECT_ERROR", "HTTPS darf nicht auf HTTP weiterleiten.", {
          retryable: false,
        })
      }
      if (options.sameOriginOnly && !sameOrigin(current, next)) {
        throw new ProviderFetchError("REDIRECT_ERROR", "Die Website leitete auf ein anderes Ziel weiter.", {
          retryable: false,
        })
      }
      redirectChain.push(next.toString())
      current = next
      continue
    }

    return {
      ...response,
      finalUrl: current.toString(),
      redirectChain,
    }
  }

  throw new ProviderFetchError("REDIRECT_LOOP", "Zu viele Weiterleitungen.", { retryable: false })
}

async function requestText(
  inputUrl: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: Buffer | string
    timeoutMs: number
    bodyLimitBytes: number
    maxRedirects?: number
    sameOriginOnly?: boolean
  },
) {
  const response = await requestWithRedirects(inputUrl, options)
  const text = new TextDecoder("utf-8").decode(response.body)
  return { ...response, text }
}

async function requestJson<T = unknown>(
  inputUrl: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: Buffer | string
    timeoutMs: number
    bodyLimitBytes: number
    maxRedirects?: number
    sameOriginOnly?: boolean
  },
) {
  const response = await requestText(inputUrl, options)
  try {
    return { ...response, json: JSON.parse(response.text) as T }
  } catch {
    throw new ProviderFetchError("INVALID_JSON", "Der Provider hat kein gültiges JSON geliefert.", { retryable: false })
  }
}

async function runProviderAttempt<T>(
  ctx: ActionCtx,
  claim: Claim,
  provider:
    | "direct_html"
    | "jina"
    | "firecrawl"
    | "screenshotone"
    | "pagespeed"
    | "local_business_data"
    | "google_places",
  operation: string,
  requestEvidence: string,
  attemptFn: (attempt: number) => Promise<{ value: T; responseStatus?: number }>,
  options: { optional?: boolean; limitKind?: ProviderLimitKind } = {},
): Promise<T | null> {
  let lastError: ProviderFetchError | null = null

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await checkProviderLimit(ctx, {
        kind: options.limitKind ?? providerToLimitKind(provider),
        provider,
        workspaceId: claim.workspaceId,
        userId: claim.createdByUserId,
        plan: claim.planSnapshot,
      })
    } catch (error) {
      if (options.optional) {
        return null
      }
      throw error
    }

    const providerCallId = await ctx.runMutation(internal.audit_state.logProviderCallStart, {
      workspaceId: claim.workspaceId,
      auditId: claim.auditId,
      provider,
      operation,
      attempt,
      requestEvidence: sanitizeEvidence(requestEvidence),
      retryCount: attempt - 1,
    })

    const startedAt = Date.now()
    try {
      const result = await attemptFn(attempt)
      await ctx.runMutation(internal.audit_state.logProviderCallFinish, {
        providerCallId,
        status: "completed",
        latencyMs: Date.now() - startedAt,
        retryCount: attempt - 1,
        responseStatus: result.responseStatus,
      })
      await recordAttemptCost(ctx, claim, provider, operation, providerCallId)
      return result.value
    } catch (error) {
      const normalized =
        error instanceof ProviderFetchError
          ? error
          : new ProviderFetchError("PROVIDER_ERROR", error instanceof Error ? error.message : "Providerfehler.", {
              retryable: false,
            })
      lastError = normalized
      await ctx.runMutation(internal.audit_state.logProviderCallFinish, {
        providerCallId,
        status: "failed",
        latencyMs: Date.now() - startedAt,
        retryCount: attempt - 1,
        errorCode: normalized.errorCode,
        errorMessage: redactSensitiveText(normalized.message),
        responseStatus: normalized.statusCode,
      })

      if (!normalized.retryable || attempt === 2) {
        break
      }
      if (normalized.retryAfterMs) {
        await delay(normalized.retryAfterMs)
      }
    }
  }

  if (options.optional) {
    return null
  }

  throw lastError ?? new ProviderFetchError("PROVIDER_ERROR", "Providerfehler.", { retryable: false })
}

async function recordAttemptCost(
  ctx: ActionCtx,
  claim: Claim,
  provider: string,
  operation: string,
  providerCallId: string,
) {
  const costInput = {
    workspaceId: claim.workspaceId,
    auditId: claim.auditId,
    providerCallId,
    costKey: `pcall:${providerCallId}`,
    provider,
    operation,
    requestCount: 1,
  }

  let costRecord: ProviderCostRecord
  if (provider === "firecrawl") {
    costRecord = estimateFirecrawlCost(costInput, operation)
  } else if (provider === "pagespeed") {
    costRecord = estimatePageSpeedCost(costInput)
  } else if (provider === "direct_html") {
    costRecord = estimateDirectHtmlCost(costInput)
  } else {
    costRecord = buildZeroCost(costInput)
  }

  try {
    await ctx.runMutation(internal.audit_state.recordProviderCost, {
      workspaceId: costRecord.workspaceId as Id<"workspaces">,
      auditId: costRecord.auditId as Id<"audits"> | undefined,
      providerCallId: costRecord.providerCallId as Id<"providerCalls"> | undefined,
      costKey: costRecord.costKey,
      provider: costRecord.provider as any,
      operation: costRecord.operation,
      source: costRecord.source as any,
      ...(costRecord.model !== undefined ? { model: costRecord.model } : {}),
      ...(costRecord.providerRequestId !== undefined ? { providerRequestId: costRecord.providerRequestId } : {}),
      ...(costRecord.pricingVersion !== undefined ? { pricingVersion: costRecord.pricingVersion } : {}),
      ...(costRecord.estimatedCostUsd !== undefined ? { estimatedCostUsd: costRecord.estimatedCostUsd } : {}),
      ...(costRecord.actualCostUsd !== undefined ? { actualCostUsd: costRecord.actualCostUsd } : {}),
      ...(costRecord.tokensIn !== undefined ? { tokensIn: costRecord.tokensIn } : {}),
      ...(costRecord.tokensOut !== undefined ? { tokensOut: costRecord.tokensOut } : {}),
      ...(costRecord.requestCount !== undefined ? { requestCount: costRecord.requestCount } : {}),
    })
  } catch (error) {
    console.warn("[audit_pipeline] failed to record provider cost", {
      providerCallId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

const FIRECRAWL_DEFAULT_BASE_URL = "https://api.firecrawl.dev"
const FIRECRAWL_RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504])

type FirecrawlScrapePayload = {
  markdown?: string
  html?: string
  rawHtml?: string
  screenshot?: string
  links?: string[]
  metadata?: {
    statusCode?: number
    sourceURL?: string
    url?: string
    title?: string
    description?: string
  }
}

type FirecrawlNormalizedScrape = {
  finalUrl: string
  httpStatus: number
  markdown?: string
  html?: string
  links: string[]
  screenshot?: string
  title?: string
  metaDescription?: string
}

function firecrawlBaseUrl() {
  return (env.FIRECRAWL_API_BASE_URL ?? FIRECRAWL_DEFAULT_BASE_URL).replace(/\/$/, "")
}

function isFirecrawlConfigured() {
  return Boolean(env.FIRECRAWL_API_KEY)
}

function firecrawlRequestHeaders() {
  return {
    authorization: `Bearer ${env.FIRECRAWL_API_KEY ?? ""}`,
    "content-type": "application/json",
    accept: "application/json",
  }
}

function firecrawlHttpError(
  statusCode: number,
  headers: Record<string, string | string[] | undefined>,
  operation: string,
) {
  return new ProviderFetchError(
    `HTTP_${statusCode}`,
    `Firecrawl ${operation} failed with ${statusCode}`,
    {
      retryable: FIRECRAWL_RETRYABLE_STATUSES.has(statusCode),
      statusCode,
      retryAfterMs: parseRetryAfter(headers["retry-after"]),
    },
  )
}

function normalizeFirecrawlScrape(
  payload: unknown,
  fallbackUrl: string,
  responseStatus: number,
): FirecrawlNormalizedScrape {
  const root = (payload ?? {}) as { data?: FirecrawlScrapePayload } & FirecrawlScrapePayload
  const data = root.data ?? root
  const metadata = data.metadata ?? {}
  const links = Array.isArray(data.links)
    ? data.links.filter((link): link is string => typeof link === "string")
    : []
  const finalUrl = metadata.url ?? metadata.sourceURL ?? fallbackUrl
  const httpStatus = typeof metadata.statusCode === "number" ? metadata.statusCode : responseStatus
  return {
    finalUrl,
    httpStatus,
    markdown: data.markdown,
    html: data.rawHtml ?? data.html,
    links,
    screenshot: data.screenshot,
    title: metadata.title,
    metaDescription: metadata.description,
  }
}

function extractFirecrawlMapLinks(payload: unknown): string[] {
  const root = (payload ?? {}) as {
    success?: boolean
    links?: Array<{ url?: string } | string>
  }
  const raw = Array.isArray(root.links) ? root.links : []
  return raw
    .map((entry) => (typeof entry === "string" ? entry : entry?.url))
    .filter((value): value is string => typeof value === "string" && value.length > 0)
}

async function scrapeHomepageWithFirecrawl(
  ctx: ActionCtx,
  claim: Claim,
): Promise<PrimaryFetchResult | null> {
  if (!isFirecrawlConfigured()) {
    return null
  }

  const url = claim.normalizedUrl
  const result = await runProviderAttempt<PrimaryFetchResult>(
    ctx,
    claim,
    "firecrawl",
    "scrape_homepage",
    `firecrawl:scrape:${url}`,
    async () => {
      await assertPublicProviderTarget(url)
      const response = await requestJson<unknown>(`${firecrawlBaseUrl()}/v2/scrape`, {
        method: "POST",
        headers: firecrawlRequestHeaders(),
        body: JSON.stringify({
          url,
          formats: ["markdown", "rawHtml", "links"],
          onlyMainContent: false,
          timeout: 25_000,
          maxAge: 0,
        }),
        timeoutMs: 35_000,
        bodyLimitBytes: 5_000_000,
        maxRedirects: 3,
      })

      if (response.statusCode >= 400) {
        throw firecrawlHttpError(response.statusCode, response.headers, "scrape_homepage")
      }

      const normalized = normalizeFirecrawlScrape(response.json, url, response.statusCode)
      if (!normalized.html && !normalized.markdown) {
        throw new ProviderFetchError("EMPTY_RESPONSE", "Firecrawl returned no usable content.", {
          retryable: false,
        })
      }

      return {
        value: {
          finalUrl: normalized.finalUrl,
          httpStatus: normalized.httpStatus,
          sourceProvider: "firecrawl" as const,
          html: normalized.html ?? "",
          markdown: normalized.markdown ?? "",
          links: normalized.links,
        },
        responseStatus: response.statusCode,
      }
    },
    { optional: true },
  )

  return result
}

async function scrapePriorityPageWithFirecrawl(
  ctx: ActionCtx,
  claim: Claim,
  url: string,
  pageIndex: number,
  kind: string,
): Promise<PriorityPageResult | null> {
  if (!isFirecrawlConfigured()) {
    return null
  }

  const result = await runProviderAttempt<PriorityPageResult>(
    ctx,
    claim,
    "firecrawl",
    "scrape_priority_page",
    `firecrawl:scrape:${url}`,
    async () => {
      await assertPublicProviderTarget(url)
      const response = await requestJson<unknown>(`${firecrawlBaseUrl()}/v2/scrape`, {
        method: "POST",
        headers: firecrawlRequestHeaders(),
        body: JSON.stringify({
          url,
          formats: ["markdown", "rawHtml"],
          onlyMainContent: false,
          timeout: 25_000,
          maxAge: 0,
        }),
        timeoutMs: 35_000,
        bodyLimitBytes: 5_000_000,
        maxRedirects: 3,
      })

      if (response.statusCode >= 400) {
        throw firecrawlHttpError(response.statusCode, response.headers, "scrape_priority_page")
      }

      const normalized = normalizeFirecrawlScrape(response.json, url, response.statusCode)
      if (!normalized.html && !normalized.markdown) {
        throw new ProviderFetchError("EMPTY_RESPONSE", "Firecrawl returned no usable content.", {
          retryable: false,
        })
      }

      return {
        value: {
          pageIndex,
          kind,
          url,
          normalizedUrl: normalizeUrlForAudit(normalized.finalUrl),
          httpStatus: normalized.httpStatus,
          finalUrl: normalized.finalUrl,
          html: normalized.html,
          markdown: normalized.markdown,
          sourceProvider: "firecrawl" as const,
        },
        responseStatus: response.statusCode,
      }
    },
    { optional: true },
  )

  return result
}

async function mapWithFirecrawl(ctx: ActionCtx, claim: Claim, baseUrl: string): Promise<string[]> {
  if (!isFirecrawlConfigured()) {
    return []
  }

  const result = await runProviderAttempt<string[]>(
    ctx,
    claim,
    "firecrawl",
    "map_site_urls",
    `firecrawl:map:${baseUrl}`,
    async () => {
      await assertPublicProviderTarget(baseUrl)
      const response = await requestJson<unknown>(`${firecrawlBaseUrl()}/v2/map`, {
        method: "POST",
        headers: firecrawlRequestHeaders(),
        body: JSON.stringify({
          url: baseUrl,
          sitemap: "include",
          includeSubdomains: false,
          ignoreQueryParameters: true,
          limit: 30,
          timeout: 15_000,
        }),
        timeoutMs: 25_000,
        bodyLimitBytes: 1_500_000,
        maxRedirects: 3,
      })

      if (response.statusCode >= 400) {
        throw firecrawlHttpError(response.statusCode, response.headers, "map_site_urls")
      }

      return {
        value: extractFirecrawlMapLinks(response.json),
        responseStatus: response.statusCode,
      }
    },
    { optional: true },
  )

  return result ?? []
}

async function fetchPrimaryHtml(ctx: ActionCtx, claim: Claim): Promise<PrimaryFetchResult> {
  const cached = await readProviderCache<PrimaryFetchResult>(ctx, claim, {
    kind: "content",
    provider: "other",
    operation: "primary_content",
  })
  if (cached) return cached

  // Firecrawl is the primary crawler. If it fails or returns no usable content,
  // fall back to a direct HTML fetch. Jina has been removed from the pipeline.
  try {
    const firecrawlResult = await scrapeHomepageWithFirecrawl(ctx, claim)
    if (firecrawlResult) {
      await writeProviderCache(ctx, claim, firecrawlResult, {
        kind: "content",
        provider: "other",
        operation: "primary_content",
      })
      return firecrawlResult
    }
  } catch (error) {
    console.warn(
      "Firecrawl homepage scrape failed, falling back to direct HTML",
      redactSensitiveText(error instanceof Error ? error.message : String(error)),
    )
  }

  const directEvidence = `direct_html:${claim.normalizedUrl}`
  const directResult = await runProviderAttempt(
    ctx,
    claim,
    "direct_html",
    "fetch_homepage_html",
    directEvidence,
    async () => {
      const response = await requestText(claim.normalizedUrl, {
        timeoutMs: 10_000,
        bodyLimitBytes: 2_000_000,
        maxRedirects: 5,
        sameOriginOnly: true,
        headers: {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      })

      if (response.statusCode >= 400) {
        const retryAfterMs = parseRetryAfter(response.headers["retry-after"])
        throw new ProviderFetchError(
          `HTTP_${response.statusCode}`,
          `HTML fetch failed with ${response.statusCode}`,
          {
            retryable: response.statusCode === 408 || response.statusCode === 429 || response.statusCode >= 500,
            statusCode: response.statusCode,
            retryAfterMs,
          },
        )
      }

      return {
        value: {
          finalUrl: response.finalUrl,
          httpStatus: response.statusCode,
          sourceProvider: "direct_html" as const,
          html: response.text,
        },
        responseStatus: response.statusCode,
      }
    },
  )

  if (directResult) {
    await writeProviderCache(ctx, claim, directResult, {
      kind: "content",
      provider: "other",
      operation: "primary_content",
    })
    return directResult
  }

  throw new ProviderFetchError(
    "EMPTY_RESPONSE",
    "Weder Firecrawl noch ein direkter HTML-Abruf konnten Inhalte liefern.",
    { retryable: false },
  )
}

async function fetchPriorityPage(
  ctx: ActionCtx,
  claim: Claim,
  url: string,
  pageIndex: number,
  kind: string,
): Promise<PriorityPageResult | null> {
  // Firecrawl first, direct HTML as fallback.
  try {
    const firecrawlResult = await scrapePriorityPageWithFirecrawl(ctx, claim, url, pageIndex, kind)
    if (firecrawlResult) {
      return firecrawlResult
    }
  } catch (error) {
    console.warn(
      "Firecrawl priority page scrape failed, falling back to direct HTML",
      redactSensitiveText(error instanceof Error ? error.message : String(error)),
    )
  }

  return await runProviderAttempt<PriorityPageResult>(
    ctx,
    claim,
    "direct_html",
    "fetch_priority_page",
    `direct_html:${url}`,
    async () => {
      const response = await requestText(url, {
        timeoutMs: 10_000,
        bodyLimitBytes: 2_000_000,
        maxRedirects: 5,
        sameOriginOnly: true,
        headers: {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      })

      if (response.statusCode >= 400) {
        throw new ProviderFetchError(`HTTP_${response.statusCode}`, `Page fetch failed with ${response.statusCode}`, {
          retryable: response.statusCode === 408 || response.statusCode === 429 || response.statusCode >= 500,
          statusCode: response.statusCode,
          retryAfterMs: parseRetryAfter(response.headers["retry-after"]),
        })
      }

      return {
        value: {
          pageIndex,
          kind,
          url,
          normalizedUrl: normalizeUrlForAudit(response.finalUrl),
          httpStatus: response.statusCode,
          finalUrl: response.finalUrl,
          html: response.text,
          sourceProvider: "direct_html" as const,
        },
        responseStatus: response.statusCode,
      }
    },
    { optional: true },
  )
}

function parsePageSpeed(result: {
  lighthouseResult?: {
    categories?: Record<string, { score?: number }>
    audits?: Record<string, { numericValue?: number }>
  }
}) {
  const lighthouse = result.lighthouseResult
  if (!lighthouse) {
    return null
  }

  return {
    performanceScore: roundScore(lighthouse.categories?.performance?.score),
    accessibilityScore: roundScore(lighthouse.categories?.accessibility?.score),
    bestPracticesScore: roundScore(lighthouse.categories?.["best-practices"]?.score),
    seoScore: roundScore(lighthouse.categories?.seo?.score),
    lcp: numericAudit(lighthouse.audits?.["largest-contentful-paint"]?.numericValue),
    cls: numericAudit(lighthouse.audits?.["cumulative-layout-shift"]?.numericValue),
    fcp: numericAudit(lighthouse.audits?.["first-contentful-paint"]?.numericValue),
    speedIndex: numericAudit(lighthouse.audits?.["speed-index"]?.numericValue),
  }
}

function roundScore(score: number | undefined) {
  return typeof score === "number" ? Math.round(score * 100) : undefined
}

function numericAudit(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

async function captureScreenshotWithFirecrawl(
  ctx: ActionCtx,
  claim: Claim,
  targetUrl: string,
  viewport: "desktop" | "mobile",
  requestEvidence: string,
) {
  const cached = await readScreenshotCache(ctx, claim, targetUrl, viewport)
  if (cached) return cached
  if (!isFirecrawlConfigured()) {
    return null
  }

  return await runProviderAttempt(
    ctx,
    claim,
    "firecrawl",
    `capture_${viewport}_screenshot`,
    requestEvidence,
    async () => {
      await assertPublicProviderTarget(targetUrl)
      const screenshotFormat = {
        type: "screenshot" as const,
        fullPage: true,
        viewport: {
          width: viewport === "mobile" ? 390 : 1440,
          height: viewport === "mobile" ? 844 : 900,
        },
      }

      const body: Record<string, unknown> = {
        url: targetUrl,
        formats: [screenshotFormat],
        timeout: 25_000,
        maxAge: 0,
      }
      if (viewport === "mobile") {
        body.mobile = true
      }

      const scrapeResponse = await requestJson<unknown>(`${firecrawlBaseUrl()}/v2/scrape`, {
        method: "POST",
        headers: firecrawlRequestHeaders(),
        body: JSON.stringify(body),
        timeoutMs: 35_000,
        bodyLimitBytes: 5_000_000,
        maxRedirects: 3,
      })

      if (scrapeResponse.statusCode >= 400) {
        throw firecrawlHttpError(scrapeResponse.statusCode, scrapeResponse.headers, `capture_${viewport}_screenshot`)
      }

      const normalized = normalizeFirecrawlScrape(scrapeResponse.json, targetUrl, scrapeResponse.statusCode)
      const screenshotUrl = normalized.screenshot
      if (!screenshotUrl) {
        throw new ProviderFetchError("EMPTY_RESPONSE", "Firecrawl returned no screenshot URL.", {
          retryable: false,
        })
      }

      const imageResponse = await requestWithRedirects(screenshotUrl, {
        timeoutMs: 45_000,
        bodyLimitBytes: 10_000_000,
        maxRedirects: 3,
        headers: {
          accept: "image/png,image/jpeg,image/webp,*/*;q=0.2",
        },
      })

      if (imageResponse.statusCode >= 400) {
        throw new ProviderFetchError(`HTTP_${imageResponse.statusCode}`, `Screenshot download failed with ${imageResponse.statusCode}`, {
          retryable: imageResponse.statusCode === 408 || imageResponse.statusCode === 429 || imageResponse.statusCode >= 500,
          statusCode: imageResponse.statusCode,
          retryAfterMs: parseRetryAfter(imageResponse.headers["retry-after"]),
        })
      }

      const mimeType = validateScreenshotBytes(imageResponse.body, imageResponse.headers["content-type"])
      const arrayBuffer = imageResponse.body.buffer.slice(
        imageResponse.body.byteOffset,
        imageResponse.body.byteOffset + imageResponse.body.byteLength,
      ) as ArrayBuffer
      const storageId = await ctx.storage.store(new Blob([arrayBuffer as ArrayBuffer], { type: mimeType }))
      const normalizedUrl = normalizeUrlForAudit(targetUrl)
      const cacheKey = buildAuditCacheKey({
        workspaceId: claim.workspaceId,
        normalizedUrl,
        auditType: claim.auditType,
        kind: "screenshot",
        provider: "firecrawl",
        operation: `capture_${viewport}_screenshot`,
      })
      const auditCacheEntryId = await ctx.runMutation(internal.audit_cache.putEntry, {
        workspaceId: claim.workspaceId,
        kind: "screenshot",
        cacheKey,
        normalizedUrl,
        domain: claim.domain,
        auditType: claim.auditType,
        provider: "firecrawl",
        operation: `capture_${viewport}_screenshot`,
        version: AUDIT_CACHE_VERSION,
        sourceAuditId: claim.auditId,
        storageId,
        mimeType,
        expiresAt: cacheExpiresAt("screenshot"),
      })

      return {
        value: {
          viewport,
          storageId,
          mimeType,
          auditCacheEntryId,
        },
        responseStatus: scrapeResponse.statusCode,
      }
    },
    { optional: true, limitKind: "screenshot" },
  )
}

async function runPageSpeedAnalysis(ctx: ActionCtx, claim: Claim, targetUrl: string, strategy: "mobile" | "desktop") {
  const normalizedTarget = normalizeUrlForAudit(targetUrl)
  const cached = await readProviderCache<ReturnType<typeof parsePageSpeed>>(ctx, claim, {
    kind: "pagespeed",
    provider: "pagespeed",
    operation: `run_${strategy}_pagespeed`,
    normalizedUrl: normalizedTarget,
  })
  if (cached) return cached

  const key = env.PAGESPEED_API_KEY
  const timeout = parseInt(env.PAGESPEED_TIMEOUT_MS ?? "90000", 10)
  const pagespeedUrl = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed")
  pagespeedUrl.searchParams.set("url", targetUrl)
  pagespeedUrl.searchParams.set("strategy", strategy)
  pagespeedUrl.searchParams.append("category", "performance")
  pagespeedUrl.searchParams.append("category", "accessibility")
  pagespeedUrl.searchParams.append("category", "best-practices")
  pagespeedUrl.searchParams.append("category", "seo")
  if (key) {
    pagespeedUrl.searchParams.set("key", key)
  }

  const result = await runProviderAttempt(
    ctx,
    claim,
    "pagespeed",
    `run_${strategy}_pagespeed`,
    `pagespeed:${strategy}:${targetUrl}`,
    async () => {
      await assertPublicProviderTarget(targetUrl)
      const response = await requestJson<{ lighthouseResult?: unknown }>(pagespeedUrl.toString(), {
        timeoutMs: timeout,
        bodyLimitBytes: 8_000_000,
        maxRedirects: 3,
        headers: {
          accept: "application/json",
        },
      })

      if (response.statusCode >= 400) {
        throw new ProviderFetchError(`HTTP_${response.statusCode}`, `PageSpeed failed with ${response.statusCode}`, {
          retryable: response.statusCode === 408 || response.statusCode === 429 || response.statusCode >= 500,
          statusCode: response.statusCode,
          retryAfterMs: parseRetryAfter(response.headers["retry-after"]),
        })
      }

      return {
        value: parsePageSpeed(response.json as never),
        responseStatus: response.statusCode,
      }
    },
    { optional: true },
  )

  if (result) {
    await writeProviderCache(ctx, claim, result, {
      kind: "pagespeed",
      provider: "pagespeed",
      operation: `run_${strategy}_pagespeed`,
      normalizedUrl: normalizedTarget,
    })
  }
  return result
}

async function lookupBusinessData(ctx: ActionCtx, claim: Claim, businessName: string | undefined) {
  const query = [businessName, claim.domain].filter(Boolean).join(" ").trim() || claim.domain
  const cached = await readProviderCache<ReturnType<typeof normalizeBusinessResult>>(ctx, claim, {
    kind: "business_data",
    provider: "other",
    operation: `business:${query.toLowerCase()}`,
  })
  if (cached) return cached

  const local = env.LOCAL_BUSINESS_DATA_API_KEY
    ? await runProviderAttempt(
        ctx,
        claim,
        "local_business_data",
        "search_business_data",
        `local_business_data:${query}`,
        async () => {
          const url = new URL("https://local-business-data.p.rapidapi.com/search")
          url.searchParams.set("query", query)
          url.searchParams.set("limit", "5")
          const response = await requestJson<any>(url.toString(), {
            timeoutMs: 20_000,
            bodyLimitBytes: 1_000_000,
            maxRedirects: 3,
            headers: {
              accept: "application/json",
              "X-RapidAPI-Key": env.LOCAL_BUSINESS_DATA_API_KEY ?? "",
              "X-RapidAPI-Host": "local-business-data.p.rapidapi.com",
            },
          })

          if (response.statusCode >= 400) {
            throw new ProviderFetchError(
              `HTTP_${response.statusCode}`,
              `Business data lookup failed with ${response.statusCode}`,
              {
                retryable: response.statusCode === 408 || response.statusCode === 429 || response.statusCode >= 500,
                statusCode: response.statusCode,
                retryAfterMs: parseRetryAfter(response.headers["retry-after"]),
              },
            )
          }

          const normalized = normalizeBusinessResult(response.json, query, "local_business_data")
          return {
            value: normalized,
            responseStatus: response.statusCode,
          }
        },
        { optional: true },
      )
    : null

  if (local) {
    await writeProviderCache(ctx, claim, local, {
      kind: "business_data",
      provider: "other",
      operation: `business:${query.toLowerCase()}`,
    })
    return local
  }

  if (!env.GOOGLE_PLACES_API_KEY) {
    return null
  }

  const google = await runProviderAttempt(
    ctx,
    claim,
    "google_places",
    "search_business_data",
    `google_places:${query}`,
    async () => {
      const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json")
      url.searchParams.set("query", query)
      url.searchParams.set("key", env.GOOGLE_PLACES_API_KEY ?? "")
      const response = await requestJson<any>(url.toString(), {
        timeoutMs: 20_000,
        bodyLimitBytes: 1_000_000,
        maxRedirects: 3,
        headers: {
          accept: "application/json",
        },
      })

      if (response.statusCode >= 400) {
        throw new ProviderFetchError(`HTTP_${response.statusCode}`, `Google Places failed with ${response.statusCode}`, {
          retryable: response.statusCode === 408 || response.statusCode === 429 || response.statusCode >= 500,
          statusCode: response.statusCode,
          retryAfterMs: parseRetryAfter(response.headers["retry-after"]),
        })
      }

      const body = response.json as { status?: string; error_message?: string }
      if (body.status && body.status !== "OK" && body.status !== "ZERO_RESULTS") {
        throw new ProviderFetchError(`GOOGLE_${body.status}`, body.error_message ?? "Google Places returned an error", {
          retryable: body.status === "OVER_QUERY_LIMIT" || body.status === "RESOURCE_EXHAUSTED",
        })
      }

      return {
        value: normalizeBusinessResult(response.json, query, "google_places"),
        responseStatus: response.statusCode,
      }
    },
    { optional: true },
  )
  if (google) {
    await writeProviderCache(ctx, claim, google, {
      kind: "business_data",
      provider: "other",
      operation: `business:${query.toLowerCase()}`,
    })
  }
  return google
}

function normalizeBusinessResult(payload: unknown, query: string, sourceProvider: string) {
  const data = payload as {
    results?: Array<{
      place_id?: string
      name?: string
      formatted_address?: string
      website?: string
      international_phone_number?: string
      phone_number?: string
      rating?: number
      user_ratings_total?: number
      types?: string[]
      geometry?: { location?: { lat?: number; lng?: number } }
    }>
    data?: Array<{
      id?: string
      name?: string
      address?: string
      website?: string
      phone?: string
      rating?: number
      review_count?: number
      categories?: string[]
      latitude?: number
      longitude?: number
    }>
  }

  const candidate = (data.results?.[0] ?? data.data?.[0] ?? null) as any

  if (!candidate) {
    return null
  }

  const categories = "types" in candidate ? candidate.types : candidate.categories
  const latitude =
    "geometry" in candidate ? candidate.geometry?.location?.lat : candidate.latitude
  const longitude =
    "geometry" in candidate ? candidate.geometry?.location?.lng : candidate.longitude

  return {
    sourceProvider,
    sourceId: "place_id" in candidate ? candidate.place_id : candidate.id,
    query,
    name: candidate.name,
    websiteUrl: candidate.website,
    normalizedWebsiteUrl: candidate.website
      ? (() => {
          try {
            return normalizeUrlForAudit(candidate.website)
          } catch {
            return undefined
          }
        })()
      : undefined,
    address: "formatted_address" in candidate ? candidate.formatted_address : candidate.address,
    phone:
      candidate.international_phone_number ??
      candidate.formatted_phone_number ??
      candidate.phone_number ??
      candidate.phone,
    categories,
    rating: candidate.rating,
    reviewCount: "user_ratings_total" in candidate ? candidate.user_ratings_total : candidate.review_count,
    latitude,
    longitude,
    provenance: sourceProvider,
  }
}

function validateScreenshotBytes(buffer: Buffer, contentTypeHeader: string | string[] | undefined) {
  const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader
  const firstBytes = buffer.subarray(0, 12)

  if (contentType?.includes("image/svg") || contentType?.includes("text/html")) {
    throw new ProviderFetchError("INVALID_SCREENSHOT", "Der Screenshot war kein Bild.", { retryable: false })
  }

  const isPng = firstBytes.length >= 8 && firstBytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const isJpeg = firstBytes.length >= 3 && firstBytes[0] === 0xff && firstBytes[1] === 0xd8 && firstBytes[2] === 0xff
  const isWebp =
    firstBytes.length >= 12 &&
    firstBytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    firstBytes.subarray(8, 12).toString("ascii") === "WEBP"

  if (isPng) {
    return "image/png"
  }
  if (isJpeg) {
    return "image/jpeg"
  }
  if (isWebp) {
    return "image/webp"
  }

  if (contentType?.startsWith("image/")) {
    return contentType
  }

  throw new ProviderFetchError("INVALID_SCREENSHOT", "Der Screenshot war kein Bild.", { retryable: false })
}

async function storeScreenshot(
  ctx: ActionCtx,
  claim: Claim,
  storageId: Id<"_storage">,
  type: "desktop_screenshot" | "mobile_screenshot",
  mimeType: string,
  auditCacheEntryId?: Id<"auditCacheEntries">,
) {
  try {
    await ctx.runMutation(internal.audit_state.storeAuditAsset, {
      workspaceId: claim.workspaceId,
      auditId: claim.auditId,
      auditCacheEntryId,
      type,
      storageId,
      storageProvider: "convex",
      mimeType,
    })
  } catch (error) {
    if (!auditCacheEntryId) await ctx.storage.delete(storageId)
    throw error
  }
}

export const processAuditPipeline = internalAction({
  args: {
    auditId: v.id("audits"),
  },
  handler: async (ctx, args) => {
    const claim: Claim | null = await ctx.runMutation(internal.audit_state.claimAuditPipelineWork, {
      auditId: args.auditId,
    })

    if (!claim) {
      return null
    }

    try {
      const plan = getAuditPipelinePlan(claim.auditType)
      const primaryFetch = await fetchPrimaryHtml(ctx, claim)

    const primaryOrigin = new URL(primaryFetch.finalUrl).origin
    const primarySignals =
      primaryFetch.sourceProvider === "firecrawl" && !primaryFetch.html
        ? extractSignalsFromMarkdown(primaryFetch.markdown, primaryOrigin)
        : extractSignalsFromHtml(primaryFetch.html, primaryFetch.finalUrl, primaryOrigin)

    await ctx.runMutation(internal.audit_state.advanceAuditPipelineStage, {
      auditId: claim.auditId,
      leaseToken: claim.leaseToken,
      stage: "extracting_content",
      status: "extracting_content",
      statusMessage: "Inhalte werden extrahiert",
    })

    await ctx.runMutation(internal.audit_state.upsertAuditRawData, {
      workspaceId: claim.workspaceId,
      auditId: claim.auditId,
      httpStatus: primaryFetch.httpStatus,
      finalUrl: primaryFetch.finalUrl,
      sourceProvider: primaryFetch.sourceProvider,
      sourceUrl: primaryFetch.finalUrl,
      title: primarySignals.title,
      metaDescription: primarySignals.metaDescription,
      openGraphTitle: primarySignals.openGraphTitle,
      openGraphDescription: primarySignals.openGraphDescription,
      openGraphImage: primarySignals.openGraphImage,
      h1Texts: primarySignals.h1Texts,
      h2Texts: primarySignals.h2Texts,
      canonicalUrl: primarySignals.canonicalUrl,
      robotsFound: primarySignals.robotsFound,
      sitemapFound: primarySignals.sitemapFound,
      schemaTypes: primarySignals.schemaTypes,
      phoneNumbers: primarySignals.phoneNumbers,
      emailAddresses: primarySignals.emailAddresses,
      contactLinks: primarySignals.contactLinks,
      internalLinks: primarySignals.internalLinks,
      externalLinks: primarySignals.externalLinks,
      privacyLinkFound: primarySignals.privacyLinkFound,
      imprintLinkFound: primarySignals.imprintLinkFound,
      ctaCandidates: primarySignals.ctaCandidates,
      extractedMarkdown: primarySignals.extractedMarkdown,
      imageCount: primarySignals.imageCount,
      imagesMissingAltCount: primarySignals.imagesMissingAltCount,
      phoneLinkFound: primarySignals.phoneLinkFound,
      contactFormFound: primarySignals.contactFormFound,
      viewportMetaFound: primarySignals.viewportMetaFound,
    })

    const homeUrl = new URL(primaryFetch.finalUrl)
    const firecrawlScrapeLinks = primaryFetch.sourceProvider === "firecrawl" ? primaryFetch.links : []
    const firecrawlMappedLinks =
      plan.maxPages > 1 ? await mapWithFirecrawl(ctx, claim, homeUrl.toString()) : []
    const discoveredInternalLinks = [
      ...primarySignals.internalLinks,
      ...firecrawlScrapeLinks,
      ...firecrawlMappedLinks,
    ]
    const prioritizedPages = pickPriorityPages(homeUrl.toString(), discoveredInternalLinks, plan.maxPages)

    const additionalPages = await Promise.allSettled(
      prioritizedPages.slice(1).map((page, index) =>
        fetchPriorityPage(ctx, claim, page.url, index + 1, page.kind),
      ),
    )

    const selectedPages = [
      {
        pageIndex: 0,
        kind: "primary",
        url: homeUrl.toString(),
        normalizedUrl: normalizeUrlForAudit(homeUrl.toString()),
        httpStatus: primaryFetch.httpStatus,
        finalUrl: primaryFetch.finalUrl,
        title: primarySignals.title,
        metaDescription: primarySignals.metaDescription,
        sourceProvider: primaryFetch.sourceProvider,
        sourceUrl: primaryFetch.finalUrl,
      },
      ...additionalPages.flatMap((result, offset) => {
        if (result.status !== "fulfilled" || !result.value) {
          return []
        }
        const page = result.value
        const pageOrigin = new URL(page.finalUrl).origin
        const pageSignals = page.html
          ? extractSignalsFromHtml(page.html, page.finalUrl, pageOrigin)
          : extractSignalsFromMarkdown(page.markdown ?? "", pageOrigin)
        return [
          {
            pageIndex: page.pageIndex,
            kind: page.kind,
            url: page.url,
            normalizedUrl: page.normalizedUrl,
            httpStatus: page.httpStatus,
            finalUrl: page.finalUrl,
            title: pageSignals.title,
            metaDescription: pageSignals.metaDescription,
            sourceProvider: page.sourceProvider,
            sourceUrl: page.finalUrl,
          },
        ]
      }),
    ]

    await Promise.all(
      selectedPages.map((page) =>
        ctx.runMutation(internal.audit_state.upsertAuditPage, {
          workspaceId: claim.workspaceId,
          auditId: claim.auditId,
          pageIndex: page.pageIndex,
          kind: page.kind,
          url: page.url,
          normalizedUrl: page.normalizedUrl,
          httpStatus: page.httpStatus,
          finalUrl: page.finalUrl,
          title: page.title,
          metaDescription: page.metaDescription,
          sourceProvider: page.sourceProvider,
          sourceUrl: page.sourceUrl,
        }),
      ),
    )

    await ctx.runMutation(internal.audit_state.advanceAuditPipelineStage, {
      auditId: claim.auditId,
      leaseToken: claim.leaseToken,
      stage: "taking_screenshots",
      status: "taking_screenshots",
      statusMessage: "Screenshots werden erstellt",
    })

    const screenshotTasks = plan.screenshotViewports.map((viewport) =>
      captureScreenshotWithFirecrawl(
        ctx,
        claim,
        selectedPages[0]?.finalUrl ?? claim.normalizedUrl,
        viewport,
        `firecrawl:screenshot:${viewport}:${selectedPages[0]?.finalUrl ?? claim.normalizedUrl}`,
      ),
    )

    await ctx.runMutation(internal.audit_state.advanceAuditPipelineStage, {
      auditId: claim.auditId,
      leaseToken: claim.leaseToken,
      stage: "running_performance_checks",
      status: "running_performance_checks",
      statusMessage: "PageSpeed wird geprüft",
    })

    const performanceTasks = plan.performanceStrategies.map(async (strategy) => {
      const result = await runPageSpeedAnalysis(ctx, claim, selectedPages[0]?.finalUrl ?? claim.normalizedUrl, strategy)
      if (!result) {
        return null
      }
      await ctx.runMutation(internal.audit_state.upsertAuditPerformance, {
        workspaceId: claim.workspaceId,
        auditId: claim.auditId,
        strategy,
        performanceScore: result.performanceScore,
        accessibilityScore: result.accessibilityScore,
        bestPracticesScore: result.bestPracticesScore,
        seoScore: result.seoScore,
        lcp: result.lcp,
        cls: result.cls,
        fcp: result.fcp,
        speedIndex: result.speedIndex,
      })
      return result
    })

    await ctx.runMutation(internal.audit_state.advanceAuditPipelineStage, {
      auditId: claim.auditId,
      leaseToken: claim.leaseToken,
      stage: "fetching_business_data",
      status: "fetching_business_data",
      statusMessage: "Externe Prüfungen werden finalisiert",
    })

    const businessTask = plan.useBusinessData
      ? lookupBusinessData(ctx, claim, primarySignals.title ?? claim.domain).then(async (result) => {
          if (!result) {
            return null
          }
          await ctx.runMutation(internal.audit_state.upsertAuditBusinessData, {
            workspaceId: claim.workspaceId,
            auditId: claim.auditId,
            ...result,
          })
          return result
        }).catch((error) => {
          console.warn(
            "Business lookup failed",
            redactSensitiveText(error instanceof Error ? error.message : String(error)),
          )
          return null
        })
      : Promise.resolve(null)

    const screenshotResults = await Promise.allSettled(screenshotTasks)
    const performanceResults = await Promise.allSettled(performanceTasks)
    const businessResult = await businessTask

    for (const result of screenshotResults) {
      if (result.status === "rejected") {
        console.warn("Screenshot failed", redactSensitiveText(result.reason instanceof Error ? result.reason.message : String(result.reason)))
      } else if (result.value) {
        await storeScreenshot(
          ctx,
          claim,
          result.value.storageId,
          result.value.viewport === "desktop" ? "desktop_screenshot" : "mobile_screenshot",
          result.value.mimeType,
          result.value.auditCacheEntryId,
        )
      }
    }

    for (const result of performanceResults) {
      if (result.status === "rejected") {
        console.warn("PageSpeed failed", redactSensitiveText(result.reason instanceof Error ? result.reason.message : String(result.reason)))
      }
    }

    if (businessResult === null) {
      // no-op, optional provider failed or was unavailable
    }

    console.log("[audit_pipeline] finishing pipeline", {
      auditId: claim.auditId,
      leaseToken: claim.leaseToken,
    })

    const finishResult = await ctx.runMutation(internal.audit_state.finishAuditPipeline, {
      auditId: claim.auditId,
      leaseToken: claim.leaseToken,
      statusMessage: "Deterministische Checks werden vorbereitet",
    })

    console.log("[audit_pipeline] finish result", {
      auditId: claim.auditId,
      finishResult,
    })

    if (finishResult) {
      console.log("[audit_pipeline] scheduling deterministic scoring", {
        auditId: claim.auditId,
      })
      try {
        await ctx.scheduler.runAfter(0, internal.audit_scoring.processDeterministicScoring, {
          auditId: claim.auditId,
        })
        console.log("[audit_pipeline] scoring scheduled successfully", {
          auditId: claim.auditId,
        })
      } catch (error) {
        console.error("[audit_pipeline] failed to schedule scoring", {
          auditId: claim.auditId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    } else {
      console.warn("[audit_pipeline] finishAuditPipeline returned null, not scheduling scoring", {
        auditId: claim.auditId,
      })
    }

    return null
    } catch (error) {
      const safe = sanitizeError(error)
      console.error("[audit_pipeline] pipeline failed", {
        auditId: claim.auditId,
        code: safe.code,
        message: safe.message,
      })
      try {
        await ctx.runMutation(internal.audit_state.failAuditPipeline, {
          auditId: claim.auditId,
          leaseToken: claim.leaseToken,
          errorCode: safe.code,
          errorMessage: safe.message,
        })
      } catch (failError) {
        console.error("[audit_pipeline] failed to mark audit as failed", {
          auditId: claim.auditId,
          error: failError instanceof Error ? failError.message : String(failError),
        })
      }
      return null
    }
  },
})
