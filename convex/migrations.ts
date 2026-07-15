import { Migrations } from "@convex-dev/migrations"

import { components } from "./_generated/api.js"
import type { DataModel } from "./_generated/dataModel.js"
import { internalMutation, internalQuery } from "./_generated/server.js"
import schema from "./schema.js"
import { resolveReportCtaSnapshotValues } from "./lib/report_cta.js"
import { hasAccurateViewAggregate } from "./lib/report_view_stats.js"
import { normalizeLeadDomain } from "./lib/lead_search.js"
import { normalizeReportReferrer } from "./lib/report_privacy.js"

const migrations = new Migrations<DataModel, typeof schema>(components.migrations, {
  internalMutation,
  schema,
  defaultBatchSize: 50,
})

const FEED_ACTIVITY_EVENT_TYPES = new Set([
  "report_opened",
  "report_reopened",
  "report_cta_clicked",
  "outreach_copied",
  "public_link_copied",
  "pdf_exported",
  "audit_completed",
])

/** Marks legacy dashboard-visible events for the indexed activity feed. */
export const backfillFeedActivityDiscriminator = migrations.define({
  table: "usageEvents",
  migrateOne: (_ctx, event) => {
    if (event.isFeedActivity === true || !FEED_ACTIVITY_EVENT_TYPES.has(event.event)) return
    return { isFeedActivity: true }
  },
})

/** Deploy-1 migration: legacy rows remain schema-valid until this has completed. */
export const canonicalizeLeadStatuses = migrations.define({
  table: "leads",
  migrateOne: (_ctx, lead) => {
    if (lead.status !== "not_interested") return
    return { status: "lost" as const, updatedAt: Date.now() }
  },
})

/** Deploy-1 backfill for the workspace-scoped lead domain identity. */
export const backfillNormalizedLeadDomains = migrations.define({
  table: "leads",
  migrateOne: (_ctx, lead) => {
    if (lead.normalizedDomain !== undefined) return
    const normalizedDomain = normalizeLeadDomain(lead.normalizedWebsiteUrl ?? lead.websiteUrl)
    if (!normalizedDomain) return
    return { normalizedDomain }
  },
})

/**
 * Attributes legacy audits only when their lead belongs to exactly one
 * campaign. Ambiguous historical ownership is intentionally left unset.
 */
export const backfillUnambiguousCampaignAuditAttribution = migrations.define({
  table: "audits",
  migrateOne: async (ctx, audit) => {
    if (audit.campaignId !== undefined || audit.campaignLeadId !== undefined || !audit.leadId) return
    const campaignLeads = await ctx.db
      .query("campaignLeads")
      .withIndex("by_workspaceId_and_leadId", (q) =>
        q.eq("workspaceId", audit.workspaceId).eq("leadId", audit.leadId!),
      )
      .take(2)
    if (campaignLeads.length !== 1) return
    const campaignLead = campaignLeads[0]
    const campaign = await ctx.db.get(campaignLead.campaignId)
    if (!campaign || campaign.workspaceId !== audit.workspaceId) return
    return {
      campaignId: campaignLead.campaignId,
      campaignLeadId: campaignLead._id,
    }
  },
})

export const verifyNormalizedLeadDomains = internalQuery({
  args: {},
  handler: async (ctx) => {
    // The compound index cannot efficiently select every workspace's missing
    // value, so this is a bounded smoke check. Component status remains the
    // authoritative full-table completion source.
    const sample = await ctx.db.query("leads").take(100)
      .then((leads) => leads.find((lead) =>
        lead.normalizedDomain === undefined &&
        normalizeLeadDomain(lead.normalizedWebsiteUrl ?? lead.websiteUrl) !== undefined,
      ))
    return { complete: sample === undefined, sampleRemainingLeadId: sample?._id ?? null }
  },
})

/**
 * Privacy hardening for legacy report views. Query strings and paths can carry
 * campaign identifiers or personal data, so only a normalized referrer host is retained.
 */
export const minimizeLegacyReportReferrers = migrations.define({
  table: "reportViews",
  migrateOne: (_ctx, view) => {
    if (view.referrer === undefined) return
    const referrer = normalizeReportReferrer(view.referrer)
    if (referrer === view.referrer) return
    return { referrer }
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
      .withIndex("by_auditId_and_includedInStats", (q) =>
        q.eq("auditId", stats.auditId).eq("includedInStats", undefined),
      )
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
