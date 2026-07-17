import { ConvexError, v } from "convex/values"

import { action, internalMutation, internalQuery, query } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import { internal } from "./_generated/api"
import { isSupportAdmin, requireSupportAdmin } from "./lib/support"
import { getWorkspaceCreditBalance, getWorkspaceCreditSnapshot } from "./lib/credits"
import { reserveWorkspaceCredit } from "./lib/credits"
import { redactSensitiveText } from "./lib/telemetry_safety"
import { generatePublicSlug } from "./lib/audit_url"
import { auditWorkpool } from "./workpools"

const DAY_MS = 86_400_000
const METRICS_WINDOW_DAYS = 30
const DEFAULT_TAKE = 50

function now() {
  return Date.now()
}

export const _requireSupportAdminInternal = internalQuery({
  args: {},
  handler: async (ctx): Promise<{ userId: Id<"users">; email: string }> => {
    return await requireSupportAdmin(ctx)
  },
})

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getAdminAccess = query({
  args: {},
  handler: async (ctx) => {
    const isAdmin = await isSupportAdmin(ctx)
    return { isSupportAdmin: isAdmin }
  },
})

export const listFailedAudits = query({
  args: {
    paginationOpts: v.optional(
      v.object({
        cursor: v.union(v.string(), v.null()),
        numItems: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireSupportAdmin(ctx)

    const numItems = Math.min(args.paginationOpts?.numItems ?? DEFAULT_TAKE, 200)

    const failedAudits = await ctx.db
      .query("audits")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "failed"))
      .order("desc")
      .take(numItems)

    const workspaceIds = new Set<Id<"workspaces">>()
    for (const audit of failedAudits) {
      workspaceIds.add(audit.workspaceId)
    }

    const workspaceCache = new Map<Id<"workspaces">, Doc<"workspaces">>()
    for (const wsId of workspaceIds) {
      const ws = await ctx.db.get(wsId)
      if (ws) workspaceCache.set(wsId, ws)
    }

    const items = failedAudits.map((audit) => {
      const ws = workspaceCache.get(audit.workspaceId)
      return {
        _id: audit._id,
        domain: audit.domain,
        status: audit.status,
        errorCode: audit.errorCode ?? null,
        errorMessage: audit.errorMessage ? redactSensitiveText(audit.errorMessage) : null,
        failedAt: audit.failedAt ?? null,
        createdAt: audit.createdAt,
        workspaceName: ws?.name ?? null,
        workspaceId: audit.workspaceId,
      }
    })

    return { items }
  },
})

export const getAuditTrace = query({
  args: {
    auditId: v.id("audits"),
  },
  handler: async (ctx, args) => {
    await requireSupportAdmin(ctx)

    const audit = await ctx.db.get(args.auditId)
    if (!audit) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Audit not found" })
    }

    const pipelineStates = await ctx.db
      .query("auditPipelineStates")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .take(5)

    const providerCalls = await ctx.db
      .query("providerCalls")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .order("desc")
      .take(50)

    const agentRuns = await ctx.db
      .query("auditAgentRuns")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .order("desc")
      .take(20)

    const creditLedger = await ctx.db
      .query("creditLedger")
      .withIndex("by_workspaceId_and_auditId", (q) =>
        q.eq("workspaceId", audit.workspaceId).eq("auditId", args.auditId),
      )
      .take(20)

    const providerCosts = await ctx.db
      .query("providerCosts")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .take(100)

    let totalEstimatedCostUsd = 0
    let totalActualCostUsd = 0
    for (const cost of providerCosts) {
      if (cost.actualCostUsd !== undefined) {
        totalActualCostUsd += cost.actualCostUsd
      } else if (cost.estimatedCostUsd !== undefined) {
        totalEstimatedCostUsd += cost.estimatedCostUsd
      }
    }

    const billingSnapshots = await ctx.db
      .query("providerBillingSnapshots")
      .withIndex("by_createdAt", (q) =>
        q.gte("createdAt", now() - 7 * DAY_MS),
      )
      .take(20)

    return {
      audit: {
        _id: audit._id,
        domain: audit.domain,
        url: audit.url,
        status: audit.status,
        statusMessage: audit.statusMessage ?? null,
        errorCode: audit.errorCode ?? null,
        errorMessage: audit.errorMessage ? redactSensitiveText(audit.errorMessage) : null,
        createdAt: audit.createdAt,
        updatedAt: audit.updatedAt,
        completedAt: audit.completedAt ?? null,
        failedAt: audit.failedAt ?? null,
        startedAt: audit.startedAt ?? null,
        workspaceId: audit.workspaceId,
      },
      pipeline: pipelineStates.map((s) => ({
        status: s.status,
        phase: s.phase,
        attemptCount: s.attemptCount,
        startedAt: s.startedAt ?? null,
        finishedAt: s.finishedAt ?? null,
        lastErrorCode: s.lastErrorCode ?? null,
        lastErrorMessage: s.lastErrorMessage ? redactSensitiveText(s.lastErrorMessage) : null,
      })),
      providerCalls: providerCalls.map((pc) => ({
        provider: pc.provider,
        operation: pc.operation,
        status: pc.status,
        attempt: pc.attempt,
        latencyMs: pc.latencyMs ?? null,
        retryCount: pc.retryCount ?? null,
        errorMessage: pc.errorMessage ? redactSensitiveText(pc.errorMessage) : null,
        errorCode: pc.errorCode ?? null,
        responseStatus: pc.responseStatus ?? null,
        startedAt: pc.startedAt,
        completedAt: pc.completedAt ?? null,
      })),
      agentRuns: agentRuns.map((ar) => ({
        provider: ar.provider,
        model: ar.model,
        purpose: ar.purpose,
        status: ar.status,
        executor: ar.executor ?? "legacy",
        releaseVersion: ar.releaseVersion ?? null,
        promptVersion: ar.promptVersion ?? null,
        outputSchemaVersion: ar.outputSchemaVersion ?? null,
        eveVersion: ar.eveVersion ?? null,
        eveSessionId: ar.eveSessionId ?? null,
        buildSha: ar.buildSha ?? null,
        skillVersions: ar.loadedSkillVersions ?? ar.skillVersions ?? {},
        schemaPass: ar.schemaPass ?? null,
        evidencePass: ar.evidencePass ?? null,
        claimSafetyPass: ar.claimSafetyPass ?? null,
        tokensIn: ar.tokensIn ?? null,
        tokensOut: ar.tokensOut ?? null,
        errorMessage: ar.errorMessage ? redactSensitiveText(ar.errorMessage) : null,
        startedAt: ar.startedAt,
        completedAt: ar.completedAt ?? null,
      })),
      creditLedger: creditLedger.map((cl) => ({
        type: cl.type,
        amount: cl.amount,
        reason: cl.reason ?? null,
        createdAt: cl.createdAt,
      })),
      costs: {
        items: providerCosts.map((c) => ({
          provider: c.provider,
          operation: c.operation,
          model: c.model ?? null,
          source: c.source,
          actualCostUsd: c.actualCostUsd ?? null,
          estimatedCostUsd: c.estimatedCostUsd ?? null,
          tokensIn: c.tokensIn ?? null,
          tokensOut: c.tokensOut ?? null,
        })),
        totalEstimatedCostUsd,
        totalActualCostUsd,
      },
      billingSnapshots: billingSnapshots.map((bs) => ({
        provider: bs.provider,
        periodStart: bs.periodStart,
        periodEnd: bs.periodEnd,
        providerSpendUsd: bs.providerSpendUsd ?? null,
        calculatedSpendUsd: bs.calculatedSpendUsd,
        deltaUsd: bs.deltaUsd ?? null,
        creditBalance: bs.creditBalance ?? null,
        source: bs.source,
        createdAt: bs.createdAt,
      })),
    }
  },
})

