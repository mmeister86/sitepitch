/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { describe, expect, test, vi } from "vitest"

import { api } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

vi.mock("./auth", () => ({
  authComponent: {
    getAuthUser: async (ctx: {
      auth: {
        getUserIdentity: () => Promise<{
          tokenIdentifier: string
          email?: string
          name?: string
        } | null>
      }
    }) => {
      const identity = await ctx.auth.getUserIdentity()
      return identity?.email
        ? { _id: identity.tokenIdentifier, email: identity.email, name: identity.name }
        : null
    },
  },
}))

vi.mock("./workpools", () => {
  const pool = () => ({ enqueueAction: vi.fn(async () => "test-workpool-id") })
  return {
    auditWorkpool: pool(),
    batchAuditWorkpool: pool(),
    providerWorkpool: pool(),
    llmWorkpool: pool(),
    pdfWorkpool: pool(),
  }
})

const modules = import.meta.glob([
  "./batch_audits.ts",
  "./workspaces.ts",
  "./lib/*.ts",
  "./_generated/*.js",
])

type SeedOwner = {
  tokenIdentifier: string
  email: string
  userId: Id<"users">
  workspaceId: Id<"workspaces">
}

async function seedOwner(
  t: ReturnType<typeof convexTest>,
  suffix: string,
  options: { reservedCredits?: number } = {},
): Promise<SeedOwner> {
  const tokenIdentifier = `batch-owner-${suffix}`
  const email = `batch-${suffix}@example.com`
  const ids = await t.run(async (ctx) => {
    const now = Date.now()
    const userId = await ctx.db.insert("users", {
      tokenIdentifier,
      betterAuthUserId: tokenIdentifier,
      email,
      createdAt: now,
    })
    const workspaceId = await ctx.db.insert("workspaces", {
      name: `Batch ${suffix}`,
      ownerUserId: userId,
      reportLanguage: "de",
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert("workspaceMembers", {
      workspaceId,
      userId,
      role: "owner",
      createdAt: now,
    })
    await ctx.db.insert("creditBalances", {
      workspaceId,
      periodStart: now,
      periodEnd: now + 86_400_000,
      monthlyCredits: 20,
      extraCredits: 0,
      usedMonthlyCredits: 0,
      usedExtraCredits: 0,
      reservedCredits: options.reservedCredits ?? 0,
      updatedAt: now,
    })
    return { userId, workspaceId }
  })
  return { tokenIdentifier, email, ...ids }
}

type SeedBatchOptions = {
  status: "queued" | "running" | "paused" | "completed" | "failed" | "cancelled"
  itemStatus: "queued" | "running" | "paused" | "completed" | "failed" | "cancelled"
  itemCount?: number
  retryable?: boolean
  creditSettled?: boolean
  manualRetryCount?: number
}

async function seedBatch(
  t: ReturnType<typeof convexTest>,
  owner: SeedOwner,
  suffix: string,
  options: SeedBatchOptions,
) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const itemCount = options.itemCount ?? 1
    const queuedItems = options.itemStatus === "queued" ? itemCount : 0
    const runningItems = options.itemStatus === "running" ? itemCount : 0
    const completedItems = options.itemStatus === "completed" ? itemCount : 0
    const failedItems = options.itemStatus === "failed" ? itemCount : 0
    const cancelledItems = options.itemStatus === "cancelled" ? itemCount : 0
    const unsettledItems = options.creditSettled === false ? itemCount : 0
    const batchAuditJobId = await ctx.db.insert("batchAuditJobs", {
      workspaceId: owner.workspaceId,
      createdByUserId: owner.userId,
      source: "csv",
      planSnapshot: "agency",
      planLimitSnapshot: 25,
      maxParallelismSnapshot: 2,
      auditType: "standard",
      reportLanguage: "de",
      idempotencyKey: `batch-api-${suffix}`,
      status: options.status,
      totalItems: itemCount,
      queuedItems,
      runningItems,
      completedItems,
      failedItems,
      cancelledItems,
      initialReservedCredits: itemCount,
      reservedCredits: unsettledItems,
      consumedCredits: completedItems,
      refundedCredits: failedItems + cancelledItems,
      cacheHitItems: 0,
      cacheHitOperations: 0,
      qaSelectedItems: 0,
      qaPassedItems: 0,
      qaFailedItems: 0,
      createdAt: now,
      updatedAt: now,
    })
    const batchAuditItemIds: Id<"batchAuditItems">[] = []
    for (let position = 0; position < itemCount; position += 1) {
      batchAuditItemIds.push(await ctx.db.insert("batchAuditItems", {
        batchAuditJobId,
        workspaceId: owner.workspaceId,
        position,
        url: `https://${suffix}-${position}.example.com`,
        normalizedUrl: `https://${suffix}-${position}.example.com/`,
        domain: `${suffix}-${position}.example.com`,
        status: options.itemStatus,
        attemptCount: options.itemStatus === "queued" ? 0 : 1,
        manualRetryCount: options.manualRetryCount ?? 0,
        retryable: options.retryable,
        creditSettled: options.creditSettled ?? true,
        cacheHitCount: 0,
        qaSelected: false,
        qaStatus: "skipped",
        createdAt: now,
        updatedAt: now,
      }))
    }
    return { batchAuditJobId, batchAuditItemIds }
  })
}

