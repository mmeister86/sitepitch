import { v } from "convex/values"

import type { Id } from "./_generated/dataModel"
import { internalMutation } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"

export type ReportViewInput = {
  workspaceId: Id<"workspaces">
  auditId: Id<"audits">
  viewerIpHash?: string
  userAgentHash?: string
  referrer?: string
  viewedAt: number
}

/**
 * Records the short-lived identifying view row and updates the permanent,
 * non-identifying aggregate in the same transaction.
 */
export async function recordReportView(ctx: MutationCtx, input: ReportViewInput) {
  await ctx.db.insert("reportViews", input)
  const stats = await ctx.db
    .query("reportViewStats")
    .withIndex("by_auditId", (q) => q.eq("auditId", input.auditId))
    .unique()
  if (stats) {
    const nextReopenCount = stats.totalViews === 0
      ? 0
      : (stats.reopenCount ?? Math.max(stats.totalViews - 1, 0)) + 1
    const firstViewedAt = stats.firstViewedAt ?? stats.lastViewedAt ?? input.viewedAt
    await ctx.db.patch(stats._id, {
      totalViews: stats.totalViews + 1,
      lastViewedAt: Math.max(stats.lastViewedAt ?? input.viewedAt, input.viewedAt),
      firstViewedAt,
      reopenCount: nextReopenCount,
    })
    return stats.totalViews + 1
  }
  await ctx.db.insert("reportViewStats", {
    workspaceId: input.workspaceId,
    auditId: input.auditId,
    totalViews: 1,
    lastViewedAt: input.viewedAt,
    firstViewedAt: input.viewedAt,
    reopenCount: 0,
    ctaClicks: 0,
    pdfDownloads: 0,
  })
  return 1
}

export const recordReportViewInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    viewerIpHash: v.optional(v.string()),
    userAgentHash: v.optional(v.string()),
    referrer: v.optional(v.string()),
    viewedAt: v.number(),
  },
  handler: recordReportView,
})
