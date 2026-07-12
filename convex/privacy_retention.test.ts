/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { describe, expect, test, vi } from "vitest"

import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

vi.mock("./auth", () => ({
  authComponent: {
    getAuthUser: async (ctx: { auth: { getUserIdentity: () => Promise<{ email?: string; name?: string } | null> } }) => {
      const identity = await ctx.auth.getUserIdentity()
      return identity?.email ? { _id: "better-auth-test-user", email: identity.email, name: identity.name } : null
    },
  },
}))

const modules = import.meta.glob([
  "./workspaces.ts", "./retention.ts", "./crons.ts", "./deletion.ts", "./audit_state.ts",
  "./lib/workspace.ts", "./lib/credits.ts", "./lib/rate_limit_helpers.ts",
  "./_generated/*.js",
])

async function seedWorkspace(t: ReturnType<typeof convexTest>, mode: "standard" | "extended" = "standard") {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const userId = await ctx.db.insert("users", { tokenIdentifier: "privacy-user", betterAuthUserId: "better-auth-test-user", email: "privacy@example.com", createdAt: now })
    const workspaceId = await ctx.db.insert("workspaces", { name: "Privacy", ownerUserId: userId, reportLanguage: "de", retentionMode: mode, createdAt: now, updatedAt: now })
    return { userId, workspaceId }
  })
}

async function seedAudit(t: ReturnType<typeof convexTest>, userId: Id<"users">, workspaceId: Id<"workspaces">) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert("audits", { workspaceId, createdByUserId: userId, url: "https://example.com", normalizedUrl: "https://example.com/", domain: "example.com", auditType: "standard", reportLanguage: "de", idempotencyKey: `privacy-${now}`, status: "completed", publicSlug: `privacy-${now}`, isPublic: true, reportVersion: "v1", createdAt: now, updatedAt: now })
  })
}

