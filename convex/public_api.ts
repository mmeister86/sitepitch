import { paginationOptsValidator } from "convex/server"
import { ConvexError, v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { internalAction, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"
import { startAuditForPrincipal } from "./lib/audit_start"
import { getWorkspaceCreditBalance, getWorkspaceCreditSnapshot } from "./lib/credits"
import { getWorkspacePlan } from "./lib/workspace"

const publicAuditStatusValidator = v.union(
  v.literal("draft"),
  v.literal("queued"),
  v.literal("validating_url"),
  v.literal("fetching_html"),
  v.literal("extracting_content"),
  v.literal("taking_screenshots"),
  v.literal("running_performance_checks"),
  v.literal("fetching_business_data"),
  v.literal("running_deterministic_checks"),
  v.literal("calculating_scores"),
  v.literal("generating_findings"),
  v.literal("generating_outreach"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled"),
)

function auditStatusDto(audit: Doc<"audits">) {
  if (!audit.externalApiId) return null
  return {
    audit_id: audit.externalApiId,
    status: audit.status,
    domain: audit.domain,
    audit_type: audit.auditType,
    report_language: audit.reportLanguage,
    publish_report: audit.publishRequested ?? false,
    created_at: new Date(audit.createdAt).toISOString(),
    started_at: audit.startedAt ? new Date(audit.startedAt).toISOString() : null,
    completed_at: audit.completedAt ? new Date(audit.completedAt).toISOString() : null,
    error_code: audit.status === "failed" ? audit.errorCode ?? "AUDIT_FAILED" : null,
  }
}

export const createAudit = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    apiKeyId: v.id("apiKeys"),
    idempotencyKeyHash: v.string(),
    payloadHash: v.string(),
    url: v.string(),
    auditType: v.union(v.literal("standard"), v.literal("local"), v.literal("quick")),
    reportLanguage: v.union(v.literal("de"), v.literal("en")),
    publishRequested: v.boolean(),
  },
  handler: async (ctx, args): Promise<{
    auditId: Id<"audits">
    externalAuditId?: string
    status: "queued"
    normalizedUrl: string
    domain: string
    publicSlug: string
  }> => {
    const workspaceContext = await ctx.runQuery(internal.workspaces.getWorkspaceAuditContext, {
      workspaceId: args.workspaceId,
    })
    if (!workspaceContext || workspaceContext.userId !== args.userId) {
      throw new ConvexError({ code: "INVALID_API_KEY", message: "Invalid API key" })
    }
    return await startAuditForPrincipal(ctx, {
      kind: "api_key",
      workspaceId: args.workspaceId,
      userId: args.userId,
      apiKeyId: args.apiKeyId,
      plan: workspaceContext.plan,
      creditsRemaining: workspaceContext.credits.remaining,
    }, {
      url: args.url,
      auditType: args.auditType,
      reportLanguage: args.reportLanguage,
      idempotencyKey: `api:${args.idempotencyKeyHash}`,
      payloadHash: args.payloadHash,
      publishRequested: args.publishRequested,
    })
  },
})

export const getAuditStatus = internalQuery({
  args: { workspaceId: v.id("workspaces"), externalAuditId: v.string() },
  handler: async (ctx, args) => {
    const audit = await ctx.db
      .query("audits")
      .withIndex("by_workspaceId_and_externalApiId", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("externalApiId", args.externalAuditId),
      )
      .unique()
    if (!audit || audit.deletionRequestedAt) return null
    return auditStatusDto(audit)
  },
})

