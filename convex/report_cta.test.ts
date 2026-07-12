import { describe, expect, test } from "vitest"

import { normalizeReportCtaText, normalizeReportCtaUrl } from "./lib/report_cta"

describe("report CTA validation", () => {
  test("normalizes optional text and enforces the length", () => {
    expect(normalizeReportCtaText("  Gespräch buchen  ")).toBe("Gespräch buchen")
    expect(normalizeReportCtaText("   ")).toBeUndefined()
    expect(() => normalizeReportCtaText("x".repeat(81))).toThrow()
  })

  test.each([
    "https://example.com/contact",
    "http://example.com/contact",
    "mailto:hello@example.com",
    "tel:+4930123456",
  ])("accepts the allowed URL scheme: %s", (url) => {
    expect(normalizeReportCtaUrl(` ${url} `)).toBe(url)
  })

  test.each([
    "javascript:alert(1)",
    "ftp://example.com/file",
    "https://user:secret@example.com",
    "https://example.com/a b",
    "mailto:",
    "tel:",
    "mailto:hello@example.com?subject=%0d%0aBcc:bad@example.com",
    "mailto:hello%0d%0a@example.com",
    "tel:+4930%0d%0a123",
    "not-a-url",
  ])("rejects unsafe or malformed URL: %s", (url) => {
    expect(() => normalizeReportCtaUrl(url)).toThrow()
  })
})
