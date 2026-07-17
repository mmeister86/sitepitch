import { ConvexError, v } from "convex/values"
import { paginationOptsValidator } from "convex/server"

import { env, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import { CATEGORY_WEIGHTS } from "./lib/audit_scoring"
import { auditRateLimiter } from "./lib/audit_rate_limit"
import { generatePublicSlug, toSafeDisplayUrl } from "./lib/audit_url"
import { DEFAULT_WORKSPACE_ACCENT, findAppUser, getWorkspaceByOwner, getWorkspacePlan } from "./lib/workspace"
import { outreachDraftTypeValidator } from "../src/lib/convex-schema-values.ts"
import { recordReportView } from "./retention"
import {
  LEGACY_VIEW_COUNT_CAP,
  loadReportViewCount,
  loadWorkspaceReportViewCount,
  resolveReportViewCount,
} from "./lib/report_view_stats"
import { resolvePublicReportAccess } from "./lib/report_access"
import { resolveReportPublicUrl } from "./lib/report_domain"
import { reportFeaturePolicy } from "./lib/report_policy"
import { normalizeReportReferrer } from "./lib/report_privacy"
import { queueReportPdfArtifact } from "./lib/report_pdf_queue"
import { optionalIntegrationReportUrl, recordIntegrationEvent } from "./integrations"
import {
  buildReportSettingsSnapshotValues,
  ensureReportSettingsSnapshot,
} from "./report_settings"
import type { PublicReportDocumentModel } from "../src/lib/report-document"

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
  logoUrl?: string
  ctaText?: string
  ctaUrl?: string
  ctaSnapshotted: boolean
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

export interface ProviderCallDto {
  provider: string
  operation: string
  status: "queued" | "started" | "completed" | "failed"
  attempt: number
  latencyMs?: number
  errorCode?: string
}

export interface ProviderCallsSummaryDto {
  items: ProviderCallDto[]
  overall: "idle" | "running" | "completed" | "failed"
}

function buildProviderCallDto(call: Doc<"providerCalls">): ProviderCallDto {
  return {
    provider: call.provider,
    operation: call.operation,
    status: call.status,
    attempt: call.attempt,
    latencyMs: call.latencyMs ?? undefined,
    errorCode: call.errorCode ?? undefined,
  }
}

function buildProviderCallsSummary(calls: Doc<"providerCalls">[]): ProviderCallsSummaryDto {
  const items = calls.map(buildProviderCallDto)
  if (items.length === 0) {
    return { items, overall: "idle" }
  }
  const hasRunning = items.some((item) => item.status === "started" || item.status === "queued")
  if (hasRunning) {
    return { items, overall: "running" }
  }
  const hasFailed = items.some((item) => item.status === "failed")
  if (hasFailed) {
    return { items, overall: "failed" }
  }
  return { items, overall: "completed" }
}

function validatedViewerHash(value: string | undefined) {
  return value && /^[a-f0-9]{64}$/i.test(value) ? value.toLowerCase() : undefined
}

function safeViewerHash(value: string | undefined) {
  return validatedViewerHash(value) ?? "anonymous"
}

async function incrementReportActionAggregate(
  ctx: MutationCtx,
  audit: Pick<Doc<"audits">, "_id" | "workspaceId">,
  field: "ctaClicks" | "pdfDownloads",
) {
  const stats = await ctx.db
    .query("reportViewStats")
    .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
    .unique()
  if (stats) {
    await ctx.db.patch(stats._id, { [field]: (stats[field] ?? 0) + 1 })
    return
  }
  const legacyView = await ctx.db
    .query("reportViews")
    .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
    .first()
  await ctx.db.insert("reportViewStats", {
    workspaceId: audit.workspaceId,
    auditId: audit._id,
    totalViews: 0,
    reopenCount: 0,
    ctaClicks: field === "ctaClicks" ? 1 : 0,
    pdfDownloads: field === "pdfDownloads" ? 1 : 0,
    viewAggregationState: legacyView ? "pending" : "accurate",
  })
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

function buildBranding(workspace: Doc<"workspaces">, audit: Doc<"audits">): BrandingDto {
  const hasCtaSnapshot = audit.reportCtaSnapshottedAt !== undefined
  return {
    name: workspace.name,
    accentColor: workspace.accentColor ?? DEFAULT_WORKSPACE_ACCENT,
    ctaText: hasCtaSnapshot ? audit.reportCtaText : workspace.ctaText,
    ctaUrl: hasCtaSnapshot ? audit.reportCtaUrl : workspace.ctaUrl,
    ctaSnapshotted: hasCtaSnapshot,
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
    return null
  }

  return {
    desktop: await resolve(desktopAsset),
    mobile: await resolve(mobileAsset),
  }
}

async function buildPublicReportDocument(
  ctx: QueryCtx,
  audit: Doc<"audits">,
  workspace: Doc<"workspaces">,
  storedSettings: Doc<"reportSettings"> | null,
  plan: Parameters<typeof reportFeaturePolicy>[0],
): Promise<PublicReportDocumentModel> {
  const [score, summary, findings, screenshots, fallbackSettings] = await Promise.all([
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
    resolveScreenshotUrls(ctx, audit._id),
    storedSettings ? Promise.resolve(null) : buildReportSettingsSnapshotValues(ctx, audit),
  ])
  const settings = storedSettings ?? fallbackSettings
  if (!settings) throw new Error("Report settings unavailable")

  const policy = reportFeaturePolicy(plan)
  const logoUrl = settings.logoStorageId
    ? await ctx.storage.getUrl(settings.logoStorageId)
    : null
  const summaryDto = buildSummary(summary)

  return {
    domain: audit.domain,
    normalizedUrl: toSafeDisplayUrl(audit.normalizedUrl),
    completedAt: audit.completedAt ?? null,
    reportLanguage: settings.language,
    overallScore: audit.overallScore ?? score?.overallScore ?? null,
    categoryScores: buildCategoryScores(score),
    summary: summaryDto,
    findings: buildPublicFindings(findings),
    nextSteps: summaryDto?.nextSteps ?? [],
    screenshots,
    intro: settings.introText,
    hiddenSections: settings.hiddenSections,
    theme: {
      preset: policy.themes ? settings.theme : "classic",
      primaryColor: policy.customColors
        ? settings.primaryColor
        : workspace.accentColor ?? DEFAULT_WORKSPACE_ACCENT,
      backgroundColor: policy.customColors ? settings.backgroundColor : "#ffffff",
      textColor: policy.customColors ? settings.textColor : "#18181b",
    },
    branding: {
      name: settings.brandName,
      logoUrl: logoUrl ?? undefined,
      accentColor: policy.customColors
        ? settings.primaryColor
        : workspace.accentColor ?? DEFAULT_WORKSPACE_ACCENT,
      ctaText: settings.ctaText,
      ctaUrl: settings.ctaUrl,
      ctaSnapshotted: true,
      website: workspace.website,
      contactEmail: workspace.contactEmail,
    },
    showPoweredBy: policy.poweredByToggle
      ? settings.showPoweredByPreference
      : true,
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
    if (!workspace || workspace.deletionRequestedAt || audit.workspaceId !== workspace._id) return null

    const [storedSettings, reportDomain, workspacePlan] = await Promise.all([
      ctx.db
        .query("reportSettings")
        .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
        .unique(),
      ctx.db
        .query("reportDomains")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspace._id))
        .unique(),
      getWorkspacePlan(ctx, workspace._id),
    ])
    const effectiveSettings = storedSettings ?? await buildReportSettingsSnapshotValues(ctx, audit)
    const logoUrl = effectiveSettings.logoStorageId
      ? await ctx.storage.getUrl(effectiveSettings.logoStorageId)
      : null
    const capabilities = reportFeaturePolicy(workspacePlan)

    const [score, summary, findings, checks, outreach, performanceRows, reportViews, reportViewStats, personaReviews, copyReviewDoc, designCritiqueDoc, providerCalls] =
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
          .take(LEGACY_VIEW_COUNT_CAP + 1),
        ctx.db
          .query("reportViewStats")
          .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
          .unique(),
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
        ctx.db
          .query("providerCalls")
          .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
          .take(50),
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

    const viewCount = resolveReportViewCount(reportViewStats, reportViews.length)

    return {
      auditId: audit._id,
      workspaceId: audit.workspaceId,
      status: audit.status,
      statusMessage: audit.statusMessage ?? null,
      isPublic: audit.isPublic,
      publicSlug: audit.publicSlug,
      publicUrl: resolveReportPublicUrl({
        siteUrl: env.SITE_URL,
        publicSlug: audit.publicSlug,
        plan: workspacePlan,
        domain: reportDomain,
      }),
      publicationStatus: !audit.isPublic
        ? "disabled"
        : effectiveSettings.expiresAt !== undefined && effectiveSettings.expiresAt <= Date.now()
          ? "expired"
          : effectiveSettings.passwordHash
            ? "protected"
            : "active",
      reportLanguage: audit.reportLanguage,
      domain: audit.domain,
      normalizedUrl: toSafeDisplayUrl(audit.normalizedUrl),
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
      viewCount: viewCount.count,
      viewCountCapped: viewCount.capped,
      viewCountPending: viewCount.pending,
      branding: {
        ...buildBranding(workspace, audit),
        name: effectiveSettings.brandName,
        accentColor: capabilities.customColors
          ? effectiveSettings.primaryColor
          : workspace.accentColor ?? DEFAULT_WORKSPACE_ACCENT,
        logoUrl: logoUrl ?? undefined,
        ctaText: effectiveSettings.ctaText,
        ctaUrl: effectiveSettings.ctaUrl,
      },
      capabilities,
      personaReviews: buildPersonaReviews(personaReviews),
      copyReview: buildCopyReview(copyReviewDoc ?? null),
      designCritique: buildDesignCritique(designCritiqueDoc ?? null),
      warnings,
      providerCalls: buildProviderCallsSummary(providerCalls),
    }
  },
})

