import { ConvexError, v } from "convex/values"

import { api, internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
} from "./_generated/server"
import { batchAuditWorkpool } from "./workpools"
import {
  generatePublicSlug,
  normalizeAuditUrl,
  validatePublicAuditTarget,
} from "./lib/audit_url"
import {
  consumeWorkspaceBatchItemCredit,
  releaseWorkspaceBatchItemCredit,
  reserveWorkspaceBatchCredits,
  reserveWorkspaceBatchItemRetryCredit,
} from "./lib/credits"
import {
  MAX_MANUAL_BATCH_ITEM_RETRIES,
  isSafeBatchItemRetry,
  terminalBatchStatus,
  validateBatchAuditSize,
} from "./lib/batch_audit_policy"
import { getWorkspacePlan, requireOwnerWorkspace } from "./lib/workspace"
import type { SubscriptionPlan } from "./lib/rate_limit_helpers"
import { checkBatchStartLimits } from "./lib/audit_rate_limit"
import { isBatchQaPositionSelected } from "./lib/batch_audit_qa"
import {
  estimateBatchAuditCostUsd,
  PROVIDER_COST_RATE_VERSION,
} from "./lib/provider_cost_rates"

type BatchSource = "campaign" | "csv"
type AuditType = "standard" | "local" | "quick"
type ReportLanguage = "de" | "en"

type PreparedItem = {
  position: number
  url: string
  normalizedUrl: string
  domain: string
  leadId?: Id<"leads">
  campaignLeadId?: Id<"campaignLeads">
}

type InvalidItem = {
  position: number
  url: string
  code: string
  message: string
}

type RawBatchItem = {
  position: number
  url: string
  leadId?: Id<"leads">
  campaignLeadId?: Id<"campaignLeads">
}

type PreparedBatch = {
  workspaceId: Id<"workspaces">
  userId: Id<"users">
  plan: SubscriptionPlan
  source: BatchSource
  campaignId?: Id<"campaigns">
  auditType: AuditType
  reportLanguage: ReportLanguage
  items: PreparedItem[]
  invalidItems: InvalidItem[]
  availableCredits: number
}

const sourceValidator = v.union(v.literal("campaign"), v.literal("csv"))
const auditTypeValidator = v.union(v.literal("standard"), v.literal("local"), v.literal("quick"))
const reportLanguageValidator = v.union(v.literal("de"), v.literal("en"))

const batchInputArgs = {
  source: sourceValidator,
  campaignId: v.optional(v.id("campaigns")),
  campaignLeadIds: v.optional(v.array(v.id("campaignLeads"))),
  urls: v.optional(v.array(v.string())),
  auditType: auditTypeValidator,
  reportLanguage: reportLanguageValidator,
}

function batchError(code: string, message: string): never {
  throw new ConvexError({ code, message })
}

function validateInputShape(args: {
  source: BatchSource
  campaignId?: Id<"campaigns">
  campaignLeadIds?: Id<"campaignLeads">[]
  urls?: string[]
}) {
  if (args.source === "campaign") {
    if (!args.campaignId || !args.campaignLeadIds || args.urls !== undefined) {
      batchError("INVALID_BATCH_SOURCE", "Campaign batches require a campaign and campaign leads")
    }
    return
  }
  if (args.campaignId !== undefined || args.campaignLeadIds !== undefined || !args.urls) {
    batchError("INVALID_BATCH_SOURCE", "CSV batches require URLs without campaign context")
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  fn: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (cursor < values.length) {
        const index = cursor++
        results[index] = await fn(values[index]!, index)
      }
    }),
  )
  return results
}

