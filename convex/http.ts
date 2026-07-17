import { httpRouter } from "convex/server"

import { authComponent, createAuth } from "./auth"
import { api, internal } from "./_generated/api"
import { env, httpAction, type ActionCtx } from "./_generated/server"
import { timingSafeHexEqual } from "./lib/lemonsqueezy"
import { isJsonContentType, readLimitedRequestText } from "./lib/webhook_request"
import {
  encodeAuditListCursor,
  isValidIdempotencyKey,
  OPENAPI_V1,
  parseAuditListRequest,
  parseCreateAuditBody,
  PUBLIC_API_BODY_LIMIT_BYTES,
} from "./lib/public_api_contract"
import { sha256Base64Url } from "./lib/integration_crypto"
import { buildCanonicalReportUrl } from "./lib/report_url"
import { parseEvalIngestPayload, verifyEvalIngestSignature } from "./lib/eval_ingest"
import { normalizeAuditUrl } from "./lib/audit_url"

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function sha256(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))
}

async function hmacSha256(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)))
}

const http = httpRouter()

function jsonResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    },
  })
}

function apiError(code: string, message: string, status: number, extraHeaders?: Record<string, string>) {
  return jsonResponse({ error: { code, message } }, status, extraHeaders)
}

function convexErrorData(error: unknown): { code?: string; retryAfter?: number } {
  if (!error || typeof error !== "object") return {}
  const candidate = error as { data?: unknown }
  if (!candidate.data || typeof candidate.data !== "object") return {}
  const data = candidate.data as { code?: unknown; retryAfter?: unknown }
  return {
    code: typeof data.code === "string" ? data.code : undefined,
    retryAfter: typeof data.retryAfter === "number" ? data.retryAfter : undefined,
  }
}

function mapPublicApiError(error: unknown) {
  const data = convexErrorData(error)
  const code = data.code ?? "INTERNAL_ERROR"
  if (code === "INVALID_API_KEY" || code === "UNAUTHENTICATED") {
    return apiError("invalid_api_key", "Invalid or revoked API key", 401)
  }
  if (code === "INSUFFICIENT_CREDITS") return apiError("insufficient_credits", "No credits available", 402)
  if (code === "INSUFFICIENT_SCOPE") return apiError("insufficient_scope", "API key scope is missing", 403)
  if (code === "PLAN_UPGRADE_REQUIRED" || code === "FORBIDDEN") return apiError("forbidden", "The requested operation is not available", 403)
  if (code === "IDEMPOTENCY_CONFLICT" || code === "AUDIT_CONTEXT_MISMATCH") return apiError("idempotency_conflict", "Idempotency key belongs to another payload", 409)
  if (code === "RATE_LIMITED") {
    const seconds = Math.max(1, Math.ceil((data.retryAfter ?? 1_000) / 1_000))
    return apiError("rate_limited", "Too many requests", 429, { "retry-after": String(seconds) })
  }
  if (code === "PUBLIC_API_DISABLED") return apiError("service_unavailable", "The public API is disabled", 503)
  if (["INVALID_URL", "UNSAFE_URL", "URL_UNRESOLVABLE", "VALIDATION_ERROR"].includes(code)) {
    return apiError("validation_error", "The request payload is invalid", 422)
  }
  return apiError("internal_error", "The request could not be completed", 500)
}

function bearerToken(request: Request) {
  const match = /^Bearer\s+([^\s]+)$/i.exec(request.headers.get("authorization") ?? "")
  return match?.[1] ?? null
}

async function authenticatePublicApi(
  ctx: ActionCtx,
  request: Request,
  requiredScope: "audits:create" | "audits:read" | "reports:read" | "usage:read",
) {
  const rawKey = bearerToken(request)
  if (!rawKey) throw { data: { code: "INVALID_API_KEY" } }
  return await ctx.runMutation(internal.api_keys.authenticateApiKey, { rawKey, requiredScope })
}

authComponent.registerRoutesLazy(http, createAuth, {
  basePath: "/api/auth",
  cors: true,
})

http.route({
  path: "/api/v1/openapi.json",
  method: "GET",
  handler: httpAction(async () => jsonResponse(OPENAPI_V1, 200, { "cache-control": "public, max-age=300" })),
})

