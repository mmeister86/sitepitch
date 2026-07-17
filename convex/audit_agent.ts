import { ConvexError, v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { env, internalMutation, internalQuery } from "./_generated/server"
import type { CheckCategory, CheckInput } from "./lib/audit_scoring"
import { consumeWorkspaceCreditReservation } from "./lib/credits"
import { estimateLlmCostUsd, PROVIDER_COST_RATE_VERSION } from "./lib/provider_cost_rates"
import {
  AUDIT_AGENT_SCHEMA_VERSION,
  auditAgentOutputSchema,
  type AuditAgentOutput,
} from "./lib/audit_agent_schemas"
import { buildEvidenceRefs, validateOutputEvidence } from "./lib/audit_agent_evidence"
import { reviewClaimSafety } from "./lib/audit_agent_claim_safety"
import { personaPanelOutputSchema } from "./lib/audit_persona_schemas"
import { copyReviewOutputSchema } from "./lib/audit_copy_review_schemas"
import { designCritiqueOutputSchema } from "./lib/audit_design_critique_schemas"
import { settleBatchAuditItem } from "./batch_audits"
import { optionalIntegrationReportUrl, recordIntegrationEvent } from "./integrations"
import { settleAuditFailureSideEffects } from "./lib/audit_failure"
import { setPublicReportVisibility } from "./reports"

export interface AuditAgentContextCheck {
  category: CheckCategory
  key: string
  label: string
  status: CheckInput["status"]
  evidence?: string
  source?: string
  weight?: number
}

export interface AuditAgentContext {
  auditId: string
  workspaceId: string
  apiKeyId?: string
  domain: string
  normalizedUrl: string
  reportLanguage: "de" | "en"
  publicSlug: string
  isPublic: boolean
  overallScore: number
  workspace: {
    name: string
    website?: string
    contactEmail?: string
    ctaText?: string
    ctaUrl?: string
  }
  categoryScores: {
    conversion: number
    seo: number
    local_seo: number
    performance: number
    mobile: number
    trust: number
  }
  scoringVersion: string
  checks: AuditAgentContextCheck[]
  signals: {
    title?: string
    metaDescription?: string
    openGraphTitle?: string
    openGraphDescription?: string
    h1Texts?: string[]
    h2Texts?: string[]
    ctaCandidates?: string[]
    phoneNumbers?: string[]
    contactLinks?: string[]
    schemaTypes?: string[]
    phoneLinkFound?: boolean
    contactFormFound?: boolean
    viewportMetaFound?: boolean
    imagesMissingAltCount?: number
    privacyLinkFound?: boolean
    imprintLinkFound?: boolean
    copySample?: string
  }
  performance: {
    mobile?: { performanceScore?: number; lcp?: number; cls?: number; fcp?: number }
    desktop?: { performanceScore?: number; lcp?: number }
  }
  screenshots: {
    desktop?: string
    mobile?: string
  }
  business?: {
    name?: string
    city?: string
    phone?: string
    rating?: number
    reviewCount?: number
  }
}

function compactCopySample(markdown: string | undefined): string | undefined {
  const sample = markdown?.replace(/\s+/g, " ").trim()
  if (!sample) return undefined
  return sample.slice(0, 4000)
}

export const getAuditAgentContext = internalQuery({
  args: { auditId: v.id("audits") },
  handler: async (ctx, args): Promise<AuditAgentContext | null> => {
    const audit = await ctx.db.get(args.auditId)
    if (!audit) {
      return null
    }

    const workspace = await ctx.db.get(audit.workspaceId)
    if (!workspace) {
      return null
    }

    const score = await ctx.db
      .query("auditScores")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .unique()

    const checksDocs = await ctx.db
      .query("auditChecks")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .collect()

    const rawData = await ctx.db
      .query("auditRawData")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .unique()

    const performanceRows = await ctx.db
      .query("auditPerformance")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .collect()

    const business = await ctx.db
      .query("auditBusinessData")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .unique()

    const assets = await ctx.db
      .query("auditAssets")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .take(10)

    const desktopAsset = assets.find((a) => a.type === "desktop_screenshot")
    const mobileAsset = assets.find((a) => a.type === "mobile_screenshot")

    const resolveAssetUrl = async (asset: Doc<"auditAssets"> | undefined): Promise<string | undefined> => {
      if (!asset) return undefined
      if (asset.storageId) {
        const url = await ctx.storage.getUrl(asset.storageId)
        return url ?? undefined
      }
      return asset.url ?? undefined
    }

    const [desktopScreenshot, mobileScreenshot] = await Promise.all([
      resolveAssetUrl(desktopAsset),
      resolveAssetUrl(mobileAsset),
    ])

    const mobile = performanceRows.find((row) => row.strategy === "mobile")
    const desktop = performanceRows.find((row) => row.strategy === "desktop")

    const checks: AuditAgentContextCheck[] = checksDocs.map((check: Doc<"auditChecks">) => ({
      category: check.category as CheckCategory,
      key: check.key,
      label: check.label,
      status: check.status as CheckInput["status"],
      evidence: check.evidence,
      source: check.source,
      weight: check.weight,
    }))

    return {
      auditId: audit._id,
      workspaceId: audit.workspaceId,
      apiKeyId: audit.apiKeyId,
      domain: audit.domain,
      normalizedUrl: audit.normalizedUrl,
      reportLanguage: audit.reportLanguage,
      publicSlug: audit.publicSlug,
      isPublic: audit.isPublic,
      overallScore: audit.overallScore ?? score?.overallScore ?? 50,
      workspace: {
        name: workspace.name,
        website: workspace.website,
        contactEmail: workspace.contactEmail,
        ctaText: workspace.ctaText,
        ctaUrl: workspace.ctaUrl,
      },
      categoryScores: score
        ? {
            conversion: score.conversionScore,
            seo: score.seoBasicsScore,
            local_seo: score.localSeoScore,
            performance: score.performanceScore,
            mobile: score.mobileUxScore,
            trust: score.trustScore,
          }
        : {
            conversion: 50,
            seo: 50,
            local_seo: 50,
            performance: 50,
            mobile: 50,
            trust: 50,
          },
      scoringVersion: score?.scoringVersion ?? "unknown",
      checks,
      signals: {
        title: rawData?.title,
        metaDescription: rawData?.metaDescription,
        openGraphTitle: rawData?.openGraphTitle,
        openGraphDescription: rawData?.openGraphDescription,
        h1Texts: rawData?.h1Texts,
        h2Texts: rawData?.h2Texts?.slice(0, 8),
        ctaCandidates: rawData?.ctaCandidates,
        phoneNumbers: rawData?.phoneNumbers,
        contactLinks: rawData?.contactLinks,
        schemaTypes: rawData?.schemaTypes,
        phoneLinkFound: rawData?.phoneLinkFound,
        contactFormFound: rawData?.contactFormFound,
        viewportMetaFound: rawData?.viewportMetaFound,
        imagesMissingAltCount: rawData?.imagesMissingAltCount,
        privacyLinkFound: rawData?.privacyLinkFound,
        imprintLinkFound: rawData?.imprintLinkFound,
        copySample: compactCopySample(rawData?.extractedMarkdown),
      },
      performance: {
        mobile: mobile
          ? {
              performanceScore: mobile.performanceScore,
              lcp: mobile.lcp,
              cls: mobile.cls,
              fcp: mobile.fcp,
            }
          : undefined,
        desktop: desktop
          ? {
              performanceScore: desktop.performanceScore,
              lcp: desktop.lcp,
            }
          : undefined,
      },
      screenshots: {
        desktop: desktopScreenshot,
        mobile: mobileScreenshot,
      },
      business: business
        ? {
            name: business.name,
            city: business.city,
            phone: business.phone,
            rating: business.rating,
            reviewCount: business.reviewCount,
          }
        : undefined,
    }
  },
})

function now() {
  return Date.now()
}

export const startAuditAgentRun = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    provider: v.union(v.literal("openai"), v.literal("anthropic"), v.literal("other")),
    model: v.string(),
    purpose: v.union(v.literal("findings"), v.literal("summary"), v.literal("outreach"), v.literal("qa"), v.literal("critique")),
    skillVersions: v.optional(v.record(v.string(), v.string())),
    executor: v.optional(v.union(v.literal("eve"), v.literal("ai_sdk"), v.literal("deterministic"), v.literal("legacy"))),
    releaseVersion: v.optional(v.string()),
    promptVersion: v.optional(v.string()),
    outputSchemaVersion: v.optional(v.string()),
    eveVersion: v.optional(v.string()),
    buildSha: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const audit = await ctx.db.get(args.auditId)
    if (!audit || audit.deletionRequestedAt || audit.status === "cancelled") {
      throw new ConvexError({ code: "AUDIT_DELETION_PENDING", message: "Audit deletion is pending" })
    }
    return await ctx.db.insert("auditAgentRuns", {
      workspaceId: args.workspaceId,
      auditId: args.auditId,
      provider: args.provider,
      model: args.model,
      purpose: args.purpose,
      status: "started",
      skillVersions: args.skillVersions,
      executor: args.executor,
      releaseVersion: args.releaseVersion,
      promptVersion: args.promptVersion,
      outputSchemaVersion: args.outputSchemaVersion,
      eveVersion: args.eveVersion,
      buildSha: args.buildSha,
      startedAt: now(),
      createdAt: now(),
    })
  },
})

