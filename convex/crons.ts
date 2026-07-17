import { cronJobs } from "convex/server"
import { v } from "convex/values"

import { internal } from "./_generated/api"
import { internalMutation } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { hasAccurateViewAggregate } from "./lib/report_view_stats"
import { webhookWorkpool } from "./workpools"

const DAY_MS = 86_400_000
const BATCH_SIZE = 100
const cursorValidator = v.union(v.string(), v.null())

async function dispatchIntegrationRun(
  ctx: MutationCtx,
  run: { _id: Id<"integrationRuns">; kind: string },
) {
  if (run.kind === "webhook_delivery") {
    await webhookWorkpool.enqueueAction(
      ctx,
      internal.integration_actions.processIntegrationRun,
      { runId: run._id },
      { retry: false },
    )
    return
  }
  await ctx.scheduler.runAfter(0, internal.integration_actions.processIntegrationRun, { runId: run._id })
}

async function isExtended(ctx: MutationCtx, workspaceId: string) {
  const id = ctx.db.normalizeId("workspaces", workspaceId)
  if (!id) return false
  const workspace = await ctx.db.get(id)
  return workspace?.retentionMode === "extended"
}

export const purgeExpiredReportViews = internalMutation({
  args: { cursor: v.optional(cursorValidator) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("reportViews").withIndex("by_viewedAt", (q) => q.lt("viewedAt", Date.now() - 30 * DAY_MS)).paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null })
    let deleted = 0
    for (const row of page.page) {
      if (row.includedInStats !== true) {
        const stats = await ctx.db
          .query("reportViewStats")
          .withIndex("by_auditId", (q) => q.eq("auditId", row.auditId))
          .unique()
        if (!hasAccurateViewAggregate(stats)) continue
      }
      await ctx.db.delete(row._id)
      deleted += 1
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.crons.purgeExpiredReportViews, { cursor: page.continueCursor })
    return { deleted, isDone: page.isDone }
  },
})

export const purgeExpiredProviderCalls = internalMutation({
  args: { cursor: v.optional(cursorValidator) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("providerCalls").withIndex("by_createdAt", (q) => q.lt("createdAt", Date.now() - 30 * DAY_MS)).paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null })
    let deleted = 0
    for (const row of page.page) if (!(await isExtended(ctx, row.workspaceId))) { await ctx.db.delete(row._id); deleted++ }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.crons.purgeExpiredProviderCalls, { cursor: page.continueCursor })
    return { deleted, isDone: page.isDone }
  },
})

export const purgeExpiredAgentRuns = internalMutation({
  args: { cursor: v.optional(cursorValidator) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("auditAgentRuns").withIndex("by_createdAt", (q) => q.lt("createdAt", Date.now() - 30 * DAY_MS)).paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null })
    let deleted = 0
    for (const row of page.page) if (!(await isExtended(ctx, row.workspaceId))) { await ctx.db.delete(row._id); deleted++ }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.crons.purgeExpiredAgentRuns, { cursor: page.continueCursor })
    return { deleted, isDone: page.isDone }
  },
})

export const purgeExpiredExtractedMarkdown = internalMutation({
  args: { cursor: v.optional(cursorValidator) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("auditRawData").withIndex("by_createdAt", (q) => q.lt("createdAt", Date.now() - 30 * DAY_MS)).paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null })
    let cleared = 0
    for (const row of page.page) if (row.extractedMarkdown && !(await isExtended(ctx, row.workspaceId))) { await ctx.db.patch(row._id, { extractedMarkdown: undefined }); cleared++ }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.crons.purgeExpiredExtractedMarkdown, { cursor: page.continueCursor })
    return { deleted: cleared, isDone: page.isDone }
  },
})

export const purgeExpiredScreenshots = internalMutation({
  args: { cursor: v.optional(cursorValidator) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("auditAssets").withIndex("by_createdAt", (q) => q.lt("createdAt", Date.now() - 90 * DAY_MS)).paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null })
    let deleted = 0
    for (const row of page.page) {
      if (row.type === "pdf" || await isExtended(ctx, row.workspaceId)) continue
      const cacheEntry = row.auditCacheEntryId ? await ctx.db.get(row.auditCacheEntryId) : null
      if (cacheEntry) {
        const referenceCount = Math.max(0, cacheEntry.referenceCount - 1)
        if (referenceCount === 0 && cacheEntry.expiresAt <= Date.now()) {
          if (cacheEntry.storageId) await ctx.storage.delete(cacheEntry.storageId)
          await ctx.db.delete(cacheEntry._id)
        } else {
          await ctx.db.patch(cacheEntry._id, { referenceCount, updatedAt: Date.now() })
        }
      } else if (row.storageId) {
        await ctx.storage.delete(row.storageId)
      }
      await ctx.db.delete(row._id)
      deleted++
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.crons.purgeExpiredScreenshots, { cursor: page.continueCursor })
    return { deleted, isDone: page.isDone }
  },
})

