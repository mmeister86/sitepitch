/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { sha256Base64Url } from "./lib/integration_crypto"
import schema from "./schema"

vi.mock("./lib/audit_rate_limit", () => ({
  checkPublicApiTransportLimits: vi.fn(async () => undefined),
  checkAuditStartLimits: vi.fn(async () => undefined),
}))

const modules = import.meta.glob([
  "./auth.ts",
  "./api_keys.ts",
  "./http.ts",
  "./public_api.ts",
  "./workspaces.ts",
  "./lib/*.ts",
  "./_generated/*.js",
])

async function seed(t: ReturnType<typeof convexTest>) {
  const fullRawKey = `spk_${"a".repeat(16)}_${"s".repeat(43)}`
  const auditOnlyRawKey = `spk_${"b".repeat(16)}_${"t".repeat(43)}`
  const [fullHash, auditOnlyHash] = await Promise.all([
    sha256Base64Url(fullRawKey),
    sha256Base64Url(auditOnlyRawKey),
  ])
  await t.run(async (ctx) => {
    const now = 1_750_000_000_000
    const userId = await ctx.db.insert("users", {
      tokenIdentifier: "http-owner",
      betterAuthUserId: "http-owner",
      email: "http@example.com",
      createdAt: now,
    })
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "HTTP Public API",
      ownerUserId: userId,
      reportLanguage: "de",
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert("subscriptions", {
      workspaceId,
      provider: "lemonsqueezy",
      plan: "agency",
      status: "active",
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert("creditBalances", {
      workspaceId,
      periodStart: now - 1_000,
      periodEnd: now + 1_000,
      monthlyCredits: 300,
      extraCredits: 25,
      usedMonthlyCredits: 8,
      usedExtraCredits: 3,
      reservedCredits: 2,
      updatedAt: now,
    })
    await ctx.db.insert("workspaceAuditCounters", {
      workspaceId,
      total: 2,
      createdAt: now,
      updatedAt: now,
    })
    for (const [index, status] of ["completed", "queued"] .entries()) {
      await ctx.db.insert("audits", {
        workspaceId,
        createdByUserId: userId,
        externalApiId: `aud_http_${index.toString().padEnd(16, "x")}`,
        creationChannel: "api",
        countedInWorkspaceAuditTotal: true,
        publishRequested: false,
        url: `https://${index}.example.com`,
        normalizedUrl: `https://${index}.example.com/`,
        domain: `${index}.example.com`,
        auditType: "standard",
        reportLanguage: "de",
        idempotencyKey: `http-${index}`,
        status: status as "completed" | "queued",
        publicSlug: `http-${index}`,
        isPublic: false,
        reportVersion: "v1",
        createdAt: now + index,
        updatedAt: now + index,
      })
    }
    for (const [publicId, hash, scopes] of [
      ["a".repeat(16), fullHash, ["audits:read", "usage:read"]],
      ["b".repeat(16), auditOnlyHash, ["audits:read"]],
    ] as const) {
      await ctx.db.insert("apiKeys", {
        workspaceId,
        createdByUserId: userId,
        label: "HTTP test",
        publicId,
        prefix: `spk_${publicId}_test…`,
        secretHash: hash,
        scopes: [...scopes],
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
    }
  })
  return { fullRawKey, auditOnlyRawKey }
}

function bearer(rawKey: string) {
  return { authorization: `Bearer ${rawKey}` }
}

describe("public API HTTP endpoints", () => {
  beforeEach(() => vi.stubEnv("PUBLIC_API_ENABLED", "true"))
  afterEach(() => vi.unstubAllEnvs())

  test("enforces authentication and usage scope", async () => {
    const t = convexTest(schema, modules)
    const { auditOnlyRawKey } = await seed(t)
    expect((await t.fetch("/api/v1/audits")).status).toBe(401)
    const denied = await t.fetch("/api/v1/usage", { headers: bearer(auditOnlyRawKey) })
    expect(denied.status).toBe(403)
    expect(await denied.json()).toMatchObject({ error: { code: "insufficient_scope" } })
  })

  test("returns 422 for strict query validation", async () => {
    const t = convexTest(schema, modules)
    const { fullRawKey } = await seed(t)
    const response = await t.fetch("/api/v1/audits?limit=1&limit=2", { headers: bearer(fullRawKey) })
    expect(response.status).toBe(422)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
  })

  test("paginates audit DTOs and returns the usage snapshot", async () => {
    const t = convexTest(schema, modules)
    const { fullRawKey } = await seed(t)
    const firstResponse = await t.fetch("/api/v1/audits?limit=1", { headers: bearer(fullRawKey) })
    expect(firstResponse.status).toBe(200)
    const first = await firstResponse.json() as { items: Array<{ audit_id: string }>; has_more: boolean; next_cursor: string }
    expect(first.items).toHaveLength(1)
    expect(first.items[0]?.audit_id).toMatch(/^aud_/)
    expect(first.has_more).toBe(true)
    expect(first.next_cursor).toBeTypeOf("string")

    const secondResponse = await t.fetch(`/api/v1/audits?limit=1&cursor=${encodeURIComponent(first.next_cursor)}`, {
      headers: bearer(fullRawKey),
    })
    expect(secondResponse.status).toBe(200)
    const second = await secondResponse.json() as { items: Array<{ audit_id: string }>; has_more: boolean; next_cursor: null }
    expect(second.items).toHaveLength(1)
    expect(second.items[0]?.audit_id).not.toBe(first.items[0]?.audit_id)
    expect(second.has_more).toBe(false)
    expect(second.next_cursor).toBeNull()

    const usageResponse = await t.fetch("/api/v1/usage", { headers: bearer(fullRawKey) })
    expect(usageResponse.status).toBe(200)
    expect(usageResponse.headers.get("cache-control")).toBe("private, no-store")
    expect(await usageResponse.json()).toMatchObject({
      plan: { name: "agency", subscription_status: "active" },
      credits: { total: 325, used: 11, reserved: 2, remaining: 312 },
      audits: { total: 2 },
    })
  })
})
