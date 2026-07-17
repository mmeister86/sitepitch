/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { afterEach, describe, expect, test, vi } from "vitest"

import { internal } from "./_generated/api"
import { sha256Base64Url } from "./lib/integration_crypto"
import schema from "./schema"

const mocks = vi.hoisted(() => ({
  checkPublicApiTransportLimits: vi.fn(async () => undefined),
}))

vi.mock("./lib/audit_rate_limit", () => ({
  checkPublicApiTransportLimits: mocks.checkPublicApiTransportLimits,
}))

vi.mock("./auth.ts", () => ({
  authComponent: { getAuthUser: vi.fn() },
}))

const modules = import.meta.glob(["./api_keys.ts", "./lib/*.ts", "./_generated/*.js"])

async function seedKey(t: ReturnType<typeof convexTest>, plan: "pro" | "agency", scopes: Array<"audits:read" | "usage:read">) {
  const publicId = "abcdefghijklmnop"
  const secret = "s".repeat(43)
  const rawKey = `spk_${publicId}_${secret}`
  const secretHash = await sha256Base64Url(rawKey)
  await t.run(async (ctx) => {
    const now = Date.now()
    const userId = await ctx.db.insert("users", {
      tokenIdentifier: "auth-owner",
      betterAuthUserId: "auth-owner",
      email: "auth@example.com",
      createdAt: now,
    })
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Auth order",
      ownerUserId: userId,
      reportLanguage: "de",
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert("subscriptions", {
      workspaceId,
      provider: "lemonsqueezy",
      plan,
      status: "active",
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert("apiKeys", {
      workspaceId,
      createdByUserId: userId,
      label: "Test",
      publicId,
      prefix: "spk_abcdefghijklmnop_ssss…",
      secretHash,
      scopes,
      status: "active",
      createdAt: now,
      updatedAt: now,
    })
  })
  return rawKey
}

afterEach(() => {
  vi.unstubAllEnvs()
  mocks.checkPublicApiTransportLimits.mockClear()
})

describe("public API authentication ordering", () => {
  test("charges transport limits before plan denial", async () => {
    vi.stubEnv("PUBLIC_API_ENABLED", "true")
    const t = convexTest(schema, modules)
    const rawKey = await seedKey(t, "pro", ["audits:read"])
    await expect(t.mutation(internal.api_keys.authenticateApiKey, {
      rawKey,
      requiredScope: "audits:read",
    })).rejects.toThrow(/Agency plan/i)
    expect(mocks.checkPublicApiTransportLimits).toHaveBeenCalledOnce()
  })

  test("charges transport limits before scope denial", async () => {
    vi.stubEnv("PUBLIC_API_ENABLED", "true")
    const t = convexTest(schema, modules)
    const rawKey = await seedKey(t, "agency", ["audits:read"])
    await expect(t.mutation(internal.api_keys.authenticateApiKey, {
      rawKey,
      requiredScope: "usage:read",
    })).rejects.toThrow(/scope is missing/i)
    expect(mocks.checkPublicApiTransportLimits).toHaveBeenCalledOnce()
  })
})