export const listAudits = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    paginationOpts: paginationOptsValidator,
    status: v.union(publicAuditStatusValidator, v.null()),
    createdAfter: v.union(v.number(), v.null()),
    createdBefore: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const query = args.status === null
      ? ctx.db
          .query("audits")
          .withIndex("by_workspaceId_and_countedAudit_and_createdAt", (q) => {
            const workspaceRange = q
              .eq("workspaceId", args.workspaceId)
              .eq("countedInWorkspaceAuditTotal", true)
            if (args.createdAfter !== null && args.createdBefore !== null) {
              return workspaceRange.gt("createdAt", args.createdAfter).lt("createdAt", args.createdBefore)
            }
            if (args.createdAfter !== null) return workspaceRange.gt("createdAt", args.createdAfter)
            if (args.createdBefore !== null) return workspaceRange.lt("createdAt", args.createdBefore)
            return workspaceRange
          })
      : ctx.db
          .query("audits")
          .withIndex("by_workspaceId_and_countedAudit_and_status_and_createdAt", (q) => {
            const statusRange = q
              .eq("workspaceId", args.workspaceId)
              .eq("countedInWorkspaceAuditTotal", true)
              .eq("status", args.status!)
            if (args.createdAfter !== null && args.createdBefore !== null) {
              return statusRange.gt("createdAt", args.createdAfter).lt("createdAt", args.createdBefore)
            }
            if (args.createdAfter !== null) return statusRange.gt("createdAt", args.createdAfter)
            if (args.createdBefore !== null) return statusRange.lt("createdAt", args.createdBefore)
            return statusRange
          })
    const result = await query.order("desc").paginate(args.paginationOpts)
    return {
      ...result,
      page: result.page.flatMap((audit) => {
        const dto = auditStatusDto(audit)
        return dto ? [dto] : []
      }),
    }
  },
})

export const getUsage = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId)
    if (!workspace || workspace.deletionRequestedAt) return null
    const [plan, subscription, balance, auditCounter] = await Promise.all([
      getWorkspacePlan(ctx, args.workspaceId),
      ctx.db
        .query("subscriptions")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
        .order("desc")
        .first(),
      getWorkspaceCreditBalance(ctx, args.workspaceId),
      ctx.db
        .query("workspaceAuditCounters")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
        .unique(),
    ])
    const credits = getWorkspaceCreditSnapshot(balance)
    return {
      as_of: new Date().toISOString(),
      plan: {
        name: plan,
        subscription_status: subscription?.status ?? null,
        cancel_at_period_end: subscription?.cancelAtPeriodEnd ?? false,
      },
      credits: {
        total: credits.total,
        used: credits.used,
        reserved: credits.reserved,
        remaining: credits.remaining,
        monthly: {
          total: credits.monthly.total,
          used: credits.monthly.used,
          period_start: balance && balance.periodStart > 0 ? new Date(balance.periodStart).toISOString() : null,
          period_end: balance && balance.periodEnd > 0 ? new Date(balance.periodEnd).toISOString() : null,
        },
        extra: {
          total: credits.extra.total,
          used: credits.extra.used,
        },
      },
      audits: { total: auditCounter?.total ?? 0 },
    }
  },
})

export const getAuditReportMetadata = internalQuery({
  args: { workspaceId: v.id("workspaces"), externalAuditId: v.string() },
  handler: async (ctx, args) => {
    const audit = await ctx.db
      .query("audits")
      .withIndex("by_workspaceId_and_externalApiId", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("externalApiId", args.externalAuditId),
      )
      .unique()
    if (!audit || audit.deletionRequestedAt) return null
    if (audit.status !== "completed") return { ready: false as const }
    const score = await ctx.db
      .query("auditScores")
      .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
      .unique()
    return {
      ready: true as const,
      audit_id: audit.externalApiId!,
      status: audit.status,
      report_status: audit.isPublic ? "published" as const : "private" as const,
      version: audit.reportVersion,
      domain: audit.domain,
      score: audit.overallScore ?? score?.overallScore ?? null,
      scores: score ? {
        overall: score.overallScore,
        conversion: score.conversionScore,
        seo_basics: score.seoBasicsScore,
        local_seo: score.localSeoScore,
        performance: score.performanceScore,
        mobile_ux: score.mobileUxScore,
        trust: score.trustScore,
      } : null,
      public_slug: audit.isPublic ? audit.publicSlug : null,
      completed_at: audit.completedAt ? new Date(audit.completedAt).toISOString() : null,
    }
  },
})
