/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { afterEach, describe, expect, test, vi } from "vitest"

import { api } from "./_generated/api"
import schema from "./schema"

vi.mock("./auth.ts", () => ({
  authComponent: {
    getAuthUser: async (ctx: { auth: { getUserIdentity: () => Promise<{ email?: string; name?: string } | null> } }) => {
      const identity = await ctx.auth.getUserIdentity()
      return identity?.email ? { _id: `auth:${identity.email}`, email: identity.email, name: identity.name } : null
    },
  },
}))

const modules = import.meta.glob(["./api_keys.ts", "./lib/*.ts", "./_generated/*.js"])

function testDb() {
  return convexTest(schema, modules)
}

async function seedApiWorkspace(t: ReturnType<typeof testDb>, plan: "pro" | "agency" | "scale" = "agency") {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const userId = await ctx.db.insert("users", {
      tokenIdentifier: "owner",
      betterAuthUserId: "auth:owner@example.com",
      email: "owner@example.com",
      createdAt: now,
    })
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "API Workspace",
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
    return { workspaceId }
  })
}

function owner(t: ReturnType<typeof testDb>) {
  return t.withIdentity({ tokenIdentifier: "owner", email: "owner@example.com" })
}

afterEach(() => vi.unstubAllEnvs())

describe("API key lifecycle", () => {
  test("returns the raw key once and stores only its hash", async () => {
    vi.stubEnv("PUBLIC_API_ENABLED", "true")
    const t = testDb()
    const { workspaceId } = await seedApiWorkspace(t)
    const created = await owner(t).mutation(api.api_keys.createApiKey, {
      label: "Production",
      scopes: ["audits:create", "audits:read"],
    })

    expect(created.rawKey).toMatch(/^spk_[A-Za-z0-9_-]{16}_[A-Za-z0-9_-]{43}$/)
    const stored = await t.run(async (ctx) =>
      await ctx.db.query("apiKeys").withIndex("by_workspaceId_and_createdAt", (q) => q.eq("workspaceId", workspaceId)).unique(),
    )
    expect(stored?.secretHash).not.toContain(created.rawKey)
    expect(stored?.prefix).toBe(created.prefix)

    const listed = await owner(t).query(api.api_keys.listApiKeys, {})
    expect(listed.canManage).toBe(true)
    expect(JSON.stringify(listed)).not.toContain(created.rawKey)
    expect(listed.keys[0]).toMatchObject({ label: "Production", status: "active" })
  })

  test("rotates with a 24 hour overlap and supports immediate revocation", async () => {
    vi.stubEnv("PUBLIC_API_ENABLED", "true")
    const t = testDb()
    await seedApiWorkspace(t)
    const created = await owner(t).mutation(api.api_keys.createApiKey, {
      label: "Production",
      scopes: ["audits:create", "reports:read"],
    })
    const before = Date.now()
    const rotated = await owner(t).mutation(api.api_keys.rotateApiKey, { apiKeyId: created.apiKeyId })
    expect(rotated.rawKey).not.toBe(created.rawKey)
    expect(rotated.previousKeyGraceExpiresAt).toBeGreaterThanOrEqual(before + 24 * 60 * 60_000)
    let listed = await owner(t).query(api.api_keys.listApiKeys, {})
    expect(listed.keys.map((key) => key.status).sort()).toEqual(["active", "grace"])

    await owner(t).mutation(api.api_keys.revokeApiKey, { apiKeyId: rotated.apiKeyId })
    listed = await owner(t).query(api.api_keys.listApiKeys, {})
    expect(listed.keys.find((key) => key._id === rotated.apiKeyId)?.status).toBe("revoked")
  })

  test("includes Agency and rejects lower plans", async () => {
    vi.stubEnv("PUBLIC_API_ENABLED", "true")
    const t = testDb()
    await seedApiWorkspace(t, "pro")
    await expect(owner(t).mutation(api.api_keys.createApiKey, {
      label: "Denied",
      scopes: ["audits:read"],
    })).rejects.toThrow(/Agency-Plan/i)
  })
})