export const loadCampaignBatchInputs = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    campaignId: v.id("campaigns"),
    campaignLeadIds: v.array(v.id("campaignLeads")),
  },
  handler: async (ctx, args): Promise<{
    reportLanguage: ReportLanguage
    rows: Array<{
      position: number
      url: string
      leadId: Id<"leads">
      campaignLeadId: Id<"campaignLeads">
    }>
  }> => {
    if (args.campaignLeadIds.length > 100) {
      batchError("BATCH_TOO_LARGE", "A batch cannot contain more than 100 items")
    }
    const campaign = await ctx.db.get(args.campaignId)
    if (!campaign || campaign.workspaceId !== args.workspaceId) {
      batchError("NOT_FOUND", "Campaign not found")
    }
    if (campaign.status !== "active") {
      batchError("VALIDATION_ERROR", "Audits can only start from active campaigns")
    }

    const rows = []
    const seen = new Set<Id<"campaignLeads">>()
    for (const [position, campaignLeadId] of args.campaignLeadIds.entries()) {
      if (seen.has(campaignLeadId)) continue
      seen.add(campaignLeadId)
      const campaignLead = await ctx.db.get(campaignLeadId)
      if (
        !campaignLead ||
        campaignLead.workspaceId !== args.workspaceId ||
        campaignLead.campaignId !== campaign._id
      ) {
        batchError("NOT_FOUND", "Campaign lead not found")
      }
      const lead = await ctx.db.get(campaignLead.leadId)
      if (!lead || lead.workspaceId !== args.workspaceId) {
        batchError("NOT_FOUND", "Lead not found")
      }
      rows.push({
        position,
        url: lead.normalizedWebsiteUrl ?? lead.websiteUrl ?? "",
        leadId: lead._id,
        campaignLeadId: campaignLead._id,
      })
    }
    return { reportLanguage: campaign.language as ReportLanguage, rows }
  },
})

async function prepareBatch(
  ctx: ActionCtx,
  args: {
    source: BatchSource
    campaignId?: Id<"campaigns">
    campaignLeadIds?: Id<"campaignLeads">[]
    urls?: string[]
    auditType: AuditType
    reportLanguage: ReportLanguage
  },
): Promise<PreparedBatch> {
  validateInputShape(args)
  const workspace = await ctx.runMutation(api.workspaces.ensureCurrentWorkspace, {})
  if (!workspace || !("workspaceId" in workspace) || !workspace.workspaceId) {
    batchError("WORKSPACE_NOT_READY", "Workspace not ready")
  }
  const plan = (workspace.plan ?? "free") as SubscriptionPlan
  const rows: { reportLanguage: ReportLanguage; rows: RawBatchItem[] } = args.source === "campaign"
    ? await ctx.runQuery(internal.batch_audits.loadCampaignBatchInputs, {
        workspaceId: workspace.workspaceId,
        campaignId: args.campaignId!,
        campaignLeadIds: args.campaignLeadIds!,
      })
    : {
        reportLanguage: args.reportLanguage,
        rows: (args.urls ?? []).slice(0, 101).map((url, position) => ({ position, url })),
      }

  const rawCount = args.source === "campaign" ? (args.campaignLeadIds?.length ?? 0) : (args.urls?.length ?? 0)
  if (rawCount > 100) batchError("BATCH_TOO_LARGE", "A batch cannot contain more than 100 items")

  const seenDomains = new Set<string>()
  const checked = await mapWithConcurrency(rows.rows, 8, async (row) => {
    const normalized = normalizeAuditUrl(row.url)
    if ("code" in normalized) {
      return { invalid: { position: row.position, url: row.url, code: normalized.code, message: normalized.message } }
    }
    if (seenDomains.has(normalized.hostname)) {
      return {
        invalid: {
          position: row.position,
          url: row.url,
          code: "DUPLICATE_DOMAIN",
          message: "The domain is already included in this batch",
        },
      }
    }
    seenDomains.add(normalized.hostname)
    const target = await validatePublicAuditTarget(normalized.hostname)
    if ("code" in target) {
      return { invalid: { position: row.position, url: row.url, code: target.code, message: target.message } }
    }
    return {
      item: {
        position: row.position,
        url: row.url.trim(),
        normalizedUrl: normalized.normalizedUrl,
        domain: normalized.hostname,
        ...(row.leadId ? { leadId: row.leadId } : {}),
        ...(row.campaignLeadId ? { campaignLeadId: row.campaignLeadId } : {}),
      } satisfies PreparedItem,
    }
  })

  return {
    workspaceId: workspace.workspaceId,
    userId: workspace.userId,
    plan,
    source: args.source,
    campaignId: args.campaignId,
    auditType: args.auditType,
    reportLanguage: rows.reportLanguage,
    items: checked.flatMap((result) => result.item ? [result.item] : []),
    invalidItems: checked.flatMap((result) => result.invalid ? [result.invalid] : []),
    availableCredits: workspace.credits.remaining,
  }
}

