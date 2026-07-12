import assert from "node:assert/strict"

import { describe, test } from "vitest"

import {
  MAX_WEBHOOK_BODY_BYTES,
  isJsonContentType,
  readLimitedRequestText,
} from "./webhook_request"

describe("webhook request limits", () => {
  test("accepts JSON content types with optional parameters", () => {
    assert.equal(isJsonContentType("application/json"), true)
    assert.equal(isJsonContentType("Application/JSON; charset=utf-8"), true)
    assert.equal(isJsonContentType("text/plain"), false)
    assert.equal(isJsonContentType(null), false)
  })

  test("reads a request body at the byte limit", async () => {
    const payload = "a".repeat(MAX_WEBHOOK_BODY_BYTES)
    const result = await readLimitedRequestText(new Request("https://example.test", {
      method: "POST",
      body: payload,
    }))
    assert.equal(result, payload)
  })

  test("rejects declared and streamed bodies over the byte limit", async () => {
    const declared = new Request("https://example.test", {
      method: "POST",
      headers: { "content-length": String(MAX_WEBHOOK_BODY_BYTES + 1) },
      body: "{}",
    })
    assert.equal(await readLimitedRequestText(declared), null)

    const streamed = new Request("https://example.test", {
      method: "POST",
      body: "a".repeat(MAX_WEBHOOK_BODY_BYTES + 1),
    })
    assert.equal(await readLimitedRequestText(streamed), null)
  })
})