// ---------------------------------------------------------------------------
// Public: getPublicReportBySlug
// ---------------------------------------------------------------------------

export const getPublicReportBySlug = query({
  args: {
    slug: v.string(),
    host: v.optional(v.string()),
    grantToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await resolvePublicReportAccess(ctx, args)
    if (access.status === "unavailable") return { status: "unavailable" as const }
    if (access.status === "password_required") {
      return { status: "password_required" as const }
    }
    return {
      status: "available" as const,
      report: await buildPublicReportDocument(
        ctx,
        access.audit,
        access.workspace,
        access.settings,
        access.plan,
      ),
      publicUrl: access.publicUrl,
      capabilities: reportFeaturePolicy(access.plan),
    }
  },
})

export const getPdfReportModel = internalQuery({
  args: { auditId: v.id("audits") },
  handler: async (ctx, args) => {
    const audit = await ctx.db.get(args.auditId)
    if (!audit || audit.status !== "completed" || audit.deletionRequestedAt) return null
    const workspace = await ctx.db.get(audit.workspaceId)
    if (!workspace || workspace.deletionRequestedAt) return null
    const [settings, plan] = await Promise.all([
      ctx.db
        .query("reportSettings")
        .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
        .unique(),
      getWorkspacePlan(ctx, workspace._id),
    ])
    return await buildPublicReportDocument(ctx, audit, workspace, settings, plan)
  },
})

