import { ConvexError, v } from "convex/values"

import { components, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { internalAction, internalMutation, internalQuery } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"

const BATCH_SIZE = 50

const phases = [
  "auditScores",
  "auditSummaries",
  "auditFindings",
  "auditChecks",
  "auditPerformance",
  "auditRawData",
  "auditPages",
  "auditBusinessData",
  "outreachDrafts",
  "reportViews",
  "reportViewStats",
  "reportAccessGrants",
  "reportPdfArtifacts",
  "reportSettings",
  "notifications",
  "providerCalls",
  "auditPipelineStates",
  "auditAgentRuns",
  "auditPersonaReviews",
  "auditCopyReviews",
  "auditDesignCritiques",
  "batchAuditQaResults",
  "batchAuditItemAuditReference",
  "batchAuditItemPreviousReference",
  "auditAssets",
  "auditCacheEntries",
  "usageEvents",
  "providerCosts",
  "adminActions",
  "creditLedger",
  "rerunReferences",
  "leads",
  "audit",
] as const

type AuditDeletionPhase = (typeof phases)[number]

function nextPhase(phase: AuditDeletionPhase) {
  return phases[phases.indexOf(phase) + 1] ?? null
}

export async function enqueueAuditDeletion(
  ctx: MutationCtx,
  auditId: Id<"audits">,
  workspaceId: Id<"workspaces">,
) {
  const existing = await ctx.db
    .query("deletionJobs")
    .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
    .unique()
  if (existing) return existing._id

  const now = Date.now()
  await ctx.db.patch(auditId, {
    isPublic: false,
    status: "cancelled",
    statusMessage: "Audit wird gelöscht",
    cancelledAt: now,
    deletionRequestedAt: now,
    updatedAt: now,
  })
  const pipelineState = await ctx.db
    .query("auditPipelineStates")
    .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
    .unique()
  if (pipelineState) {
    await ctx.db.patch(pipelineState._id, {
      status: "failed",
      phase: "cancelled",
      leaseToken: undefined,
      leaseExpiresAt: undefined,
      finishedAt: now,
      updatedAt: now,
    })
  }
  const jobId = await ctx.db.insert("deletionJobs", {
    kind: "audit",
    workspaceId,
    auditId,
    phase: phases[0],
    status: "pending",
    createdAt: now,
    updatedAt: now,
  })
  await ctx.scheduler.runAfter(0, internal.deletion.processAuditDeletion, { jobId })
  return jobId
}

async function deleteSimplePhase(
  ctx: MutationCtx,
  phase: Exclude<AuditDeletionPhase, "batchAuditItemAuditReference" | "batchAuditItemPreviousReference" | "auditCacheEntries" | "usageEvents" | "providerCosts" | "adminActions" | "creditLedger" | "rerunReferences" | "leads" | "auditAssets" | "reportPdfArtifacts" | "reportSettings" | "audit">,
  auditId: Id<"audits">,
) {
  switch (phase) {
    case "auditScores": return await ctx.db.query("auditScores").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).take(BATCH_SIZE)
    case "auditSummaries": return await ctx.db.query("auditSummaries").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).take(BATCH_SIZE)
    case "auditFindings": return await ctx.db.query("auditFindings").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).take(BATCH_SIZE)
    case "auditChecks": return await ctx.db.query("auditChecks").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).take(BATCH_SIZE)
    case "auditPerformance": return await ctx.db.query("auditPerformance").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).take(BATCH_SIZE)
    case "auditRawData": return await ctx.db.query("auditRawData").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).take(BATCH_SIZE)
    case "auditPages": return await ctx.db.query("auditPages").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).take(BATCH_SIZE)
    case "auditBusinessData": return await ctx.db.query("auditBusinessData").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).take(BATCH_SIZE)
    case "outreachDrafts": return await ctx.db.query("outreachDrafts").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).take(BATCH_SIZE)
    case "reportViews": return await ctx.db.query("reportViews").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).take(BATCH_SIZE)
    case "reportViewStats": return await ctx.db.query("reportViewStats").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).take(BATCH_SIZE)
    case "reportAccessGrants": return await ctx.db.query("reportAccessGrants").withIndex("by_auditId_and_accessVersion", (q) => q.eq("auditId", auditId)).take(BATCH_SIZE)
    case "notifications": return await ctx.db.query("notifications").withIndex("by_auditId_and_type", (q) => q.eq("auditId", auditId)).take(BATCH_SIZE)
    case "providerCalls": return await ctx.db.query("providerCalls").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).take(BATCH_SIZE)
    case "auditPipelineStates": return await ctx.db.query("auditPipelineStates").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).take(BATCH_SIZE)
    case "auditAgentRuns": return await ctx.db.query("auditAgentRuns").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).take(BATCH_SIZE)
    case "auditPersonaReviews": return await ctx.db.query("auditPersonaReviews").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).take(BATCH_SIZE)
    case "auditCopyReviews": return await ctx.db.query("auditCopyReviews").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).take(BATCH_SIZE)
    case "auditDesignCritiques": return await ctx.db.query("auditDesignCritiques").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).take(BATCH_SIZE)
    case "batchAuditQaResults": return await ctx.db.query("batchAuditQaResults").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).take(BATCH_SIZE)
  }
}

