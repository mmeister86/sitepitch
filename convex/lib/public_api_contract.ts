export const PUBLIC_API_BODY_LIMIT_BYTES = 16 * 1024
export const PUBLIC_API_CURSOR_LIMIT_BYTES = 8 * 1024

export const PUBLIC_AUDIT_STATUSES = [
  "draft",
  "queued",
  "validating_url",
  "fetching_html",
  "extracting_content",
  "taking_screenshots",
  "running_performance_checks",
  "fetching_business_data",
  "running_deterministic_checks",
  "calculating_scores",
  "generating_findings",
  "generating_outreach",
  "completed",
  "failed",
  "cancelled",
] as const

export type PublicAuditStatus = typeof PUBLIC_AUDIT_STATUSES[number]

export type AuditListFilters = {
  status: PublicAuditStatus | null
  createdAfter: number | null
  createdBefore: number | null
}

export type AuditListRequest = AuditListFilters & {
  limit: number
  convexCursor: string | null
  fingerprint: string
}

type PublicCursor = { v: 1; cursor: string; filter: string }

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function base64UrlDecode(value: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")
    const binary = atob(padded)
    return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)))
  } catch {
    return null
  }
}

function filterFingerprint(filters: AuditListFilters): string {
  return base64UrlEncode(JSON.stringify([
    filters.status,
    filters.createdAfter,
    filters.createdBefore,
  ]))
}

function parseRfc3339(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-](\d{2}):(\d{2}))$/.exec(value)
  if (!match) return null
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number)
  const calendarValue = new Date(Date.UTC(year!, month! - 1, day!, hour!, minute!, second!))
  if (
    calendarValue.getUTCFullYear() !== year
    || calendarValue.getUTCMonth() !== month! - 1
    || calendarValue.getUTCDate() !== day
    || calendarValue.getUTCHours() !== hour
    || calendarValue.getUTCMinutes() !== minute
    || calendarValue.getUTCSeconds() !== second
    || (match[8] !== "Z" && (Number(match[9]) > 23 || Number(match[10]) > 59))
  ) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function decodePublicCursor(value: string, fingerprint: string): string | null {
  if (new TextEncoder().encode(value).byteLength > PUBLIC_API_CURSOR_LIMIT_BYTES) return null
  const decoded = base64UrlDecode(value)
  if (!decoded) return null
  try {
    const cursor = JSON.parse(decoded) as Partial<PublicCursor>
    if (cursor.v !== 1 || typeof cursor.cursor !== "string" || !cursor.cursor || cursor.filter !== fingerprint) return null
    return cursor.cursor
  } catch {
    return null
  }
}

export function encodeAuditListCursor(convexCursor: string, fingerprint: string): string {
  return base64UrlEncode(JSON.stringify({ v: 1, cursor: convexCursor, filter: fingerprint } satisfies PublicCursor))
}

export function parseAuditListRequest(urlValue: string):
  | { ok: true; value: AuditListRequest }
  | { ok: false } {
  const parameters = new URL(urlValue).searchParams
  const allowed = new Set(["limit", "cursor", "status", "created_after", "created_before"])
  for (const key of parameters.keys()) {
    if (!allowed.has(key) || parameters.getAll(key).length !== 1) return { ok: false }
  }

  const rawLimit = parameters.get("limit")
  if (rawLimit !== null && !/^[1-9]\d*$/.test(rawLimit)) return { ok: false }
  const limit = rawLimit === null ? 25 : Number(rawLimit)
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) return { ok: false }

  const rawStatus = parameters.get("status")
  const status = rawStatus === null
    ? null
    : PUBLIC_AUDIT_STATUSES.find((candidate) => candidate === rawStatus) ?? null
  if (rawStatus !== null && status === null) return { ok: false }

  const rawAfter = parameters.get("created_after")
  const rawBefore = parameters.get("created_before")
  const createdAfter = rawAfter === null ? null : parseRfc3339(rawAfter)
  const createdBefore = rawBefore === null ? null : parseRfc3339(rawBefore)
  if ((rawAfter !== null && createdAfter === null) || (rawBefore !== null && createdBefore === null)) return { ok: false }
  if (createdAfter !== null && createdBefore !== null && createdAfter >= createdBefore) return { ok: false }

  const filters = { status, createdAfter, createdBefore }
  const fingerprint = filterFingerprint(filters)
  const rawCursor = parameters.get("cursor")
  const convexCursor = rawCursor === null ? null : decodePublicCursor(rawCursor, fingerprint)
  if (rawCursor !== null && convexCursor === null) return { ok: false }
  return { ok: true, value: { ...filters, limit, convexCursor, fingerprint } }
}