function asIdentity(owner: SeedOwner) {
  return {
    tokenIdentifier: owner.tokenIdentifier,
    email: owner.email,
    name: owner.email,
  }
}

describe("batch audit API authorization", () => {
  test("requires authentication and hides foreign-workspace jobs and items", async () => {
    const t = convexTest(schema, modules)
    const owner = await seedOwner(t, "workspace-a")
    const intruder = await seedOwner(t, "workspace-b")
    const batch = await seedBatch(t, owner, "foreign", {
      status: "queued",
      itemStatus: "queued",
      creditSettled: false,
    })

    await expect(t.query(api.batch_audits.listMyBatches, {})).rejects.toThrow("UNAUTHENTICATED")

    const foreign = t.withIdentity(asIdentity(intruder))
    expect(await foreign.query(api.batch_audits.listMyBatches, {})).toEqual({ items: [], total: 0 })
    expect(await foreign.query(api.batch_audits.getBatch, {
      batchAuditJobId: batch.batchAuditJobId,
    })).toBeNull()
    await expect(foreign.mutation(api.batch_audits.pauseBatch, {
      batchAuditJobId: batch.batchAuditJobId,
    })).rejects.toThrow("Batch not found")
    await expect(foreign.mutation(api.batch_audits.cancelBatch, {
      batchAuditJobId: batch.batchAuditJobId,
    })).rejects.toThrow("Batch not found")
    await expect(foreign.mutation(api.batch_audits.retryBatchItem, {
      batchAuditItemId: batch.batchAuditItemIds[0]!,
    })).rejects.toThrow("Batch item not found")

    const unchanged = await t.run(async (ctx) => ({
      job: await ctx.db.get(batch.batchAuditJobId),
      item: await ctx.db.get(batch.batchAuditItemIds[0]!),
    }))
    expect(unchanged.job?.status).toBe("queued")
    expect(unchanged.item?.status).toBe("queued")
  })
})