export const processAuditDeletion = internalMutation({
  args: { jobId: v.id("deletionJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (!job || job.kind !== "audit" || job.status === "completed" || !job.auditId) return null
    const phase = job.phase as AuditDeletionPhase
    const now = Date.now()
    await ctx.db.patch(job._id, { status: "running", updatedAt: now })

    let processed = 0
    if (phase === "auditAssets") {
      const rows = await ctx.db.query("auditAssets").withIndex("by_auditId", (q) => q.eq("auditId", job.auditId!)).take(BATCH_SIZE)
      for (const row of rows) {
        const cacheEntry = row.auditCacheEntryId ? await ctx.db.get(row.auditCacheEntryId) : null
        if (cacheEntry) {
          const referenceCount = Math.max(0, cacheEntry.referenceCount - 1)
          if (referenceCount === 0 && cacheEntry.expiresAt <= now) {
            if (cacheEntry.storageId) await ctx.storage.delete(cacheEntry.storageId)
            await ctx.db.delete(cacheEntry._id)
          } else {
            await ctx.db.patch(cacheEntry._id, { referenceCount, updatedAt: now })
          }
        } else if (row.storageId) {
          await ctx.storage.delete(row.storageId)
        }
        await ctx.db.delete(row._id)
      }
      processed = rows.length
    } else if (phase === "batchAuditItemAuditReference") {
      const rows = await ctx.db.query("batchAuditItems").withIndex("by_auditId", (q) => q.eq("auditId", job.auditId!)).take(BATCH_SIZE)
      for (const row of rows) await ctx.db.patch(row._id, { auditId: undefined, updatedAt: now })
      processed = rows.length
    } else if (phase === "batchAuditItemPreviousReference") {
      const rows = await ctx.db.query("batchAuditItems").withIndex("by_previousAuditId", (q) => q.eq("previousAuditId", job.auditId!)).take(BATCH_SIZE)
      for (const row of rows) await ctx.db.patch(row._id, { previousAuditId: undefined, updatedAt: now })
      processed = rows.length
    } else if (phase === "auditCacheEntries") {
      const rows = await ctx.db.query("auditCacheEntries").withIndex("by_sourceAuditId", (q) => q.eq("sourceAuditId", job.auditId!)).take(BATCH_SIZE)
      for (const row of rows) {
        const retainedAsset = await ctx.db
          .query("auditAssets")
          .withIndex("by_auditCacheEntryId", (q) => q.eq("auditCacheEntryId", row._id))
          .first()
        if (retainedAsset) {
          await ctx.db.patch(row._id, { sourceAuditId: undefined, updatedAt: now })
        } else {
          if (row.storageId) await ctx.storage.delete(row.storageId)
          await ctx.db.delete(row._id)
        }
      }
      processed = rows.length
    } else if (phase === "usageEvents") {
      const rows = await ctx.db.query("usageEvents").withIndex("by_workspaceId_and_auditId", (q) => q.eq("workspaceId", job.workspaceId).eq("auditId", job.auditId)).take(BATCH_SIZE)
      for (const row of rows) await ctx.db.delete(row._id)
      processed = rows.length
    } else if (phase === "providerCosts") {
      const rows = await ctx.db.query("providerCosts").withIndex("by_auditId", (q) => q.eq("auditId", job.auditId!)).take(BATCH_SIZE)
      for (const row of rows) await ctx.db.patch(row._id, { auditId: undefined, providerCallId: undefined })
      processed = rows.length
    } else if (phase === "adminActions") {
      const rows = await ctx.db.query("adminActions").withIndex("by_auditId_and_createdAt", (q) => q.eq("auditId", job.auditId!)).take(BATCH_SIZE)
      for (const row of rows) await ctx.db.patch(row._id, { auditId: undefined })
      processed = rows.length
    } else if (phase === "creditLedger") {
      const rows = await ctx.db.query("creditLedger").withIndex("by_workspaceId_and_auditId", (q) => q.eq("workspaceId", job.workspaceId).eq("auditId", job.auditId)).take(BATCH_SIZE)
      for (const row of rows) await ctx.db.patch(row._id, { auditId: undefined })
      processed = rows.length
    } else if (phase === "rerunReferences") {
      const rows = await ctx.db.query("audits").withIndex("by_rerunOfAuditId", (q) => q.eq("rerunOfAuditId", job.auditId)).take(BATCH_SIZE)
      for (const row of rows) await ctx.db.patch(row._id, { rerunOfAuditId: undefined, updatedAt: now })
      processed = rows.length
    } else if (phase === "leads") {
      const rows = await ctx.db.query("leads").withIndex("by_workspaceId_and_auditId", (q) => q.eq("workspaceId", job.workspaceId).eq("auditId", job.auditId)).take(BATCH_SIZE)
      for (const row of rows) await ctx.db.patch(row._id, { auditId: undefined, updatedAt: now })
      processed = rows.length
    } else if (phase === "reportPdfArtifacts") {
      const rows = await ctx.db.query("reportPdfArtifacts").withIndex("by_auditId", (q) => q.eq("auditId", job.auditId!)).take(BATCH_SIZE)
      for (const row of rows) {
        if (row.storageId) await ctx.storage.delete(row.storageId)
        await ctx.db.delete(row._id)
      }
      processed = rows.length
    } else if (phase === "reportSettings") {
      const rows = await ctx.db.query("reportSettings").withIndex("by_auditId", (q) => q.eq("auditId", job.auditId!)).take(BATCH_SIZE)
      for (const row of rows) {
        const logoStorageId = row.logoStorageId
        await ctx.db.delete(row._id)
        if (logoStorageId) {
          const [workspace, otherReference, upload] = await Promise.all([
            ctx.db.get(row.workspaceId),
            ctx.db.query("reportSettings").withIndex("by_logoStorageId", (q) => q.eq("logoStorageId", logoStorageId)).first(),
            ctx.db.query("logoUploads").withIndex("by_storageId", (q) => q.eq("storageId", logoStorageId)).unique(),
          ])
          if (!otherReference && workspace?.logoStorageId !== logoStorageId && upload) {
            await ctx.storage.delete(logoStorageId)
            await ctx.db.delete(upload._id)
          }
        }
      }
      processed = rows.length
    } else if (phase === "audit") {
      const audit = await ctx.db.get(job.auditId)
      if (audit) await ctx.db.delete(audit._id)
      await ctx.db.patch(job._id, { status: "completed", completedAt: now, updatedAt: now })
      return { completed: true }
    } else {
      const rows = await deleteSimplePhase(ctx, phase, job.auditId)
      for (const row of rows) await ctx.db.delete(row._id)
      processed = rows.length
    }

    if (processed === BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.deletion.processAuditDeletion, { jobId: job._id })
      return { completed: false, phase, processed }
    }
    const next = nextPhase(phase)
    if (!next) return null
    await ctx.db.patch(job._id, { phase: next, updatedAt: now })
    await ctx.scheduler.runAfter(0, internal.deletion.processAuditDeletion, { jobId: job._id })
    return { completed: false, phase, processed }
  },
})