export type CreateAuditBody = {
  url: string
  audit_type: "standard" | "local" | "quick"
  report_language: "de" | "en"
  publish_report: boolean
}

export function parseCreateAuditBody(value: unknown): CreateAuditBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  const allowed = new Set(["url", "audit_type", "report_language", "publish_report"])
  if (Object.keys(body).some((key) => !allowed.has(key))) return null
  if (typeof body.url !== "string" || body.url.trim().length === 0 || body.url.length > 2048) return null
  const auditType = body.audit_type ?? "standard"
  if (auditType !== "standard" && auditType !== "local" && auditType !== "quick") return null
  const reportLanguage = body.report_language ?? "de"
  if (reportLanguage !== "de" && reportLanguage !== "en") return null
  if (body.publish_report !== undefined && typeof body.publish_report !== "boolean") return null
  return {
    url: body.url.trim(),
    audit_type: auditType,
    report_language: reportLanguage,
    publish_report: body.publish_report ?? false,
  }
}

export function isValidIdempotencyKey(value: string | null): value is string {
  return Boolean(value && value.length >= 8 && value.length <= 200 && /^[\x21-\x7E]+$/.test(value))
}

export const OPENAPI_V1 = {
  openapi: "3.1.0",
  info: { title: "SitePitch Public API", version: "1.1.0" },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "spk_<publicId>_<secret>" } },
    schemas: {
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: { code: { type: "string" }, message: { type: "string" } },
          },
        },
      },
      AuditStatus: {
        type: "string",
        enum: PUBLIC_AUDIT_STATUSES,
      },
      Audit: {
        type: "object",
        additionalProperties: false,
        required: ["audit_id", "status", "domain", "audit_type", "report_language", "publish_report", "created_at", "started_at", "completed_at", "error_code"],
        properties: {
          audit_id: { type: "string", pattern: "^aud_" },
          status: { $ref: "#/components/schemas/AuditStatus" },
          domain: { type: "string" },
          audit_type: { type: "string", enum: ["standard", "local", "quick"] },
          report_language: { type: "string", enum: ["de", "en"] },
          publish_report: { type: "boolean" },
          created_at: { type: "string", format: "date-time" },
          started_at: { type: ["string", "null"], format: "date-time" },
          completed_at: { type: ["string", "null"], format: "date-time" },
          error_code: { type: ["string", "null"] },
        },
      },
      Usage: {
        type: "object",
        additionalProperties: false,
        required: ["as_of", "plan", "credits", "audits"],
        properties: {
          as_of: { type: "string", format: "date-time" },
          plan: {
            type: "object",
            required: ["name", "subscription_status", "cancel_at_period_end"],
            properties: {
              name: { type: "string", enum: ["free", "starter", "pro", "agency", "scale"] },
              subscription_status: { type: ["string", "null"], enum: ["active", "trialing", "past_due", "cancelled", "expired", null] },
              cancel_at_period_end: { type: "boolean" },
            },
          },
          credits: {
            type: "object",
            required: ["total", "used", "reserved", "remaining", "monthly", "extra"],
            properties: {
              total: { type: "integer", minimum: 0 },
              used: { type: "integer", minimum: 0 },
              reserved: { type: "integer", minimum: 0 },
              remaining: { type: "integer", minimum: 0 },
              monthly: {
                type: "object",
                required: ["total", "used", "period_start", "period_end"],
                properties: {
                  total: { type: "integer", minimum: 0 },
                  used: { type: "integer", minimum: 0 },
                  period_start: { type: ["string", "null"], format: "date-time" },
                  period_end: { type: ["string", "null"], format: "date-time" },
                },
              },
              extra: {
                type: "object",
                required: ["total", "used"],
                properties: { total: { type: "integer", minimum: 0 }, used: { type: "integer", minimum: 0 } },
              },
            },
          },
          audits: {
            type: "object",
            required: ["total"],
            properties: { total: { type: "integer", minimum: 0 } },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/audits": {
      get: {
        summary: "List audits",
        description: "Requires audits:read. Results are ordered newest first. Time boundaries are exclusive.",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } },
          { name: "cursor", in: "query", schema: { type: "string", maxLength: PUBLIC_API_CURSOR_LIMIT_BYTES } },
          { name: "status", in: "query", schema: { $ref: "#/components/schemas/AuditStatus" } },
          { name: "created_after", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "created_before", in: "query", schema: { type: "string", format: "date-time" } },
        ],
        responses: {
          "200": {
            description: "A page of audits",
            content: { "application/json": { schema: {
              type: "object",
              additionalProperties: false,
              required: ["items", "has_more", "next_cursor"],
              properties: {
                items: { type: "array", items: { $ref: "#/components/schemas/Audit" } },
                has_more: { type: "boolean" },
                next_cursor: { type: ["string", "null"] },
              },
            } } },
          },
          "401": { description: "Invalid API key" },
          "403": { description: "Scope or plan denied" },
          "422": { description: "Invalid query parameters or cursor" },
          "429": { description: "Rate limited" },
          "500": { description: "Internal error" },
          "503": { description: "API disabled" },
        },
      },
      post: {
        summary: "Create an audit",
        description: "Requires audits:create. Body limit: 16 KiB. Also subject to workspace credits and audit start limits.",
        parameters: [{ name: "Idempotency-Key", in: "header", required: true, schema: { type: "string", minLength: 8, maxLength: 200 } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: {
            type: "object", additionalProperties: false, required: ["url"],
            properties: {
              url: { type: "string", maxLength: 2048 },
              audit_type: { type: "string", enum: ["standard", "local", "quick"], default: "standard" },
              report_language: { type: "string", enum: ["de", "en"], default: "de" },
              publish_report: { type: "boolean", default: false },
            },
          } } },
        },
        responses: { "202": { description: "Audit accepted" }, "401": { description: "Invalid API key" }, "402": { description: "Insufficient credits" }, "403": { description: "Scope or plan denied" }, "409": { description: "Idempotency conflict" }, "413": { description: "Payload too large" }, "415": { description: "Unsupported content type" }, "422": { description: "Validation failed" }, "429": { description: "Rate limited" }, "500": { description: "Internal error" }, "503": { description: "API disabled" } },
      },
    },
    "/audits/{audit_id}": {
      get: {
        summary: "Get audit status", description: "Requires audits:read.",
        parameters: [{ name: "audit_id", in: "path", required: true, schema: { type: "string", pattern: "^aud_" } }],
        responses: { "200": { description: "Audit status", content: { "application/json": { schema: { $ref: "#/components/schemas/Audit" } } } }, "401": { description: "Invalid API key" }, "403": { description: "Scope or plan denied" }, "404": { description: "Not found" }, "429": { description: "Rate limited" }, "500": { description: "Internal error" }, "503": { description: "API disabled" } },
      },
    },
    "/audits/{audit_id}/report": {
      get: {
        summary: "Get report metadata", description: "Requires reports:read. Full report contents are not returned.",
        parameters: [{ name: "audit_id", in: "path", required: true, schema: { type: "string", pattern: "^aud_" } }],
        responses: { "200": { description: "Report metadata and scores" }, "401": { description: "Invalid API key" }, "403": { description: "Scope or plan denied" }, "404": { description: "Not found" }, "409": { description: "Report not ready" }, "429": { description: "Rate limited" }, "500": { description: "Internal error" }, "503": { description: "API disabled" } },
      },
    },
    "/usage": {
      get: {
        summary: "Get workspace usage",
        description: "Requires usage:read. Returns the current plan, credit snapshot, and visible audit total.",
        responses: {
          "200": { description: "Workspace usage", content: { "application/json": { schema: { $ref: "#/components/schemas/Usage" } } } },
          "401": { description: "Invalid API key" },
          "403": { description: "Scope or plan denied" },
          "404": { description: "Workspace not found" },
          "429": { description: "Rate limited" },
          "500": { description: "Internal error" },
          "503": { description: "API disabled" },
        },
      },
    },
  },
  "x-webhook-verification": {
    version: "1",
    signature_header: "x-sitepitch-signature",
    timestamp_header: "x-sitepitch-timestamp",
    signed_value: "<timestamp>.<raw_body>",
    algorithm: "HMAC-SHA256",
  },
} as const