export const finishAuditAgentRun = internalMutation({
  args: {
    auditAgentRunId: v.id("auditAgentRuns"),
    status: v.union(v.literal("completed"), v.literal("failed")),
    tokensIn: v.optional(v.number()),
    tokensOut: v.optional(v.number()),
    model: v.optional(v.string()),
    actualCostUsd: v.optional(v.number()),
    eveSessionId: v.optional(v.string()),
    eveVersion: v.optional(v.string()),
    buildSha: v.optional(v.string()),
    loadedSkillVersions: v.optional(v.record(v.string(), v.string())),
    schemaPass: v.optional(v.boolean()),
    evidencePass: v.optional(v.boolean()),
    claimSafetyPass: v.optional(v.boolean()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.auditAgentRunId)
    if (!run) return
    const audit = await ctx.db.get(run.auditId)
    if (!audit || audit.deletionRequestedAt || audit.status === "cancelled") {
      throw new ConvexError({ code: "AUDIT_DELETION_PENDING", message: "Audit deletion is pending" })
    }

    await ctx.db.patch(args.auditAgentRunId, {
      status: args.status,
      tokensIn: args.tokensIn,
      tokensOut: args.tokensOut,
      model: args.model ?? run.model,
      eveSessionId: args.eveSessionId,
      eveVersion: args.eveVersion,
      buildSha: args.buildSha,
      loadedSkillVersions: args.loadedSkillVersions,
      schemaPass: args.schemaPass,
      evidencePass: args.evidencePass,
      claimSafetyPass: args.claimSafetyPass,
      errorMessage: args.errorMessage,
      completedAt: now(),
    })

    if (args.status === "completed" && args.tokensIn !== undefined && args.tokensOut !== undefined) {
      const costKey = `agent:${args.auditAgentRunId}`
      const existing = await ctx.db
        .query("providerCosts")
        .withIndex("by_costKey", (q) => q.eq("costKey", costKey))
        .first()
      if (existing) return

      const model = args.model ?? run.model
      const estimatedCostUsd = args.actualCostUsd === undefined
        ? estimateLlmCostUsd(model, args.tokensIn, args.tokensOut)
        : undefined

      await ctx.db.insert("providerCosts", {
        workspaceId: run.workspaceId,
        auditId: run.auditId,
        batchAuditJobId: audit.batchAuditJobId,
        batchAuditItemId: audit.batchAuditItemId,
        costKey,
        provider: run.provider,
        operation: `llm:${run.purpose}`,
        model,
        source: args.actualCostUsd === undefined ? "estimated" : "provider_response",
        pricingVersion: PROVIDER_COST_RATE_VERSION,
        estimatedCostUsd,
        actualCostUsd: args.actualCostUsd,
        tokensIn: args.tokensIn,
        tokensOut: args.tokensOut,
        requestCount: 1,
        createdAt: now(),
      })
    }
  },
})

