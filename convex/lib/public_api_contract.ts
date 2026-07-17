export const PUBLIC_API_BODY_LIMIT_BYTES = 16 * 1024

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
  info: { title: "SitePitch Public API", version: "1.0.0" },
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
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/audits": {
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
        responses: { "202": { description: "Audit accepted" }, "401": { description: "Invalid API key" }, "402": { description: "Insufficient credits" }, "403": { description: "Scope or plan denied" }, "409": { description: "Idempotency conflict" }, "413": { description: "Payload too large" }, "415": { description: "Unsupported content type" }, "422": { description: "Validation failed" }, "429": { description: "Rate limited" }, "503": { description: "API disabled" } },
      },
    },
    "/audits/{audit_id}": {
      get: {
        summary: "Get audit status", description: "Requires audits:read.",
        parameters: [{ name: "audit_id", in: "path", required: true, schema: { type: "string", pattern: "^aud_" } }],
        responses: { "200": { description: "Audit status" }, "404": { description: "Not found" } },
      },
    },
    "/audits/{audit_id}/report": {
      get: {
        summary: "Get report metadata", description: "Requires reports:read. Full report contents are not returned.",
        parameters: [{ name: "audit_id", in: "path", required: true, schema: { type: "string", pattern: "^aud_" } }],
        responses: { "200": { description: "Report metadata and scores" }, "404": { description: "Not found" }, "409": { description: "Report not ready" } },
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
