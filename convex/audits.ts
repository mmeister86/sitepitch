import { ConvexError, v } from "convex/values"

import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server"
import type { Id, Doc } from "./_generated/dataModel"
import { api, internal } from "./_generated/api"
import {
  generatePublicSlug,
  toSafeDisplayUrl,
} from "./lib/audit_url"
import { reserveWorkspaceCredit } from "./lib/credits"
import { findAppUser, getWorkspaceByOwner } from "./lib/workspace"
import { enqueueAuditDeletion } from "./deletion"
import { auditWorkpool } from "./workpools"
import { LEGACY_VIEW_COUNT_CAP, resolveReportViewCount } from "./lib/report_view_stats"
import { startAuditForPrincipal, type SharedAuditStartResult } from "./lib/audit_start"
import { randomBase64Url } from "./lib/integration_crypto"
import { recordIntegrationEvent } from "./integrations"
import { incrementWorkspaceAuditTotal } from "./lib/workspace_audit_counter"

type CanonicalLeadStatus = "new" | "audited" | "contacted" | "follow_up" | "interested" | "won" | "lost"

function toCanonicalLeadStatus(status: Doc<"leads">["status"]): CanonicalLeadStatus {
  return status === "not_interested" ? "lost" : status
}

type AuditStartResult = SharedAuditStartResult

function toAuditStartResult(audit: Doc<"audits">): AuditStartResult {
  return {
    auditId: audit._id,
    externalAuditId: audit.externalApiId,
    status: "queued",
    normalizedUrl: toSafeDisplayUrl(audit.normalizedUrl),
    domain: audit.domain,
    publicSlug: audit.publicSlug,
  }
}

export const getById = internalQuery({
  args: { auditId: v.id("audits") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.auditId)
  },
})

export const listMyAudits = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const user = await findAppUser(ctx, identity.tokenIdentifier)
    if (!user) return null

    const workspace = await getWorkspaceByOwner(ctx, user._id)
    if (!workspace) return null

    const audits = await ctx.db
      .query("audits")
      .withIndex("by_workspaceId_and_createdAt", (q) =>
        q.eq("workspaceId", workspace._id),
      )
      .order("desc")
      .take(50)

    const items = await Promise.all(
      audits.filter((audit) => audit.deletionRequestedAt === undefined).map(async (audit) => {
        const [scoreDoc, linkedLead, viewStats, legacyViews, outreach, copiedEvent] = await Promise.all([
          ctx.db
            .query("auditScores")
            .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
            .unique(),
          audit.leadId ? ctx.db.get(audit.leadId) : Promise.resolve(null),
          ctx.db
            .query("reportViewStats")
            .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
            .unique(),
          ctx.db
            .query("reportViews")
            .withIndex("by_auditId_and_viewedAt", (q) => q.eq("auditId", audit._id))
            .order("desc")
            .take(LEGACY_VIEW_COUNT_CAP + 1),
          ctx.db
            .query("outreachDrafts")
            .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
            .take(1),
          ctx.db
            .query("usageEvents")
            .withIndex("by_auditId_and_event", (q) =>
              q.eq("auditId", audit._id).eq("event", "outreach_copied"),
            )
            .first(),
        ])
        const lead = linkedLead?.workspaceId === workspace._id ? linkedLead : null
        const outreachStatus = copiedEvent
          ? "copied" as const
          : outreach.length > 0
            ? "ready" as const
            : "not_started" as const
        const viewCount = resolveReportViewCount(viewStats, legacyViews.length)
        const lastViewedAt = viewCount.pending
          ? legacyViews[0]?.viewedAt ?? null
          : viewStats?.lastViewedAt ?? null

        return {
          _id: audit._id,
          domain: audit.domain,
          normalizedUrl: toSafeDisplayUrl(audit.normalizedUrl),
          status: audit.status,
          auditType: audit.auditType,
          overallScore: audit.overallScore ?? scoreDoc?.overallScore ?? null,
          isPublic: audit.isPublic,
          publicSlug: audit.publicSlug,
          reportLanguage: audit.reportLanguage,
          createdAt: audit.createdAt,
          completedAt: audit.completedAt ?? null,
          leadId: lead?._id ?? null,
          businessName: lead?.businessName ?? null,
          leadStatus: lead ? toCanonicalLeadStatus(lead.status) : null,
          city: lead?.city ?? null,
          category: lead?.category ?? null,
          outreachStatus,
          views: viewCount.count,
          viewCountCapped: viewCount.capped,
          viewCountPending: viewCount.pending,
          reopenCount: viewStats?.reopenCount ?? 0,
          ctaClicks: viewStats?.ctaClicks ?? 0,
          pdfDownloads: viewStats?.pdfDownloads ?? 0,
          lastViewedAt,
        }
      }),
    )

    return { items, total: items.length }
  },
})