export const saveAuditAgentOutput = internalMutation({
  args: {
    auditId: v.id("audits"),
    auditAgentRunId: v.optional(v.id("auditAgentRuns")),
    output: v.any(),
    reportLink: v.optional(v.string()),
    metadata: v.optional(v.object({
      executor: v.union(v.literal("eve"), v.literal("ai_sdk"), v.literal("deterministic"), v.literal("legacy")),
      provider: v.optional(v.string()),
      model: v.optional(v.string()),
      releaseVersion: v.string(),
      promptVersion: v.string(),
      outputSchemaVersion: v.string(),
      skillVersions: v.record(v.string(), v.string()),
      eveVersion: v.optional(v.string()),
      eveSessionId: v.optional(v.string()),
      buildSha: v.optional(v.string()),
      activationReason: v.optional(v.string()),
      activatedByUserId: v.optional(v.id("users")),
    })),
  },
  handler: async (ctx, args) => {
    const audit = await ctx.db.get(args.auditId)
    if (!audit) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Audit not found" })
    }
    if (audit.deletionRequestedAt || audit.status === "cancelled") {
      throw new ConvexError({ code: "AUDIT_DELETION_PENDING", message: "Audit deletion is pending" })
    }

    const workspaceId = audit.workspaceId
    const current = now()
    const latestVersion = await ctx.db
      .query("auditOutputVersions")
      .withIndex("by_auditId_and_versionNumber", (q) => q.eq("auditId", args.auditId))
      .order("desc")
      .first()
    const versionNumber = (latestVersion?.versionNumber ?? 0) + 1
    const metadata = args.metadata ?? {
      executor: "legacy" as const,
      releaseVersion: audit.reportVersion,
      promptVersion: "legacy",
      outputSchemaVersion: AUDIT_AGENT_SCHEMA_VERSION,
      skillVersions: {},
    }
    const parseResult = auditAgentOutputSchema.safeParse(args.output)
    const checks = await ctx.db
      .query("auditChecks")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .collect()
    const refs = buildEvidenceRefs(checks.map((check) => ({
      category: check.category,
      key: check.key,
      label: check.label,
      status: check.status,
      evidence: check.evidence,
      source: check.source,
      weight: check.weight,
    })))
    const evidenceIssues = parseResult.success ? validateOutputEvidence(parseResult.data, refs) : []
    const claimSafety = parseResult.success ? reviewClaimSafety(parseResult.data) : null
    const schemaPass = parseResult.success
    const evidencePass = parseResult.success && evidenceIssues.length === 0
    const claimSafetyPass = parseResult.success && Boolean(claimSafety?.ok)
    const rejectionCode = !schemaPass
      ? "schema_invalid"
      : !evidencePass
        ? "evidence_invalid"
        : !claimSafetyPass
          ? "claim_safety_invalid"
          : undefined

    const outputVersionId = await ctx.db.insert("auditOutputVersions", {
      workspaceId,
      auditId: args.auditId,
      auditAgentRunId: args.auditAgentRunId,
      versionNumber,
      status: rejectionCode ? "rejected" : "candidate",
      executor: metadata.executor,
      provider: metadata.provider,
      model: metadata.model,
      releaseVersion: metadata.releaseVersion,
      promptVersion: metadata.promptVersion,
      outputSchemaVersion: metadata.outputSchemaVersion,
      skillVersions: metadata.skillVersions,
      eveVersion: metadata.eveVersion,
      eveSessionId: metadata.eveSessionId,
      buildSha: metadata.buildSha,
      output: args.output,
      schemaPass,
      evidencePass,
      claimSafetyPass,
      rejectionCode,
      activationReason: metadata.activationReason,
      activatedByUserId: metadata.activatedByUserId,
      createdAt: current,
      rejectedAt: rejectionCode ? current : undefined,
    })

    if (args.auditAgentRunId) {
      await ctx.db.patch(args.auditAgentRunId, {
        executor: metadata.executor,
        releaseVersion: metadata.releaseVersion,
        promptVersion: metadata.promptVersion,
        outputSchemaVersion: metadata.outputSchemaVersion,
        eveVersion: metadata.eveVersion,
        eveSessionId: metadata.eveSessionId,
        buildSha: metadata.buildSha,
        loadedSkillVersions: metadata.skillVersions,
        outputVersionId,
        schemaPass,
        evidencePass,
        claimSafetyPass,
      })
    }

    if (!parseResult.success || rejectionCode) {
      return {
        activated: false,
        outputVersionId,
        versionNumber,
        rejectionCode: rejectionCode ?? "schema_invalid",
        findingsCount: 0,
        outreachCount: 0,
        reportLink: args.reportLink,
      }
    }
    const output = parseResult.data

    const previousActive = audit.activeOutputVersionId
      ? await ctx.db.get(audit.activeOutputVersionId)
      : await ctx.db
          .query("auditOutputVersions")
          .withIndex("by_auditId_and_status", (q) => q.eq("auditId", args.auditId).eq("status", "active"))
          .first()
    if (previousActive && previousActive._id !== outputVersionId) {
      await ctx.db.patch(previousActive._id, { status: "superseded", supersededAt: current })
    }

    const existingFindings = await ctx.db
      .query("auditFindings")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .collect()
    for (const row of existingFindings) {
      await ctx.db.delete(row._id)
    }

    for (let i = 0; i < output.findings.length; i++) {
      const finding = output.findings[i]
      await ctx.db.insert("auditFindings", {
        workspaceId,
        auditId: args.auditId,
        outputVersionId,
        auditAgentRunId: args.auditAgentRunId,
        category: finding.category,
        severity: finding.severity,
        title: finding.title,
        evidence: finding.evidence,
        evidenceRefs: finding.evidenceRefs,
        explanation: finding.explanation,
        recommendation: finding.recommendation,
        salesAngle: finding.salesAngle,
        sortOrder: i,
        createdAt: current,
      })
    }

    const existingSummary = await ctx.db
      .query("auditSummaries")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .unique()
    const summaryPayload = {
      workspaceId,
      auditId: args.auditId,
      outputVersionId,
      auditAgentRunId: args.auditAgentRunId,
      shortSummary: output.summary.shortSummary,
      strengths: output.summary.strengths,
      weaknesses: output.summary.weaknesses,
      topOpportunities: output.summary.topOpportunities,
      nextSteps: output.summary.nextSteps,
      evidenceRefs: output.summary.evidenceRefs,
      createdAt: current,
    }
    if (existingSummary) {
      await ctx.db.patch(existingSummary._id, summaryPayload)
    } else {
      await ctx.db.insert("auditSummaries", summaryPayload)
    }

    const existingDrafts = await ctx.db
      .query("outreachDrafts")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .collect()
    for (const row of existingDrafts) {
      await ctx.db.delete(row._id)
    }

    for (const draft of output.outreach) {
      await ctx.db.insert("outreachDrafts", {
        workspaceId,
        auditId: args.auditId,
        outputVersionId,
        auditAgentRunId: args.auditAgentRunId,
        type: draft.type,
        subject: draft.subject,
        subjectLines: draft.type === "email" ? output.subjectLines : undefined,
        body: draft.body,
        evidenceRefs: draft.evidenceRefs,
        createdAt: current,
      })
    }

    await ctx.db.patch(outputVersionId, {
      status: "active",
      activatedAt: current,
    })
    await ctx.db.patch(args.auditId, {
      activeOutputVersionId: outputVersionId,
      reportVersion: metadata.releaseVersion,
      updatedAt: current,
    })

    return {
      activated: true,
      outputVersionId,
      versionNumber,
      rejectionCode: null,
      findingsCount: output.findings.length,
      outreachCount: output.outreach.length,
      reportLink: args.reportLink,
    }
  },
})

