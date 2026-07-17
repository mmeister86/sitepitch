import { describe, expect, test } from "vitest"

import { isValidIdempotencyKey, parseCreateAuditBody } from "./public_api_contract"

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
})