// ---------------------------------------------------------------------------
// Authenticated: setPublicReportEnabled
// ---------------------------------------------------------------------------

export async function setPublicReportVisibility(
  ctx: MutationCtx,
  audit: Doc<"audits">,
  enabled: boolean,
) {
  const workspace = await ctx.db.get(audit.workspaceId)
  if (!workspace || workspace.deletionRequestedAt) {
    throw new ConvexError({ code: "WORKSPACE_DELETION_PENDING", message: "Workspace deletion is pending" })
  }
  if (enabled && audit.status !== "completed") {
    throw new ConvexError({ code: "REPORT_NOT_READY", message: "Report can only be published for completed audits" })
  }

  const now = Date.now()
  const firstShare = enabled && !audit.isPublic
  const settings = enabled
    ? await ensureReportSettingsSnapshot(ctx, audit)
    : await ctx.db
        .query("reportSettings")
        .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
        .unique()
  const shouldSnapshotCta = firstShare && audit.reportCtaSnapshottedAt === undefined
  await ctx.db.patch(audit._id, {
    isPublic: enabled,
    reportCtaText: shouldSnapshotCta ? settings?.ctaText : audit.reportCtaText,
    reportCtaUrl: shouldSnapshotCta ? settings?.ctaUrl : audit.reportCtaUrl,
    reportCtaSnapshottedAt: shouldSnapshotCta ? now : audit.reportCtaSnapshottedAt,
    updatedAt: now,
  })
  if (!enabled && settings) {
    await ctx.db.patch(settings._id, { accessVersion: settings.accessVersion + 1, updatedAt: now })
  }
  if (enabled && settings) {
    const policy = reportFeaturePolicy(await getWorkspacePlan(ctx, workspace._id))
    if (policy.pdfExport) {
      await queueReportPdfArtifact(ctx, {
        workspaceId: workspace._id,
        auditId: audit._id,
        settingsVersion: settings.settingsVersion,
      })
    }
  }
  return { auditId: audit._id, isPublic: enabled }
}

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
    return await setPublicReportVisibility(ctx, audit, args.enabled)
  },
})

