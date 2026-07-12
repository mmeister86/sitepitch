import { v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { internalMutation } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import { releaseWorkspaceCreditReservation } from "./lib/credits"

function now() {
  return Date.now()
}

function terminalAuditStatus(status: Doc<"audits">["status"]) {
  return status === "completed" || status === "failed" || status === "cancelled"
}

async function auditAcceptsWrites(ctx: MutationCtx, auditId: Id<"audits">) {
  const audit = await ctx.db.get(auditId)
  return Boolean(audit && !audit.deletionRequestedAt && !terminalAuditStatus(audit.status))
}

export const createAuditPipelineState = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
  },
  handler: async (ctx, args) => {
    if (!(await auditAcceptsWrites(ctx, args.auditId))) throw new Error("AUDIT_DELETION_PENDING")
    const existing = await ctx.db
      .query("auditPipelineStates")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .unique()

    if (existing) {
      return existing._id
    }

    return await ctx.db.insert("auditPipelineStates", {
      workspaceId: args.workspaceId,
      auditId: args.auditId,
      status: "queued",
      phase: "queued",
      attemptCount: 0,
      updatedAt: now(),
    })
  },
})

export const claimAuditPipelineWork = internalMutation({
  args: {
    auditId: v.id("audits"),
  },
  handler: async (ctx, args) => {
    const audit = await ctx.db.get(args.auditId)
    if (!audit) {
      return null
    }
    if (terminalAuditStatus(audit.status)) {
      return null
    }

    let state = await ctx.db
      .query("auditPipelineStates")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .unique()
    let stateId = state?._id

    if (!state) {
      stateId = await ctx.db.insert("auditPipelineStates", {
        workspaceId: audit.workspaceId,
        auditId: args.auditId,
        status: "queued",
        phase: "queued",
        attemptCount: 0,
        updatedAt: now(),
      })
      state = await ctx.db.get(stateId)
    }

    if (!state || !stateId) {
      return null
    }

    const current = now()
    if (state.status === "running" && state.leaseExpiresAt && state.leaseExpiresAt > current) {
      return null
    }

    const leaseToken = crypto.randomUUID()
    const leaseExpiresAt = current + 10 * 60 * 1000

    await ctx.db.patch(stateId, {
      status: "running",
      phase: "fetching_html",
      leaseToken,
      leaseExpiresAt,
      attemptCount: state.attemptCount + 1,
      startedAt: state.startedAt ?? current,
      updatedAt: current,
    })

    await ctx.db.patch(audit._id, {
      status: "fetching_html",
      statusMessage: "Website wird geladen",
      startedAt: audit.startedAt ?? current,
      updatedAt: current,
    })

    return {
      auditId: audit._id,
      workspaceId: audit.workspaceId,
      leaseToken,
      leaseExpiresAt,
      url: audit.url,
      normalizedUrl: audit.normalizedUrl,
      domain: audit.domain,
      auditType: audit.auditType,
      reportLanguage: audit.reportLanguage,
      idempotencyKey: audit.idempotencyKey,
    }
  },
})

export const finishAuditPipeline = internalMutation({
  args: {
    auditId: v.id("audits"),
    leaseToken: v.string(),
    statusMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("auditPipelineStates")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .unique()
    const audit = await ctx.db.get(args.auditId)

    if (!state || !audit || audit.deletionRequestedAt || terminalAuditStatus(audit.status) || state.leaseToken !== args.leaseToken || state.status !== "running") {
      return null
    }

    const current = now()
    await ctx.db.patch(state._id, {
      status: "completed",
      phase: "running_deterministic_checks",
      leaseToken: undefined,
      leaseExpiresAt: undefined,
      finishedAt: current,
      updatedAt: current,
    })

    await ctx.db.patch(audit._id, {
      status: "running_deterministic_checks",
      statusMessage: args.statusMessage ?? "Deterministische Checks werden vorbereitet",
      updatedAt: current,
    })

    return state._id
  },
})

export const advanceAuditPipelineStage = internalMutation({
  args: {
    auditId: v.id("audits"),
    leaseToken: v.string(),
    stage: v.string(),
    status: v.union(
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
    ),
    statusMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("auditPipelineStates")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .unique()
    const audit = await ctx.db.get(args.auditId)

    if (!state || !audit || state.leaseToken !== args.leaseToken || state.status !== "running" || terminalAuditStatus(audit.status)) {
      return null
    }

    const current = now()
    await ctx.db.patch(state._id, {
      phase: args.stage,
      status: "running",
      updatedAt: current,
    })

    await ctx.db.patch(audit._id, {
      status: args.status,
      statusMessage: args.statusMessage,
      updatedAt: current,
    })

    return state._id
  },
})