export const retryStaleDeletionJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 15 * 60_000
    const jobs = await ctx.db
      .query("deletionJobs")
      .withIndex("by_status_and_updatedAt", (q) => q.eq("status", "running").lt("updatedAt", cutoff))
      .take(50)
    for (const job of jobs) {
      if (job.kind === "audit") {
        await ctx.scheduler.runAfter(0, internal.deletion.processAuditDeletion, { jobId: job._id })
      } else {
        await ctx.scheduler.runAfter(0, internal.deletion.processWorkspaceDeletion, { jobId: job._id })
      }
    }
    const pending = await ctx.db
      .query("deletionJobs")
      .withIndex("by_status_and_updatedAt", (q) => q.eq("status", "pending").lt("updatedAt", cutoff))
      .take(50)
    for (const job of pending) {
      const ref = job.kind === "audit" ? internal.deletion.processAuditDeletion : internal.deletion.processWorkspaceDeletion
      await ctx.scheduler.runAfter(0, ref, { jobId: job._id })
    }
    return jobs.length + pending.length
  },
})

export const listStalePreparedWorkspaceDeletions = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 15 * 60_000
    const jobs = await ctx.db
      .query("deletionJobs")
      .withIndex("by_status_and_updatedAt", (q) =>
        q.eq("status", "prepared").lt("updatedAt", cutoff),
      )
      .take(50)
    const items: Array<{
      jobId: Id<"deletionJobs">
      betterAuthUserId: string
    }> = []
    for (const job of jobs) {
      if (job.kind !== "workspace" || !job.userId) continue
      const user = await ctx.db.get(job.userId)
      if (user) items.push({ jobId: job._id, betterAuthUserId: user.betterAuthUserId })
    }
    return items
  },
})