export const rotatePublicReportLink = mutation({
  args: { auditId: v.id("audits") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" })
    const user = await findAppUser(ctx, identity.tokenIdentifier)
    if (!user) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" })
    const [audit, workspace] = await Promise.all([
      ctx.db.get(args.auditId),
      getWorkspaceByOwner(ctx, user._id),
    ])
    if (!audit || !workspace || audit.workspaceId !== workspace._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Report not found" })
    }
    const settings = await ensureReportSettingsSnapshot(ctx, audit)
    let publicSlug = generatePublicSlug()
    for (let attempt = 0; attempt < 5; attempt++) {
      const collision = await ctx.db
        .query("audits")
        .withIndex("by_publicSlug", (q) => q.eq("publicSlug", publicSlug))
        .unique()
      if (!collision) break
      publicSlug = generatePublicSlug()
      if (attempt === 4) throw new Error("Unable to allocate report link")
    }
    const now = Date.now()
    await ctx.db.patch(audit._id, { publicSlug, updatedAt: now })
    await ctx.db.patch(settings._id, {
      accessVersion: settings.accessVersion + 1,
      updatedAt: now,
    })
    const artifacts = await ctx.db
      .query("reportPdfArtifacts")
      .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
      .take(50)
    for (const artifact of artifacts) {
      if (artifact.status !== "stale") {
        await ctx.db.patch(artifact._id, { status: "stale", updatedAt: now })
      }
    }
    const [plan, domain] = await Promise.all([
      getWorkspacePlan(ctx, workspace._id),
      ctx.db
        .query("reportDomains")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspace._id))
        .unique(),
    ])
    return {
      publicSlug,
      publicUrl: resolveReportPublicUrl({
        siteUrl: env.SITE_URL,
        publicSlug,
        plan,
        domain,
      }),
    }
  },
})