http.route({
  path: "/api/v1/audits",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!isJsonContentType(request.headers.get("content-type"))) {
      return apiError("unsupported_media_type", "Content-Type must be application/json", 415)
    }
    const bodyText = await readLimitedRequestText(request, PUBLIC_API_BODY_LIMIT_BYTES)
    if (bodyText === null) return apiError("payload_too_large", "Request body exceeds 16 KiB", 413)
    const idempotencyKey = request.headers.get("idempotency-key")
    if (!isValidIdempotencyKey(idempotencyKey)) {
      return apiError("invalid_idempotency_key", "A valid Idempotency-Key header is required", 422)
    }
    let decoded: unknown
    try {
      decoded = JSON.parse(bodyText)
    } catch {
      return apiError("validation_error", "Request body is not valid JSON", 422)
    }
    const body = parseCreateAuditBody(decoded)
    if (!body) return apiError("validation_error", "The request payload is invalid", 422)
    try {
      const principal = await authenticatePublicApi(ctx, request, "audits:create")
      const normalizedForHash = normalizeAuditUrl(body.url)
      const canonicalBody = {
        ...body,
        url: "code" in normalizedForHash ? body.url : normalizedForHash.normalizedUrl,
      }
      const [idempotencyKeyHash, payloadHash] = await Promise.all([
        sha256Base64Url(idempotencyKey),
        sha256Base64Url(JSON.stringify(canonicalBody)),
      ])
      const result = await ctx.runAction(internal.public_api.createAudit, {
        workspaceId: principal.workspaceId,
        userId: principal.userId,
        apiKeyId: principal.apiKeyId,
        idempotencyKeyHash,
        payloadHash,
        url: body.url,
        auditType: body.audit_type,
        reportLanguage: body.report_language,
        publishRequested: body.publish_report,
      })
      if (!result.externalAuditId) return apiError("internal_error", "The audit could not be created", 500)
      return jsonResponse({
        audit_id: result.externalAuditId,
        status: result.status,
        domain: result.domain,
        status_url: new URL(`/api/v1/audits/${result.externalAuditId}`, request.url).toString(),
        report_url: new URL(`/api/v1/audits/${result.externalAuditId}/report`, request.url).toString(),
      }, 202, { location: `/api/v1/audits/${result.externalAuditId}` })
    } catch (error) {
      return mapPublicApiError(error)
    }
  }),
})

http.route({
  path: "/api/v1/audits",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const principal = await authenticatePublicApi(ctx, request, "audits:read")
      const parsed = parseAuditListRequest(request.url)
      if (!parsed.ok) return apiError("validation_error", "The query parameters are invalid", 422)
      const result = await ctx.runQuery(internal.public_api.listAudits, {
        workspaceId: principal.workspaceId,
        paginationOpts: { numItems: parsed.value.limit, cursor: parsed.value.convexCursor },
        status: parsed.value.status,
        createdAfter: parsed.value.createdAfter,
        createdBefore: parsed.value.createdBefore,
      })
      return jsonResponse({
        items: result.page,
        has_more: !result.isDone,
        next_cursor: result.isDone
          ? null
          : encodeAuditListCursor(result.continueCursor, parsed.value.fingerprint),
      })
    } catch (error) {
      return mapPublicApiError(error)
    }
  }),
})

http.route({
  path: "/api/v1/usage",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const principal = await authenticatePublicApi(ctx, request, "usage:read")
      const usage = await ctx.runQuery(internal.public_api.getUsage, {
        workspaceId: principal.workspaceId,
      })
      return usage ? jsonResponse(usage) : apiError("not_found", "Resource not found", 404)
    } catch (error) {
      return mapPublicApiError(error)
    }
  }),
})

http.route({
  pathPrefix: "/api/v1/audits/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const path = new URL(request.url).pathname.slice("/api/v1/audits/".length)
    const segments = path.split("/").filter(Boolean)
    const externalAuditId = segments[0]
    const isReport = segments.length === 2 && segments[1] === "report"
    if (!externalAuditId || !/^aud_[A-Za-z0-9_-]{16,64}$/.test(externalAuditId) || (segments.length > 1 && !isReport)) {
      return apiError("not_found", "Resource not found", 404)
    }
    try {
      const principal = await authenticatePublicApi(ctx, request, isReport ? "reports:read" : "audits:read")
      if (!isReport) {
        const audit = await ctx.runQuery(internal.public_api.getAuditStatus, {
          workspaceId: principal.workspaceId,
          externalAuditId,
        })
        return audit ? jsonResponse(audit) : apiError("not_found", "Resource not found", 404)
      }
      const report = await ctx.runQuery(internal.public_api.getAuditReportMetadata, {
        workspaceId: principal.workspaceId,
        externalAuditId,
      })
      if (!report) return apiError("not_found", "Resource not found", 404)
      if (!report.ready) return apiError("report_not_ready", "Report is not ready", 409)
      const publicUrl = report.public_slug && env.SITE_URL
        ? buildCanonicalReportUrl(env.SITE_URL, report.public_slug)
        : null
      const { public_slug: _publicSlug, ...safeReport } = report
      return jsonResponse({ ...safeReport, public_url: publicUrl })
    } catch (error) {
      return mapPublicApiError(error)
    }
  }),
})