export const purgeExpiredAuditCacheEntries = internalMutation({
  args: { cursor: v.optional(cursorValidator) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("auditCacheEntries")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", Date.now()))
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null })
    let deleted = 0
    for (const row of page.page) {
      const retainedAsset = await ctx.db
        .query("auditAssets")
        .withIndex("by_auditCacheEntryId", (q) => q.eq("auditCacheEntryId", row._id))
        .first()
      if (retainedAsset) continue
      if (row.storageId) await ctx.storage.delete(row.storageId)
      await ctx.db.delete(row._id)
      deleted += 1
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.crons.purgeExpiredAuditCacheEntries, {
        cursor: page.continueCursor,
      })
    }
    return { deleted, isDone: page.isDone }
  },
})

function longRetentionMutation(table: "usageEvents" | "providerCosts" | "adminActions") {
  return internalMutation({
    args: { cursor: v.optional(cursorValidator) },
    handler: async (ctx, args) => {
      const cutoff = Date.now() - 730 * DAY_MS
      const page = table === "usageEvents"
        ? await ctx.db.query("usageEvents").withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff)).paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null })
        : table === "providerCosts"
          ? await ctx.db.query("providerCosts").withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff)).paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null })
          : await ctx.db.query("adminActions").withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff)).paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null })
      let deleted = 0
      for (const row of page.page) if (!(await isExtended(ctx, row.workspaceId))) { await ctx.db.delete(row._id); deleted++ }
      const ref = table === "usageEvents" ? internal.crons.purgeExpiredUsageEvents : table === "providerCosts" ? internal.crons.purgeExpiredProviderCosts : internal.crons.purgeExpiredAdminActions
      if (!page.isDone) await ctx.scheduler.runAfter(0, ref, { cursor: page.continueCursor })
      return { deleted, isDone: page.isDone }
    },
  })
}

export const purgeExpiredUsageEvents = longRetentionMutation("usageEvents")
export const purgeExpiredProviderCosts = longRetentionMutation("providerCosts")
export const purgeExpiredAdminActions = longRetentionMutation("adminActions")

export const purgeExpiredIntegrationEphemera = internalMutation({
  args: { cursor: v.optional(cursorValidator) },
  handler: async (ctx, args) => {
    const now = Date.now()
    const page = await ctx.db.query("integrationOAuthStates").withIndex("by_expiresAt", (q) => q.lt("expiresAt", now)).paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null })
    for (const row of page.page) await ctx.db.delete(row._id)
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.crons.purgeExpiredIntegrationEphemera, { cursor: page.continueCursor })
    return { deleted: page.page.length, isDone: page.isDone }
  },
})

export const purgeExpiredGmailIntents = internalMutation({
  args: { cursor: v.optional(cursorValidator) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("gmailDraftIntents").withIndex("by_expiresAt", (q) => q.lt("expiresAt", Date.now())).paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null })
    let deleted = 0
    for (const row of page.page) {
      const run = row.runId ? await ctx.db.get(row.runId) : null
      if (run && ["queued", "running", "retryable_failed"].includes(run.status)) continue
      await ctx.db.delete(row._id)
      deleted++
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.crons.purgeExpiredGmailIntents, { cursor: page.continueCursor })
    return { deleted, isDone: page.isDone }
  },
})

export const purgeExpiredSheetSnapshots = internalMutation({
  args: { cursor: v.optional(cursorValidator) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("sheetImportSnapshots").withIndex("by_expiresAt", (q) => q.lt("expiresAt", Date.now())).paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null })
    for (const row of page.page) await ctx.db.delete(row._id)
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.crons.purgeExpiredSheetSnapshots, { cursor: page.continueCursor })
    return { deleted: page.page.length, isDone: page.isDone }
  },
})

export const purgeExpiredIntegrationRuns = internalMutation({
  args: { cursor: v.optional(cursorValidator) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("integrationRuns").withIndex("by_createdAt", (q) => q.lt("createdAt", Date.now() - 30 * DAY_MS)).paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null })
    let deleted = 0
    for (const row of page.page) {
      if (["queued", "running", "retryable_failed"].includes(row.status)) continue
      await ctx.db.delete(row._id)
      deleted++
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.crons.purgeExpiredIntegrationRuns, { cursor: page.continueCursor })
    return { deleted, isDone: page.isDone }
  },
})