export const getCreditState = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireSupportAdmin(ctx)

    const balance = await getWorkspaceCreditBalance(ctx, args.workspaceId)
    if (!balance) {
      return { balance: null, recentLedger: [] }
    }

    const recentLedger = await ctx.db
      .query("creditLedger")
      .withIndex("by_workspaceId_and_createdAt", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(20)

    return {
      balance: getWorkspaceCreditSnapshot(balance),
      recentLedger: recentLedger.map((cl) => ({
        type: cl.type,
        amount: cl.amount,
        reason: cl.reason ?? null,
        createdAt: cl.createdAt,
      })),
    }
  },
})

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export const getOperationsMetrics = query({
  args: {},
  handler: async (ctx) => {
    await requireSupportAdmin(ctx)

    const cutoff = now() - METRICS_WINDOW_DAYS * DAY_MS

    const completedAudits = await ctx.db
      .query("audits")
      .withIndex("by_status_and_createdAt", (q) =>
        q.eq("status", "completed").gte("createdAt", cutoff),
      )
      .take(500)

    const failedAudits = await ctx.db
      .query("audits")
      .withIndex("by_status_and_createdAt", (q) =>
        q.eq("status", "failed").gte("createdAt", cutoff),
      )
      .take(500)

    const total = completedAudits.length + failedAudits.length

    const durations: number[] = []
    for (const audit of completedAudits) {
      if (audit.startedAt && audit.completedAt) {
        durations.push(audit.completedAt - audit.startedAt)
      }
    }
    const avgDurationMs = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null

    const completionRate = total > 0 ? completedAudits.length / total : null
    const failureRate = total > 0 ? failedAudits.length / total : null

    const recentProviderCalls = await ctx.db
      .query("providerCalls")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", cutoff))
      .take(500)

    const providerGroups = new Map<string, { total: number; failed: number }>()
    for (const pc of recentProviderCalls) {
      const key = pc.provider
      const entry = providerGroups.get(key) ?? { total: 0, failed: 0 }
      entry.total++
      if (pc.status === "failed") entry.failed++
      providerGroups.set(key, entry)
    }

    const providerFailureRates: Record<string, number | null> = {}
    for (const [provider, entry] of providerGroups) {
      providerFailureRates[provider] = entry.total > 0 ? entry.failed / entry.total : null
    }

    const recentIntegrationRuns = await ctx.db
      .query("integrationRuns")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", cutoff))
      .take(500)
    const integrationGroups = new Map<string, { total: number; failed: number }>()
    let failedIntegrationRuns = 0
    for (const run of recentIntegrationRuns) {
      const integration = await ctx.db.get(run.integrationId)
      if (!integration) continue
      const entry = integrationGroups.get(integration.provider) ?? { total: 0, failed: 0 }
      entry.total++
      if (["retryable_failed", "permanent_failed", "unknown"].includes(run.status)) {
        entry.failed++
        failedIntegrationRuns++
      }
      integrationGroups.set(integration.provider, entry)
    }
    const integrationFailureRates: Record<string, number | null> = {}
    for (const [provider, entry] of integrationGroups) {
      integrationFailureRates[provider] = entry.total > 0 ? entry.failed / entry.total : null
    }

    const recentCosts = await ctx.db
      .query("providerCosts")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", cutoff))
      .take(500)

    let totalEstimatedCostUsd = 0
    let totalActualCostUsd = 0
    for (const cost of recentCosts) {
      if (cost.actualCostUsd !== undefined) {
        totalActualCostUsd += cost.actualCostUsd
      } else if (cost.estimatedCostUsd !== undefined) {
        totalEstimatedCostUsd += cost.estimatedCostUsd
      }
    }

    const avgCostPerAudit = completedAudits.length > 0
      ? (totalActualCostUsd + totalEstimatedCostUsd) / completedAudits.length
      : null

    const outreachCopiedEvents = await ctx.db
      .query("usageEvents")
      .withIndex("by_event_and_createdAt", (q) =>
        q.eq("event", "outreach_copied").gte("createdAt", cutoff),
      )
      .take(500)

    const outreachAuditIds = new Set<Id<"audits">>()
    for (const ev of outreachCopiedEvents) {
      if (ev.auditId) {
        outreachAuditIds.add(ev.auditId)
      }
    }
    const outreachCopyRate = completedAudits.length > 0
      ? outreachAuditIds.size / completedAudits.length
      : null

    const recentViews = await ctx.db
      .query("reportViews")
      .withIndex("by_viewedAt", (q) => q.gte("viewedAt", cutoff))
      .take(500)

    const viewAuditIds = new Set<Id<"audits">>()
    for (const view of recentViews) {
      viewAuditIds.add(view.auditId)
    }
    const publicReportRate = completedAudits.length > 0
      ? viewAuditIds.size / completedAudits.length
      : null

    return {
      windowDays: METRICS_WINDOW_DAYS,
      totalCompletedAudits: completedAudits.length,
      totalFailedAudits: failedAudits.length,
      avgDurationMs,
      completionRate,
      failureRate,
      providerFailureRates,
      integrationFailureRates,
      failedIntegrationRuns,
      totalEstimatedCostUsd,
      totalActualCostUsd,
      avgCostPerAudit,
      outreachCopyRate,
      publicReportViewRate: publicReportRate,
      reportViews: recentViews.length,
    }
  },
})

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const adjustCredits = action({
  args: {
    workspaceId: v.id("workspaces"),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args): Promise<{ adjusted: number }> => {
    const admin: { userId: Id<"users">; email: string } = await ctx.runQuery(
      internal.admin_operations._requireSupportAdminInternal,
      {},
    )

    const trimmedReason = args.reason.trim()
    if (!trimmedReason) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "A reason is required for credit adjustments" })
    }

    if (args.amount === 0 || !Number.isInteger(args.amount)) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Amount must be a non-zero integer" })
    }

    const result: { adjusted: number } = await ctx.runMutation(
      internal.admin_operations._adjustCreditsInternal,
      {
        workspaceId: args.workspaceId,
        amount: args.amount,
        reason: trimmedReason,
        actorUserId: admin.userId,
      },
    )
    return result
  },
})

