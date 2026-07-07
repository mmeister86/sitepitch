/// <reference types="vite/client" />
import assert from "node:assert/strict"

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const envMock = vi.hoisted(() => ({
  TURNSTILE_SECRET_KEY: "test-secret" as string | undefined,
}))
const fetchMock = vi.hoisted(() => vi.fn())

vi.stubGlobal("fetch", fetchMock)

vi.mock("../_generated/server", () => ({ env: envMock }))

import { verifyTurnstileToken } from "./turnstile"

describe("verifyTurnstileToken", () => {
  beforeEach(() => {
    envMock.TURNSTILE_SECRET_KEY = "test-secret"
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test("returns TURNSTILE_NOT_CONFIGURED and does not call fetch when no secret", async () => {
    envMock.TURNSTILE_SECRET_KEY = undefined

    const result = await verifyTurnstileToken("tok")

    assert.deepEqual(result, { ok: false, reason: "TURNSTILE_NOT_CONFIGURED" })
    assert.equal(fetchMock.mock.calls.length, 0)
  })

  test("returns ok when Cloudflare reports success", async () => {
    fetchMock.mockResolvedValueOnce({ json: async () => ({ success: true }) })

    const result = await verifyTurnstileToken("tok")

    assert.deepEqual(result, { ok: true })
  })

  test('returns TURNSTILE_FAILED when Cloudflare reports success: false', async () => {
    fetchMock.mockResolvedValueOnce({ json: async () => ({ success: false }) })

    const result = await verifyTurnstileToken("tok")

    assert.deepEqual(result, { ok: false, reason: "TURNSTILE_FAILED" })
  })

  test("posts the token and secret to the siteverify endpoint", async () => {
    fetchMock.mockResolvedValueOnce({ json: async () => ({ success: true }) })

    await verifyTurnstileToken("the-token", "203.0.113.7")

    assert.equal(fetchMock.mock.calls.length, 1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    assert.equal(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify")
    assert.equal(init.method, "POST")
    const body = init.body as FormData
    expect(body).toBeInstanceOf(FormData)
    assert.equal(body.get("secret"), "test-secret")
    assert.equal(body.get("response"), "the-token")
    assert.equal(body.get("remoteip"), "203.0.113.7")
  })
})
