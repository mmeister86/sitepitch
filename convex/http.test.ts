import assert from "node:assert/strict"

import { convexTest } from "convex-test"
import { beforeEach, describe, test, vi } from "vitest"

import schema from "./schema"
import { MAX_WEBHOOK_BODY_BYTES } from "./lib/webhook_request"

const modules = import.meta.glob([
  "./auth.ts",
  "./billing.ts",
  "./http.ts",
  "./lib/*.ts",
  "./_generated/*.js",
])

async function sign(body: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

describe("Lemon Squeezy webhook boundary", () => {
  beforeEach(() => {
    vi.stubEnv("LEMONSQUEEZY_WEBHOOK_SECRET", "webhook-test-secret")
  })

  test("rejects non-JSON requests before reading the payload", async () => {
    const response = await convexTest(schema, modules).fetch("/api/webhooks/lemonsqueezy", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "not json",
    })
    assert.equal(response.status, 415)
  })

  test("rejects payloads larger than 256 KiB", async () => {
    const response = await convexTest(schema, modules).fetch("/api/webhooks/lemonsqueezy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "a".repeat(MAX_WEBHOOK_BODY_BYTES + 1),
    })
    assert.equal(response.status, 413)
  })

  test("rejects malformed signed JSON", async () => {
    const body = "{invalid"
    const response = await convexTest(schema, modules).fetch("/api/webhooks/lemonsqueezy", {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-signature": await sign(body, "webhook-test-secret"),
      },
      body,
    })
    assert.equal(response.status, 400)
  })

  test("rejects a JSON payload with the wrong signature", async () => {
    const response = await convexTest(schema, modules).fetch("/api/webhooks/lemonsqueezy", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature": "00".repeat(32),
        "x-event-id": "attacker-controlled-replay-id",
      },
      body: JSON.stringify({ meta: { event_name: "order_created" } }),
    })
    assert.equal(response.status, 401)
  })
})
