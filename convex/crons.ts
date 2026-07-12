import { cronJobs } from "convex/server"
import { v } from "convex/values"

import { internal } from "./_generated/api"
import { internalMutation } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"

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
    for (const row of page.page) await ctx.db.delete(row._id)
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.crons.purgeExpiredReportViews, { cursor: page.continueCursor })
    return { deleted: page.page.length, isDone: page.isDone }
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
      if (row.storageId) await ctx.storage.delete(row.storageId)
      await ctx.db.delete(row._id)
      deleted++
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.crons.purgeExpiredScreenshots, { cursor: page.continueCursor })
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
crons.interval("purge usage events", { hours: 24 }, internal.crons.purgeExpiredUsageEvents, {})
crons.interval("purge provider costs", { hours: 24 }, internal.crons.purgeExpiredProviderCosts, {})
crons.interval("purge admin actions", { hours: 24 }, internal.crons.purgeExpiredAdminActions, {})
crons.interval("retry deletion jobs", { minutes: 15 }, internal.deletion.retryStaleDeletionJobs, {})
crons.interval("recover prepared account deletions", { minutes: 15 }, internal.deletion.recoverPreparedWorkspaceDeletions, {})
crons.interval("reconcile provider costs", { hours: 24 }, internal.provider_billing.reconcileProviderCosts, {})
export default crons
