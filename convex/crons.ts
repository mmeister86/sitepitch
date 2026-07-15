import { cronJobs } from "convex/server"
import { v } from "convex/values"

import { internal } from "./_generated/api"
import { internalMutation } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import { hasAccurateViewAggregate } from "./lib/report_view_stats"

const DAY_MS = 86_400_000
const BATCH_SIZE = 100
const cursorValidator = v.union(v.string(), v.null())

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
crons.interval("retry deletion jobs", { minutes: 15 }, internal.deletion.retryStaleDeletionJobs, {})
crons.interval("recover prepared account deletions", { minutes: 15 }, internal.deletion.recoverPreparedWorkspaceDeletions, {})
crons.interval("reconcile provider costs", { hours: 24 }, internal.provider_billing.reconcileProviderCosts, {})
crons.interval("purge expired report grants", { hours: 1 }, internal.lib.report_access.purgeExpiredAccessGrants, {})
crons.interval("recheck report domains", { hours: 24 }, internal.report_domains.recheckReportDomains, {})
export default crons
