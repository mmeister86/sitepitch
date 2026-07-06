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
import { validatePublicAuditTarget } from "./lib/audit_url"
import {
  extractSignalsFromHtml,
  extractSignalsFromMarkdown,
  getAuditPipelinePlan,
  normalizeUrlForAudit,
  pickPriorityPages,
  redactSensitiveText,
  sameOrigin,
} from "./lib/audit_pipeline"

type Claim = {
  auditId: Id<"audits">
  workspaceId: Id<"workspaces">
  leaseToken: string
  leaseExpiresAt: number
  url: string
  normalizedUrl: string
  domain: string
  auditType: "quick" | "standard" | "local"
  reportLanguage: "de" | "en"
  idempotencyKey: string
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
      sourceProvider: "jina"
      markdown: string
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
  provider: "direct_html" | "jina" | "screenshotone" | "pagespeed" | "local_business_data" | "google_places",
  operation: string,
  requestEvidence: string,
  attemptFn: (attempt: number) => Promise<{ value: T; responseStatus?: number }>,
  options: { optional?: boolean } = {},
): Promise<T | null> {
  let lastError: ProviderFetchError | null = null

  for (let attempt = 1; attempt <= 2; attempt++) {
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

async function fetchPrimaryHtml(ctx: ActionCtx, claim: Claim): Promise<PrimaryFetchResult> {
  const directEvidence = `direct_html:${claim.normalizedUrl}`
  try {
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
      return directResult
    }
    throw new ProviderFetchError("EMPTY_RESPONSE", "HTML fetch returned no content.", { retryable: false })
  } catch (error) {
    const directError = error instanceof Error ? error : new Error("HTML fetch failed")
    const jinaUrl = `https://r.jina.ai/http://${claim.normalizedUrl.replace(/^https?:\/\//, "")}`
    const jinaEvidence = `jina:${jinaUrl}`

    try {
      const jinaResult = await runProviderAttempt(
        ctx,
        claim,
        "jina",
        "fetch_homepage_markdown",
        jinaEvidence,
        async () => {
          const response = await requestText(jinaUrl, {
            timeoutMs: 30_000,
            bodyLimitBytes: 2_000_000,
            maxRedirects: 5,
            headers: {
              accept: "text/plain,text/markdown,text/html;q=0.5,*/*;q=0.2",
            },
          })

          if (response.statusCode >= 400) {
            const retryAfterMs = parseRetryAfter(response.headers["retry-after"])
            throw new ProviderFetchError(
              `HTTP_${response.statusCode}`,
              `Jina fallback failed with ${response.statusCode}`,
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
              sourceProvider: "jina" as const,
              markdown: response.text,
            },
            responseStatus: response.statusCode,
          }
        },
      )

      if (jinaResult) {
        return jinaResult
      }
    } catch {
      // fall through to the direct HTML error below
    }

    throw directError
  }
}

async function fetchPriorityPage(ctx: ActionCtx, claim: Claim, url: string, pageIndex: number, kind: string) {
  return await runProviderAttempt(
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

async function captureScreenshot(
  ctx: ActionCtx,
  claim: Claim,
  targetUrl: string,
  viewport: "desktop" | "mobile",
  requestEvidence: string,
) {
  if (!env.SCREENSHOTONE_API_KEY) {
    return null
  }

  return await runProviderAttempt(
    ctx,
    claim,
    "screenshotone",
    `capture_${viewport}_screenshot`,
    requestEvidence,
    async () => {
      const screenshotUrl = new URL("https://api.screenshotone.com/take")
      screenshotUrl.searchParams.set("access_key", env.SCREENSHOTONE_API_KEY ?? "")
      screenshotUrl.searchParams.set("url", targetUrl)
      screenshotUrl.searchParams.set("format", "png")
      screenshotUrl.searchParams.set("full_page", "true")
      screenshotUrl.searchParams.set("device_scale_factor", "1")
      screenshotUrl.searchParams.set("viewport_width", viewport === "mobile" ? "390" : "1440")
      screenshotUrl.searchParams.set("viewport_height", viewport === "mobile" ? "844" : "900")

      const response = await requestWithRedirects(screenshotUrl.toString(), {
        timeoutMs: 45_000,
        bodyLimitBytes: 10_000_000,
        maxRedirects: 3,
        headers: {
          accept: "image/png,image/jpeg,image/webp,*/*;q=0.2",
        },
      })

      if (response.statusCode >= 400) {
        throw new ProviderFetchError(`HTTP_${response.statusCode}`, `Screenshot failed with ${response.statusCode}`, {
          retryable: response.statusCode === 408 || response.statusCode === 429 || response.statusCode >= 500,
          statusCode: response.statusCode,
          retryAfterMs: parseRetryAfter(response.headers["retry-after"]),
        })
      }

      const mimeType = validateScreenshotBytes(response.body, response.headers["content-type"])
      const arrayBuffer = response.body.buffer.slice(
        response.body.byteOffset,
        response.body.byteOffset + response.body.byteLength,
      ) as ArrayBuffer
      const storageId = await ctx.storage.store(new Blob([arrayBuffer as ArrayBuffer], { type: mimeType }))

      return {
        value: {
          viewport,
          storageId,
          mimeType,
        },
        responseStatus: response.statusCode,
      }
    },
    { optional: true },
  )
}

async function runPageSpeedAnalysis(ctx: ActionCtx, claim: Claim, targetUrl: string, strategy: "mobile" | "desktop") {
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

  return result
}

async function lookupBusinessData(ctx: ActionCtx, claim: Claim, businessName: string | undefined) {
  const query = [businessName, claim.domain].filter(Boolean).join(" ").trim() || claim.domain

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
    return local
  }

  if (!env.GOOGLE_PLACES_API_KEY) {
    return null
  }

  return await runProviderAttempt(
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
) {
  await ctx.runMutation(internal.audit_state.storeAuditAsset, {
    workspaceId: claim.workspaceId,
    auditId: claim.auditId,
    type,
    storageId,
    storageProvider: "convex",
    mimeType,
  })
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

    const plan = getAuditPipelinePlan(claim.auditType)
    const primaryFetch = await fetchPrimaryHtml(ctx, claim)

    const primarySignals =
      primaryFetch.sourceProvider === "direct_html"
        ? extractSignalsFromHtml(primaryFetch.html, primaryFetch.finalUrl, new URL(primaryFetch.finalUrl).origin)
        : extractSignalsFromMarkdown(primaryFetch.markdown, new URL(claim.normalizedUrl).origin)

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
    const prioritizedPages = pickPriorityPages(homeUrl.toString(), primarySignals.internalLinks, plan.maxPages)

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
        const pageSignals = extractSignalsFromHtml(page.html, page.finalUrl, new URL(page.finalUrl).origin)
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
            sourceProvider: "direct_html" as const,
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
      captureScreenshot(
        ctx,
        claim,
        selectedPages[0]?.finalUrl ?? claim.normalizedUrl,
        viewport,
        `screenshotone:${viewport}:${selectedPages[0]?.finalUrl ?? claim.normalizedUrl}`,
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
      statusMessage: plan.useBusinessData ? "Firmendaten werden geprüft" : "Deterministische Checks werden vorbereitet",
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
  },
})
