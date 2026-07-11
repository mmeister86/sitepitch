import { cronJobs } from "convex/server"
import { internalAction, internalMutation } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"

const DAY_MS = 86_400_000
const BATCH_SIZE = 100

const reportViewRetentionMs = 30 * DAY_MS
const providerCallRetentionMs = 30 * DAY_MS
const usageEventRetentionMs = 730 * DAY_MS
const providerCostRetentionMs = 730 * DAY_MS
const adminActionRetentionMs = 730 * DAY_MS

// ---------------------------------------------------------------------------
// Internal delete mutations (batched)
// ---------------------------------------------------------------------------

export const _deleteExpiredReportViews = internalMutation({
  args: { cutoff: v.number(), batchSize: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("reportViews")
      .withIndex("by_viewedAt", (q) => q.lt("viewedAt", args.cutoff))
      .take(args.batchSize)
    for (const row of rows) {
      await ctx.db.delete(row._id)
    }
    return { deleted: rows.length }
  },
})

export const _deleteExpiredProviderCalls = internalMutation({
  args: { cutoff: v.number(), batchSize: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("providerCalls")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", args.cutoff))
      .take(args.batchSize)
    for (const row of rows) {
      await ctx.db.delete(row._id)
    }
    return { deleted: rows.length }
  },
})

export const _deleteExpiredUsageEvents = internalMutation({
  args: { cutoff: v.number(), batchSize: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("usageEvents")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", args.cutoff))
      .take(args.batchSize)
    for (const row of rows) {
      await ctx.db.delete(row._id)
    }
    return { deleted: rows.length }
  },
})

export const _deleteExpiredProviderCosts = internalMutation({
  args: { cutoff: v.number(), batchSize: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("providerCosts")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", args.cutoff))
      .take(args.batchSize)
    for (const row of rows) {
      await ctx.db.delete(row._id)
    }
    return { deleted: rows.length }
  },
})

export const _deleteExpiredAdminActions = internalMutation({
  args: { cutoff: v.number(), batchSize: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("adminActions")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", args.cutoff))
      .take(args.batchSize)
    for (const row of rows) {
      await ctx.db.delete(row._id)
    }
    return { deleted: rows.length }
  },
})

// ---------------------------------------------------------------------------
// Cron actions
// ---------------------------------------------------------------------------

export const purgeExpiredReportViews = internalAction({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - reportViewRetentionMs
    const result: { deleted: number } = await ctx.runMutation(
      internal.crons._deleteExpiredReportViews,
      { cutoff, batchSize: BATCH_SIZE },
    )
    return result
  },
})

export const purgeExpiredProviderCalls = internalAction({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - providerCallRetentionMs
    const result: { deleted: number } = await ctx.runMutation(
      internal.crons._deleteExpiredProviderCalls,
      { cutoff, batchSize: BATCH_SIZE },
    )
    return result
  },
})

export const purgeExpiredUsageEvents = internalAction({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - usageEventRetentionMs
    const result: { deleted: number } = await ctx.runMutation(
      internal.crons._deleteExpiredUsageEvents,
      { cutoff, batchSize: BATCH_SIZE },
    )
    return result
  },
})

export const purgeExpiredProviderCosts = internalAction({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - providerCostRetentionMs
    const result: { deleted: number } = await ctx.runMutation(
      internal.crons._deleteExpiredProviderCosts,
      { cutoff, batchSize: BATCH_SIZE },
    )
    return result
  },
})

export const purgeExpiredAdminActions = internalAction({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - adminActionRetentionMs
    const result: { deleted: number } = await ctx.runMutation(
      internal.crons._deleteExpiredAdminActions,
      { cutoff, batchSize: BATCH_SIZE },
    )
    return result
  },
})

// ---------------------------------------------------------------------------
// Cron schedule
// ---------------------------------------------------------------------------

const crons = cronJobs()

crons.interval("purge report views", { hours: 24 }, internal.crons.purgeExpiredReportViews, {})
crons.interval("purge provider calls", { hours: 24 }, internal.crons.purgeExpiredProviderCalls, {})
crons.interval("purge usage events", { hours: 24 }, internal.crons.purgeExpiredUsageEvents, {})
crons.interval("purge provider costs", { hours: 24 }, internal.crons.purgeExpiredProviderCosts, {})
crons.interval("purge admin actions", { hours: 24 }, internal.crons.purgeExpiredAdminActions, {})
crons.interval("reconcile provider costs", { hours: 24 }, internal.provider_billing.reconcileProviderCosts, {})

export default crons
