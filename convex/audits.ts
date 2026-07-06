import { ConvexError, v } from "convex/values"

import { action, internalMutation, internalQuery, query } from "./_generated/server"
import type { Id, Doc } from "./_generated/dataModel"
import { api, internal } from "./_generated/api"
import { auditRateLimiter } from "./lib/audit_rate_limit"
import {
  generatePublicSlug,
  normalizeAuditUrl,
  validatePublicAuditTarget,
  type AuditUrlErrorCode,
} from "./lib/audit_url"
import { reserveWorkspaceCredit } from "./lib/credits"
import type { CreditSnapshot } from "./lib/credits"

type WorkspaceContext = {
  userId: Id<"users">
  workspaceId: Id<"workspaces">
  credits: CreditSnapshot
}

type AuditStartResult = {
  auditId: Id<"audits">
  status: "queued"
  normalizedUrl: string
  domain: string
  publicSlug: string
}

function toAuditStartResult(audit: Doc<"audits">): AuditStartResult {
  return {
    auditId: audit._id,
    status: "queued",
    normalizedUrl: audit.normalizedUrl,
    domain: audit.domain,
    publicSlug: audit.publicSlug,
  }
}

function throwUrlError(code: AuditUrlErrorCode, message: string): never {
  throw new ConvexError({ code, message })
}

export const getById = query({
  args: { auditId: v.id("audits") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.auditId)
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
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId)
    if (!workspace || workspace.ownerUserId !== args.userId) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Workspace access denied" })
    }

    const existing: Doc<"audits"> | null = await ctx.db
      .query("audits")
      .withIndex("by_workspaceId_and_idempotencyKey", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("idempotencyKey", args.idempotencyKey),
      )
      .unique()

    if (existing) {
      return toAuditStartResult(existing)
    }

    const now = Date.now()
    const publicSlug = generatePublicSlug()
    const auditId = await ctx.db.insert("audits", {
      workspaceId: args.workspaceId,
      createdByUserId: args.userId,
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

    await ctx.db.insert("auditPipelineStates", {
      workspaceId: args.workspaceId,
      auditId,
      status: "queued",
      phase: "queued",
      attemptCount: 0,
      updatedAt: now,
    })

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
      },
      createdAt: now,
    })

    await ctx.scheduler.runAfter(0, internal.audit_pipeline.processAuditPipeline, {
      auditId,
    })

    return {
      auditId,
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

    const normalized = normalizeAuditUrl(args.url)
    if ("code" in normalized) {
      throwUrlError(normalized.code, normalized.message)
    }

    const existing: Doc<"audits"> | null = await ctx.runQuery(
      internal.audits.findByWorkspaceAndIdempotencyKey,
      {
        workspaceId: workspaceContext.workspaceId,
        idempotencyKey: args.idempotencyKey,
      },
    )
    if (existing) {
      return toAuditStartResult(existing)
    }

    if (workspaceContext.credits.remaining < 1) {
      throw new ConvexError({ code: "INSUFFICIENT_CREDITS", message: "No credits available" })
    }

    const rateLimit = await auditRateLimiter.limit(ctx, "auditStarts", {
      key: `${workspaceContext.workspaceId}:${workspaceContext.userId}`,
    })
    if (!rateLimit.ok) {
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: "Zu viele Audits in kurzer Zeit. Bitte versuche es später erneut.",
        retryAfter: rateLimit.retryAfter,
      })
    }

    const target = await validatePublicAuditTarget(normalized.hostname)
    if ("code" in target) {
      throwUrlError(target.code, target.message)
    }

    return await ctx.runMutation(internal.audits.createQueuedAudit, {
      workspaceId: workspaceContext.workspaceId,
      userId: workspaceContext.userId,
      url: args.url.trim(),
      normalizedUrl: normalized.normalizedUrl,
      domain: normalized.hostname,
      auditType: args.auditType,
      reportLanguage: args.reportLanguage,
      idempotencyKey: args.idempotencyKey,
    })
  },
})