describe("privacy retention backend", () => {
  test("workspace bootstrap records signed_up once at workspace creation time", async () => {
    const t = convexTest(schema, modules).withIdentity({
      tokenIdentifier: "signup-user",
      email: "signup@example.com",
      name: "Signup",
    })

    const first = await t.mutation(api.workspaces.ensureCurrentWorkspace, {})
    await t.mutation(api.workspaces.ensureCurrentWorkspace, {})

    const result = await t.run(async (ctx) => ({
      workspace: await ctx.db.get(first.workspaceId),
      events: await ctx.db
        .query("usageEvents")
        .withIndex("by_workspaceId_and_event", (q) =>
          q.eq("workspaceId", first.workspaceId).eq("event", "signed_up"),
        )
        .take(10),
    }))
    expect(result.events).toHaveLength(1)
    expect(result.events[0]?.createdAt).toBe(result.workspace?.createdAt)
  })

  test("requires authentication and the exact policy version for retention consent", async () => {
    const t = convexTest(schema, modules)
    await seedWorkspace(t)
    await expect(t.mutation(api.workspaces.setRetentionPreference, { mode: "extended", policyVersion: "2026-07-11" })).rejects.toThrow()
    const authed = t.withIdentity({ tokenIdentifier: "privacy-user", email: "privacy@example.com" })
    await expect(authed.mutation(api.workspaces.setRetentionPreference, { mode: "extended", policyVersion: "old" })).rejects.toThrow()
    const result = await authed.mutation(api.workspaces.setRetentionPreference, { mode: "extended", policyVersion: "2026-07-11" })
    expect(result.mode).toBe("extended")
    const workspace = await authed.query(api.workspaces.getMyWorkspace, {})
    expect(workspace.workspace.retentionMode).toBe("extended")
  })

  test("always purges identifying report views but preserves extended provider data", async () => {
    const t = convexTest(schema, modules)
    const standard = await seedWorkspace(t, "standard")
    const extended = await t.run(async (ctx) => {
      const now = Date.now()
      const userId = await ctx.db.insert("users", { tokenIdentifier: "extended", betterAuthUserId: "extended", email: "extended@example.com", createdAt: now })
      const workspaceId = await ctx.db.insert("workspaces", { name: "Extended", ownerUserId: userId, reportLanguage: "de", retentionMode: "extended", createdAt: now, updatedAt: now })
      return { userId, workspaceId }
    })
    const standardAudit = await seedAudit(t, standard.userId, standard.workspaceId)
    const extendedAudit = await seedAudit(t, extended.userId, extended.workspaceId)
    const old = Date.now() - 40 * 86_400_000
    await t.run(async (ctx) => {
      for (const [workspaceId, auditId] of [[standard.workspaceId, standardAudit], [extended.workspaceId, extendedAudit]] as const) {
        await ctx.db.insert("reportViews", { workspaceId, auditId, viewerIpHash: "hash", viewedAt: old })
        await ctx.db.insert("providerCalls", { workspaceId, auditId, provider: "openai", operation: "audit", status: "completed", attempt: 1, startedAt: old, createdAt: old })
      }
    })
    await t.mutation(internal.crons.purgeExpiredReportViews, {})
    await t.mutation(internal.crons.purgeExpiredProviderCalls, {})
    const counts = await t.run(async (ctx) => ({
      views: (await ctx.db.query("reportViews").take(10)).length,
      standard: (await ctx.db.query("providerCalls").withIndex("by_workspaceId", q => q.eq("workspaceId", standard.workspaceId)).take(10)).length,
      extended: (await ctx.db.query("providerCalls").withIndex("by_workspaceId", q => q.eq("workspaceId", extended.workspaceId)).take(10)).length,
    }))
    expect(counts).toEqual({ views: 0, standard: 0, extended: 1 })
  })

  test("blocks account deletion with an active subscription and prepares a durable job otherwise", async () => {
    const t = convexTest(schema, modules)
    const { workspaceId } = await seedWorkspace(t)
    const now = Date.now()
    const subscriptionId = await t.run(ctx => ctx.db.insert("subscriptions", { workspaceId, provider: "lemonsqueezy", plan: "starter", status: "active", createdAt: now, updatedAt: now }))
    expect((await t.query(internal.deletion.checkAccountDeletionAllowed, { betterAuthUserId: "better-auth-test-user" })).allowed).toBe(false)
    await t.run(ctx => ctx.db.patch(subscriptionId, { status: "cancelled", currentPeriodEnd: Date.now() + 60_000 }))
    await expect(
      t.mutation(internal.deletion.prepareWorkspaceDeletionForAuthUser, {
        betterAuthUserId: "better-auth-test-user",
      }),
    ).rejects.toThrow("ACTIVE_SUBSCRIPTION")
    await t.run(ctx => ctx.db.patch(subscriptionId, { status: "cancelled", currentPeriodEnd: Date.now() - 1 }))
    expect((await t.query(internal.deletion.checkAccountDeletionAllowed, { betterAuthUserId: "better-auth-test-user" })).allowed).toBe(true)
    await t.mutation(internal.deletion.prepareWorkspaceDeletionForAuthUser, { betterAuthUserId: "better-auth-test-user" })
    const prepared = await t.run(async ctx => ({ workspace: await ctx.db.get(workspaceId), jobs: await ctx.db.query("deletionJobs").take(10) }))
    expect(prepared.workspace?.deletionRequestedAt).toBeUndefined()
    expect(prepared.jobs[0]?.status).toBe("prepared")
  })

  test("clears standard markdown and screenshots while extended retention preserves them", async () => {
    const t = convexTest(schema, modules)
    const standard = await seedWorkspace(t, "standard")
    const extended = await t.run(async (ctx) => {
      const now = Date.now()
      const userId = await ctx.db.insert("users", { tokenIdentifier: "keep", betterAuthUserId: "keep", email: "keep@example.com", createdAt: now })
      const workspaceId = await ctx.db.insert("workspaces", { name: "Keep", ownerUserId: userId, reportLanguage: "de", retentionMode: "extended", createdAt: now, updatedAt: now })
      return { userId, workspaceId }
    })
    const standardAudit = await seedAudit(t, standard.userId, standard.workspaceId)
    const extendedAudit = await seedAudit(t, extended.userId, extended.workspaceId)
    const old = Date.now() - 100 * 86_400_000
    const ids = await t.run(async (ctx) => {
      const standardRaw = await ctx.db.insert("auditRawData", { workspaceId: standard.workspaceId, auditId: standardAudit, extractedMarkdown: "delete", createdAt: old })
      const extendedRaw = await ctx.db.insert("auditRawData", { workspaceId: extended.workspaceId, auditId: extendedAudit, extractedMarkdown: "keep", createdAt: old })
      const standardStorage = await ctx.storage.store(new Blob(["standard"], { type: "image/png" }))
      const extendedStorage = await ctx.storage.store(new Blob(["extended"], { type: "image/png" }))
      await ctx.db.insert("auditAssets", { workspaceId: standard.workspaceId, auditId: standardAudit, type: "desktop_screenshot", storageProvider: "convex", storageId: standardStorage, createdAt: old })
      await ctx.db.insert("auditAssets", { workspaceId: extended.workspaceId, auditId: extendedAudit, type: "desktop_screenshot", storageProvider: "convex", storageId: extendedStorage, createdAt: old })
      return { standardRaw, extendedRaw, standardStorage, extendedStorage }
    })
    await t.mutation(internal.crons.purgeExpiredExtractedMarkdown, {})
    await t.mutation(internal.crons.purgeExpiredScreenshots, {})
    const remaining = await t.run(async ctx => ({
      standardRaw: await ctx.db.get(ids.standardRaw), extendedRaw: await ctx.db.get(ids.extendedRaw),
      standardStorage: await ctx.db.system.get("_storage", ids.standardStorage), extendedStorage: await ctx.db.system.get("_storage", ids.extendedStorage),
    }))
    expect(remaining.standardRaw?.extractedMarkdown).toBeUndefined()
    expect(remaining.extendedRaw?.extractedMarkdown).toBe("keep")
    expect(remaining.standardStorage).toBeNull()
    expect(remaining.extendedStorage).not.toBeNull()
  })

  test("audit deletion removes Convex storage and the audit through resumable phases", async () => {
    vi.useFakeTimers()
    const t = convexTest(schema, modules)
    const { userId, workspaceId } = await seedWorkspace(t)
    const auditId = await seedAudit(t, userId, workspaceId)
    const { storageId, jobId } = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["image"], { type: "image/png" }))
      await ctx.db.insert("auditAssets", { workspaceId, auditId, type: "desktop_screenshot", storageProvider: "convex", storageId, mimeType: "image/png", createdAt: Date.now() })
      await ctx.db.insert("usageEvents", {
        workspaceId,
        userId,
        event: "first_shared_report",
        idempotencyKey: `first_shared_report:${workspaceId}`,
        createdAt: Date.now(),
      })
      const jobId = await ctx.db.insert("deletionJobs", { kind: "audit", workspaceId, auditId, phase: "auditAssets", status: "pending", createdAt: Date.now(), updatedAt: Date.now() })
      return { storageId, jobId }
    })
    await t.mutation(internal.deletion.processAuditDeletion, { jobId })
    await t.finishAllScheduledFunctions(() => vi.runAllTimers())
    const remaining = await t.run(async ctx => ({
      audit: await ctx.db.get(auditId),
      asset: await ctx.db.system.get("_storage", storageId),
      milestones: await ctx.db.query("usageEvents").withIndex("by_workspaceId_and_event", q => q.eq("workspaceId", workspaceId).eq("event", "first_shared_report")).take(10),
    }))
    expect(remaining.audit).toBeNull()
    expect(remaining.asset).toBeNull()
    expect(remaining.milestones).toHaveLength(1)
    vi.useRealTimers()
  })

  test("deletion-pending audits reject late pipeline writes", async () => {
    const t = convexTest(schema, modules)
    const { userId, workspaceId } = await seedWorkspace(t)
    const auditId = await seedAudit(t, userId, workspaceId)
    await t.run((ctx) =>
      ctx.db.patch(auditId, {
        status: "cancelled",
        deletionRequestedAt: Date.now(),
        cancelledAt: Date.now(),
      }),
    )

    await expect(
      t.mutation(internal.audit_state.upsertAuditRawData, {
        workspaceId,
        auditId,
        extractedMarkdown: "must not be recreated",
      }),
    ).rejects.toThrow("AUDIT_DELETION_PENDING")

    const rawRows = await t.run((ctx) =>
      ctx.db.query("auditRawData").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).take(1),
    )
    expect(rawRows).toHaveLength(0)
  })

  test("workspace deletion removes owned data and storage but unlinks retained billing events", async () => {
    vi.useFakeTimers()
    const t = convexTest(schema, modules)
    const { userId, workspaceId } = await seedWorkspace(t)
    const auditId = await seedAudit(t, userId, workspaceId)
    const seeded = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["workspace-image"], { type: "image/png" }))
      await ctx.db.insert("auditAssets", { workspaceId, auditId, type: "desktop_screenshot", storageProvider: "convex", storageId, createdAt: Date.now() })
      await ctx.db.insert("usageEvents", { workspaceId, userId, auditId, event: "audit_completed", createdAt: Date.now() })
      await ctx.db.insert("outreachTemplates", { workspaceId, createdByUserId: userId, name: "Follow-up", type: "follow_up", body: "Hallo", createdAt: Date.now(), updatedAt: Date.now() })
      await ctx.db.insert("notifications", { workspaceId, auditId, recipientUserId: userId, type: "first_open", idempotencyKey: `first_open:${auditId}`, createdAt: Date.now() })
      const billingEventId = await ctx.db.insert("billingEvents", { provider: "lemonsqueezy", providerEventId: "retained-billing", eventName: "order_created", workspaceId, testMode: true, status: "processed", processedAt: Date.now() })
      return { storageId, billingEventId }
    })
    await t.mutation(internal.deletion.prepareWorkspaceDeletionForAuthUser, { betterAuthUserId: "better-auth-test-user" })
    await t.mutation(internal.deletion.startWorkspaceDeletionForAuthUser, { betterAuthUserId: "better-auth-test-user" })
    await t.finishAllScheduledFunctions(() => vi.runAllTimers())
    const remaining = await t.run(async ctx => ({
      user: await ctx.db.get(userId), workspace: await ctx.db.get(workspaceId), audit: await ctx.db.get(auditId),
      storage: await ctx.db.system.get("_storage", seeded.storageId), billing: await ctx.db.get(seeded.billingEventId),
      usage: await ctx.db.query("usageEvents").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(1),
      jobs: await ctx.db.query("deletionJobs").take(10),
      templates: await ctx.db.query("outreachTemplates").withIndex("by_workspaceId_and_updatedAt", q => q.eq("workspaceId", workspaceId)).take(1),
      notifications: await ctx.db.query("notifications").withIndex("by_workspaceId_and_createdAt", q => q.eq("workspaceId", workspaceId)).take(1),
    }))
    expect(remaining.user).toBeNull()
    expect(remaining.workspace).toBeNull()
    expect(remaining.audit).toBeNull()
    expect(remaining.storage).toBeNull()
    expect(remaining.usage).toHaveLength(0)
    expect(remaining.billing?.workspaceId).toBeUndefined()
    expect(remaining.jobs).toHaveLength(0)
    expect(remaining.templates).toHaveLength(0)
    expect(remaining.notifications).toHaveLength(0)
    vi.useRealTimers()
  })
})
