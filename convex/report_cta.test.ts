import { describe, expect, test } from "vitest"

import {
  normalizeReportCtaText,
  normalizeReportCtaUrl,
  resolveReportCtaSnapshotValues,
} from "./lib/report_cta"

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
    "mailto:user+tag@example.co.uk",
    "tel:+4930123456",
    "tel:+49 (30) 123-45",
  ])("accepts the allowed URL scheme: %s", (url) => {
    expect(normalizeReportCtaUrl(` ${url} `)).toBe(url)
  })

  test.each([
    "javascript:alert(1)",
    "ftp://example.com/file",
    "https://user:secret@example.com",
    "https://example.com/a b",
    "https://example.com/contact?next=%0d%0aSet-Cookie:bad",
    "mailto:",
    "tel:",
    "mailto:hello@example.com?subject=%0d%0aBcc:bad@example.com",
    "mailto:a@example.com/path",
    "mailto:a@example.com%3Fbcc=x@example.com",
    "mailto:hello%0d%0a@example.com",
    "mailto:hello%250d%250a@example.com",
    "mailto:hello%252525250d@example.com",
    "tel:+4930%0d%0a123",
    "tel:+4930?ext=123",
    "tel:---",
    "tel:()",
    "not-a-url",
  ])("rejects unsafe or malformed URL: %s", (url) => {
    expect(() => normalizeReportCtaUrl(url)).toThrow()
  })

  test("ignores unsafe legacy workspace fallbacks at the snapshot boundary", () => {
    const workspace = {
      ctaText: "Kontakt",
      ctaUrl: "https://user:secret@unsafe.example.com",
      website: "javascript:alert(1)",
      contactEmail: "hello\r\nbcc@example.com",
    } as any
    expect(resolveReportCtaSnapshotValues(workspace, null)).toEqual({
      text: "Kontakt",
      url: undefined,
    })
  })
})