export const saveAuditPersonaReviews = internalMutation({
  args: {
    auditId: v.id("audits"),
    reviews: v.any(),
  },
  handler: async (ctx, args) => {
    const audit = await ctx.db.get(args.auditId)
    if (!audit) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Audit not found" })
    }
    if (audit.deletionRequestedAt || audit.status === "cancelled") {
      throw new ConvexError({ code: "AUDIT_DELETION_PENDING", message: "Audit deletion is pending" })
    }

    const parseResult = personaPanelOutputSchema.safeParse({ reviews: args.reviews })
    if (!parseResult.success) {
      throw new ConvexError({
        code: "INVALID_PERSONA_OUTPUT",
        message: "Persona reviews failed schema validation",
      })
    }
    const reviews = parseResult.data.reviews

    const workspaceId = audit.workspaceId
    const current = now()

    const existing = await ctx.db
      .query("auditPersonaReviews")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .collect()
    for (const row of existing) {
      await ctx.db.delete(row._id)
    }

    for (let i = 0; i < reviews.length; i++) {
      const review = reviews[i]
      await ctx.db.insert("auditPersonaReviews", {
        workspaceId,
        auditId: args.auditId,
        personaId: review.personaId,
        personaName: review.personaName,
        lens: review.lens,
        verdict: review.verdict,
        positives: review.positives,
        frictionPoints: review.frictionPoints,
        topRecommendation: review.topRecommendation,
        evidenceRefs: review.evidenceRefs,
        confidence: review.confidence,
        sortOrder: i,
        createdAt: current,
      })
    }

    return { reviewsCount: reviews.length }
  },
})