export const findByWorkspaceAndIdempotencyKey = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("audits")
      .withIndex("by_workspaceId_and_idempotencyKey", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("idempotencyKey", args.idempotencyKey),
      )
      .unique()
  },
})

export const createQueuedAudit = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    url: v.string(),
    normalizedUrl: v.string(),
    domain: v.string(),
    auditType: v.union(v.literal("standard"), v.literal("local"), v.literal("quick")),
    reportLanguage: v.union(v.literal("de"), v.literal("en")),
    idempotencyKey: v.string(),
    leadId: v.optional(v.id("leads")),
    campaignId: v.optional(v.id("campaigns")),
    campaignLeadId: v.optional(v.id("campaignLeads")),
    creationChannel: v.optional(v.union(v.literal("ui"), v.literal("api"), v.literal("batch"), v.literal("admin"))),
    apiKeyId: v.optional(v.id("apiKeys")),
    publishRequested: v.optional(v.boolean()),
    apiPayloadHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId)
    if (!workspace || workspace.ownerUserId !== args.userId) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Workspace access denied" })
    }

    if (args.leadId) {
      const lead = await ctx.db.get(args.leadId)
      if (!lead || lead.workspaceId !== args.workspaceId) {
        throw new ConvexError({ code: "FORBIDDEN", message: "Workspace access denied" })
      }
    }

    if ((args.campaignId === undefined) !== (args.campaignLeadId === undefined)) {
      throw new ConvexError({ code: "INVALID_CAMPAIGN_CONTEXT", message: "Campaign context is incomplete" })
    }
    if (args.campaignId && args.campaignLeadId) {
      const [campaign, campaignLead] = await Promise.all([
        ctx.db.get(args.campaignId),
        ctx.db.get(args.campaignLeadId),
      ])
      if (
        !campaign ||
        !campaignLead ||
        campaign.workspaceId !== args.workspaceId ||
        campaignLead.workspaceId !== args.workspaceId ||
        campaignLead.campaignId !== campaign._id ||
        !args.leadId ||
        campaignLead.leadId !== args.leadId
      ) {
        throw new ConvexError({ code: "FORBIDDEN", message: "Workspace access denied" })
      }
    }

    const existing: Doc<"audits"> | null = await ctx.db
      .query("audits")
      .withIndex("by_workspaceId_and_idempotencyKey", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("idempotencyKey", args.idempotencyKey),
      )
      .unique()

    const now = Date.now()

    if (existing) {
      if (args.creationChannel === "api" && existing.apiPayloadHash !== args.apiPayloadHash) {
        throw new ConvexError({ code: "IDEMPOTENCY_CONFLICT", message: "Idempotency key belongs to another payload" })
      }
      if (
        args.campaignId !== undefined &&
        (existing.campaignId !== args.campaignId || existing.campaignLeadId !== args.campaignLeadId)
      ) {
        throw new ConvexError({ code: "AUDIT_CONTEXT_MISMATCH", message: "Idempotency key belongs to another campaign context" })
      }
      if (args.leadId && existing.leadId !== args.leadId) {
        await ctx.db.patch(existing._id, { leadId: args.leadId, updatedAt: now })
        await ctx.db.patch(args.leadId, { auditId: existing._id, updatedAt: now })
      }
      return toAuditStartResult(existing)
    }

    const publicSlug = generatePublicSlug()
    const externalApiId = `aud_${randomBase64Url(16)}`
    const auditId = await ctx.db.insert("audits", {
      workspaceId: args.workspaceId,
      leadId: args.leadId,
      campaignId: args.campaignId,
      campaignLeadId: args.campaignLeadId,
      createdByUserId: args.userId,
      externalApiId,
      creationChannel: args.creationChannel ?? "ui",
      countedInWorkspaceAuditTotal: true,
      apiKeyId: args.apiKeyId,
      publishRequested: args.publishRequested ?? false,
      apiPayloadHash: args.apiPayloadHash,
      url: args.url,
      normalizedUrl: args.normalizedUrl,
      domain: args.domain,
      auditType: args.auditType,
      reportLanguage: args.reportLanguage,
      idempotencyKey: args.idempotencyKey,
      status: "queued",
      statusMessage: "Audit wird vorbereitet",
      publicSlug,
      isPublic: false,
      reportVersion: "v1",
      queuedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    await incrementWorkspaceAuditTotal(ctx, args.workspaceId)

    await ctx.db.insert("auditPipelineStates", {
      workspaceId: args.workspaceId,
      auditId,
      status: "queued",
      phase: "queued",
      attemptCount: 0,
      updatedAt: now,
    })

    if (args.leadId) {
      await ctx.db.patch(args.leadId, { auditId, updatedAt: now })
    }

    await reserveWorkspaceCredit(ctx, args.workspaceId, args.userId, auditId, args.idempotencyKey)

    await ctx.db.insert("usageEvents", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      auditId,
      event: "audit_started",
      idempotencyKey: args.idempotencyKey,
      metadata: {
        normalizedUrl: args.normalizedUrl,
        domain: args.domain,
        auditType: args.auditType,
        reportLanguage: args.reportLanguage,
        creationChannel: args.creationChannel ?? "ui",
      },
      createdAt: now,
    })

    await recordIntegrationEvent(ctx, {
      workspaceId: args.workspaceId,
      auditId,
      event: "audit_started",
      idempotencyKey: `webhook:audit_started:${auditId}`,
      occurredAt: now,
      domain: args.domain,
    })

    await auditWorkpool.enqueueAction(
      ctx,
      internal.audit_pipeline.processAuditPipeline,
      { auditId },
      { retry: true },
    )

    return {
      auditId,
      externalAuditId: externalApiId,
      status: "queued" as const,
      normalizedUrl: args.normalizedUrl,
      domain: args.domain,
      publicSlug,
    }
  },
})