export const _adjustCreditsInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    amount: v.number(),
    reason: v.string(),
    actorUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const balance = await getWorkspaceCreditBalance(ctx, args.workspaceId)
    if (!balance) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Credit balance not found" })
    }

    if (args.amount < 0) {
      const availableExtraCredits = Math.max(0, balance.extraCredits - balance.usedExtraCredits)
      if (availableExtraCredits + args.amount < 0) {
        throw new ConvexError({
          code: "VALIDATION_ERROR",
          message: "Cannot reduce extra credits below the available extra-credit balance",
        })
      }
      await ctx.db.patch(balance._id, {
        extraCredits: balance.extraCredits + args.amount,
        updatedAt: now(),
      })
    } else {
      await ctx.db.patch(balance._id, {
        extraCredits: balance.extraCredits + args.amount,
        updatedAt: now(),
      })
    }

    const current = now()
    await ctx.db.insert("creditLedger", {
      workspaceId: args.workspaceId,
      type: "manual_adjustment",
      amount: args.amount,
      balanceScope: "extra",
      reason: args.reason,
      createdByUserId: args.actorUserId,
      createdAt: current,
    })

    await ctx.db.insert("adminActions", {
      actorUserId: args.actorUserId,
      workspaceId: args.workspaceId,
      action: "credit_adjusted",
      reason: args.reason,
      metadata: { amount: args.amount },
      createdAt: current,
    })

    return { adjusted: args.amount }
  },
})

