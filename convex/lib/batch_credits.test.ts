/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import schema from "../schema"
import {
  consumeWorkspaceBatchItemCredit,
  releaseWorkspaceBatchItemCredit,
  reserveWorkspaceBatchCredits,
} from "./credits"

const modules = import.meta.glob(["../_generated/*.js"])

async function seedCreditWorkspace(t: ReturnType<typeof convexTest>, availableCredits = 10) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const userId = await ctx.db.insert("users", {
      tokenIdentifier: `batch-credit-user-${now}`,
      betterAuthUserId: `batch-credit-auth-${now}`,
      email: `batch-credit-${now}@example.com`,
      createdAt: now,
    })
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Batch Credits",
      ownerUserId: userId,
      reportLanguage: "de",
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert("creditBalances", {
      workspaceId,
      periodStart: now,
      periodEnd: now + 86_400_000,
      monthlyCredits: availableCredits,
      extraCredits: 0,
      usedMonthlyCredits: 0,
      usedExtraCredits: 0,
      reservedCredits: 0,
      updatedAt: now,
    })
    return { userId, workspaceId }
  })
}

async function seedBatchJob(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  workspaceId: Id<"workspaces">,
  suffix: string,
) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert("batchAuditJobs", {
      workspaceId,
      createdByUserId: userId,
      source: "csv",
      planSnapshot: "agency",
      planLimitSnapshot: 25,
      maxParallelismSnapshot: 2,
      auditType: "standard",
      reportLanguage: "de",
      idempotencyKey: `batch-credit-job-${suffix}`,
      status: "queued",
      totalItems: 2,
      queuedItems: 2,
      runningItems: 0,
      completedItems: 0,
      failedItems: 0,
      cancelledItems: 0,
      initialReservedCredits: 2,
      reservedCredits: 2,
      consumedCredits: 0,
      refundedCredits: 0,
      cacheHitItems: 0,
      cacheHitOperations: 0,
      qaSelectedItems: 0,
      qaPassedItems: 0,
      qaFailedItems: 0,
      createdAt: now,
      updatedAt: now,
    })
  })
}

async function seedBatchItem(
  t: ReturnType<typeof convexTest>,
  batchAuditJobId: Id<"batchAuditJobs">,
  workspaceId: Id<"workspaces">,
  position: number,
) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert("batchAuditItems", {
      batchAuditJobId,
      workspaceId,
      position,
      url: `https://credit-${position}.example.com`,
      normalizedUrl: `https://credit-${position}.example.com/`,
      domain: `credit-${position}.example.com`,
      status: "queued",
      attemptCount: 0,
      manualRetryCount: 0,
      creditSettled: false,
      cacheHitCount: 0,
      qaSelected: false,
      qaStatus: "pending",
      createdAt: now,
      updatedAt: now,
    })
  })
}

