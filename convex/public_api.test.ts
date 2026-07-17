/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

import { internal } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob(["./public_api.ts", "./_generated/*.js"])

async function seed(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = 1_750_000_000_000
    const userId = await ctx.db.insert("users", {
      tokenIdentifier: "public-api-owner",
      betterAuthUserId: "public-api-owner",
      email: "api@example.com",
      createdAt: now,
    })
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Public API",
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
      currentPeriodStart: now - 1_000,
      currentPeriodEnd: now + 1_000,
      cancelAtPeriodEnd: true,
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
    const insertAudit = async (suffix: string, createdAt: number, status: "queued" | "completed", counted: boolean) =>
      await ctx.db.insert("audits", {
        workspaceId,
        createdByUserId: userId,
        externalApiId: `aud_${suffix.padEnd(22, "x")}`,
        creationChannel: "api",
        countedInWorkspaceAuditTotal: counted,
        publishRequested: false,
        url: `https://${suffix}.example.com`,
        normalizedUrl: `https://${suffix}.example.com/`,
        domain: `${suffix}.example.com`,
        auditType: "standard",
        reportLanguage: "de",
        idempotencyKey: `api-${suffix}`,
        status,
        publicSlug: `public-${suffix}`,
        isPublic: false,
        reportVersion: "v1",
        createdAt,
        updatedAt: createdAt,
      })
    await insertAudit("old", now - 100, "completed", true)
    await insertAudit("new", now, "queued", true)
    await insertAudit("deleted", now + 100, "completed", false)
    return { workspaceId, now }
  })
}

describe("public API queries", () => {
  test("paginates only counted audits newest first and applies exclusive filters", async () => {
    const t = convexTest(schema, modules)
    const { workspaceId, now } = await seed(t)
    const first = await t.query(internal.public_api.listAudits, {
      workspaceId,
      paginationOpts: { numItems: 1, cursor: null },
      status: null,
      createdAfter: null,
      createdBefore: null,
    })
    expect(first.page.map((audit) => audit.domain)).toEqual(["new.example.com"])
    expect(first.isDone).toBe(false)

    const second = await t.query(internal.public_api.listAudits, {
      workspaceId,
      paginationOpts: { numItems: 1, cursor: first.continueCursor },
      status: null,
      createdAfter: null,
      createdBefore: null,
    })
    expect(second.page.map((audit) => audit.domain)).toEqual(["old.example.com"])
    expect(second.isDone).toBe(true)

    const exclusive = await t.query(internal.public_api.listAudits, {
      workspaceId,
      paginationOpts: { numItems: 25, cursor: null },
      status: "completed",
      createdAfter: now - 100,
      createdBefore: now + 1,
    })
    expect(exclusive.page).toEqual([])
  })

  test("returns a safe and internally consistent usage snapshot", async () => {
    const t = convexTest(schema, modules)
    const { workspaceId } = await seed(t)
    const usage = await t.query(internal.public_api.getUsage, { workspaceId })
    expect(usage).toMatchObject({
      plan: { name: "agency", subscription_status: "active", cancel_at_period_end: true },
      credits: {
        total: 325,
        used: 11,
        reserved: 2,
        remaining: 312,
        monthly: { total: 300, used: 8 },
        extra: { total: 25, used: 3 },
      },
      audits: { total: 2 },
    })
    const serialized = JSON.stringify(usage)
    expect(serialized).not.toContain(workspaceId)
    expect(serialized).not.toContain("public-api-owner")
  })
})
