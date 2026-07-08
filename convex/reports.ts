import { ConvexError, v } from "convex/values"

import { mutation, query, type QueryCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import { CATEGORY_WEIGHTS } from "./lib/audit_scoring"
import { auditRateLimiter } from "./lib/audit_rate_limit"
import { DEFAULT_WORKSPACE_ACCENT, findAppUser, getWorkspaceByOwner } from "./lib/workspace"
import { outreachDraftTypeValidator } from "../src/lib/convex-schema-values.ts"

// ---------------------------------------------------------------------------
// Category metadata
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<keyof typeof CATEGORY_WEIGHTS, string> = {
  conversion: "Conversion",
  seo: "SEO Basics",
  local_seo: "Local SEO",
  performance: "Performance",
  mobile: "Mobile UX",
  trust: "Trust",
}

const CATEGORY_ORDER: Array<keyof typeof CATEGORY_WEIGHTS> = [
  "conversion",
  "seo",
  "local_seo",
  "performance",
  "mobile",
  "trust",
]

// ---------------------------------------------------------------------------
// Shared DTO types
// ---------------------------------------------------------------------------

export interface CategoryScoreDto {
  key: string
  label: string
  score: number
  weight: number
}

export interface SummaryDto {
  shortSummary: string
  strengths: string[]
  weaknesses: string[]
  topOpportunities: string[]
  nextSteps: string[]
}

export interface FindingDto {
  category: string
  severity: string
  title: string
  evidence: string
  explanation: string
  recommendation: string
  salesAngle: string
  sortOrder: number
}

export interface PublicFindingDto {
  category: string
  severity: string
  title: string
  evidence: string
  explanation: string
  recommendation: string
  sortOrder: number
}

export interface CheckDto {
  category: string
  key: string
  status: string
  label: string
  evidence?: string
}

export interface AssetDto {
  type: string
  url: string | null
}

export interface OutreachDto {
  type: string
  subject?: string
  subjectLines?: string[]
  body: string
}

export interface PerformanceDto {
  strategy: string
  performanceScore?: number
  accessibilityScore?: number
  bestPracticesScore?: number
  seoScore?: number
  lcp?: number
  cls?: number
  fcp?: number
  speedIndex?: number
}

export interface BrandingDto {
  name: string
  accentColor: string
  ctaText?: string
  ctaUrl?: string
  website?: string
  contactEmail?: string
}

export interface PersonaReviewDto {
  personaId: string
  personaName: string
  lens: string
  verdict: string
  positives: string[]
  frictionPoints: string[]
  topRecommendation: string
  evidenceRefs: string[]
  confidence: string
  sortOrder: number
}

export interface CopyReviewDto {
  heroClarity: string
  valueProposition: string
  offerClarity: string
  ctaClarity: string
  snippetClarity: string
  overallVerdict: string
  recommendations: string[]
  evidenceRefs: string[]
}

export interface DesignCritiqueHeuristicDto {
  name: string
  score: number
  keyIssue: string
}

export interface DesignPriorityIssueDto {
  severity: string
  title: string
  whyItMatters: string
  fix: string
  evidenceRefs: string[]
}

export interface DesignCritiqueDto {
  designHealthScore: number
  ratingBand: string
  overallImpression: string
  heuristicScores: DesignCritiqueHeuristicDto[]
  cognitiveLoadFailedCount: number
  cognitiveLoadLevel: string
  cognitiveLoadNotes: string
  antiPatternVerdict: string
  whatsWorking: string[]
  priorityIssues: DesignPriorityIssueDto[]
  recommendations: string[]
  evidenceRefs: string[]
}

// ---------------------------------------------------------------------------
// DTO builders
// ---------------------------------------------------------------------------

function buildCategoryScores(score: Doc<"auditScores"> | null): CategoryScoreDto[] | null {
  if (!score) return null
  return CATEGORY_ORDER.map((key) => ({
    key,
    label: CATEGORY_LABELS[key],
    score: scoreToField(score, key),
    weight: Math.round(CATEGORY_WEIGHTS[key] * 100),
  }))
}

function scoreToField(score: Doc<"auditScores">, key: keyof typeof CATEGORY_WEIGHTS): number {
  switch (key) {
    case "conversion":
      return score.conversionScore
    case "seo":
      return score.seoBasicsScore
    case "local_seo":
      return score.localSeoScore
    case "performance":
      return score.performanceScore
    case "mobile":
      return score.mobileUxScore
    case "trust":
      return score.trustScore
  }
}

function buildSummary(summary: Doc<"auditSummaries"> | null): SummaryDto | null {
  if (!summary) return null
  return {
    shortSummary: summary.shortSummary,
    strengths: summary.strengths,
    weaknesses: summary.weaknesses,
    topOpportunities: summary.topOpportunities,
    nextSteps: summary.nextSteps,
  }
}

function buildFindings(findings: Doc<"auditFindings">[]): FindingDto[] {
  return findings.map((f) => ({
    category: f.category,
    severity: f.severity,
    title: f.title,
    evidence: f.evidence,
    explanation: f.explanation,
    recommendation: f.recommendation,
    salesAngle: f.salesAngle,
    sortOrder: f.sortOrder,
  }))
}

function buildPublicFindings(findings: Doc<"auditFindings">[]): PublicFindingDto[] {
  return findings.map((f) => ({
    category: f.category,
    severity: f.severity,
    title: f.title,
    evidence: f.evidence,
    explanation: f.explanation,
    recommendation: f.recommendation,
    sortOrder: f.sortOrder,
  }))
}

function buildChecks(checks: Doc<"auditChecks">[]): CheckDto[] {
  return checks.map((c) => ({
    category: c.category,
    key: c.key,
    status: c.status,
    label: c.label,
    evidence: c.evidence,
  }))
}

function buildOutreach(drafts: Doc<"outreachDrafts">[]): OutreachDto[] {
  return drafts.map((d) => ({
    type: d.type,
    subject: d.subject,
    subjectLines: d.subjectLines,
    body: d.body,
  }))
}

function buildPerformance(rows: Doc<"auditPerformance">[]): PerformanceDto[] {
  return rows.map((row) => ({
    strategy: row.strategy,
    performanceScore: row.performanceScore,
    accessibilityScore: row.accessibilityScore,
    bestPracticesScore: row.bestPracticesScore,
    seoScore: row.seoScore,
    lcp: row.lcp,
    cls: row.cls,
    fcp: row.fcp,
    speedIndex: row.speedIndex,
  }))
}

function buildBranding(workspace: Doc<"workspaces">): BrandingDto {
  return {
    name: workspace.name,
    accentColor: workspace.accentColor ?? DEFAULT_WORKSPACE_ACCENT,
    ctaText: workspace.ctaText,
    ctaUrl: workspace.ctaUrl,
    website: workspace.website,
    contactEmail: workspace.contactEmail,
  }
}

function buildPersonaReviews(reviews: Doc<"auditPersonaReviews">[]): PersonaReviewDto[] {
  return reviews.map((r) => ({
    personaId: r.personaId,
    personaName: r.personaName,
    lens: r.lens,
    verdict: r.verdict,
    positives: r.positives,
    frictionPoints: r.frictionPoints,
    topRecommendation: r.topRecommendation,
    evidenceRefs: r.evidenceRefs,
    confidence: r.confidence,
    sortOrder: r.sortOrder,
  }))
}

function buildCopyReview(review: Doc<"auditCopyReviews"> | null): CopyReviewDto | null {
  if (!review) return null
  return {
    heroClarity: review.heroClarity,
    valueProposition: review.valueProposition,
    offerClarity: review.offerClarity,
    ctaClarity: review.ctaClarity,
    snippetClarity: review.snippetClarity,
    overallVerdict: review.overallVerdict,
    recommendations: review.recommendations,
    evidenceRefs: review.evidenceRefs,
  }
}

function buildDesignCritique(review: Doc<"auditDesignCritiques"> | null): DesignCritiqueDto | null {
  if (!review) return null
  return {
    designHealthScore: review.designHealthScore,
    ratingBand: review.ratingBand,
    overallImpression: review.overallImpression,
    heuristicScores: review.heuristicScores.map((h) => ({
      name: h.name,
      score: h.score,
      keyIssue: h.keyIssue,
    })),
    cognitiveLoadFailedCount: review.cognitiveLoadFailedCount,
    cognitiveLoadLevel: review.cognitiveLoadLevel,
    cognitiveLoadNotes: review.cognitiveLoadNotes,
    antiPatternVerdict: review.antiPatternVerdict,
    whatsWorking: review.whatsWorking,
    priorityIssues: review.priorityIssues.map((issue) => ({
      severity: issue.severity,
      title: issue.title,
      whyItMatters: issue.whyItMatters,
      fix: issue.fix,
      evidenceRefs: issue.evidenceRefs,
    })),
    recommendations: review.recommendations,
    evidenceRefs: review.evidenceRefs,
  }
}

async function resolveScreenshotUrls(
  ctx: QueryCtx,
  auditId: Id<"audits">,
): Promise<{ desktop: string | null; mobile: string | null }> {
  const assets = await ctx.db
    .query("auditAssets")
    .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
    .take(10)

  const desktopAsset = assets.find((a) => a.type === "desktop_screenshot")
  const mobileAsset = assets.find((a) => a.type === "mobile_screenshot")

  const resolve = async (asset: Doc<"auditAssets"> | undefined): Promise<string | null> => {
    if (!asset) return null
    if (asset.storageId) {
      return await ctx.storage.getUrl(asset.storageId)
    }
    return asset.url ?? null
  }

  return {
    desktop: await resolve(desktopAsset),
    mobile: await resolve(mobileAsset),
  }
}

function computeWarnings(args: {
  hasScore: boolean
  hasSummary: boolean
  findingsCount: number
  hasDesktopScreenshot: boolean
  hasPerformance: boolean
  outreachCount: number
}): string[] {
  const warnings: string[] = []
  if (!args.hasScore) warnings.push("score_missing")
  if (!args.hasSummary) warnings.push("summary_missing")
  if (args.findingsCount === 0) warnings.push("findings_missing")
  if (!args.hasDesktopScreenshot) warnings.push("screenshot_missing")
  if (!args.hasPerformance) warnings.push("performance_missing")
  if (args.outreachCount === 0) warnings.push("outreach_missing")
  return warnings
}

// ---------------------------------------------------------------------------
// Authenticated: getInternalReportById
// ---------------------------------------------------------------------------

export const getInternalReportById = query({
  args: { auditId: v.id("audits") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const user = await findAppUser(ctx, identity.tokenIdentifier)
    if (!user) return null

    const audit = await ctx.db.get(args.auditId)
    if (!audit) return null

    const workspace = await getWorkspaceByOwner(ctx, user._id)
    if (!workspace || audit.workspaceId !== workspace._id) return null

    const [score, summary, findings, checks, outreach, performanceRows, reportViews, personaReviews, copyReviewDoc, designCritiqueDoc] =
      await Promise.all([
        ctx.db
          .query("auditScores")
          .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
          .unique(),
        ctx.db
          .query("auditSummaries")
          .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
          .unique(),
        ctx.db
          .query("auditFindings")
          .withIndex("by_auditId_and_sortOrder", (q) => q.eq("auditId", args.auditId))
          .take(50),
        ctx.db
          .query("auditChecks")
          .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
          .take(100),
        ctx.db
          .query("outreachDrafts")
          .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
          .take(10),
        ctx.db
          .query("auditPerformance")
          .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
          .take(4),
        ctx.db
          .query("reportViews")
          .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
          .take(100),
        ctx.db
          .query("auditPersonaReviews")
          .withIndex("by_auditId_and_sortOrder", (q) => q.eq("auditId", args.auditId))
          .take(10),
        ctx.db
          .query("auditCopyReviews")
          .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
          .first(),
        ctx.db
          .query("auditDesignCritiques")
          .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
          .first(),
      ])

    const screenshots = await resolveScreenshotUrls(ctx, args.auditId)

    const categoryScores = buildCategoryScores(score)
    const overallScore = audit.overallScore ?? score?.overallScore ?? null

    const warnings = computeWarnings({
      hasScore: score !== null,
      hasSummary: summary !== null,
      findingsCount: findings.length,
      hasDesktopScreenshot: screenshots.desktop !== null,
      hasPerformance: performanceRows.length > 0,
      outreachCount: outreach.length,
    })

    return {
      auditId: audit._id,
      workspaceId: audit.workspaceId,
      status: audit.status,
      statusMessage: audit.statusMessage ?? null,
      isPublic: audit.isPublic,
      publicSlug: audit.publicSlug,
      reportLanguage: audit.reportLanguage,
      domain: audit.domain,
      normalizedUrl: audit.normalizedUrl,
      auditType: audit.auditType,
      overallScore,
      completedAt: audit.completedAt ?? null,
      failedAt: audit.failedAt ?? null,
      createdAt: audit.createdAt,
      errorMessage: audit.errorMessage ?? null,
      errorCode: audit.errorCode ?? null,
      categoryScores,
      summary: buildSummary(summary),
      findings: buildFindings(findings),
      nextSteps: summary?.nextSteps ?? [],
      checks: buildChecks(checks),
      outreachDrafts: buildOutreach(outreach),
      performance: buildPerformance(performanceRows),
      screenshots,
      viewCount: reportViews.length,
      branding: buildBranding(workspace),
      personaReviews: buildPersonaReviews(personaReviews),
      copyReview: buildCopyReview(copyReviewDoc ?? null),
      designCritique: buildDesignCritique(designCritiqueDoc ?? null),
      warnings,
    }
  },
})

// ---------------------------------------------------------------------------
// Public: getPublicReportBySlug
// ---------------------------------------------------------------------------

export const getPublicReportBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const audit = await ctx.db
      .query("audits")
      .withIndex("by_publicSlug", (q) => q.eq("publicSlug", args.slug))
      .unique()

    if (!audit) return null
    if (!audit.isPublic) return null
    if (audit.status !== "completed") return null

    const workspace = await ctx.db.get(audit.workspaceId)
    if (!workspace) return null

    const [score, summary, findings] = await Promise.all([
      ctx.db
        .query("auditScores")
        .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
        .unique(),
      ctx.db
        .query("auditSummaries")
        .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
        .unique(),
      ctx.db
        .query("auditFindings")
        .withIndex("by_auditId_and_sortOrder", (q) => q.eq("auditId", audit._id))
        .take(50),
    ])

    const screenshots = await resolveScreenshotUrls(ctx, audit._id)

    const categoryScores = buildCategoryScores(score)
    const overallScore = audit.overallScore ?? score?.overallScore ?? null
    const summaryDto = buildSummary(summary)

    return {
      domain: audit.domain,
      normalizedUrl: audit.normalizedUrl,
      reportLanguage: audit.reportLanguage,
      completedAt: audit.completedAt ?? null,
      overallScore,
      categoryScores,
      summary: summaryDto,
      findings: buildPublicFindings(findings),
      nextSteps: summaryDto?.nextSteps ?? [],
      screenshots,
      branding: buildBranding(workspace),
    }
  },
})

