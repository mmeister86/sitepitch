import { ConvexError, v } from "convex/values"

import type { Id } from "./_generated/dataModel"
import { internalAction, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"
import { startAuditForPrincipal } from "./lib/audit_start"

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
    return {
      audit_id: audit.externalApiId!,
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