export const saveAuditCopyReview = internalMutation({
  args: {
    auditId: v.id("audits"),
    review: v.any(),
  },
  handler: async (ctx, args) => {
    const audit = await ctx.db.get(args.auditId)
    if (!audit) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Audit not found" })
    }
    if (audit.deletionRequestedAt || audit.status === "cancelled") {
      throw new ConvexError({ code: "AUDIT_DELETION_PENDING", message: "Audit deletion is pending" })
    }

    const parseResult = copyReviewOutputSchema.safeParse(args.review)
    if (!parseResult.success) {
      throw new ConvexError({
        code: "INVALID_COPY_REVIEW",
        message: "Copy review failed schema validation",
      })
    }
    const review = parseResult.data

    const workspaceId = audit.workspaceId
    const current = now()

    const existing = await ctx.db
      .query("auditCopyReviews")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .collect()
    for (const row of existing) {
      await ctx.db.delete(row._id)
    }

    await ctx.db.insert("auditCopyReviews", {
      workspaceId,
      auditId: args.auditId,
      heroClarity: review.heroClarity,
      valueProposition: review.valueProposition,
      offerClarity: review.offerClarity,
      ctaClarity: review.ctaClarity,
      snippetClarity: review.snippetClarity,
      overallVerdict: review.overallVerdict,
      recommendations: review.recommendations,
      evidenceRefs: review.evidenceRefs,
      createdAt: current,
    })

    return { saved: true }
  },
})