export const refreshPublicReportCta = mutation({
  args: { auditId: v.id("audits") },
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
    const workspace = await getWorkspaceByOwner(ctx, user._id)
    if (!audit || !workspace || audit.workspaceId !== workspace._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Audit not found" })
    }
    if (workspace.deletionRequestedAt) {
      throw new ConvexError({ code: "WORKSPACE_DELETION_PENDING", message: "Workspace deletion is pending" })
    }
    if (audit.status !== "completed") {
      throw new ConvexError({ code: "REPORT_NOT_READY", message: "Report is not completed" })
    }
    if (!audit.isPublic) {
      throw new ConvexError({ code: "REPORT_NOT_PUBLIC", message: "Report is not public" })
    }
    const current = await ensureReportSettingsSnapshot(ctx, audit)
    const snapshot = await buildReportSettingsSnapshotValues(
      ctx,
      { ...audit, reportCtaSnapshottedAt: undefined },
      current,
    )
    const now = Date.now()
    await ctx.db.patch(audit._id, {
      reportCtaText: snapshot.ctaText,
      reportCtaUrl: snapshot.ctaUrl,
      reportCtaSnapshottedAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(current._id, snapshot)
    const artifacts = await ctx.db
      .query("reportPdfArtifacts")
      .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
      .take(50)
    for (const artifact of artifacts) {
      if (artifact.status !== "stale") {
        await ctx.db.patch(artifact._id, { status: "stale", updatedAt: now })
      }
    }
    return { auditId: audit._id, reportCtaSnapshottedAt: now }
  },
})

// ---------------------------------------------------------------------------
// Public: recordPublicReportView
// ---------------------------------------------------------------------------

export const recordPublicReportView = mutation({
  args: {
    slug: v.string(),
    host: v.optional(v.string()),
    grantToken: v.optional(v.string()),
    referrer: v.optional(v.string()),
    userAgentHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await resolvePublicReportAccess(ctx, args)
    if (access.status !== "available") return null
    const { audit, workspace } = access

    const slugLimit = await auditRateLimiter.limit(ctx, "publicReportViewsBySlug", {
      key: audit.publicSlug,
    })
    if (!slugLimit.ok) {
      return { recorded: false, reason: "rate_limited" as const }
    }
    const viewerKey = `${audit.publicSlug}:${safeViewerHash(args.userAgentHash)}`
    const viewLimit = await auditRateLimiter.limit(ctx, "publicReportViewsByViewer", {
      key: viewerKey,
    })
    if (!viewLimit.ok) {
      return { recorded: false, reason: "rate_limited" as const }
    }

    const now = Date.now()
    const viewResult = await recordReportView(ctx, {
      workspaceId: audit.workspaceId,
      auditId: audit._id,
      referrer: normalizeReportReferrer(args.referrer),
      userAgentHash: validatedViewerHash(args.userAgentHash),
      viewedAt: now,
    })

    const isFirstView = viewResult.isFirstView
    const event = isFirstView ? "report_opened" : "report_reopened"
    await ctx.db.insert("usageEvents", {
      workspaceId: audit.workspaceId,
      auditId: audit._id,
      event,
      isFeedActivity: true,
      metadata: { source: "public_report" },
      createdAt: now,
    })

    if (isFirstView) {
      await recordIntegrationEvent(ctx, {
        workspaceId: audit.workspaceId,
        auditId: audit._id,
        event: "report_viewed",
        idempotencyKey: `report_viewed:${audit._id}`,
        occurredAt: now,
        domain: audit.domain,
        reportUrl: optionalIntegrationReportUrl(env.SITE_URL, audit.publicSlug),
      })
    }

    const notificationType = isFirstView ? "first_open" : "first_reopen"
    const idempotencyKey = `${notificationType}:${audit._id}`
    const existingNotification = await ctx.db
      .query("notifications")
      .withIndex("by_workspaceId_and_idempotencyKey", (q) =>
        q.eq("workspaceId", workspace._id).eq("idempotencyKey", idempotencyKey),
      )
      .unique()
    if (!existingNotification) {
      await ctx.db.insert("notifications", {
        workspaceId: workspace._id,
        auditId: audit._id,
        recipientUserId: workspace.ownerUserId,
        type: notificationType,
        idempotencyKey,
        createdAt: now,
      })
    }

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
        isFeedActivity: true,
        metadata: {
          draftType: args.draftType,
          edited: args.edited ?? false,
          includedReportLink: args.includedReportLink ?? false,
        },
        createdAt: now,
      })

      await recordIntegrationEvent(ctx, {
        workspaceId: workspace._id,
        auditId: audit._id,
        event: "outreach_copied",
        idempotencyKey: `outreach_copied:${audit._id}:${args.draftType}:${now}`,
        occurredAt: now,
        domain: audit.domain,
        draftType: args.draftType,
        includedReportLink: args.includedReportLink ?? false,
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
        isFeedActivity: true,
        metadata: { source: "internal_report" },
        createdAt: now,
      })

      const milestoneKey = `first_shared_report:${workspace._id}`
      const existingMilestone = await ctx.db
        .query("usageEvents")
        .withIndex("by_workspaceId_and_idempotencyKey", (q) =>
          q.eq("workspaceId", workspace._id).eq("idempotencyKey", milestoneKey),
        )
        .unique()
      if (!existingMilestone) {
        await ctx.db.insert("usageEvents", {
          workspaceId: workspace._id,
          userId: user._id,
          event: "first_shared_report",
          idempotencyKey: milestoneKey,
          createdAt: now,
        })
      }
    }

    return { recorded: true }
  },
})

// ---------------------------------------------------------------------------
// Public: recordPublicReportCtaClick
// ---------------------------------------------------------------------------