describe("batch credit invariants", () => {
  test("reserves an aggregate exactly once for an idempotent batch start", async () => {
    const t = convexTest(schema, modules)
    const { userId, workspaceId } = await seedCreditWorkspace(t)
    const batchAuditJobId = await seedBatchJob(t, userId, workspaceId, "idempotent")

    for (let attempt = 0; attempt < 2; attempt++) {
      await t.run((ctx) => reserveWorkspaceBatchCredits(
        ctx as MutationCtx,
        workspaceId,
        userId,
        batchAuditJobId,
        2,
        "batch-reserve:idempotent",
      ))
    }

    const result = await t.run(async (ctx) => ({
      balance: await ctx.db.query("creditBalances").withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId)).unique(),
      ledger: await ctx.db.query("creditLedger").withIndex("by_workspaceId_and_batchAuditJobId", (q) => q.eq("workspaceId", workspaceId).eq("batchAuditJobId", batchAuditJobId)).take(10),
    }))
    expect(result.balance?.reservedCredits).toBe(2)
    expect(result.ledger).toHaveLength(1)
    expect(result.ledger[0]).toMatchObject({ type: "reserve", amount: 2, reason: "batch_audit_start" })
  })

  test("rejects idempotency-key conflicts and insufficient aggregate credit without a partial reservation", async () => {
    const t = convexTest(schema, modules)
    const { userId, workspaceId } = await seedCreditWorkspace(t, 2)
    const firstJobId = await seedBatchJob(t, userId, workspaceId, "first")
    const secondJobId = await seedBatchJob(t, userId, workspaceId, "second")
    await t.run((ctx) => reserveWorkspaceBatchCredits(ctx as MutationCtx, workspaceId, userId, firstJobId, 1, "batch-reserve:shared"))

    await expect(t.run((ctx) => reserveWorkspaceBatchCredits(
      ctx as MutationCtx,
      workspaceId,
      userId,
      secondJobId,
      1,
      "batch-reserve:shared",
    ))).rejects.toThrow("IDEMPOTENCY_CONFLICT")
    await expect(t.run((ctx) => reserveWorkspaceBatchCredits(
      ctx as MutationCtx,
      workspaceId,
      userId,
      secondJobId,
      2,
      "batch-reserve:insufficient",
    ))).rejects.toThrow("INSUFFICIENT_CREDITS")

    const result = await t.run(async (ctx) => ({
      balance: await ctx.db.query("creditBalances").withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId)).unique(),
      secondLedger: await ctx.db.query("creditLedger").withIndex("by_workspaceId_and_batchAuditJobId", (q) => q.eq("workspaceId", workspaceId).eq("batchAuditJobId", secondJobId)).take(10),
    }))
    expect(result.balance?.reservedCredits).toBe(1)
    expect(result.secondLedger).toHaveLength(0)
  })

  test("consumes and refunds reserved item credits idempotently", async () => {
    const t = convexTest(schema, modules)
    const { userId, workspaceId } = await seedCreditWorkspace(t)
    const batchAuditJobId = await seedBatchJob(t, userId, workspaceId, "settlement")
    const completedItemId = await seedBatchItem(t, batchAuditJobId, workspaceId, 0)
    const failedItemId = await seedBatchItem(t, batchAuditJobId, workspaceId, 1)
    const auditId = await t.run((ctx) => ctx.db.insert("audits", {
      workspaceId,
      createdByUserId: userId,
      batchAuditJobId,
      batchAuditItemId: completedItemId,
      url: "https://credit-0.example.com",
      normalizedUrl: "https://credit-0.example.com/",
      domain: "credit-0.example.com",
      auditType: "standard",
      reportLanguage: "de",
      idempotencyKey: "batch-credit-audit",
      status: "completed",
      publicSlug: "batch-credit-audit",
      isPublic: false,
      reportVersion: "v1",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }))
    await t.run((ctx) => reserveWorkspaceBatchCredits(ctx as MutationCtx, workspaceId, userId, batchAuditJobId, 2, "batch-reserve:settlement"))

    for (let attempt = 0; attempt < 2; attempt++) {
      await t.run((ctx) => consumeWorkspaceBatchItemCredit(ctx as MutationCtx, {
        workspaceId,
        batchAuditJobId,
        batchAuditItemId: completedItemId,
        auditId,
        idempotencyKey: "batch-consume:item-0",
      }))
      await t.run((ctx) => releaseWorkspaceBatchItemCredit(ctx as MutationCtx, {
        workspaceId,
        batchAuditJobId,
        batchAuditItemId: failedItemId,
        idempotencyKey: "batch-refund:item-1",
        reason: "batch_audit_failed",
      }))
    }

    const result = await t.run(async (ctx) => ({
      balance: await ctx.db.query("creditBalances").withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId)).unique(),
      itemLedger: await ctx.db.query("creditLedger").withIndex("by_workspaceId_and_batchAuditJobId", (q) => q.eq("workspaceId", workspaceId).eq("batchAuditJobId", batchAuditJobId)).take(10),
    }))
    expect(result.balance).toMatchObject({ reservedCredits: 0, usedMonthlyCredits: 1, usedExtraCredits: 0 })
    expect(result.itemLedger.filter((entry) => entry.type === "consume")).toHaveLength(1)
    expect(result.itemLedger.filter((entry) => entry.type === "refund")).toHaveLength(1)
  })
})