export const promotePreparedWorkspaceDeletion = internalMutation({
  args: { jobId: v.id("deletionJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (!job || job.kind !== "workspace" || job.status !== "prepared") return null
    const workspace = await ctx.db.get(job.workspaceId)
    const now = Date.now()
    if (workspace) {
      await ctx.db.patch(workspace._id, { deletionRequestedAt: now, updatedAt: now })
    }
    await ctx.db.patch(job._id, { status: "pending", updatedAt: now })
    await ctx.scheduler.runAfter(0, internal.deletion.processWorkspaceDeletion, { jobId: job._id })
    return job._id
  },
})

export const recoverPreparedWorkspaceDeletions = internalAction({
  args: {},
  handler: async (ctx) => {
    const jobs: Array<{ jobId: Id<"deletionJobs">; betterAuthUserId: string }> =
      await ctx.runQuery(internal.deletion.listStalePreparedWorkspaceDeletions, {})
    let recovered = 0
    for (const job of jobs) {
      const authUser = await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "_id", value: job.betterAuthUserId }],
      })
      if (authUser) continue
      await ctx.runMutation(internal.deletion.promotePreparedWorkspaceDeletion, {
        jobId: job.jobId,
      })
      recovered++
    }
    return recovered
  },
})

const workspacePhases = [
  "audits",
  "auditRawData", "auditAssets", "auditPerformance", "auditChecks", "auditScores",
  "auditFindings", "auditSummaries", "outreachDrafts", "reportViews", "reportViewStats",
  "reportAccessGrants", "reportPdfArtifacts", "reportSettings", "reportDomains",
  "notifications", "outreachTemplates",
  "auditPipelineStates", "providerCalls", "auditPages", "auditBusinessData", "auditAgentRuns",
  "auditPersonaReviews", "auditCopyReviews", "auditDesignCritiques",
  "batchAuditQaResults", "batchAuditItems", "batchAuditJobs", "auditCacheEntries",
  "leadActivities", "campaignLeads", "campaigns", "leads", "leadSearchSnapshots",
  "usageEvents", "providerCosts", "adminActions", "creditLedger", "creditBalances",
  "subscriptions", "retentionPreferenceEvents", "logoUploads", "workspaceMembers",
  "billingEvents", "deletionJobs", "workspace",
] as const
type WorkspaceDeletionPhase = (typeof workspacePhases)[number]

