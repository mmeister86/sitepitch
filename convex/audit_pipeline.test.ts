import assert from "node:assert/strict"

import { describe, test } from "vitest"

import {
  extractSignalsFromHtml,
  getAuditPipelinePlan,
  pickPriorityPages,
  redactSensitiveText,
} from "./lib/audit_pipeline"

describe("audit pipeline helpers", () => {
  test("maps tiers to the expected page and provider plan", () => {
    assert.deepEqual(getAuditPipelinePlan("quick"), {
      maxPages: 1,
      screenshotViewports: ["desktop"],
      performanceStrategies: ["mobile"],
      useBusinessData: false,
    })
    assert.deepEqual(getAuditPipelinePlan("standard"), {
      maxPages: 5,
      screenshotViewports: ["desktop", "mobile"],
      performanceStrategies: ["mobile", "desktop"],
      useBusinessData: false,
    })
    assert.deepEqual(getAuditPipelinePlan("local"), {
      maxPages: 5,
      screenshotViewports: ["desktop", "mobile"],
      performanceStrategies: ["mobile", "desktop"],
      useBusinessData: true,
    })
  })

  test("extracts primary signals and prioritizes useful internal pages", () => {
    const html = `
      <html>
        <head>
          <title>Example Studio</title>
          <meta name="description" content="Modern web design for local businesses">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta property="og:title" content="Example Studio">
        </head>
        <body>
          <h1>Example Studio</h1>
          <a href="/kontakt">Kontakt</a>
          <a href="/datenschutz">Datenschutz</a>
          <a href="/leistungen">Leistungen</a>
          <a href="tel:+4930123456">+49 30 123456</a>
          <img src="/logo.png" alt="Logo">
          <img src="/hero.png">
          <form action="/kontakt" method="post">
            <input type="email" name="email">
            <textarea name="message"></textarea>
          </form>
          <a href="https://external.example">External</a>
        </body>
      </html>
    `

    const signals = extractSignalsFromHtml(html, "https://example.com/", "https://example.com")
    assert.equal(signals.title, "Example Studio")
    assert.equal(signals.metaDescription, "Modern web design for local businesses")
    assert.equal(signals.privacyLinkFound, true)
    assert.equal(signals.internalLinks.length, 3)
    assert.equal(signals.externalLinks.length, 1)
    assert.equal(signals.phoneLinkFound, true)
    assert.equal(signals.viewportMetaFound, true)
    assert.equal(signals.contactFormFound, true)
    assert.equal(signals.imageCount, 2)
    assert.equal(signals.imagesMissingAltCount, 1)

    const pages = pickPriorityPages("https://example.com/", signals.internalLinks, 5)
    assert.equal(pages[0].kind, "primary")
    assert.ok(pages.some((page) => page.kind === "contact"))
    assert.ok(pages.some((page) => page.kind === "privacy"))
  })

  test("redacts credentials from provider evidence", () => {
    const redacted = redactSensitiveText("Bearer secret-token api_key=abc123 access_key=xyz")
    assert.equal(redacted.includes("secret-token"), false)
    assert.equal(redacted.includes("abc123"), false)
    assert.equal(redacted.includes("xyz"), false)
  })

  test("pickPriorityPages dedupes and filters merged discovery links (firecrawl map scenario)", () => {
    const home = "https://example.com/"
    const internalLinks = [
      "https://example.com/kontakt",
      "https://example.com/leistungen",
    ]
    const firecrawlMapLinks = [
      "https://example.com/kontakt",
      "https://example.com/impressum",
      "https://example.com/datenschutz",
      "https://other.example.org/foreign",
      "https://example.com/ueber-uns?ref=nav",
    ]
    const merged = [...internalLinks, ...firecrawlMapLinks]

    const pages = pickPriorityPages(home, merged, 5)
    const normalized = pages.map((page) => page.normalizedUrl)

    assert.equal(pages[0].kind, "primary")
    assert.equal(new Set(normalized).size, normalized.length, "no duplicate URLs")
    assert.ok(pages.some((page) => page.kind === "contact"))
    assert.ok(pages.some((page) => page.kind === "imprint"))
    assert.ok(pages.some((page) => page.kind === "privacy"))
    assert.ok(
      pages.every((page) => new URL(page.url).hostname === "example.com"),
      "foreign-origin links filtered out",
    )
  })
})
