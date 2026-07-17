import { ConvexError, v } from "convex/values"

import type { Id } from "./_generated/dataModel"
import { action, internalMutation, internalQuery, query, type ActionCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import type { AuditAgentContext } from "./audit_agent"
import { checkAuditRecoveryLimits } from "./lib/audit_rate_limit"
import { generateDeterministicAgentOutput } from "./lib/audit_agent_fallback"
import { requireSupportAdmin } from "./lib/support"
import { eveReleaseManifest } from "../src/lib/eve/release-manifest"

type RecoveryKind =
  | "output_revalidated"
  | "output_regenerated"
  | "output_fallback_created"
  | "output_version_activated"

function requiredReason(reason: string): string {
  const trimmed = reason.trim()
  if (!trimmed || trimmed.length > 500) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: "A reason between 1 and 500 characters is required" })
  }
  return trimmed
}

export const listVersions = query({
  args: { auditId: v.id("audits") },
  handler: async (ctx, args) => {
    await requireSupportAdmin(ctx)
    const audit = await ctx.db.get(args.auditId)
    if (!audit) throw new ConvexError({ code: "NOT_FOUND", message: "Audit not found" })
    const versions = await ctx.db
      .query("auditOutputVersions")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .order("desc")
      .take(100)
    return {
      audit: {
        id: audit._id,
        domain: audit.domain,
        status: audit.status,
        activeOutputVersionId: audit.activeOutputVersionId ?? null,
      },
      versions: versions.map((version) => ({
        _id: version._id,
        versionNumber: version.versionNumber,
        status: version.status,
        executor: version.executor,
        provider: version.provider ?? "—",
        model: version.model ?? "—",
        releaseVersion: version.releaseVersion,
        promptVersion: version.promptVersion,
        outputSchemaVersion: version.outputSchemaVersion,
        schemaPass: version.schemaPass,
        evidencePass: version.evidencePass,
        claimSafetyPass: version.claimSafetyPass,
        rejectionCode: version.rejectionCode ?? null,
        createdAt: version.createdAt,
        activatedAt: version.activatedAt ?? null,
      })),
    }
  },
})

export const getVersionForRecovery = internalQuery({
  args: { auditId: v.id("audits"), versionId: v.optional(v.id("auditOutputVersions")) },
  handler: async (ctx, args) => {
    const audit = await ctx.db.get(args.auditId)
    if (!audit) return null
    const versionId = args.versionId ?? audit.activeOutputVersionId
    if (!versionId) return null
    const version = await ctx.db.get(versionId)
    if (!version || version.auditId !== audit._id || version.workspaceId !== audit.workspaceId) return null
    return { audit, version }
  },
})

export const recordRecoveryAction = internalMutation({
  args: {
    auditId: v.id("audits"),
    actorUserId: v.id("users"),
    action: v.union(
      v.literal("output_revalidated"),
      v.literal("output_regenerated"),
      v.literal("output_fallback_created"),
      v.literal("output_version_activated"),
    ),
    reason: v.string(),
    sourceVersionId: v.optional(v.id("auditOutputVersions")),
  },
  handler: async (ctx, args) => {
    const audit = await ctx.db.get(args.auditId)
    if (!audit) throw new ConvexError({ code: "NOT_FOUND", message: "Audit not found" })
    const createdAt = Date.now()
    const actionId = await ctx.db.insert("adminActions", {
      actorUserId: args.actorUserId,
      workspaceId: audit.workspaceId,
      auditId: audit._id,
      action: args.action,
      reason: args.reason,
      metadata: args.sourceVersionId ? { sourceVersionId: String(args.sourceVersionId) } : undefined,
      createdAt,
    })
    if (args.action !== "output_regenerated") {
      await ctx.db.insert("providerCosts", {
        workspaceId: audit.workspaceId,
        auditId: audit._id,
        costKey: `recovery:${actionId}`,
        provider: "other",
        operation: `recovery:${args.action}`,
        source: "zero_cost",
        actualCostUsd: 0,
        requestCount: 0,
        createdAt,
      })
    }
    return actionId
  },
})

async function authorizeRecovery(
  ctx: ActionCtx,
  auditId: Id<"audits">,
  reason: string,
) {
  const actor: { userId: Id<"users">; email: string } = await ctx.runQuery(
    internal.admin_operations._requireSupportAdminInternal,
    {},
  )
  const normalizedReason = requiredReason(reason)
  await checkAuditRecoveryLimits(ctx, { actorUserId: actor.userId, auditId })
  return { actor, reason: normalizedReason }
}