async function hasBlockingSubscription(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
) {
  for (const status of ["active", "trialing", "past_due"] as const) {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspaceId_and_status", (q) =>
        q.eq("workspaceId", workspaceId).eq("status", status),
      )
      .first()
    if (subscription && subscription.plan !== "free") return true
  }
  const cancelled = await ctx.db
    .query("subscriptions")
    .withIndex("by_workspaceId_and_status", (q) =>
      q.eq("workspaceId", workspaceId).eq("status", "cancelled"),
    )
    .order("desc")
    .first()
  return Boolean(
    cancelled &&
      cancelled.plan !== "free" &&
      (cancelled.currentPeriodEnd ?? 0) > Date.now(),
  )
}

export const checkAccountDeletionAllowed = internalQuery({
  args: { betterAuthUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("by_betterAuthUserId", (q) => q.eq("betterAuthUserId", args.betterAuthUserId)).unique()
    if (!user) return { allowed: true }
    const workspace = await ctx.db.query("workspaces").withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", user._id)).unique()
    if (!workspace) return { allowed: true }
    if (await hasBlockingSubscription(ctx, workspace._id)) {
      return { allowed: false, reason: "ACTIVE_SUBSCRIPTION" as const }
    }
    return { allowed: true }
  },
})

export const prepareWorkspaceDeletionForAuthUser = internalMutation({
  args: { betterAuthUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("by_betterAuthUserId", (q) => q.eq("betterAuthUserId", args.betterAuthUserId)).unique()
    if (!user) return null
    const workspace = await ctx.db.query("workspaces").withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", user._id)).unique()
    if (!workspace) { await ctx.db.delete(user._id); return null }
    if (await hasBlockingSubscription(ctx, workspace._id)) {
      throw new ConvexError({
        code: "ACTIVE_SUBSCRIPTION",
        message: "Cancel the active subscription before deleting this account",
      })
    }
    const running = await ctx.db.query("deletionJobs").withIndex("by_workspaceId_and_status", (q) => q.eq("workspaceId", workspace._id).eq("status", "running")).first()
    const pending = await ctx.db.query("deletionJobs").withIndex("by_workspaceId_and_status", (q) => q.eq("workspaceId", workspace._id).eq("status", "pending")).first()
    const prepared = await ctx.db.query("deletionJobs").withIndex("by_workspaceId_and_status", (q) => q.eq("workspaceId", workspace._id).eq("status", "prepared")).first()
    const existing = running ?? pending ?? prepared
    if (existing) return existing._id
    const now = Date.now()
    const jobId = await ctx.db.insert("deletionJobs", { kind: "workspace", workspaceId: workspace._id, userId: user._id, phase: workspacePhases[0], status: "prepared", createdAt: now, updatedAt: now })
    return jobId
  },
})

export const startWorkspaceDeletionForAuthUser = internalMutation({
  args: { betterAuthUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("by_betterAuthUserId", (q) => q.eq("betterAuthUserId", args.betterAuthUserId)).unique()
    if (!user) return null
    const workspace = await ctx.db.query("workspaces").withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", user._id)).unique()
    if (!workspace) return null
    const prepared = await ctx.db.query("deletionJobs").withIndex("by_workspaceId_and_status", (q) => q.eq("workspaceId", workspace._id).eq("status", "prepared")).first()
    const pending = await ctx.db.query("deletionJobs").withIndex("by_workspaceId_and_status", (q) => q.eq("workspaceId", workspace._id).eq("status", "pending")).first()
    const running = await ctx.db.query("deletionJobs").withIndex("by_workspaceId_and_status", (q) => q.eq("workspaceId", workspace._id).eq("status", "running")).first()
    const job = prepared ?? pending ?? running
    if (!job) return null
    const now = Date.now()
    await ctx.db.patch(workspace._id, { deletionRequestedAt: now, updatedAt: now })
    if (job.status === "prepared") {
      await ctx.db.patch(job._id, { status: "pending", updatedAt: now })
    }
    await ctx.scheduler.runAfter(0, internal.deletion.processWorkspaceDeletion, { jobId: job._id })
    return job._id
  },
})

