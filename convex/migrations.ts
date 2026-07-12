import { Migrations } from "@convex-dev/migrations"

import { components } from "./_generated/api.js"
import type { DataModel } from "./_generated/dataModel.js"
import { internalMutation, internalQuery } from "./_generated/server.js"
import schema from "./schema.js"
import { resolveReportCtaSnapshotValues } from "./lib/report_cta.js"
import { hasAccurateViewAggregate } from "./lib/report_view_stats.js"

const migrations = new Migrations<DataModel, typeof schema>(components.migrations, {
  internalMutation,
  schema,
  defaultBatchSize: 50,
})

/** Deploy-1 migration: legacy rows remain schema-valid until this has completed. */
export const canonicalizeLeadStatuses = migrations.define({
  table: "leads",
  migrateOne: (_ctx, lead) => {
    if (lead.status !== "not_interested") return
    return { status: "lost" as const, updatedAt: Date.now() }
  },
})

/** Backfills the server-owned activation milestone at the workspace creation time. */
export const backfillSignedUpEvents = migrations.define({
  table: "workspaces",
  migrateOne: async (ctx, workspace) => {
    const idempotencyKey = `signed_up:${workspace._id}`
    const existing = await ctx.db
      .query("usageEvents")
      .withIndex("by_workspaceId_and_idempotencyKey", (q) =>
        q.eq("workspaceId", workspace._id).eq("idempotencyKey", idempotencyKey),
      )
      .unique()
    if (existing) return
    await ctx.db.insert("usageEvents", {
      workspaceId: workspace._id,
      userId: workspace.ownerUserId,
      event: "signed_up",
      idempotencyKey,
      createdAt: workspace.createdAt,
    })
  },
})

/**
 * Backfills stable CTA snapshots for legacy public reports.
 * Define and deploy this migration, then run it explicitly via the Convex CLI.
 */
export const backfillPublicReportCtaSnapshots = migrations.define({
  table: "audits",
  migrateOne: async (ctx, audit) => {
    if (!audit.isPublic || audit.reportCtaSnapshottedAt !== undefined) return
    const workspace = await ctx.db.get(audit.workspaceId)
    if (!workspace) return
    const lead = audit.leadId ? await ctx.db.get(audit.leadId) : null
    const ownedLead = lead?.workspaceId === workspace._id ? lead : null
    const snapshot = resolveReportCtaSnapshotValues(workspace, ownedLead)
    const now = Date.now()
    return {
      reportCtaText: snapshot.text,
      reportCtaUrl: snapshot.url,
      reportCtaSnapshottedAt: now,
      updatedAt: now,
    }
  },
})

/**
 * Deploy-1 backfill. Each legacy view is marked in the same transaction as its
 * aggregate update, so interrupted/reset runs cannot double-count it. Existing
 * maintained aggregates are recognized and only have their legacy rows marked.
 */
export const backfillLegacyReportViewStats = migrations.define({
  table: "reportViews",
  migrateOne: async (ctx, view) => {
    if (view.includedInStats === true) return
    const stats = await ctx.db
      .query("reportViewStats")
      .withIndex("by_auditId", (q) => q.eq("auditId", view.auditId))
      .unique()

    if (hasAccurateViewAggregate(stats)) {
      await ctx.db.patch(view._id, { includedInStats: true })
      if (stats?.viewAggregationState === undefined) {
        await ctx.db.patch(stats!._id, { viewAggregationState: "accurate" })
      }
      return
    }

    if (stats) {
      const totalViews = stats.totalViews + 1
      await ctx.db.patch(stats._id, {
        totalViews,
        firstViewedAt: Math.min(stats.firstViewedAt ?? view.viewedAt, view.viewedAt),
        lastViewedAt: Math.max(stats.lastViewedAt ?? view.viewedAt, view.viewedAt),
        reopenCount: Math.max(totalViews - 1, 0),
        viewAggregationState: "pending",
      })
    } else {
      await ctx.db.insert("reportViewStats", {
        workspaceId: view.workspaceId,
        auditId: view.auditId,
        totalViews: 1,
        firstViewedAt: view.viewedAt,
        lastViewedAt: view.viewedAt,
        reopenCount: 0,
        ctaClicks: 0,
        pdfDownloads: 0,
        viewAggregationState: "pending",
      })
    }
    await ctx.db.patch(view._id, { includedInStats: true })
  },
})

/** Marks a stats row trustworthy only after every source view was incorporated. */
export const finalizeLegacyReportViewStats = migrations.define({
  table: "reportViewStats",
  migrateOne: async (ctx, stats) => {
    if (stats.viewAggregationState === "accurate") return
    const remaining = await ctx.db
      .query("reportViews")
      .withIndex("by_auditId", (q) => q.eq("auditId", stats.auditId))
      .filter((q) => q.neq(q.field("includedInStats"), true))
      .first()
    if (remaining) return
    return {
      viewAggregationState: "accurate" as const,
      reopenCount: Math.max(stats.totalViews - 1, 0),
    }
  },
})

export const verifyLegacyReportViewStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [unaggregatedView, pendingStats] = await Promise.all([
      ctx.db
        .query("reportViews")
        .withIndex("by_includedInStats", (q) => q.eq("includedInStats", undefined))
        .first(),
      ctx.db
        .query("reportViewStats")
        .withIndex("by_viewAggregationState", (q) => q.eq("viewAggregationState", "pending"))
        .first(),
    ])
    return {
      complete: unaggregatedView === null && pendingStats === null,
      sampleUnaggregatedViewId: unaggregatedView?._id ?? null,
      samplePendingAuditId: pendingStats?.auditId ?? null,
    }
  },
})