export const failAuditPipeline = internalMutation({
  args: {
    auditId: v.id("audits"),
    leaseToken: v.string(),
    errorCode: v.optional(v.string()),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("auditPipelineStates")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .unique()
    const audit = await ctx.db.get(args.auditId)

    if (!state || !audit || audit.deletionRequestedAt || terminalAuditStatus(audit.status) || state.leaseToken !== args.leaseToken || state.status !== "running") {
      return null
    }

    const current = now()
    await ctx.db.patch(state._id, {
      status: "failed",
      phase: "failed",
      leaseToken: undefined,
      leaseExpiresAt: undefined,
      finishedAt: current,
      lastErrorCode: args.errorCode,
      lastErrorMessage: args.errorMessage,
      updatedAt: current,
    })

    await ctx.db.patch(audit._id, {
      status: "failed",
      failedAt: current,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      statusMessage: args.errorMessage,
      updatedAt: current,
    })

    await releaseWorkspaceCreditReservation(ctx, audit.workspaceId, audit._id, audit.idempotencyKey, args.errorCode ?? "audit_failed")

    const existingFailedEvent = await ctx.db
      .query("usageEvents")
      .withIndex("by_auditId_and_event", (q) =>
        q.eq("auditId", args.auditId).eq("event", "audit_failed"),
      )
      .first()

    if (!existingFailedEvent) {
      await ctx.db.insert("usageEvents", {
        workspaceId: audit.workspaceId,
        auditId: args.auditId,
        event: "audit_failed",
        idempotencyKey: `audit_failed:${args.auditId}`,
        metadata: { code: args.errorCode ?? "AUDIT_FAILED" },
        createdAt: current,
      })
    }

    return state._id
  },
})

export const logProviderCallStart = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    auditId: v.optional(v.id("audits")),
    provider: v.union(
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
    ),
    operation: v.string(),
    attempt: v.number(),
    requestEvidence: v.optional(v.string()),
    retryCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.auditId && !(await auditAcceptsWrites(ctx, args.auditId))) throw new Error("AUDIT_DELETION_PENDING")
    return await ctx.db.insert("providerCalls", {
      workspaceId: args.workspaceId,
      auditId: args.auditId,
      provider: args.provider,
      operation: args.operation,
      status: "started",
      attempt: args.attempt,
      requestEvidence: args.requestEvidence,
      retryCount: args.retryCount,
      startedAt: now(),
      createdAt: now(),
    })
  },
})

export const logProviderCallFinish = internalMutation({
  args: {
    providerCallId: v.id("providerCalls"),
    status: v.union(v.literal("queued"), v.literal("started"), v.literal("completed"), v.literal("failed")),
    latencyMs: v.optional(v.number()),
    retryCount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    responseStatus: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const call = await ctx.db.get(args.providerCallId)
    if (!call) return null
    if (call.auditId && !(await auditAcceptsWrites(ctx, call.auditId))) throw new Error("AUDIT_DELETION_PENDING")
    await ctx.db.patch(args.providerCallId, {
      status: args.status,
      latencyMs: args.latencyMs,
      retryCount: args.retryCount,
      errorMessage: args.errorMessage,
      errorCode: args.errorCode,
      responseStatus: args.responseStatus,
      completedAt: now(),
    })
  },
})

export const recordProviderCost = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    auditId: v.optional(v.id("audits")),
    providerCallId: v.optional(v.id("providerCalls")),
    costKey: v.string(),
    provider: v.union(
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
    ),
    operation: v.string(),
    model: v.optional(v.string()),
    providerRequestId: v.optional(v.string()),
    source: v.union(
      v.literal("provider_response"),
      v.literal("generation_lookup"),
      v.literal("estimated"),
      v.literal("zero_cost"),
    ),
    pricingVersion: v.optional(v.string()),
    estimatedCostUsd: v.optional(v.number()),
    actualCostUsd: v.optional(v.number()),
    tokensIn: v.optional(v.number()),
    tokensOut: v.optional(v.number()),
    requestCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.auditId && !(await auditAcceptsWrites(ctx, args.auditId))) throw new Error("AUDIT_DELETION_PENDING")
    const existing = await ctx.db
      .query("providerCosts")
      .withIndex("by_costKey", (q) => q.eq("costKey", args.costKey))
      .first()

    if (existing) {
      return existing._id
    }

    if (args.estimatedCostUsd === undefined && args.actualCostUsd === undefined) {
      throw new Error("recordProviderCost requires at least estimated or actual cost")
    }

    return await ctx.db.insert("providerCosts", {
      workspaceId: args.workspaceId,
      auditId: args.auditId,
      providerCallId: args.providerCallId,
      costKey: args.costKey,
      provider: args.provider,
      operation: args.operation,
      model: args.model,
      providerRequestId: args.providerRequestId,
      source: args.source,
      pricingVersion: args.pricingVersion,
      estimatedCostUsd: args.estimatedCostUsd,
      actualCostUsd: args.actualCostUsd,
      tokensIn: args.tokensIn,
      tokensOut: args.tokensOut,
      requestCount: args.requestCount,
      createdAt: now(),
    })
  },
})