export const disablePublicReport = action({
  args: {
    auditId: v.id("audits"),
    reason: v.string(),
  },
  handler: async (ctx, args): Promise<{ auditId: Id<"audits">; isPublic: boolean }> => {
    const admin: { userId: Id<"users">; email: string } = await ctx.runQuery(
      internal.admin_operations._requireSupportAdminInternal,
      {},
    )

    const trimmedReason = args.reason.trim()
    if (!trimmedReason) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "A reason is required" })
    }

    const result: { auditId: Id<"audits">; isPublic: boolean } = await ctx.runMutation(
      internal.admin_operations._disableReportInternal,
      {
        auditId: args.auditId,
        reason: trimmedReason,
        actorUserId: admin.userId,
      },
    )
    return result
  },
})

export const _disableReportInternal = internalMutation({
  args: {
    auditId: v.id("audits"),
    reason: v.string(),
    actorUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const audit = await ctx.db.get(args.auditId)
    if (!audit) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Audit not found" })
    }

    const current = now()
    await ctx.db.patch(args.auditId, {
      isPublic: false,
      updatedAt: current,
    })

    await ctx.db.insert("adminActions", {
      actorUserId: args.actorUserId,
      workspaceId: audit.workspaceId,
      auditId: args.auditId,
      action: "report_disabled",
      reason: args.reason,
      createdAt: current,
    })

    return { auditId: args.auditId, isPublic: false }
  },
})