describe("batch audit API lifecycle", () => {
  test("pauses, resumes, and cancels queued work while refunding every reservation", async () => {
    const t = convexTest(schema, modules)
    const owner = await seedOwner(t, "lifecycle", { reservedCredits: 2 })
    const batch = await seedBatch(t, owner, "lifecycle", {
      status: "queued",
      itemStatus: "queued",
      itemCount: 2,
      creditSettled: false,
    })
    const authed = t.withIdentity(asIdentity(owner))

    expect(await authed.mutation(api.batch_audits.pauseBatch, {
      batchAuditJobId: batch.batchAuditJobId,
    })).toEqual({ status: "paused", inFlightItems: 0 })
    let snapshot = await authed.query(api.batch_audits.getBatch, {
      batchAuditJobId: batch.batchAuditJobId,
    })
    expect(snapshot?.job.status).toBe("paused")
    expect(snapshot?.items.map((item) => item.status)).toEqual(["paused", "paused"])

    expect(await authed.mutation(api.batch_audits.resumeBatch, {
      batchAuditJobId: batch.batchAuditJobId,
    })).toEqual({ status: "queued" })
    snapshot = await authed.query(api.batch_audits.getBatch, {
      batchAuditJobId: batch.batchAuditJobId,
    })
    expect(snapshot?.job.status).toBe("queued")
    expect(snapshot?.items.map((item) => item.status)).toEqual(["queued", "queued"])

    expect(await authed.mutation(api.batch_audits.cancelBatch, {
      batchAuditJobId: batch.batchAuditJobId,
    })).toEqual({ status: "cancelled", cancelledItems: 2, inFlightItems: 0 })
    const cancelled = await t.run(async (ctx) => ({
      job: await ctx.db.get(batch.batchAuditJobId),
      items: await ctx.db.query("batchAuditItems")
        .withIndex("by_batchAuditJobId_and_position", (q) => q.eq("batchAuditJobId", batch.batchAuditJobId))
        .take(10),
      balance: await ctx.db.query("creditBalances")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", owner.workspaceId))
        .unique(),
      ledger: await ctx.db.query("creditLedger")
        .withIndex("by_workspaceId_and_batchAuditJobId", (q) => q.eq("workspaceId", owner.workspaceId).eq("batchAuditJobId", batch.batchAuditJobId))
        .take(10),
    }))
    expect(cancelled.job).toMatchObject({
      status: "cancelled",
      queuedItems: 0,
      cancelledItems: 2,
      reservedCredits: 0,
      refundedCredits: 2,
    })
    expect(cancelled.items.map((item) => item.status)).toEqual(["cancelled", "cancelled"])
    expect(cancelled.items.every((item) => item.creditSettled)).toBe(true)
    expect(cancelled.balance?.reservedCredits).toBe(0)
    expect(cancelled.ledger.filter((entry) => entry.type === "refund")).toHaveLength(2)
  })

  test("retries only safe failed items and enforces the manual retry ceiling", async () => {
    const t = convexTest(schema, modules)
    const owner = await seedOwner(t, "retry")
    const retryable = await seedBatch(t, owner, "retryable", {
      status: "failed",
      itemStatus: "failed",
      retryable: true,
      creditSettled: true,
    })
    const exhausted = await seedBatch(t, owner, "exhausted", {
      status: "failed",
      itemStatus: "failed",
      retryable: true,
      creditSettled: true,
      manualRetryCount: 2,
    })
    const unsafe = await seedBatch(t, owner, "unsafe", {
      status: "failed",
      itemStatus: "failed",
      retryable: false,
      creditSettled: true,
    })
    const authed = t.withIdentity(asIdentity(owner))

    expect(await authed.mutation(api.batch_audits.retryBatchItem, {
      batchAuditItemId: retryable.batchAuditItemIds[0]!,
    })).toEqual({ status: "queued", retryNumber: 1 })
    const retried = await t.run(async (ctx) => ({
      job: await ctx.db.get(retryable.batchAuditJobId),
      item: await ctx.db.get(retryable.batchAuditItemIds[0]!),
      balance: await ctx.db.query("creditBalances")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", owner.workspaceId))
        .unique(),
      ledger: await ctx.db.query("creditLedger")
        .withIndex("by_batchAuditItemId", (q) => q.eq("batchAuditItemId", retryable.batchAuditItemIds[0]!))
        .take(10),
    }))
    expect(retried.item).toMatchObject({
      status: "queued",
      manualRetryCount: 1,
      creditSettled: false,
    })
    expect(retried.job).toMatchObject({
      status: "queued",
      queuedItems: 1,
      failedItems: 0,
      reservedCredits: 1,
    })
    expect(retried.balance?.reservedCredits).toBe(1)
    expect(retried.ledger).toHaveLength(1)
    expect(retried.ledger[0]).toMatchObject({ type: "reserve", reason: "batch_audit_retry" })

    await expect(authed.mutation(api.batch_audits.retryBatchItem, {
      batchAuditItemId: retryable.batchAuditItemIds[0]!,
    })).rejects.toThrow("cannot be retried safely")
    await expect(authed.mutation(api.batch_audits.retryBatchItem, {
      batchAuditItemId: exhausted.batchAuditItemIds[0]!,
    })).rejects.toThrow("Manual retry limit reached")
    await expect(authed.mutation(api.batch_audits.retryBatchItem, {
      batchAuditItemId: unsafe.batchAuditItemIds[0]!,
    })).rejects.toThrow("cannot be retried safely")
  })
})
