/// <reference types="vite/client" />
import assert from "node:assert/strict"

import { beforeEach, describe, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
}))

vi.mock("@convex-dev/rate-limiter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@convex-dev/rate-limiter")>()
  return {
    ...actual,
    RateLimiter: class {
      limit = mocks.limit
    },
  }
})

const { checkProviderLimit } = await import("./audit_rate_limit")

const ctx = {} as any

describe("checkProviderLimit", () => {
  beforeEach(() => {
    mocks.limit.mockReset()
  })

  test("routes each ProviderLimitKind to the correct limit name keyed by provider", async () => {
    const cases: Array<{ kind: any; expectedLimitName: string }> = [
      { kind: "content", expectedLimitName: "contentProviderCalls" },
      { kind: "screenshot", expectedLimitName: "screenshotProviderCalls" },
      { kind: "pagespeed", expectedLimitName: "pagespeedProviderCalls" },
      { kind: "businessData", expectedLimitName: "businessDataProviderCalls" },
      { kind: "llm", expectedLimitName: "llmGenerations" },
      { kind: "pdf", expectedLimitName: "pdfExportsByWorkspace" },
    ]

    for (const { kind, expectedLimitName } of cases) {
      mocks.limit.mockReset()
      mocks.limit.mockResolvedValue({ ok: true, retryAfter: null })
      await checkProviderLimit(ctx, { kind, provider: "acme" })
      assert.equal(mocks.limit.mock.calls.length, 1)
      assert.equal(mocks.limit.mock.calls[0]![1], expectedLimitName)
      assert.deepEqual(mocks.limit.mock.calls[0]![2], { key: "acme" })
    }
  })

  test("throws a RATE_LIMITED ConvexError when the bucket is exhausted", async () => {
    mocks.limit.mockResolvedValue({ ok: false, retryAfter: 1234 })
    await assert.rejects(
      () => checkProviderLimit(ctx, { kind: "screenshot", provider: "acme" }),
      (err: any) => {
        assert.equal(err.data.code, "RATE_LIMITED")
        assert.equal(err.data.retryAfter, 1234)
        return true
      },
    )
  })

  test("does not throw when the limit resolves ok", async () => {
    mocks.limit.mockResolvedValue({ ok: true, retryAfter: null })
    await checkProviderLimit(ctx, { kind: "content", provider: "acme" })
    assert.equal(mocks.limit.mock.calls.length, 1)
  })
})