export const rerunAudit = action({
  args: {
    auditId: v.id("audits"),
    reason: v.string(),
  },
  handler: async (ctx, args): Promise<{ newAuditId: Id<"audits">; originalAuditId: Id<"audits"> }> => {
    const admin: { userId: Id<"users">; email: string } = await ctx.runQuery(
      internal.admin_operations._requireSupportAdminInternal,
      {},
    )

    const trimmedReason = args.reason.trim()
    if (!trimmedReason) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "A reason is required" })
    }

    const result: { newAuditId: Id<"audits">; originalAuditId: Id<"audits"> } = await ctx.runMutation(
      internal.admin_operations._rerunAuditInternal,
      {
        auditId: args.auditId,
        reason: trimmedReason,
        actorUserId: admin.userId,
      },
    )
    return result
  },
})

export const _rerunAuditInternal = internalMutation({
  args: {
    auditId: v.id("audits"),
    reason: v.string(),
    actorUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const originalAudit = await ctx.db.get(args.auditId)
    if (!originalAudit) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Audit not found" })
    }

    if (originalAudit.status !== "failed" && originalAudit.status !== "cancelled") {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Only failed or cancelled audits can be rerun",
      })
    }

    const workspace = await ctx.db.get(originalAudit.workspaceId)
    if (!workspace) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Workspace not found" })
    }

    const balance = await getWorkspaceCreditBalance(ctx, originalAudit.workspaceId)
    if (!balance) {
      throw new ConvexError({ code: "INSUFFICIENT_CREDITS", message: "No credits available" })
    }

    const snapshot = getWorkspaceCreditSnapshot(balance)
    if (snapshot.remaining < 1) {
      throw new ConvexError({ code: "INSUFFICIENT_CREDITS", message: "No credits available" })
    }

    const newIdempotencyKey = `rerun:${args.auditId}:${now()}`
    const publicSlug = generatePublicSlug()
    const current = now()

    const newAuditId = await ctx.db.insert("audits", {
      workspaceId: originalAudit.workspaceId,
      leadId: originalAudit.leadId,
      createdByUserId: args.actorUserId,
      url: originalAudit.url,
      normalizedUrl: originalAudit.normalizedUrl,
      domain: originalAudit.domain,
      auditType: originalAudit.auditType,
      reportLanguage: originalAudit.reportLanguage,
      idempotencyKey: newIdempotencyKey,
      status: "queued",
      statusMessage: "Audit wird vorbereitet (Re-Run)",
      publicSlug,
      isPublic: false,
      reportVersion: originalAudit.reportVersion,
      rerunOfAuditId: args.auditId,
      queuedAt: current,
      createdAt: current,
      updatedAt: current,
    })

    await ctx.db.insert("auditPipelineStates", {
      workspaceId: originalAudit.workspaceId,
      auditId: newAuditId,
      status: "queued",
      phase: "queued",
      attemptCount: 0,
      updatedAt: current,
    })

    await reserveWorkspaceCredit(
      ctx,
      originalAudit.workspaceId,
      args.actorUserId,
      newAuditId,
      newIdempotencyKey,
    )

    await ctx.db.insert("usageEvents", {
      workspaceId: originalAudit.workspaceId,
      userId: args.actorUserId,
      auditId: newAuditId,
      event: "audit_started",
      idempotencyKey: newIdempotencyKey,
      metadata: {
        auditType: originalAudit.auditType,
        reportLanguage: originalAudit.reportLanguage,
      },
      createdAt: current,
    })

    await ctx.db.insert("adminActions", {
      actorUserId: args.actorUserId,
      workspaceId: originalAudit.workspaceId,
      auditId: newAuditId,
      action: "audit_rerun",
      reason: args.reason,
      metadata: { originalAuditId: args.auditId },
      createdAt: current,
    })

    await auditWorkpool.enqueueAction(
      ctx,
      internal.audit_pipeline.processAuditPipeline,
      { auditId: newAuditId },
      { retry: true },
    )

    return { newAuditId, originalAuditId: args.auditId }
  },
})