export const purgeExpiredIntegrationEvents = internalMutation({
  args: { cursor: v.optional(cursorValidator) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("integrationEvents").withIndex("by_createdAt", (q) => q.lt("createdAt", Date.now() - 30 * DAY_MS)).paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null })
    let deleted = 0
    for (const row of page.page) {
      const delivery = await ctx.db.query("integrationRuns").withIndex("by_integrationEventId", (q) => q.eq("integrationEventId", row._id)).first()
      if (delivery) continue
      await ctx.db.delete(row._id)
      deleted++
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.crons.purgeExpiredIntegrationEvents, { cursor: page.continueCursor })
    return { deleted, isDone: page.isDone }
  },
})

export const dispatchDueIntegrationRuns = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const due = await ctx.db.query("integrationRuns").withIndex("by_status_and_nextAttemptAt", (q) => q.eq("status", "retryable_failed").lte("nextAttemptAt", now)).take(100)
    for (const run of due) await dispatchIntegrationRun(ctx, run)
    const expiredLeases = await ctx.db.query("integrationRuns").withIndex("by_status_and_leaseExpiresAt", (q) => q.eq("status", "running").lte("leaseExpiresAt", now)).take(100)
    for (const run of expiredLeases) {
      if (run.attemptCount >= run.maxAttempts) {
        await ctx.db.patch(run._id, { status: "permanent_failed", errorCode: "LEASE_EXPIRED", errorMessage: "Integrationslauf konnte nicht abgeschlossen werden.", leaseToken: undefined, leaseExpiresAt: undefined, completedAt: now, updatedAt: now })
      } else {
        await ctx.db.patch(run._id, { status: "retryable_failed", errorCode: "LEASE_EXPIRED", errorMessage: "Integrationslauf wird erneut versucht.", nextAttemptAt: now, leaseToken: undefined, leaseExpiresAt: undefined, updatedAt: now })
        await dispatchIntegrationRun(ctx, run)
      }
    }
    return { due: due.length, recovered: expiredLeases.length }
  },
})

const crons = cronJobs()
crons.interval("purge report views", { hours: 24 }, internal.crons.purgeExpiredReportViews, {})
crons.interval("purge provider calls", { hours: 24 }, internal.crons.purgeExpiredProviderCalls, {})
crons.interval("purge agent runs", { hours: 24 }, internal.crons.purgeExpiredAgentRuns, {})
crons.interval("purge extracted markdown", { hours: 24 }, internal.crons.purgeExpiredExtractedMarkdown, {})
crons.interval("purge screenshots", { hours: 24 }, internal.crons.purgeExpiredScreenshots, {})
crons.interval("purge audit cache", { hours: 24 }, internal.crons.purgeExpiredAuditCacheEntries, {})
crons.interval("purge usage events", { hours: 24 }, internal.crons.purgeExpiredUsageEvents, {})
crons.interval("purge provider costs", { hours: 24 }, internal.crons.purgeExpiredProviderCosts, {})
crons.interval("purge admin actions", { hours: 24 }, internal.crons.purgeExpiredAdminActions, {})
crons.interval("purge integration oauth states", { hours: 1 }, internal.crons.purgeExpiredIntegrationEphemera, {})
crons.interval("purge gmail draft intents", { hours: 1 }, internal.crons.purgeExpiredGmailIntents, {})
crons.interval("purge sheet snapshots", { hours: 1 }, internal.crons.purgeExpiredSheetSnapshots, {})
crons.interval("purge integration runs", { hours: 24 }, internal.crons.purgeExpiredIntegrationRuns, {})
crons.interval("purge integration events", { hours: 24 }, internal.crons.purgeExpiredIntegrationEvents, {})
crons.interval("purge eval metrics", { hours: 24 }, internal.eve_evals.deleteExpiredEvalRuns, {})
crons.interval("dispatch due integration runs", { minutes: 1 }, internal.crons.dispatchDueIntegrationRuns, {})
crons.interval("retry deletion jobs", { minutes: 15 }, internal.deletion.retryStaleDeletionJobs, {})
crons.interval("recover prepared account deletions", { minutes: 15 }, internal.deletion.recoverPreparedWorkspaceDeletions, {})
crons.interval("reconcile provider costs", { hours: 24 }, internal.provider_billing.reconcileProviderCosts, {})
crons.interval("purge expired report grants", { hours: 1 }, internal.lib.report_access.purgeExpiredAccessGrants, {})
crons.interval("recheck report domains", { hours: 24 }, internal.report_domains.recheckReportDomains, {})
export default crons