export const upsertAuditRawData = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    httpStatus: v.optional(v.number()),
    finalUrl: v.optional(v.string()),
    sourceProvider: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    title: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    openGraphTitle: v.optional(v.string()),
    openGraphDescription: v.optional(v.string()),
    openGraphImage: v.optional(v.string()),
    h1Texts: v.optional(v.array(v.string())),
    h2Texts: v.optional(v.array(v.string())),
    canonicalUrl: v.optional(v.string()),
    robotsFound: v.optional(v.boolean()),
    sitemapFound: v.optional(v.boolean()),
    schemaTypes: v.optional(v.array(v.string())),
    phoneNumbers: v.optional(v.array(v.string())),
    emailAddresses: v.optional(v.array(v.string())),
    contactLinks: v.optional(v.array(v.string())),
    internalLinks: v.optional(v.array(v.string())),
    externalLinks: v.optional(v.array(v.string())),
    privacyLinkFound: v.optional(v.boolean()),
    imprintLinkFound: v.optional(v.boolean()),
    ctaCandidates: v.optional(v.array(v.string())),
    extractedMarkdown: v.optional(v.string()),
    imageCount: v.optional(v.number()),
    imagesMissingAltCount: v.optional(v.number()),
    phoneLinkFound: v.optional(v.boolean()),
    contactFormFound: v.optional(v.boolean()),
    viewportMetaFound: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!(await auditAcceptsWrites(ctx, args.auditId))) throw new Error("AUDIT_DELETION_PENDING")
    const existing = await ctx.db
      .query("auditRawData")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .unique()

    const payload = {
      workspaceId: args.workspaceId,
      auditId: args.auditId,
      httpStatus: args.httpStatus,
      finalUrl: args.finalUrl,
      sourceProvider: args.sourceProvider,
      sourceUrl: args.sourceUrl,
      title: args.title,
      metaDescription: args.metaDescription,
      openGraphTitle: args.openGraphTitle,
      openGraphDescription: args.openGraphDescription,
      openGraphImage: args.openGraphImage,
      h1Texts: args.h1Texts,
      h2Texts: args.h2Texts,
      canonicalUrl: args.canonicalUrl,
      robotsFound: args.robotsFound,
      sitemapFound: args.sitemapFound,
      schemaTypes: args.schemaTypes,
      phoneNumbers: args.phoneNumbers,
      emailAddresses: args.emailAddresses,
      contactLinks: args.contactLinks,
      internalLinks: args.internalLinks,
      externalLinks: args.externalLinks,
      privacyLinkFound: args.privacyLinkFound,
      imprintLinkFound: args.imprintLinkFound,
      ctaCandidates: args.ctaCandidates,
      extractedMarkdown: args.extractedMarkdown,
      imageCount: args.imageCount,
      imagesMissingAltCount: args.imagesMissingAltCount,
      phoneLinkFound: args.phoneLinkFound,
      contactFormFound: args.contactFormFound,
      viewportMetaFound: args.viewportMetaFound,
      createdAt: now(),
    }

    if (existing) {
      await ctx.db.patch(existing._id, payload)
      return existing._id
    }

    return await ctx.db.insert("auditRawData", payload)
  },
})