export const recordPublicReportCtaClick = mutation({
  args: {
    slug: v.string(),
    host: v.optional(v.string()),
    grantToken: v.optional(v.string()),
    userAgentHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await resolvePublicReportAccess(ctx, args)
    if (access.status !== "available") return null
    const { audit } = access

    const slugLimit = await auditRateLimiter.limit(ctx, "publicReportActionsBySlug", {
      key: audit.publicSlug,
    })
    if (!slugLimit.ok) {
      return { recorded: false, reason: "rate_limited" as const }
    }
    const viewerKey = `${audit.publicSlug}:cta:${safeViewerHash(args.userAgentHash)}`
    const ctaLimit = await auditRateLimiter.limit(ctx, "publicReportCtaByViewer", {
      key: viewerKey,
    })
    if (!ctaLimit.ok) {
      return { recorded: false, reason: "rate_limited" as const }
    }

    const now = Date.now()
    await incrementReportActionAggregate(ctx, audit, "ctaClicks")
    await ctx.db.insert("usageEvents", {
      workspaceId: audit.workspaceId,
      auditId: audit._id,
      event: "report_cta_clicked",
      isFeedActivity: true,
      metadata: { source: "public_report" },
      createdAt: now,
    })

    return { recorded: true }
  },
})

// ---------------------------------------------------------------------------
// Public: recordPublicReportPdfExport
// ---------------------------------------------------------------------------

export const recordPublicReportPdfExport = mutation({
  args: {
    slug: v.string(),
    host: v.optional(v.string()),
    grantToken: v.optional(v.string()),
    userAgentHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await resolvePublicReportAccess(ctx, args)
    if (access.status !== "available") return null
    const { audit } = access

    const slugLimit = await auditRateLimiter.limit(ctx, "publicReportActionsBySlug", {
      key: audit.publicSlug,
    })
    if (!slugLimit.ok) {
      return { recorded: false, reason: "rate_limited" as const }
    }
    const viewerKey = `${audit.publicSlug}:pdf:${safeViewerHash(args.userAgentHash)}`
    const pdfLimit = await auditRateLimiter.limit(ctx, "publicReportCtaByViewer", {
      key: viewerKey,
    })
    if (!pdfLimit.ok) {
      return { recorded: false, reason: "rate_limited" as const }
    }

    const now = Date.now()
    await incrementReportActionAggregate(ctx, audit, "pdfDownloads")
    await ctx.db.insert("usageEvents", {
      workspaceId: audit.workspaceId,
      auditId: audit._id,
      event: "pdf_exported",
      isFeedActivity: true,
      metadata: { source: "public_report" },
      createdAt: now,
    })

    return { recorded: true }
  },
})

// ---------------------------------------------------------------------------
// Dashboard: getDashboardSummary
// ---------------------------------------------------------------------------

export interface DashboardSummaryAudit {
  _id: Id<"audits">
  domain: string
  normalizedUrl: string
  status: string
  overallScore: number | null
  createdAt: number
  businessName: string | null
  viewCount: number
  viewCountCapped: boolean
  viewCountPending: boolean
  isPublic: boolean
  hasOutreach: boolean
}

export interface DashboardSummaryResult {
  auditsThisMonth: number
  completedAudits: number
  reportViews: number
  reportViewsCapped: boolean
  reportViewsPending: boolean
  hasPublicReport: boolean
  hasOutreachCopy: boolean
  recentAudits: DashboardSummaryAudit[]
}

function monthStartTs(localNowTs: number): number {
  const localDate = new Date(localNowTs)
  const localYear = localDate.getFullYear()
  const localMonth = localDate.getMonth()
  return Date.UTC(localYear, localMonth, 1, 0, 0, 0, 0)
}