export const previewBatch = action({
  args: batchInputArgs,
  handler: async (ctx, args) => {
    const prepared = await prepareBatch(ctx, args)
    const size = validateBatchAuditSize(prepared.plan, prepared.items.length)
    const shortfall = Math.max(0, prepared.items.length - prepared.availableCredits)
    return {
      allowed: size.ok && shortfall === 0,
      plan: prepared.plan,
      planLimit: size.policy.maxItems,
      maxParallelism: size.policy.maxParallelism,
      estimatedCredits: prepared.items.length,
      estimatedCostUsd: estimateBatchAuditCostUsd(
        prepared.auditType,
        prepared.items.length,
      ),
      costPricingVersion: PROVIDER_COST_RATE_VERSION,
      availableCredits: prepared.availableCredits,
      shortfall,
      effectiveReportLanguage: prepared.reportLanguage,
      effectiveItems: prepared.items,
      invalidItems: prepared.invalidItems,
      blockingCode: !size.ok ? size.code : shortfall > 0 ? "INSUFFICIENT_CREDITS" : null,
    }
  },
})

export const createBatch = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    source: sourceValidator,
    campaignId: v.optional(v.id("campaigns")),
    auditType: auditTypeValidator,
    reportLanguage: reportLanguageValidator,
    idempotencyKey: v.string(),
    items: v.array(v.object({
      position: v.number(),
      url: v.string(),
      normalizedUrl: v.string(),
      domain: v.string(),
      leadId: v.optional(v.id("leads")),
      campaignLeadId: v.optional(v.id("campaignLeads")),
    })),
  },
  handler: async (ctx, args): Promise<{ batchAuditJobId: Id<"batchAuditJobs">; status: string; totalItems: number }> => {
    const workspace = await ctx.db.get(args.workspaceId)
    if (!workspace || workspace.ownerUserId !== args.userId) batchError("FORBIDDEN", "Workspace access denied")
    const existing = await ctx.db
      .query("batchAuditJobs")
      .withIndex("by_workspaceId_and_idempotencyKey", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("idempotencyKey", args.idempotencyKey),
      )
      .unique()
    if (existing) {
      return { batchAuditJobId: existing._id, status: existing.status, totalItems: existing.totalItems }
    }

    const plan = await getWorkspacePlan(ctx, args.workspaceId)
    const size = validateBatchAuditSize(plan, args.items.length)
    if (!size.ok) batchError(size.code, "This batch is not available on the current plan")
    if (args.source === "campaign") {
      const campaign = args.campaignId ? await ctx.db.get(args.campaignId) : null
      if (!campaign || campaign.workspaceId !== args.workspaceId || campaign.status !== "active") {
        batchError("VALIDATION_ERROR", "Campaign is no longer active")
      }
      for (const item of args.items) {
        if (!item.leadId || !item.campaignLeadId) batchError("INVALID_CAMPAIGN_CONTEXT", "Campaign context is incomplete")
        const campaignLead = await ctx.db.get(item.campaignLeadId)
        if (!campaignLead || campaignLead.campaignId !== campaign._id || campaignLead.leadId !== item.leadId) {
          batchError("INVALID_CAMPAIGN_CONTEXT", "Campaign context changed")
        }
      }
    }

    await checkBatchStartLimits(ctx, {
      workspaceId: args.workspaceId,
      userId: args.userId,
      plan,
      itemCount: args.items.length,
    })

    const now = Date.now()
    const qaSelectedItems = args.items.filter((_, index) =>
      isBatchQaPositionSelected(index, args.items.length),
    ).length
    const batchAuditJobId = await ctx.db.insert("batchAuditJobs", {
      workspaceId: args.workspaceId,
      campaignId: args.campaignId,
      createdByUserId: args.userId,
      source: args.source,
      planSnapshot: plan,
      planLimitSnapshot: size.policy.maxItems,
      maxParallelismSnapshot: size.policy.maxParallelism,
      auditType: args.auditType,
      reportLanguage: args.reportLanguage,
      idempotencyKey: args.idempotencyKey,
      status: "queued",
      totalItems: args.items.length,
      queuedItems: args.items.length,
      runningItems: 0,
      completedItems: 0,
      failedItems: 0,
      cancelledItems: 0,
      initialReservedCredits: args.items.length,
      reservedCredits: args.items.length,
      consumedCredits: 0,
      refundedCredits: 0,
      cacheHitItems: 0,
      cacheHitOperations: 0,
      qaSelectedItems,
      qaPassedItems: 0,
      qaFailedItems: 0,
      createdAt: now,
      updatedAt: now,
    })

    await reserveWorkspaceBatchCredits(
      ctx,
      args.workspaceId,
      args.userId,
      batchAuditJobId,
      args.items.length,
      `batch-reserve:${args.idempotencyKey}`,
    )
    for (const [index, item] of args.items.entries()) {
      const qaSelected = isBatchQaPositionSelected(index, args.items.length)
      await ctx.db.insert("batchAuditItems", {
        batchAuditJobId,
        workspaceId: args.workspaceId,
        leadId: item.leadId,
        campaignLeadId: item.campaignLeadId,
        position: item.position,
        url: item.url,
        normalizedUrl: item.normalizedUrl,
        domain: item.domain,
        status: "queued",
        attemptCount: 0,
        manualRetryCount: 0,
        creditSettled: false,
        cacheHitCount: 0,
        qaSelected,
        qaStatus: qaSelected ? "pending" : "skipped",
        createdAt: now,
        updatedAt: now,
      })
    }
    await ctx.scheduler.runAfter(0, internal.batch_audits.dispatchBatch, { batchAuditJobId })
    return { batchAuditJobId, status: "queued", totalItems: args.items.length }
  },
})