async function workspaceRows(ctx: MutationCtx, phase: Exclude<WorkspaceDeletionPhase, "audits" | "auditAssets" | "auditCacheEntries" | "reportPdfArtifacts" | "logoUploads" | "billingEvents" | "deletionJobs" | "workspace">, workspaceId: Id<"workspaces">) {
  switch (phase) {
    case "auditRawData": return await ctx.db.query("auditRawData").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "auditPerformance": return await ctx.db.query("auditPerformance").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "auditChecks": return await ctx.db.query("auditChecks").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "auditScores": return await ctx.db.query("auditScores").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "auditFindings": return await ctx.db.query("auditFindings").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "auditSummaries": return await ctx.db.query("auditSummaries").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "outreachDrafts": return await ctx.db.query("outreachDrafts").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "reportViews": return await ctx.db.query("reportViews").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "reportViewStats": return await ctx.db.query("reportViewStats").withIndex("by_workspaceId_and_auditId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "reportAccessGrants": return await ctx.db.query("reportAccessGrants").withIndex("by_workspaceId_and_auditId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "reportSettings": return await ctx.db.query("reportSettings").withIndex("by_workspaceId_and_updatedAt", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "reportDomains": return await ctx.db.query("reportDomains").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "notifications": return await ctx.db.query("notifications").withIndex("by_workspaceId_and_createdAt", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "outreachTemplates": return await ctx.db.query("outreachTemplates").withIndex("by_workspaceId_and_updatedAt", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "auditPipelineStates": return await ctx.db.query("auditPipelineStates").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "providerCalls": return await ctx.db.query("providerCalls").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "auditPages": return await ctx.db.query("auditPages").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "auditBusinessData": return await ctx.db.query("auditBusinessData").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "auditAgentRuns": return await ctx.db.query("auditAgentRuns").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "auditPersonaReviews": return await ctx.db.query("auditPersonaReviews").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "auditCopyReviews": return await ctx.db.query("auditCopyReviews").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "auditDesignCritiques": return await ctx.db.query("auditDesignCritiques").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "batchAuditQaResults": return await ctx.db.query("batchAuditQaResults").withIndex("by_workspaceId_and_checkedAt", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "batchAuditItems": return await ctx.db.query("batchAuditItems").withIndex("by_workspaceId_and_createdAt", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "batchAuditJobs": return await ctx.db.query("batchAuditJobs").withIndex("by_workspaceId_and_createdAt", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "leadActivities": return await ctx.db.query("leadActivities").withIndex("by_workspaceId_and_createdAt", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "campaignLeads": return await ctx.db.query("campaignLeads").withIndex("by_workspaceId_and_leadId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "campaigns": return await ctx.db.query("campaigns").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "leads": return await ctx.db.query("leads").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "leadSearchSnapshots": return await ctx.db.query("leadSearchSnapshots").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "usageEvents": return await ctx.db.query("usageEvents").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "providerCosts": return await ctx.db.query("providerCosts").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "adminActions": return await ctx.db.query("adminActions").withIndex("by_workspaceId_and_createdAt", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "creditLedger": return await ctx.db.query("creditLedger").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "creditBalances": return await ctx.db.query("creditBalances").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "subscriptions": return await ctx.db.query("subscriptions").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "retentionPreferenceEvents": return await ctx.db.query("retentionPreferenceEvents").withIndex("by_workspaceId_and_createdAt", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
    case "workspaceMembers": return await ctx.db.query("workspaceMembers").withIndex("by_workspaceId", q => q.eq("workspaceId", workspaceId)).take(BATCH_SIZE)
  }
}

export const processWorkspaceDeletion = internalMutation({
  args: { jobId: v.id("deletionJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (!job || job.kind !== "workspace" || job.status === "completed") return null
    const phase = job.phase as WorkspaceDeletionPhase
    const now = Date.now()
    await ctx.db.patch(job._id, { status: "running", updatedAt: now })
    let processed = 0
    if (phase === "audits") {
      const audits = await ctx.db.query("audits").withIndex("by_workspaceId", q => q.eq("workspaceId", job.workspaceId)).take(10)
      for (const audit of audits) await enqueueAuditDeletion(ctx, audit._id, job.workspaceId)
      if (audits.length) { await ctx.scheduler.runAfter(1000, internal.deletion.processWorkspaceDeletion, { jobId: job._id }); return { completed: false, phase, processed: audits.length } }
    } else if (phase === "auditAssets") {
      const rows = await ctx.db.query("auditAssets").withIndex("by_workspaceId", q => q.eq("workspaceId", job.workspaceId)).take(BATCH_SIZE)
      for (const row of rows) {
        if (row.storageId && !row.auditCacheEntryId) await ctx.storage.delete(row.storageId)
        await ctx.db.delete(row._id)
      }
      processed = rows.length
    } else if (phase === "auditCacheEntries") {
      const rows = await ctx.db.query("auditCacheEntries").withIndex("by_workspaceId_and_expiresAt", q => q.eq("workspaceId", job.workspaceId)).take(BATCH_SIZE)
      for (const row of rows) {
        if (row.storageId) await ctx.storage.delete(row.storageId)
        await ctx.db.delete(row._id)
      }
      processed = rows.length
    } else if (phase === "logoUploads") {
      const rows = await ctx.db.query("logoUploads").withIndex("by_workspaceId", q => q.eq("workspaceId", job.workspaceId)).take(BATCH_SIZE)
      for (const row of rows) { await ctx.storage.delete(row.storageId); await ctx.db.delete(row._id) }
      processed = rows.length
    } else if (phase === "reportPdfArtifacts") {
      const rows = await ctx.db.query("reportPdfArtifacts").withIndex("by_workspaceId_and_status", q => q.eq("workspaceId", job.workspaceId)).take(BATCH_SIZE)
      for (const row of rows) {
        if (row.storageId) await ctx.storage.delete(row.storageId)
        await ctx.db.delete(row._id)
      }
      processed = rows.length
    } else if (phase === "billingEvents") {
      const rows = await ctx.db.query("billingEvents").withIndex("by_workspaceId_and_processedAt", q => q.eq("workspaceId", job.workspaceId)).take(BATCH_SIZE)
      for (const row of rows) await ctx.db.patch(row._id, { workspaceId: undefined })
      processed = rows.length
    } else if (phase === "deletionJobs") {
      const rows = await ctx.db.query("deletionJobs").withIndex("by_workspaceId_and_status", q => q.eq("workspaceId", job.workspaceId).eq("status", "completed")).take(BATCH_SIZE)
      for (const row of rows) await ctx.db.delete(row._id)
      processed = rows.length
    } else if (phase === "workspace") {
      const workspace = await ctx.db.get(job.workspaceId)
      if (workspace?.logoStorageId) await ctx.storage.delete(workspace.logoStorageId)
      if (workspace) await ctx.db.delete(workspace._id)
      if (job.userId) { const user = await ctx.db.get(job.userId); if (user) await ctx.db.delete(user._id) }
      await ctx.db.delete(job._id)
      return { completed: true }
    } else {
      const rows = await workspaceRows(ctx, phase, job.workspaceId)
      for (const row of rows) await ctx.db.delete(row._id)
      processed = rows.length
    }
    if (processed === BATCH_SIZE) { await ctx.scheduler.runAfter(0, internal.deletion.processWorkspaceDeletion, { jobId: job._id }); return { completed: false, phase, processed } }
    const next = workspacePhases[workspacePhases.indexOf(phase) + 1]
    if (!next) return null
    await ctx.db.patch(job._id, { phase: next, updatedAt: now })
    await ctx.scheduler.runAfter(0, internal.deletion.processWorkspaceDeletion, { jobId: job._id })
    return { completed: false, phase, processed }
  },
})