// ---------------------------------------------------------------------------
// Authenticated: setPublicReportEnabled
// ---------------------------------------------------------------------------

export const setPublicReportEnabled = mutation({
  args: {
    auditId: v.id("audits"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" })
    }

    const user = await findAppUser(ctx, identity.tokenIdentifier)
    if (!user) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" })
    }

    const audit = await ctx.db.get(args.auditId)
    if (!audit) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Audit not found" })
    }

    const workspace = await getWorkspaceByOwner(ctx, user._id)
    if (!workspace || audit.workspaceId !== workspace._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Workspace access denied" })
    }

    if (args.enabled && audit.status !== "completed") {
      throw new ConvexError({
        code: "REPORT_NOT_READY",
        message: "Report can only be published for completed audits",
      })
    }

    const now = Date.now()
    await ctx.db.patch(args.auditId, {
      isPublic: args.enabled,
      updatedAt: now,
    })

    return { auditId: args.auditId, isPublic: args.enabled }
  },
})

// ---------------------------------------------------------------------------
// Public: recordPublicReportView
// ---------------------------------------------------------------------------

export const recordPublicReportView = mutation({
  args: {
    slug: v.string(),
    referrer: v.optional(v.string()),
    userAgentHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const audit = await ctx.db
      .query("audits")
      .withIndex("by_publicSlug", (q) => q.eq("publicSlug", args.slug))
      .unique()

    if (!audit || !audit.isPublic || audit.status !== "completed") {
      return null
    }

    const viewerKey = args.userAgentHash
      ? `${audit.publicSlug}:${args.userAgentHash}`
      : audit.publicSlug
    const viewLimit = await auditRateLimiter.limit(ctx, "publicReportViewsByViewer", {
      key: viewerKey,
    })
    if (!viewLimit.ok) {
      return { recorded: false, reason: "rate_limited" as const }
    }

    const now = Date.now()
    const truncatedReferrer = args.referrer
      ? args.referrer.slice(0, 200)
      : undefined

    await ctx.db.insert("reportViews", {
      workspaceId: audit.workspaceId,
      auditId: audit._id,
      referrer: truncatedReferrer,
      userAgentHash: args.userAgentHash,
      viewedAt: now,
    })

    await ctx.db.insert("usageEvents", {
      workspaceId: audit.workspaceId,
      auditId: audit._id,
      event: "report_viewed",
      metadata: { source: "public_report" },
      createdAt: now,
    })

    return { recorded: true }
  },
})