export const upsertAuditPage = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    pageIndex: v.number(),
    kind: v.string(),
    url: v.string(),
    normalizedUrl: v.string(),
    httpStatus: v.optional(v.number()),
    finalUrl: v.optional(v.string()),
    title: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    sourceProvider: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await auditAcceptsWrites(ctx, args.auditId))) throw new Error("AUDIT_DELETION_PENDING")
    const existing = await ctx.db
      .query("auditPages")
      .withIndex("by_auditId_and_pageIndex", (q) => q.eq("auditId", args.auditId).eq("pageIndex", args.pageIndex))
      .unique()

    const payload = {
      workspaceId: args.workspaceId,
      auditId: args.auditId,
      pageIndex: args.pageIndex,
      kind: args.kind,
      url: args.url,
      normalizedUrl: args.normalizedUrl,
      httpStatus: args.httpStatus,
      finalUrl: args.finalUrl,
      title: args.title,
      metaDescription: args.metaDescription,
      sourceProvider: args.sourceProvider,
      sourceUrl: args.sourceUrl,
      createdAt: now(),
    }

    if (existing) {
      await ctx.db.patch(existing._id, payload)
      return existing._id
    }

    return await ctx.db.insert("auditPages", payload)
  },
})

export const upsertAuditPerformance = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    strategy: v.union(v.literal("mobile"), v.literal("desktop")),
    performanceScore: v.optional(v.number()),
    accessibilityScore: v.optional(v.number()),
    bestPracticesScore: v.optional(v.number()),
    seoScore: v.optional(v.number()),
    lcp: v.optional(v.number()),
    cls: v.optional(v.number()),
    fcp: v.optional(v.number()),
    speedIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!(await auditAcceptsWrites(ctx, args.auditId))) throw new Error("AUDIT_DELETION_PENDING")
    const existing = await ctx.db
      .query("auditPerformance")
      .withIndex("by_auditId_and_strategy", (q) => q.eq("auditId", args.auditId).eq("strategy", args.strategy))
      .unique()

    const payload = {
      workspaceId: args.workspaceId,
      auditId: args.auditId,
      strategy: args.strategy,
      performanceScore: args.performanceScore,
      accessibilityScore: args.accessibilityScore,
      bestPracticesScore: args.bestPracticesScore,
      seoScore: args.seoScore,
      lcp: args.lcp,
      cls: args.cls,
      fcp: args.fcp,
      speedIndex: args.speedIndex,
      createdAt: now(),
    }

    if (existing) {
      await ctx.db.patch(existing._id, payload)
      return existing._id
    }

    return await ctx.db.insert("auditPerformance", payload)
  },
})

export const storeAuditAsset = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    type: v.union(v.literal("desktop_screenshot"), v.literal("mobile_screenshot"), v.literal("fullpage_screenshot"), v.literal("pdf")),
    storageId: v.optional(v.id("_storage")),
    storageProvider: v.union(v.literal("convex"), v.literal("r2"), v.literal("external")),
    mimeType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await auditAcceptsWrites(ctx, args.auditId))) {
      throw new Error("AUDIT_DELETION_PENDING")
    }
    const existing = await ctx.db
      .query("auditAssets")
      .withIndex("by_auditId_and_type", (q) => q.eq("auditId", args.auditId).eq("type", args.type))
      .unique()

    const payload = {
      workspaceId: args.workspaceId,
      auditId: args.auditId,
      type: args.type,
      storageId: args.storageId,
      storageProvider: args.storageProvider,
      mimeType: args.mimeType,
      createdAt: now(),
    }

    if (existing) {
      await ctx.db.patch(existing._id, payload)
      return existing._id
    }

    return await ctx.db.insert("auditAssets", payload)
  },
})

export const upsertAuditBusinessData = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    sourceProvider: v.string(),
    sourceId: v.optional(v.string()),
    query: v.optional(v.string()),
    name: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    normalizedWebsiteUrl: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    categories: v.optional(v.array(v.string())),
    rating: v.optional(v.number()),
    reviewCount: v.optional(v.number()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    provenance: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await auditAcceptsWrites(ctx, args.auditId))) throw new Error("AUDIT_DELETION_PENDING")
    const existing = await ctx.db
      .query("auditBusinessData")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .unique()

    const payload = {
      workspaceId: args.workspaceId,
      auditId: args.auditId,
      sourceProvider: args.sourceProvider,
      sourceId: args.sourceId,
      query: args.query,
      name: args.name,
      websiteUrl: args.websiteUrl,
      normalizedWebsiteUrl: args.normalizedWebsiteUrl,
      address: args.address,
      phone: args.phone,
      city: args.city,
      country: args.country,
      categories: args.categories,
      rating: args.rating,
      reviewCount: args.reviewCount,
      latitude: args.latitude,
      longitude: args.longitude,
      provenance: args.provenance,
      createdAt: now(),
    }

    if (existing) {
      await ctx.db.patch(existing._id, payload)
      return existing._id
    }

    return await ctx.db.insert("auditBusinessData", payload)
  },
})
