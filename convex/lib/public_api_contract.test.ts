import { describe, expect, test } from "vitest"

import {
  encodeAuditListCursor,
  isValidIdempotencyKey,
  OPENAPI_V1,
  parseAuditListRequest,
  parseCreateAuditBody,
} from "./public_api_contract"

describe("public API contract", () => {
  test("normalizes defaults and rejects unknown fields", () => {
    expect(parseCreateAuditBody({ url: " https://example.com " })).toEqual({
      url: "https://example.com",
      audit_type: "standard",
      report_language: "de",
      publish_report: false,
    })
    expect(parseCreateAuditBody({ url: "https://example.com", internal_id: "leak" })).toBeNull()
  })

  test("validates bounded printable idempotency keys", () => {
    expect(isValidIdempotencyKey("audit-request-42")).toBe(true)
    expect(isValidIdempotencyKey("short")).toBe(false)
    expect(isValidIdempotencyKey(`unsafe\nkey`)).toBe(false)
    expect(isValidIdempotencyKey("x".repeat(201))).toBe(false)
  })

  test("parses bounded audit-list filters and defaults", () => {
    expect(parseAuditListRequest("https://api.example/api/v1/audits")).toMatchObject({
      ok: true,
      value: { limit: 25, status: null, createdAfter: null, createdBefore: null, convexCursor: null },
    })
    expect(parseAuditListRequest("https://api.example/api/v1/audits?limit=100&status=completed&created_after=2026-07-01T00%3A00%3A00Z&created_before=2026-08-01T00%3A00%3A00Z")).toMatchObject({
      ok: true,
      value: {
        limit: 100,
        status: "completed",
        createdAfter: Date.parse("2026-07-01T00:00:00Z"),
        createdBefore: Date.parse("2026-08-01T00:00:00Z"),
      },
    })
  })

  test("rejects unknown, duplicate, malformed, and invalid-range parameters", () => {
    expect(parseAuditListRequest("https://api.example/api/v1/audits?internal=true")).toEqual({ ok: false })
    expect(parseAuditListRequest("https://api.example/api/v1/audits?limit=10&limit=20")).toEqual({ ok: false })
    expect(parseAuditListRequest("https://api.example/api/v1/audits?limit=0")).toEqual({ ok: false })
    expect(parseAuditListRequest("https://api.example/api/v1/audits?status=running")).toEqual({ ok: false })
    expect(parseAuditListRequest("https://api.example/api/v1/audits?created_after=2026-07-01")).toEqual({ ok: false })
    expect(parseAuditListRequest("https://api.example/api/v1/audits?created_after=2026-02-31T00%3A00%3A00Z")).toEqual({ ok: false })
    expect(parseAuditListRequest("https://api.example/api/v1/audits?created_after=2026-08-01T00%3A00%3A00Z&created_before=2026-07-01T00%3A00%3A00Z")).toEqual({ ok: false })
  })

  test("accepts only versioned cursors bound to the same filters", () => {
    const first = parseAuditListRequest("https://api.example/api/v1/audits?status=queued")
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const cursor = encodeAuditListCursor("native-convex-cursor", first.value.fingerprint)
    expect(parseAuditListRequest(`https://api.example/api/v1/audits?status=queued&cursor=${cursor}`)).toMatchObject({
      ok: true,
      value: { convexCursor: "native-convex-cursor" },
    })
    expect(parseAuditListRequest(`https://api.example/api/v1/audits?status=completed&cursor=${cursor}`)).toEqual({ ok: false })
    expect(parseAuditListRequest(`https://api.example/api/v1/audits?cursor=${"x".repeat(8193)}`)).toEqual({ ok: false })
  })

  test("publishes the v1.1 listing and usage contract", () => {
    expect(OPENAPI_V1.info.version).toBe("1.1.0")
    expect(OPENAPI_V1.paths["/audits"].get.description).toContain("audits:read")
    expect(OPENAPI_V1.paths["/usage"].get.description).toContain("usage:read")
    expect(OPENAPI_V1.paths["/usage"].get.responses).toHaveProperty("429")
    expect(OPENAPI_V1.paths["/usage"].get.responses).toHaveProperty("503")
  })
})