// ---------------------------------------------------------------------------
// Authenticated: recordReportCopyEvent
// ---------------------------------------------------------------------------

export const recordReportCopyEvent = mutation({
  args: {
    auditId: v.id("audits"),
    kind: v.union(v.literal("outreach"), v.literal("public_link")),
    draftType: v.optional(outreachDraftTypeValidator),
    edited: v.optional(v.boolean()),
    includedReportLink: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" })
    }

    const user = await findAppUser(ctx, identity.tokenIdentifier)
    if (!user) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" })
    }

    const audit = await ctx.db.get(args.auditId)
    if (!audit) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Audit not found" })
    }

    const workspace = await getWorkspaceByOwner(ctx, user._id)
    if (!workspace || audit.workspaceId !== workspace._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Workspace access denied" })
    }

    const now = Date.now()

    if (args.kind === "outreach") {
      if (!args.draftType) {
        throw new ConvexError({
          code: "DRAFT_TYPE_REQUIRED",
          message: "draftType is required for outreach copy events",
        })
      }

      await ctx.db.insert("usageEvents", {
        workspaceId: workspace._id,
        userId: user._id,
        auditId: audit._id,
        event: "outreach_copied",
        metadata: {
          draftType: args.draftType,
          edited: args.edited ?? false,
          includedReportLink: args.includedReportLink ?? false,
        },
        createdAt: now,
      })
    } else {
      if (!audit.isPublic) {
        throw new ConvexError({
          code: "REPORT_NOT_PUBLIC",
          message: "Report link can only be copied for public reports",
        })
      }

      await ctx.db.insert("usageEvents", {
        workspaceId: workspace._id,
        userId: user._id,
        auditId: audit._id,
        event: "public_link_copied",
        metadata: { source: "internal_report" },
        createdAt: now,
      })
    }

    return { recorded: true }
  },
})
