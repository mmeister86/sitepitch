import { v } from "convex/values"

import { internalMutation, internalQuery } from "./_generated/server"

const cacheKind = v.union(
  v.literal("content"),
  v.literal("screenshot"),
  v.literal("pagespeed"),
  v.literal("business_data"),
)

const provider = v.union(
  v.literal("direct_html"),
  v.literal("jina"),
  v.literal("firecrawl"),
  v.literal("screenshotone"),
  v.literal("pagespeed"),
  v.literal("local_business_data"),
  v.literal("google_places"),
  v.literal("openai"),
  v.literal("anthropic"),
  v.literal("other"),
)

export const getEntry = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    cacheKey: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("auditCacheEntries")
      .withIndex("by_workspaceId_and_cacheKey", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("cacheKey", args.cacheKey),
      )
      .unique()
    if (!entry || entry.expiresAt <= args.now) return null
    return entry
  },
})

export const putEntry = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    kind: cacheKind,
    cacheKey: v.string(),
    normalizedUrl: v.string(),
    domain: v.string(),
    auditType: v.union(v.literal("standard"), v.literal("local"), v.literal("quick")),
    provider,
    operation: v.string(),
    version: v.string(),
    sourceAuditId: v.optional(v.id("audits")),
    payload: v.optional(v.any()),
    storageId: v.optional(v.id("_storage")),
    mimeType: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("auditCacheEntries")
      .withIndex("by_workspaceId_and_cacheKey", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("cacheKey", args.cacheKey),
      )
      .unique()
    const now = Date.now()
    const values = {
      kind: args.kind,
      normalizedUrl: args.normalizedUrl,
      domain: args.domain,
      auditType: args.auditType,
      provider: args.provider,
      operation: args.operation,
      version: args.version,
      sourceAuditId: args.sourceAuditId,
      payload: args.payload,
      storageId: args.storageId,
      mimeType: args.mimeType,
      expiresAt: args.expiresAt,
      updatedAt: now,
    }
    if (existing) {
      await ctx.db.patch(existing._id, values)
      return existing._id
    }
    return await ctx.db.insert("auditCacheEntries", {
      workspaceId: args.workspaceId,
      cacheKey: args.cacheKey,
      referenceCount: 0,
      createdAt: now,
      ...values,
    })
  },
})

export const recordHit = internalMutation({
  args: {
    auditId: v.id("audits"),
    auditCacheEntryId: v.id("auditCacheEntries"),
  },
  handler: async (ctx, args) => {
    const [audit, entry] = await Promise.all([
      ctx.db.get(args.auditId),
      ctx.db.get(args.auditCacheEntryId),
    ])
    if (!audit || !entry || audit.workspaceId !== entry.workspaceId || entry.expiresAt <= Date.now()) {
      return null
    }
    const costKey = `cache:${args.auditId}:${args.auditCacheEntryId}`
    const existingCost = await ctx.db
      .query("providerCosts")
      .withIndex("by_costKey", (q) => q.eq("costKey", costKey))
      .first()
    if (existingCost) return entry._id

    const now = Date.now()
    await ctx.db.patch(entry._id, {
      lastHitAt: now,
      updatedAt: now,
    })
    await ctx.db.insert("providerCosts", {
      workspaceId: audit.workspaceId,
      auditId: audit._id,
      batchAuditJobId: audit.batchAuditJobId,
      batchAuditItemId: audit.batchAuditItemId,
      costKey,
      provider: entry.provider,
      operation: `cache:${entry.operation}`,
      source: "zero_cost",
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      requestCount: 0,
      createdAt: now,
    })

    if (audit.batchAuditItemId && audit.batchAuditJobId) {
      const [item, job] = await Promise.all([
        ctx.db.get(audit.batchAuditItemId),
        ctx.db.get(audit.batchAuditJobId),
      ])
      if (item && job && item.batchAuditJobId === job._id) {
        const firstItemHit = item.cacheHitCount === 0
        await ctx.db.patch(item._id, { cacheHitCount: item.cacheHitCount + 1, updatedAt: now })
        await ctx.db.patch(job._id, {
          cacheHitItems: job.cacheHitItems + (firstItemHit ? 1 : 0),
          cacheHitOperations: job.cacheHitOperations + 1,
          updatedAt: now,
        })
      }
    }
    return entry._id
  },
})