export const getDashboardSummary = query({
  args: {
    tzOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<DashboardSummaryResult | null> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const user = await findAppUser(ctx, identity.tokenIdentifier)
    if (!user) return null

    const workspace = await getWorkspaceByOwner(ctx, user._id)
    if (!workspace) return null

    const tzOffsetMin = args.tzOffsetMinutes ?? 0
    const now = Date.now()
    const localNow = now + tzOffsetMin * 60_000
    const startTs = monthStartTs(localNow)
    const utcStartTs = startTs - tzOffsetMin * 60_000

    const allAudits = await ctx.db
      .query("audits")
      .withIndex("by_workspaceId_and_createdAt", (q) =>
        q.eq("workspaceId", workspace._id),
      )
      .order("desc")
      .take(500)

    let completedAudits = 0
    let hasPublicReport = false
    const recentSlice = allAudits.slice(0, 5)
    const recentAuditIds: Id<"audits">[] = recentSlice.map((a) => a._id)
    const recentLeadIds: Id<"leads">[] = []
    for (const audit of recentSlice) {
      if (audit.status === "completed") completedAudits++
      if (audit.isPublic) hasPublicReport = true
      if (audit.leadId) recentLeadIds.push(audit.leadId)
    }

    const auditsThisMonth = allAudits.filter((a) => a.createdAt >= utcStartTs).length

    const usageEvents = await ctx.db
      .query("usageEvents")
      .withIndex("by_workspaceId_and_event", (q) =>
        q.eq("workspaceId", workspace._id).eq("event", "outreach_copied"),
      )
      .take(1)
    const hasOutreachCopy = usageEvents.length > 0

    const leadNames = new Map<Id<"leads">, string>()
    for (const leadId of recentLeadIds) {
      const lead = await ctx.db.get(leadId)
      if (lead?.businessName) {
        leadNames.set(leadId, lead.businessName)
      }
    }

    const viewCounts = new Map<Id<"audits">, Awaited<ReturnType<typeof loadReportViewCount>>>()
    for (const auditId of recentAuditIds) {
      viewCounts.set(auditId, await loadReportViewCount(ctx, auditId))
    }

    const outreachCounts = new Map<Id<"audits">, number>()
    for (const auditId of recentAuditIds) {
      const outreach = await ctx.db
        .query("outreachDrafts")
        .withIndex("by_workspaceId_and_auditId", (q) =>
          q.eq("workspaceId", workspace._id).eq("auditId", auditId),
        )
        .take(1)
      outreachCounts.set(auditId, outreach.length)
    }

    const recentAudits: DashboardSummaryAudit[] = recentSlice.map((audit) => {
      const scoreDoc = audit.overallScore !== undefined ? audit.overallScore : null
      return {
        _id: audit._id,
        domain: audit.domain,
        normalizedUrl: toSafeDisplayUrl(audit.normalizedUrl),
        status: audit.status,
        overallScore: scoreDoc,
        createdAt: audit.createdAt,
        businessName: audit.leadId ? (leadNames.get(audit.leadId) ?? null) : null,
        viewCount: viewCounts.get(audit._id)?.count ?? 0,
        viewCountCapped: viewCounts.get(audit._id)?.capped ?? false,
        viewCountPending: viewCounts.get(audit._id)?.pending ?? false,
        isPublic: audit.isPublic,
        hasOutreach: (outreachCounts.get(audit._id) ?? 0) > 0,
      }
    })

    const totalReportViews = await loadWorkspaceReportViewCount(ctx, workspace._id)

    return {
      auditsThisMonth,
      completedAudits,
      reportViews: totalReportViews.count,
      reportViewsCapped: totalReportViews.capped,
      reportViewsPending: totalReportViews.pending,
      hasPublicReport,
      hasOutreachCopy,
      recentAudits,
    }
  },
})

// ---------------------------------------------------------------------------
// Dashboard: getDashboardEngagement
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000
const ENGAGEMENT_WINDOW_DAYS = 14

export interface EngagementSeriesPoint {
  ts: number
  date: string
  views: number
}

export interface EngagementActivityItem {
  id: string
  event: string
  createdAt: number
  auditId: Id<"audits"> | null
  domain: string | null
  businessName: string | null
  detail: string | null
}

async function enrichActivityEvents(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  events: Doc<"usageEvents">[],
): Promise<EngagementActivityItem[]> {
  const auditIds = new Set<Id<"audits">>()
  for (const event of events) {
    if (event.auditId) auditIds.add(event.auditId)
  }

  const auditMeta = new Map<Id<"audits">, { domain: string; businessName: string | null }>()
  for (const auditId of auditIds) {
    const audit = await ctx.db.get(auditId)
    if (!audit || audit.workspaceId !== workspaceId) continue
    const lead = audit.leadId ? await ctx.db.get(audit.leadId) : null
    auditMeta.set(auditId, {
      domain: audit.domain,
      businessName: lead?.workspaceId === workspaceId ? lead.businessName : null,
    })
  }

  return events.map((event) => {
    const meta = event.auditId ? auditMeta.get(event.auditId) ?? null : null
    return {
      id: event._id,
      event: event.event,
      createdAt: event.createdAt,
      auditId: event.auditId ?? null,
      domain: meta?.domain ?? null,
      businessName: meta?.businessName ?? null,
      detail: activityDetail(event.event, event.metadata),
    }
  })
}

