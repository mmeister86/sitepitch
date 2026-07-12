import { describe, expect, test } from "vitest"

import { resolveCtaHref } from "../lib/report-cta-href"

const base = {
  name: "Studio",
  accentColor: "#000000",
  website: "https://later.example.com",
  contactEmail: "later@example.com",
}

describe("report CTA snapshot fallback", () => {
  test("does not use live website or email after absence was snapshotted", () => {
    expect(resolveCtaHref({ ...base, ctaSnapshotted: true })).toBeNull()
  })

  test("keeps the legacy live fallback before a snapshot exists", () => {
    expect(resolveCtaHref({ ...base, ctaSnapshotted: false })).toBe("https://later.example.com")
  })

  test.each([
    "mailto:a@example.com?bcc=x@example.com",
    "mailto:a%0d%0a@example.com",
    "mailto:a%252525250d@example.com",
    "tel:+49?ext=123",
    "tel:+49%0d%0a123",
    "mailto:a@example.com/path",
    "mailto:a@example.com%3Fbcc=x@example.com",
    "tel:---",
    "tel:()",
  ])("rejects unsafe snapshotted CTA href: %s", (ctaUrl) => {
    expect(resolveCtaHref({ ...base, ctaSnapshotted: true, ctaUrl })).toBeNull()
  })

  test.each([
    "mailto:user+tag@example.co.uk",
    "tel:+49 (30) 123-45",
  ])("accepts a strict valid CTA href: %s", (ctaUrl) => {
    expect(resolveCtaHref({ ...base, ctaSnapshotted: true, ctaUrl })).toBe(ctaUrl)
  })

  test("rejects an unsafe legacy contact-email fallback", () => {
    expect(resolveCtaHref({
      ...base,
      ctaSnapshotted: false,
      website: undefined,
      contactEmail: "hello%0d%0abcc@example.com",
    })).toBeNull()
  })
})