export const startBatch = action({
  args: { ...batchInputArgs, idempotencyKey: v.string() },
  handler: async (ctx, args): Promise<{ batchAuditJobId: Id<"batchAuditJobs">; status: string; totalItems: number }> => {
    const key = args.idempotencyKey.trim()
    if (!/^[a-zA-Z0-9:_-]{8,160}$/.test(key)) batchError("VALIDATION_ERROR", "Invalid idempotency key")
    const prepared = await prepareBatch(ctx, args)
    const size = validateBatchAuditSize(prepared.plan, prepared.items.length)
    if (!size.ok) batchError(size.code, "This batch is not available on the current plan")
    if (prepared.availableCredits < prepared.items.length) {
      batchError("INSUFFICIENT_CREDITS", "Not enough credits for this batch")
    }
    return await ctx.runMutation(internal.batch_audits.createBatch, {
      workspaceId: prepared.workspaceId,
      userId: prepared.userId,
      source: prepared.source,
      campaignId: prepared.campaignId,
      auditType: prepared.auditType,
      reportLanguage: prepared.reportLanguage,
      idempotencyKey: key,
      items: prepared.items,
    })
  },
})

async function createAuditForItem(
  ctx: MutationCtx,
  job: Doc<"batchAuditJobs">,
  item: Doc<"batchAuditItems">,
) {
  const current = Date.now()
  const attempt = item.attemptCount + 1
  const auditId = await ctx.db.insert("audits", {
    workspaceId: job.workspaceId,
    leadId: item.leadId,
    campaignId: job.campaignId,
    campaignLeadId: item.campaignLeadId,
    batchAuditJobId: job._id,
    batchAuditItemId: item._id,
    createdByUserId: job.createdByUserId,
    url: item.url,
    normalizedUrl: item.normalizedUrl,
    domain: item.domain,
    auditType: job.auditType,
    reportLanguage: job.reportLanguage,
    idempotencyKey: `batch:${job._id}:item:${item._id}:attempt:${attempt}`,
    status: "queued",
    statusMessage: "Batch-Audit wird vorbereitet",
    publicSlug: generatePublicSlug(),
    isPublic: false,
    reportVersion: "v1",
    rerunOfAuditId: item.previousAuditId,
    queuedAt: current,
    createdAt: current,
    updatedAt: current,
  })
  await ctx.db.insert("auditPipelineStates", {
    workspaceId: job.workspaceId,
    auditId,
    status: "queued",
    phase: "queued",
    attemptCount: 0,
    updatedAt: current,
  })
  if (item.leadId) await ctx.db.patch(item.leadId, { auditId, updatedAt: current })
  await ctx.db.insert("usageEvents", {
    workspaceId: job.workspaceId,
    userId: job.createdByUserId,
    auditId,
    event: "audit_started",
    idempotencyKey: `batch-audit-start:${job._id}:${item._id}:${attempt}`,
    metadata: { batchAuditJobId: job._id, batchAuditItemId: item._id },
    createdAt: current,
  })
  const workpoolId = await batchAuditWorkpool.enqueueAction(
    ctx,
    internal.audit_pipeline.processAuditPipeline,
    { auditId },
    { retry: true },
  )
  await ctx.db.patch(item._id, {
    status: "running",
    auditId,
    workpoolId,
    attemptCount: attempt,
    startedAt: current,
    completedAt: undefined,
    updatedAt: current,
  })
}