export const getDashboardEngagement = query({
  args: {
    tzOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const user = await findAppUser(ctx, identity.tokenIdentifier)
    if (!user) return null

    const workspace = await getWorkspaceByOwner(ctx, user._id)
    if (!workspace) return null

    const tzOffsetMin = args.tzOffsetMinutes ?? 0

    const now = Date.now()
    const localNow = now + tzOffsetMin * 60_000
    const todayBucket = Math.floor(localNow / DAY_MS)
    const startBucket = todayBucket - (ENGAGEMENT_WINDOW_DAYS - 1)
    const startTs = startBucket * DAY_MS - tzOffsetMin * 60_000

    const recentViews = await ctx.db
      .query("reportViews")
      .withIndex("by_workspaceId_and_viewedAt", (q) =>
        q.eq("workspaceId", workspace._id).gte("viewedAt", startTs),
      )
      .take(500)

    const buckets = new Map<number, number>()
    for (let i = 0; i < ENGAGEMENT_WINDOW_DAYS; i++) {
      buckets.set(startBucket + i, 0)
    }
    for (const view of recentViews) {
      const bucket = Math.floor((view.viewedAt + tzOffsetMin * 60_000) / DAY_MS)
      if (bucket < startBucket) continue
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1)
    }

    const series: EngagementSeriesPoint[] = []
    for (let i = 0; i < ENGAGEMENT_WINDOW_DAYS; i++) {
      const bucket = startBucket + i
      const ts = bucket * DAY_MS
      const d = new Date(ts)
      series.push({
        ts,
        date: `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`,
        views: buckets.get(bucket) ?? 0,
      })
    }

    const recentActivityEvents = await ctx.db
      .query("usageEvents")
      .withIndex("by_workspaceId_and_isFeedActivity_and_createdAt", (q) =>
        q.eq("workspaceId", workspace._id).eq("isFeedActivity", true),
      )
      .order("desc")
      .take(16)

    const recentUsageEvents = await ctx.db
      .query("usageEvents")
      .withIndex("by_workspaceId_and_createdAt", (q) => q.eq("workspaceId", workspace._id))
      .order("desc")
      .take(40)

    const activity = await enrichActivityEvents(
      ctx,
      workspace._id,
      recentActivityEvents.slice(0, 15),
    )

    const totals = {
      views: recentViews.length,
      outreachCopied: recentUsageEvents.filter((e) => e.event === "outreach_copied").length,
      publicLinkCopied: recentUsageEvents.filter((e) => e.event === "public_link_copied").length,
      ctaClicks: recentUsageEvents.filter((e) => e.event === "report_cta_clicked").length,
      pdfExports: recentUsageEvents.filter((e) => e.event === "pdf_exported").length,
    }

    return {
      series,
      activity,
      activityHasMore: recentActivityEvents.length > 15,
      totals,
      hasData: recentViews.length > 0 || activity.length > 0,
    }
  },
})

export const listActivity = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" })
    }

    const user = await findAppUser(ctx, identity.tokenIdentifier)
    if (!user) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" })
    }

    const workspace = await getWorkspaceByOwner(ctx, user._id)
    if (!workspace) {
      return { page: [], isDone: true, continueCursor: "" }
    }

    const result = await ctx.db
      .query("usageEvents")
      .withIndex("by_workspaceId_and_isFeedActivity_and_createdAt", (q) =>
        q.eq("workspaceId", workspace._id).eq("isFeedActivity", true),
      )
      .order("desc")
      .paginate(args.paginationOpts)

    return {
      ...result,
      page: await enrichActivityEvents(ctx, workspace._id, result.page),
    }
  },
})

function activityDetail(
  event: string,
  metadata: Record<string, string | number | boolean | null> | undefined,
): string | null {
  if (event === "report_opened") return "Report aufgerufen"
  if (event === "report_reopened") return "Report erneut aufgerufen"
  if (event === "report_cta_clicked") return "CTA geklickt"
  if (event === "audit_completed") return "Audit abgeschlossen"
  if (event === "pdf_exported") return "Report als PDF exportiert"
  if (event === "public_link_copied") return "Report-Link kopiert"
  if (event === "outreach_copied") {
    const draftType = metadata?.draftType
    return draftType ? `Outreach kopiert (${String(draftType)})` : "Outreach kopiert"
  }
  return null
}