async function cloneAndActivate(
  ctx: ActionCtx,
  args: {
    auditId: Id<"audits">
    versionId?: Id<"auditOutputVersions">
    actorUserId: Id<"users">
    reason: string
    action: Exclude<RecoveryKind, "output_regenerated" | "output_fallback_created">
  },
) {
  const source = await ctx.runQuery(internal.audit_recovery.getVersionForRecovery, {
    auditId: args.auditId,
    versionId: args.versionId,
  })
  if (!source) throw new ConvexError({ code: "NOT_FOUND", message: "Output version not found" })
  await ctx.runMutation(internal.audit_recovery.recordRecoveryAction, {
    auditId: args.auditId,
    actorUserId: args.actorUserId,
    action: args.action,
    reason: args.reason,
    sourceVersionId: source.version._id,
  })
  const result = await ctx.runMutation(internal.audit_agent.saveAuditAgentOutput, {
    auditId: args.auditId,
    output: source.version.output,
    metadata: {
      executor: source.version.executor,
      provider: source.version.provider,
      model: source.version.model,
      releaseVersion: source.version.releaseVersion,
      promptVersion: source.version.promptVersion,
      outputSchemaVersion: source.version.outputSchemaVersion,
      skillVersions: source.version.skillVersions,
      eveVersion: source.version.eveVersion,
      eveSessionId: source.version.eveSessionId,
      buildSha: source.version.buildSha,
      activationReason: args.reason,
      activatedByUserId: args.actorUserId,
    },
  })
  if (!result.activated) {
    throw new ConvexError({ code: "RECOVERY_VALIDATION_FAILED", message: `Current safety checks rejected the version (${result.rejectionCode})` })
  }
  return { outputVersionId: result.outputVersionId, activated: true }
}

export const revalidateActive = action({
  args: { auditId: v.id("audits"), reason: v.string() },
  handler: async (ctx, args): Promise<{ outputVersionId: Id<"auditOutputVersions">; activated: boolean }> => {
    const { actor, reason } = await authorizeRecovery(ctx, args.auditId, args.reason)
    return await cloneAndActivate(ctx, {
      auditId: args.auditId,
      actorUserId: actor.userId,
      reason,
      action: "output_revalidated",
    })
  },
})

export const activateVersion = action({
  args: { auditId: v.id("audits"), versionId: v.id("auditOutputVersions"), reason: v.string() },
  handler: async (ctx, args): Promise<{ outputVersionId: Id<"auditOutputVersions">; activated: boolean }> => {
    const { actor, reason } = await authorizeRecovery(ctx, args.auditId, args.reason)
    return await cloneAndActivate(ctx, {
      auditId: args.auditId,
      versionId: args.versionId,
      actorUserId: actor.userId,
      reason,
      action: "output_version_activated",
    })
  },
})

export const createDeterministicFallback = action({
  args: { auditId: v.id("audits"), reason: v.string() },
  handler: async (ctx, args): Promise<{ outputVersionId: Id<"auditOutputVersions">; activated: boolean }> => {
    const { actor, reason } = await authorizeRecovery(ctx, args.auditId, args.reason)
    const context: AuditAgentContext | null = await ctx.runQuery(internal.audit_agent.getAuditAgentContext, { auditId: args.auditId })
    if (!context) throw new ConvexError({ code: "NOT_FOUND", message: "Audit context not found" })
    const output = generateDeterministicAgentOutput({
      domain: context.domain,
      reportLanguage: context.reportLanguage,
      workspaceName: context.workspace.name,
      categoryScores: context.categoryScores,
      overallScore: context.overallScore,
      checks: context.checks,
    })
    await ctx.runMutation(internal.audit_recovery.recordRecoveryAction, {
      auditId: args.auditId,
      actorUserId: actor.userId,
      action: "output_fallback_created",
      reason,
    })
    const result = await ctx.runMutation(internal.audit_agent.saveAuditAgentOutput, {
      auditId: args.auditId,
      output,
      metadata: {
        executor: "deterministic",
        provider: "other",
        model: "deterministic-fallback",
        releaseVersion: eveReleaseManifest.releaseVersion,
        promptVersion: eveReleaseManifest.promptVersion,
        outputSchemaVersion: eveReleaseManifest.outputSchemaVersion,
        skillVersions: eveReleaseManifest.skills,
        activationReason: reason,
        activatedByUserId: actor.userId,
      },
    })
    if (!result.activated) throw new ConvexError({ code: "RECOVERY_VALIDATION_FAILED", message: "Fallback failed current safety checks" })
    return { outputVersionId: result.outputVersionId, activated: true }
  },
})

export const regenerateCore = action({
  args: { auditId: v.id("audits"), reason: v.string() },
  handler: async (ctx, args): Promise<{ scheduled: boolean }> => {
    const { actor, reason } = await authorizeRecovery(ctx, args.auditId, args.reason)
    await ctx.runMutation(internal.audit_recovery.recordRecoveryAction, {
      auditId: args.auditId,
      actorUserId: actor.userId,
      action: "output_regenerated",
      reason,
    })
    await ctx.runAction(internal.audit_agent_action.processAuditAgentOutputs, { auditId: args.auditId })
    return { scheduled: true }
  },
})