export const dispatchBatch = internalMutation({
  args: { batchAuditJobId: v.id("batchAuditJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.batchAuditJobId)
    if (!job || (job.status !== "queued" && job.status !== "running")) return { dispatched: 0 }
    const running = await ctx.db
      .query("batchAuditItems")
      .withIndex("by_batchAuditJobId_and_status", (q) =>
        q.eq("batchAuditJobId", job._id).eq("status", "running"),
      )
      .take(job.maxParallelismSnapshot)
    const capacity = Math.max(0, job.maxParallelismSnapshot - running.length)
    if (capacity === 0) return { dispatched: 0 }
    const queued = await ctx.db
      .query("batchAuditItems")
      .withIndex("by_batchAuditJobId_and_status", (q) =>
        q.eq("batchAuditJobId", job._id).eq("status", "queued"),
      )
      .take(capacity)
    if (queued.length === 0) return { dispatched: 0 }
    for (const item of queued) await createAuditForItem(ctx, job, item)
    const current = Date.now()
    await ctx.db.patch(job._id, {
      status: "running",
      queuedItems: Math.max(0, job.queuedItems - queued.length),
      runningItems: job.runningItems + queued.length,
      startedAt: job.startedAt ?? current,
      updatedAt: current,
    })
    return { dispatched: queued.length }
  },
})

export async function settleBatchAuditItem(
  ctx: MutationCtx,
  args: {
    auditId: Id<"audits">
    outcome: "completed" | "failed" | "cancelled"
    errorCode?: string
    errorMessage?: string
  },
) {
  const item = await ctx.db
    .query("batchAuditItems")
    .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
    .unique()
  if (!item || item.creditSettled) return null
  const job = await ctx.db.get(item.batchAuditJobId)
  if (!job) return null
  const current = Date.now()
  const completed = args.outcome === "completed"
  const cancelled = args.outcome === "cancelled"
  if (completed) {
    await consumeWorkspaceBatchItemCredit(ctx, {
      workspaceId: job.workspaceId,
      batchAuditJobId: job._id,
      batchAuditItemId: item._id,
      auditId: args.auditId,
      idempotencyKey: `batch-consume:${item._id}:${item.attemptCount}`,
    })
  } else {
    await releaseWorkspaceBatchItemCredit(ctx, {
      workspaceId: job.workspaceId,
      batchAuditJobId: job._id,
      batchAuditItemId: item._id,
      auditId: args.auditId,
      idempotencyKey: `batch-refund:${item._id}:${item.attemptCount}`,
      reason: cancelled ? "batch_audit_cancelled" : (args.errorCode ?? "batch_audit_failed"),
    })
  }

  const itemStatus = completed ? "completed" as const : cancelled ? "cancelled" as const : "failed" as const
  const providerCosts = await ctx.db
    .query("providerCosts")
    .withIndex("by_batchAuditItemId_and_createdAt", (q) => q.eq("batchAuditItemId", item._id))
    .take(100)
  const estimatedCostUsd = providerCosts.reduce((total, cost) => total + (cost.estimatedCostUsd ?? 0), 0)
  const actualCostUsd = providerCosts.reduce((total, cost) => total + (cost.actualCostUsd ?? 0), 0)
  const providerRequestCount = providerCosts.reduce((total, cost) => total + (cost.requestCount ?? 1), 0)
  await ctx.db.patch(item._id, {
    status: itemStatus,
    errorCode: completed ? undefined : args.errorCode,
    errorMessage: completed ? undefined : args.errorMessage,
    retryable: itemStatus === "failed" ? isSafeBatchItemRetry(args.errorCode) : false,
    creditSettled: true,
    completedAt: current,
    updatedAt: current,
  })
  const next = {
    completedItems: job.completedItems + (completed ? 1 : 0),
    failedItems: job.failedItems + (itemStatus === "failed" ? 1 : 0),
    cancelledItems: job.cancelledItems + (itemStatus === "cancelled" ? 1 : 0),
  }
  const terminal = terminalBatchStatus({ totalItems: job.totalItems, ...next })
  await ctx.db.patch(job._id, {
    runningItems: Math.max(0, job.runningItems - 1),
    ...next,
    reservedCredits: Math.max(0, job.reservedCredits - 1),
    consumedCredits: job.consumedCredits + (completed ? 1 : 0),
    refundedCredits: job.refundedCredits + (completed ? 0 : 1),
    estimatedCostUsd: (job.estimatedCostUsd ?? 0) + estimatedCostUsd,
    actualCostUsd: (job.actualCostUsd ?? 0) + actualCostUsd,
    providerRequestCount: (job.providerRequestCount ?? 0) + providerRequestCount,
    status: job.status === "cancelled" ? "cancelled" : terminal ?? job.status,
    completedAt: terminal ? current : undefined,
    updatedAt: current,
  })
  if (!terminal && job.status === "running") {
    await ctx.scheduler.runAfter(0, internal.batch_audits.dispatchBatch, { batchAuditJobId: job._id })
  }
  if (completed && item.qaSelected) {
    await ctx.scheduler.runAfter(0, internal.batch_audit_qa.evaluateCompletedItem, {
      batchAuditItemId: item._id,
    })
  }
  return { batchAuditItemId: item._id, status: itemStatus }
}

export const settleAuditItem = internalMutation({
  args: {
    auditId: v.id("audits"),
    outcome: v.union(v.literal("completed"), v.literal("failed"), v.literal("cancelled")),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: settleBatchAuditItem,
})

export const listMyBatches = query({
  args: {},
  handler: async (ctx) => {
    const { workspace } = await requireOwnerWorkspace(ctx)
    const items = await ctx.db
      .query("batchAuditJobs")
      .withIndex("by_workspaceId_and_createdAt", (q) => q.eq("workspaceId", workspace._id))
      .order("desc")
      .take(50)
    return { items, total: items.length }
  },
})

export const getBatch = query({
  args: { batchAuditJobId: v.id("batchAuditJobs") },
  handler: async (ctx, args) => {
    const { workspace } = await requireOwnerWorkspace(ctx)
    const job = await ctx.db.get(args.batchAuditJobId)
    if (!job || job.workspaceId !== workspace._id) return null
    const items = await ctx.db
      .query("batchAuditItems")
      .withIndex("by_batchAuditJobId_and_position", (q) => q.eq("batchAuditJobId", job._id))
      .take(100)
    return { job, items }
  },
})

export const pauseBatch = mutation({
  args: { batchAuditJobId: v.id("batchAuditJobs") },
  handler: async (ctx, args) => {
    const { workspace } = await requireOwnerWorkspace(ctx)
    const job = await ctx.db.get(args.batchAuditJobId)
    if (!job || job.workspaceId !== workspace._id) batchError("NOT_FOUND", "Batch not found")
    if (job.status !== "queued" && job.status !== "running") batchError("INVALID_BATCH_STATE", "Batch cannot be paused")
    const queued = await ctx.db
      .query("batchAuditItems")
      .withIndex("by_batchAuditJobId_and_status", (q) => q.eq("batchAuditJobId", job._id).eq("status", "queued"))
      .take(100)
    const current = Date.now()
    for (const item of queued) await ctx.db.patch(item._id, { status: "paused", updatedAt: current })
    await ctx.db.patch(job._id, { status: "paused", updatedAt: current })
    return { status: "paused" as const, inFlightItems: job.runningItems }
  },
})

export const resumeBatch = mutation({
  args: { batchAuditJobId: v.id("batchAuditJobs") },
  handler: async (ctx, args) => {
    const { workspace } = await requireOwnerWorkspace(ctx)
    const job = await ctx.db.get(args.batchAuditJobId)
    if (!job || job.workspaceId !== workspace._id) batchError("NOT_FOUND", "Batch not found")
    if (job.status !== "paused") batchError("INVALID_BATCH_STATE", "Batch is not paused")
    const paused = await ctx.db
      .query("batchAuditItems")
      .withIndex("by_batchAuditJobId_and_status", (q) => q.eq("batchAuditJobId", job._id).eq("status", "paused"))
      .take(100)
    const current = Date.now()
    for (const item of paused) await ctx.db.patch(item._id, { status: "queued", updatedAt: current })
    await ctx.db.patch(job._id, { status: job.runningItems > 0 ? "running" : "queued", updatedAt: current })
    await ctx.scheduler.runAfter(0, internal.batch_audits.dispatchBatch, { batchAuditJobId: job._id })
    return { status: job.runningItems > 0 ? "running" as const : "queued" as const }
  },
})

export const cancelBatch = mutation({
  args: { batchAuditJobId: v.id("batchAuditJobs") },
  handler: async (ctx, args) => {
    const { workspace } = await requireOwnerWorkspace(ctx)
    const job = await ctx.db.get(args.batchAuditJobId)
    if (!job || job.workspaceId !== workspace._id) batchError("NOT_FOUND", "Batch not found")
    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
      batchError("INVALID_BATCH_STATE", "Batch is already terminal")
    }
    const cancellable = []
    for (const status of ["queued", "paused"] as const) {
      cancellable.push(...await ctx.db
        .query("batchAuditItems")
        .withIndex("by_batchAuditJobId_and_status", (q) => q.eq("batchAuditJobId", job._id).eq("status", status))
        .take(100))
    }
    const current = Date.now()
    for (const item of cancellable) {
      if (!item.creditSettled) {
        await releaseWorkspaceBatchItemCredit(ctx, {
          workspaceId: job.workspaceId,
          batchAuditJobId: job._id,
          batchAuditItemId: item._id,
          auditId: item.auditId,
          idempotencyKey: `batch-cancel:${item._id}:${item.attemptCount}`,
          reason: "batch_audit_cancelled",
        })
      }
      await ctx.db.patch(item._id, {
        status: "cancelled",
        creditSettled: true,
        retryable: false,
        completedAt: current,
        updatedAt: current,
      })
    }
    await ctx.db.patch(job._id, {
      status: "cancelled",
      queuedItems: 0,
      cancelledItems: job.cancelledItems + cancellable.length,
      reservedCredits: Math.max(0, job.reservedCredits - cancellable.length),
      refundedCredits: job.refundedCredits + cancellable.filter((item) => !item.creditSettled).length,
      cancelledAt: current,
      completedAt: job.runningItems === 0 ? current : undefined,
      updatedAt: current,
    })
    return { status: "cancelled" as const, cancelledItems: cancellable.length, inFlightItems: job.runningItems }
  },
})

export const retryBatchItem = mutation({
  args: { batchAuditItemId: v.id("batchAuditItems") },
  handler: async (ctx, args) => {
    const { user, workspace } = await requireOwnerWorkspace(ctx)
    const item = await ctx.db.get(args.batchAuditItemId)
    if (!item || item.workspaceId !== workspace._id) batchError("NOT_FOUND", "Batch item not found")
    const job = await ctx.db.get(item.batchAuditJobId)
    if (!job || job.workspaceId !== workspace._id) batchError("NOT_FOUND", "Batch not found")
    if (job.status === "cancelled" || item.status !== "failed" || item.retryable !== true) {
      batchError("BATCH_ITEM_NOT_RETRYABLE", "This batch item cannot be retried safely")
    }
    if (item.manualRetryCount >= MAX_MANUAL_BATCH_ITEM_RETRIES) {
      batchError("BATCH_RETRY_LIMIT_EXCEEDED", "Manual retry limit reached")
    }
    const retryNumber = item.manualRetryCount + 1
    await reserveWorkspaceBatchItemRetryCredit(
      ctx,
      job.workspaceId,
      user.userId,
      job._id,
      item._id,
      `batch-retry-reserve:${item._id}:${retryNumber}`,
    )
    const current = Date.now()
    await ctx.db.patch(item._id, {
      status: "queued",
      manualRetryCount: retryNumber,
      previousAuditId: item.auditId,
      auditId: undefined,
      workpoolId: undefined,
      errorCode: undefined,
      errorMessage: undefined,
      retryable: undefined,
      creditSettled: false,
      startedAt: undefined,
      completedAt: undefined,
      updatedAt: current,
    })
    await ctx.db.patch(job._id, {
      status: "queued",
      queuedItems: job.queuedItems + 1,
      failedItems: Math.max(0, job.failedItems - 1),
      reservedCredits: job.reservedCredits + 1,
      completedAt: undefined,
      updatedAt: current,
    })
    await ctx.scheduler.runAfter(0, internal.batch_audits.dispatchBatch, { batchAuditJobId: job._id })
    return { status: "queued" as const, retryNumber }
  },
})
