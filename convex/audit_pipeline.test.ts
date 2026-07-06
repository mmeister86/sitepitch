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
          <meta property="og:title" content="Example Studio">
        </head>
        <body>
          <h1>Example Studio</h1>
          <a href="/kontakt">Kontakt</a>
          <a href="/datenschutz">Datenschutz</a>
          <a href="/leistungen">Leistungen</a>
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
})