http.route({
  path: "/api/internal/evals",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (env.EVE_EVALS_ENABLED !== "true" && env.EVE_EVALS_ENABLED !== "1") {
      return apiError("service_unavailable", "Eval ingestion is disabled", 503)
    }
    const secret = env.EVE_EVAL_REPORTER_SECRET
    if (!secret) return apiError("service_unavailable", "Eval ingestion is not configured", 503)
    if (!isJsonContentType(request.headers.get("content-type"))) {
      return apiError("unsupported_media_type", "Content-Type must be application/json", 415)
    }
    const body = await readLimitedRequestText(request)
    if (body === null) return apiError("payload_too_large", "Eval payload is too large", 413)
    const validSignature = await verifyEvalIngestSignature({
      body,
      timestamp: request.headers.get("x-sitepitch-eval-timestamp"),
      signature: request.headers.get("x-sitepitch-eval-signature"),
      secret,
    })
    if (!validSignature) return apiError("invalid_signature", "Invalid eval reporter signature", 401)
    try {
      const payload = parseEvalIngestPayload(body)
      const result = await ctx.runMutation(internal.eve_evals.ingestEvalRun, payload)
      return jsonResponse({ accepted: true, duplicate: result.duplicate }, result.duplicate ? 200 : 202)
    } catch {
      return apiError("validation_error", "Eval payload is invalid", 422)
    }
  }),
})

http.route({
  path: "/api/internal/evals/baseline",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (env.EVE_EVALS_ENABLED !== "true" && env.EVE_EVALS_ENABLED !== "1") {
      return apiError("service_unavailable", "Eval baseline is disabled", 503)
    }
    const secret = env.EVE_EVAL_REPORTER_SECRET
    if (!secret) return apiError("service_unavailable", "Eval baseline is not configured", 503)
    const validSignature = await verifyEvalIngestSignature({
      body: "",
      timestamp: request.headers.get("x-sitepitch-eval-timestamp"),
      signature: request.headers.get("x-sitepitch-eval-signature"),
      secret,
    })
    if (!validSignature) return apiError("invalid_signature", "Invalid eval reporter signature", 401)
    const baseline = await ctx.runQuery(internal.eve_evals.getReleasedBaseline, {})
    return jsonResponse({ baseline })
  }),
})

http.route({
  path: "/api/integrations/oauth/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")
    const providerError = url.searchParams.get("error")
    const destination = new URL("/app/settings/integrations", env.SITE_URL ?? url.origin)
    if (!code || !state || providerError) {
      destination.searchParams.set("oauth", "error")
      return Response.redirect(destination, 302)
    }
    try {
      const result = await ctx.runAction(internal.integration_actions.exchangeOAuthCallback, { code, state })
      destination.searchParams.set("oauth", "connected")
      destination.searchParams.set("provider", result.provider)
    } catch {
      destination.searchParams.set("oauth", "error")
    }
    return Response.redirect(destination, 302)
  }),
})

http.route({
  path: "/api/webhooks/lemonsqueezy",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = env.LEMONSQUEEZY_WEBHOOK_SECRET
    if (!secret) return new Response("Webhook not configured", { status: 503 })
    if (!isJsonContentType(request.headers.get("content-type"))) {
      return new Response("Unsupported media type", { status: 415 })
    }
    const body = await readLimitedRequestText(request)
    if (body === null) return new Response("Payload too large", { status: 413 })
    const signature = request.headers.get("x-signature") ?? ""
    const expected = await hmacSha256(body, secret)
    if (!timingSafeHexEqual(signature, expected)) return new Response("Invalid signature", { status: 401 })

    try {
      JSON.parse(body)
      // The signature covers the body, not arbitrary transport headers. Using the
      // signed body hash makes replay deduplication impossible to bypass by changing
      // an unsigned event-id header.
      const providerEventId = await sha256(body)
      await ctx.runMutation(internal.billing.processWebhook, { providerEventId, payload: body })
      return new Response("OK", { status: 200 })
    } catch {
      return new Response("Invalid webhook", { status: 400 })
    }
  }),
})

http.route({
  path: "/reports/pdf",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url)
    const slug = url.searchParams.get("slug")?.trim()
    if (!slug) return new Response("Not found", { status: 404 })
    const authorization = request.headers.get("authorization")
    const grantToken = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim() || undefined
      : undefined
    const reportHost = request.headers.get("x-report-host") ?? undefined
    const download = await ctx.runQuery(internal.report_pdf.getPublicPdfDownloadContext, {
      slug,
      host: reportHost,
      grantToken,
    })
    if (!download) {
      return new Response("Not found", {
        status: 404,
        headers: { "X-Robots-Tag": "noindex, nofollow, noarchive" },
      })
    }
    const file = await fetch(download.downloadUrl)
    if (!file.ok || !file.body) return new Response("Not found", { status: 404 })
    await ctx.runMutation(api.reports.recordPublicReportPdfExport, {
      slug,
      host: reportHost,
      grantToken,
    })
    const asciiFilename = download.filename.replace(/[^a-zA-Z0-9._-]/g, "-")
    return new Response(file.body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${asciiFilename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    })
  }),
})

export default http
