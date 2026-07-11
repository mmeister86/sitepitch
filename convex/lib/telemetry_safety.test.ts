/// <reference types="vite/client" />

import assert from "node:assert/strict"

import { describe, test } from "vitest"

import {
  redactSensitiveText,
  sanitizeError,
  sanitizeRequestEvidence,
} from "./telemetry_safety"

describe("redactSensitiveText", () => {
  test("redacts Bearer tokens", () => {
    const result = redactSensitiveText("Authorization: Bearer my-secret-token")
    assert.equal(result.includes("my-secret-token"), false)
    assert.ok(result.includes("[redacted]"))
  })

  test("redacts api keys", () => {
    const result = redactSensitiveText("api_key=sk-abc123def456")
    assert.equal(result.includes("sk-abc123def456"), false)
  })

  test("redacts passwords", () => {
    const result = redactSensitiveText("password=hunter2")
    assert.equal(result.includes("hunter2"), false)
  })

  test("redacts cookies", () => {
    const result = redactSensitiveText("cookie=sessionid=abc123; token=xyz")
    assert.equal(result.includes("sessionid=abc123"), false)
  })

  test("redacts email addresses", () => {
    const result = redactSensitiveText("Contact user@example.com for details")
    assert.equal(result.includes("user@example.com"), false)
    assert.ok(result.includes("[email]"))
  })

  test("redacts query parameters in URLs", () => {
    const result = redactSensitiveText("Request to https://api.example.com/page?key=secret&token=abc")
    assert.equal(result.includes("key=secret"), false)
    assert.equal(result.includes("token=abc"), false)
  })

  test("truncates URLs to origin+path", () => {
    const result = redactSensitiveText("Fetched https://example.com/page?param=value")
    assert.ok(result.includes("https://example.com/page"))
    assert.equal(result.includes("param=value"), false)
  })

  test("truncates long messages", () => {
    const longMessage = "A".repeat(600)
    const result = redactSensitiveText(longMessage)
    assert.ok(result.length <= 502)
    assert.ok(result.endsWith("…"))
  })
})

describe("sanitizeError", () => {
  test("returns safe error for Error instances", () => {
    const error = new Error("Connection timeout")
    const result = sanitizeError(error)
    assert.equal(result.code, "UNKNOWN")
    assert.ok(result.message.includes("Connection timeout"))
    assert.equal(result.responseStatus, undefined)
  })

  test("extracts code from custom error properties", () => {
    const error = new Error("Provider failed") as Error & { code?: string }
    error.code = "PROVIDER_TIMEOUT"
    const result = sanitizeError(error)
    assert.equal(result.code, "PROVIDER_TIMEOUT")
  })

  test("extracts responseStatus", () => {
    const error = new Error("Server error") as Error & { responseStatus?: number }
    error.responseStatus = 500
    const result = sanitizeError(error)
    assert.equal(result.responseStatus, 500)
  })

  test("discards response body", () => {
    const error = new Error("API error") as Error & { responseBody?: unknown; responseStatus?: number }
    error.responseBody = { secret: "sensitive-data" }
    error.responseStatus = 401
    const result = sanitizeError(error)
    assert.equal(result.responseStatus, 401)
    assert.equal(result.message.includes("sensitive-data"), false)
  })

  test("discards URL from error", () => {
    const error = new Error("Fetch failed") as Error & { url?: string }
    error.url = "https://api.openai.com/v1/chat/completions?api_key=secret"
    const result = sanitizeError(error)
    assert.equal(result.message.includes("api_key=secret"), false)
    assert.equal(result.message.includes("openai.com"), false)
  })

  test("handles non-Error values", () => {
    const result = sanitizeError("string error")
    assert.equal(result.code, "UNKNOWN")
    assert.ok(result.message.includes("string error"))
  })

  test("redacts tokens in error messages", () => {
    const error = new Error("Request with Bearer my-token-123 failed")
    const result = sanitizeError(error)
    assert.equal(result.message.includes("my-token-123"), false)
  })
})

describe("sanitizeRequestEvidence", () => {
  test("returns undefined for undefined input", () => {
    assert.equal(sanitizeRequestEvidence(undefined), undefined)
  })

  test("redacts sensitive content", () => {
    const result = sanitizeRequestEvidence("operation: scrape homepage with api_key=secret123")
    assert.equal(result!.includes("secret123"), false)
    assert.ok(result!.includes("[redacted]"))
  })
})