export const saveAuditDesignCritique = internalMutation({
  args: {
    auditId: v.id("audits"),
    critique: v.any(),
  },
  handler: async (ctx, args) => {
    const audit = await ctx.db.get(args.auditId)
    if (!audit) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Audit not found" })
    }
    if (audit.deletionRequestedAt || audit.status === "cancelled") {
      throw new ConvexError({ code: "AUDIT_DELETION_PENDING", message: "Audit deletion is pending" })
    }

    const parseResult = designCritiqueOutputSchema.safeParse(args.critique)
    if (!parseResult.success) {
      throw new ConvexError({
        code: "INVALID_DESIGN_CRITIQUE",
        message: "Design critique failed schema validation",
      })
    }
    const critique = parseResult.data

    const workspaceId = audit.workspaceId
    const current = now()

    const existing = await ctx.db
      .query("auditDesignCritiques")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .collect()
    for (const row of existing) {
      await ctx.db.delete(row._id)
    }

    await ctx.db.insert("auditDesignCritiques", {
      workspaceId,
      auditId: args.auditId,
      designHealthScore: critique.designHealthScore,
      ratingBand: critique.ratingBand,
      overallImpression: critique.overallImpression,
      heuristicScores: critique.heuristicScores.map((h) => ({
        name: h.name,
        score: h.score,
        keyIssue: h.keyIssue,
      })),
      cognitiveLoadFailedCount: critique.cognitiveLoad.failedCount,
      cognitiveLoadLevel: critique.cognitiveLoad.level,
      cognitiveLoadNotes: critique.cognitiveLoad.notes,
      antiPatternVerdict: critique.antiPatternVerdict,
      whatsWorking: critique.whatsWorking,
      priorityIssues: critique.priorityIssues.map((issue) => ({
        severity: issue.severity,
        title: issue.title,
        whyItMatters: issue.whyItMatters,
        fix: issue.fix,
        evidenceRefs: issue.evidenceRefs,
      })),
      recommendations: critique.recommendations,
      evidenceRefs: critique.evidenceRefs,
      createdAt: current,
    })

    return { saved: true }
  },
})