export const startAudit = action({
  args: {
    url: v.string(),
    auditType: v.union(v.literal("standard"), v.literal("local"), v.literal("quick")),
    reportLanguage: v.union(v.literal("de"), v.literal("en")),
    idempotencyKey: v.string(),
    leadId: v.optional(v.id("leads")),
    campaignId: v.optional(v.id("campaigns")),
    campaignLeadId: v.optional(v.id("campaignLeads")),
  },
  handler: async (ctx, args): Promise<AuditStartResult> => {
    const workspaceBootstrap = await ctx.runMutation(api.workspaces.ensureCurrentWorkspace)
    if (!workspaceBootstrap) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }

    const workspaceContext =
      "workspaceId" in workspaceBootstrap && workspaceBootstrap.workspaceId
        ? workspaceBootstrap
        : workspaceBootstrap.userId
          ? await ctx.runQuery(internal.workspaces.getWorkspaceAuditContextByOwner, {
              userId: workspaceBootstrap.userId,
            })
          : null

    if (!workspaceContext) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }

    return await startAuditForPrincipal(ctx, {
      kind: "user",
      workspaceId: workspaceContext.workspaceId,
      userId: workspaceContext.userId,
      plan: workspaceContext.plan ?? "free",
      creditsRemaining: workspaceContext.credits.remaining,
    }, args)
  },
})

export const deleteAudit = mutation({
  args: { auditId: v.id("audits") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" })
    }

    const user = await findAppUser(ctx, identity.tokenIdentifier)
    if (!user) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" })
    }

    const audit = await ctx.db.get(args.auditId)
    if (!audit) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Audit not found" })
    }

    const workspace = await getWorkspaceByOwner(ctx, user._id)
    if (!workspace || audit.workspaceId !== workspace._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Workspace access denied" })
    }

    const jobId = await enqueueAuditDeletion(ctx, args.auditId, workspace._id)
    return { jobId }
  },
})

export const logCreditsExhausted = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("usageEvents", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      event: "credits_exhausted",
      idempotencyKey: `credits_exhausted:${args.idempotencyKey}`,
      createdAt: Date.now(),
    })
  },
})
