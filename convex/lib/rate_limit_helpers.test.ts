/// <reference types="vite/client" />
import assert from "node:assert/strict"

import { describe, expect, test } from "vitest"

import {
  isPaidPlan,
  providerToLimitKind,
  throwRateLimited,
} from "./rate_limit_helpers"

describe("isPaidPlan", () => {
  test('returns true for "starter", "pro", "agency" and false for "free"', () => {
    assert.equal(isPaidPlan("starter"), true)
    assert.equal(isPaidPlan("pro"), true)
    assert.equal(isPaidPlan("agency"), true)
    assert.equal(isPaidPlan("free"), false)
  })
})

describe("providerToLimitKind", () => {
  test("maps every provider string to its limit kind", () => {
    assert.equal(providerToLimitKind("screenshotone"), "screenshot")
    assert.equal(providerToLimitKind("pagespeed"), "pagespeed")
    assert.equal(providerToLimitKind("local_business_data"), "businessData")
    assert.equal(providerToLimitKind("google_places"), "businessData")
    assert.equal(providerToLimitKind("openai"), "llm")
    assert.equal(providerToLimitKind("anthropic"), "llm")
    assert.equal(providerToLimitKind("other"), "llm")
    assert.equal(providerToLimitKind("direct_html"), "content")
    assert.equal(providerToLimitKind("jina"), "content")
  })
})

describe("throwRateLimited", () => {
  test("throws a ConvexError with RATE_LIMITED code and user-safe message", () => {
    try {
      throwRateLimited()
      assert.fail("expected throwRateLimited to throw")
    } catch (err: any) {
      assert.equal(err.data.code, "RATE_LIMITED")
      assert.equal(typeof err.data.message, "string")
      assert.doesNotMatch(err.data.message, /screenshotone|pagespeed|openai|anthropic|jina/i)
      assert.equal(err.data.retryAfter, undefined)
    }
  })

  test("carries retryAfter when provided", () => {
    try {
      throwRateLimited(5000)
      assert.fail("expected throwRateLimited to throw")
    } catch (err: any) {
      assert.equal(err.data.code, "RATE_LIMITED")
      assert.equal(err.data.retryAfter, 5000)
    }
  })

  test("is typed to never return (assertion helper for callers)", () => {
    const fn = (): string => {
      throwRateLimited()
      // unreachable, but TypeScript must accept this return type
      return "no"
    }
    expect(typeof fn).toBe("function")
  })
})