export const completeAuditFromAgent = internalMutation({
  args: {
    auditId: v.id("audits"),
  },
  handler: async (ctx, args) => {
    const audit = await ctx.db.get(args.auditId)
    if (!audit) {
      return null
    }
    if (audit.deletionRequestedAt || audit.status === "completed" || audit.status === "failed" || audit.status === "cancelled") {
      return null
    }

    const current = now()
    await ctx.db.patch(args.auditId, {
      status: "completed",
      statusMessage: "Audit abgeschlossen",
      completedAt: current,
      updatedAt: current,
    })

    if (audit.publishRequested && audit.activeOutputVersionId) {
      const activeVersion = await ctx.db.get(audit.activeOutputVersionId)
      if (
        activeVersion?.status === "active" &&
        activeVersion.schemaPass &&
        activeVersion.evidencePass &&
        activeVersion.claimSafetyPass
      ) {
        await setPublicReportVisibility(ctx, { ...audit, status: "completed", completedAt: current }, true)
      }
    }

    if (audit.leadId) {
      const lead = await ctx.db.get(audit.leadId)
      if (lead?.workspaceId === audit.workspaceId && lead.status === "new") {
        await ctx.db.patch(lead._id, { status: "audited", updatedAt: current })
      }
    }

    if (audit.campaignId && audit.campaignLeadId && audit.leadId) {
      const [campaign, campaignLead] = await Promise.all([
        ctx.db.get(audit.campaignId),
        ctx.db.get(audit.campaignLeadId),
      ])
      if (
        campaign?.workspaceId === audit.workspaceId &&
        campaignLead?.workspaceId === audit.workspaceId &&
        campaignLead.campaignId === campaign._id &&
        campaignLead.leadId === audit.leadId &&
        campaignLead.status === "new"
      ) {
        await ctx.db.patch(campaignLead._id, { status: "audited", updatedAt: current })
        await ctx.db.patch(campaign._id, { updatedAt: current })
        await ctx.db.insert("leadActivities", {
          workspaceId: audit.workspaceId,
          campaignId: campaign._id,
          campaignLeadId: campaignLead._id,
          leadId: audit.leadId,
          type: "status_changed",
          message: "Status geändert: Auditiert",
          createdByUserId: audit.createdByUserId,
          createdAt: current,
        })
      }
    }

    await consumeWorkspaceCreditReservation(
      ctx,
      audit.workspaceId,
      args.auditId,
      `consume:${args.auditId}`,
    )

    const existingCompletedEvent = await ctx.db
      .query("usageEvents")
      .withIndex("by_auditId_and_event", (q) =>
        q.eq("auditId", args.auditId).eq("event", "audit_completed"),
      )
      .first()

    if (!existingCompletedEvent) {
      await ctx.db.insert("usageEvents", {
        workspaceId: audit.workspaceId,
        auditId: args.auditId,
        event: "audit_completed",
        isFeedActivity: true,
        idempotencyKey: `audit_completed:${args.auditId}`,
        createdAt: current,
      })
    }

    const completedAudit = await ctx.db.get(args.auditId) ?? audit
    await recordIntegrationEvent(ctx, {
      workspaceId: audit.workspaceId,
      auditId: audit._id,
      event: "audit_completed",
      idempotencyKey: `audit_completed:${audit._id}`,
      occurredAt: current,
      domain: audit.domain,
      score: completedAudit.overallScore,
      reportUrl: completedAudit.isPublic ? optionalIntegrationReportUrl(env.SITE_URL, completedAudit.publicSlug) : undefined,
    })

    if (audit.batchAuditItemId) {
      await settleBatchAuditItem(ctx, {
        auditId: audit._id,
        outcome: "completed",
      })
    }

    return { auditId: args.auditId, completedAt: current }
  },
})

export const setAuditAgentStage = internalMutation({
  args: {
    auditId: v.id("audits"),
    status: v.union(
      v.literal("generating_findings"),
      v.literal("generating_outreach"),
      v.literal("completed"),
    ),
    statusMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const audit = await ctx.db.get(args.auditId)
    if (!audit) {
      return null
    }
    if (audit.deletionRequestedAt || audit.status === "completed" || audit.status === "failed" || audit.status === "cancelled") {
      return null
    }
    await ctx.db.patch(args.auditId, {
      status: args.status,
      statusMessage: args.statusMessage,
      updatedAt: now(),
    })
    return { auditId: args.auditId, status: args.status }
  },
})

export const markAuditAgentFailed = internalMutation({
  args: {
    auditId: v.id("audits"),
    errorCode: v.string(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const audit = await ctx.db.get(args.auditId)
    if (!audit) {
      return null
    }
    if (audit.deletionRequestedAt || audit.status === "completed" || audit.status === "cancelled") {
      return null
    }

    const alreadyFailed = audit.status === "failed"

    const current = now()
    await ctx.db.patch(args.auditId, {
      status: "failed",
      statusMessage: args.errorMessage,
      failedAt: current,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      updatedAt: current,
    })

    if (!alreadyFailed) {
      await settleAuditFailureSideEffects(ctx, audit, {
        errorCode: args.errorCode,
        errorMessage: args.errorMessage,
        occurredAt: current,
      })
    }

    return { auditId: args.auditId }
  },
})

export type SavedAgentRun = { auditAgentRunId: Id<"auditAgentRuns"> }
