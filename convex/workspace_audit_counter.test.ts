/// <reference types="vite/client" />

import { runToCompletion } from "@convex-dev/migrations"
import migrationsComponent from "@convex-dev/migrations/test"
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

import { components, internal } from "./_generated/api"
import schema from "./schema"
import { enqueueAuditDeletion } from "./deletion"
import { incrementWorkspaceAuditTotal } from "./lib/workspace_audit_counter"

const modules = import.meta.glob([
  "./deletion.ts",
  "./migrations.ts",
  "./_generated/*.js",
])

async function seedWorkspace(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = 1_700_000_000_000
    const userId = await ctx.db.insert("users", {
      tokenIdentifier: "counter-owner",
      betterAuthUserId: "counter-owner",
      email: "counter@example.com",
      createdAt: now,
    })
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Counter Workspace",
      ownerUserId: userId,
      reportLanguage: "de",
      createdAt: now,
      updatedAt: now,
    })
    return { now, userId, workspaceId }
  })
}

async function insertAudit(
  t: ReturnType<typeof convexTest>,
  seed: Awaited<ReturnType<typeof seedWorkspace>>,
  suffix: string,
  extra: Record<string, unknown> = {},
) {
  return await t.run(async (ctx) => await ctx.db.insert("audits", {
    workspaceId: seed.workspaceId,
    createdByUserId: seed.userId,
    url: `https://${suffix}.example.com`,
    normalizedUrl: `https://${suffix}.example.com/`,
    domain: `${suffix}.example.com`,
    auditType: "standard",
    reportLanguage: "de",
    idempotencyKey: `counter-${suffix}`,
    status: "completed",
    publicSlug: `counter-${suffix}`,
    isPublic: false,
    reportVersion: "v1",
    createdAt: seed.now,
    updatedAt: seed.now,
    ...extra,
  }))
}

describe("workspace audit counter", () => {
  test("decrements a counted audit exactly once when deletion is enqueued", async () => {
    const t = convexTest(schema, modules)
    const seed = await seedWorkspace(t)
    const auditId = await insertAudit(t, seed, "delete", {
      externalApiId: "aud_delete",
      creationChannel: "ui",
      countedInWorkspaceAuditTotal: true,
    })
    await t.run((ctx) => incrementWorkspaceAuditTotal(ctx, seed.workspaceId))

    const firstJobId = await t.run((ctx) => enqueueAuditDeletion(ctx, auditId, seed.workspaceId))
    const secondJobId = await t.run((ctx) => enqueueAuditDeletion(ctx, auditId, seed.workspaceId))
    const result = await t.run(async (ctx) => ({
      audit: await ctx.db.get(auditId),
      counter: await ctx.db.query("workspaceAuditCounters")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", seed.workspaceId))
        .unique(),
    }))

    expect(secondJobId).toBe(firstJobId)
    expect(result.audit?.countedInWorkspaceAuditTotal).toBe(false)
    expect(result.audit?.deletionRequestedAt).toBeTypeOf("number")
    expect(result.counter?.total).toBe(0)
  })

  test("backfills metadata and exact visible totals idempotently", async () => {
    const t = convexTest(schema, modules)
    migrationsComponent.register(t)
    const seed = await seedWorkspace(t)
    const uiAuditId = await insertAudit(t, seed, "ui")
    const batchAuditId = await insertAudit(t, seed, "batch", {
      batchAuditJobId: undefined,
      batchAuditItemId: undefined,
      creationChannel: "batch",
    })
    const deletedAuditId = await insertAudit(t, seed, "deleted", {
      deletionRequestedAt: seed.now + 1,
    })

    await t.run(async (ctx) => {
      await runToCompletion(ctx, components.migrations, internal.migrations.initializeWorkspaceAuditCounters, {
        name: "test:workspace-audit-counters:init",
        batchSize: 1,
      })
      await runToCompletion(ctx, components.migrations, internal.migrations.backfillWorkspaceAuditMetadataAndCounters, {
        name: "test:workspace-audit-counters:first",
        batchSize: 1,
      })
      await runToCompletion(ctx, components.migrations, internal.migrations.backfillWorkspaceAuditMetadataAndCounters, {
        name: "test:workspace-audit-counters:resume",
        cursor: null,
        batchSize: 1,
      })
    })

    const result = await t.run(async (ctx) => ({
      uiAudit: await ctx.db.get(uiAuditId),
      batchAudit: await ctx.db.get(batchAuditId),
      deletedAudit: await ctx.db.get(deletedAuditId),
      counter: await ctx.db.query("workspaceAuditCounters")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", seed.workspaceId))
        .unique(),
      verification: await ctx.runQuery(internal.migrations.verifyWorkspaceAuditMetadataAndCounters, {}),
    }))

    expect(result.counter?.total).toBe(2)
    expect(result.uiAudit).toMatchObject({ creationChannel: "ui", countedInWorkspaceAuditTotal: true })
    expect(result.batchAudit).toMatchObject({ creationChannel: "batch", countedInWorkspaceAuditTotal: true })
    expect(result.deletedAudit?.countedInWorkspaceAuditTotal).toBe(false)
    expect(result.uiAudit?.externalApiId).toMatch(/^aud_[A-Za-z0-9_-]{22}$/)
    expect(result.deletedAudit?.externalApiId).toMatch(/^aud_[A-Za-z0-9_-]{22}$/)
    expect(result.verification).toEqual({
      complete: true,
      sampleMissingMetadataAuditId: null,
      sampleMissingCounterWorkspaceId: null,
    })
  })
})
