import { v } from "convex/values"

import type { Doc } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"
import { internalMutation, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"
import {
  evaluateChecks,
  summarizeCategoryScores,
  computeOverallScore,
  SCORING_VERSION,
  type AuditCheckData,
} from "./lib/audit_scoring"

function now() {
  return Date.now()
}

async function gatherAuditCheckData(
  ctx: MutationCtx,
  audit: Doc<"audits">,
): Promise<AuditCheckData> {
  const rawData = await ctx.db
    .query("auditRawData")
    .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
    .unique()

  const pages = await ctx.db
    .query("auditPages")
    .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
    .collect()

  const assets = await ctx.db
    .query("auditAssets")
    .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
    .collect()

  const performanceRows = await ctx.db
    .query("auditPerformance")
    .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
    .collect()

  const businessData = await ctx.db
    .query("auditBusinessData")
    .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
    .unique()

  let leadCity: string | undefined
  let leadCategory: string | undefined
  if (audit.leadId) {
    const lead = await ctx.db.get(audit.leadId)
    leadCity = lead?.city ?? undefined
    leadCategory = lead?.category ?? undefined
  }

  const mobilePerformance = performanceRows.find((row) => row.strategy === "mobile")
  const desktopPerformance = performanceRows.find((row) => row.strategy === "desktop")

  const pageKinds = new Set(pages.map((page) => page.kind))

  return {
    domain: audit.domain,
    auditType: audit.auditType,
    httpStatus: rawData?.httpStatus,
    finalUrl: rawData?.finalUrl ?? audit.normalizedUrl,
    title: rawData?.title,
    metaDescription: rawData?.metaDescription,
    openGraphTitle: rawData?.openGraphTitle,
    openGraphDescription: rawData?.openGraphDescription,
    openGraphImage: rawData?.openGraphImage,
    h1Texts: rawData?.h1Texts,
    h2Texts: rawData?.h2Texts,
    canonicalUrl: rawData?.canonicalUrl,
    robotsFound: rawData?.robotsFound,
    sitemapFound: rawData?.sitemapFound,
    schemaTypes: rawData?.schemaTypes,
    phoneNumbers: rawData?.phoneNumbers,
    emailAddresses: rawData?.emailAddresses,
    contactLinks: rawData?.contactLinks,
    internalLinks: rawData?.internalLinks,
    externalLinks: rawData?.externalLinks,
    privacyLinkFound: rawData?.privacyLinkFound,
    imprintLinkFound: rawData?.imprintLinkFound,
    ctaCandidates: rawData?.ctaCandidates,
    extractedMarkdown: rawData?.extractedMarkdown,
    imageCount: rawData?.imageCount,
    imagesMissingAltCount: rawData?.imagesMissingAltCount,
    phoneLinkFound: rawData?.phoneLinkFound,
    contactFormFound: rawData?.contactFormFound,
    viewportMetaFound: rawData?.viewportMetaFound,
    hasContactPage: pageKinds.has("contact"),
    hasServicesPage: pageKinds.has("services"),
    hasMobileScreenshot: assets.some((asset) => asset.type === "mobile_screenshot"),
    hasDesktopScreenshot: assets.some((asset) => asset.type === "desktop_screenshot"),
    mobilePerformanceScore: mobilePerformance?.performanceScore,
    mobileAccessibilityScore: mobilePerformance?.accessibilityScore,
    desktopPerformanceScore: desktopPerformance?.performanceScore,
    lcp: mobilePerformance?.lcp ?? desktopPerformance?.lcp,
    cls: mobilePerformance?.cls ?? desktopPerformance?.cls,
    fcp: mobilePerformance?.fcp ?? desktopPerformance?.fcp,
    hasBusinessData: Boolean(businessData),
    businessAddress: businessData?.address ?? undefined,
    businessPhone: businessData?.phone ?? undefined,
    businessCity: businessData?.city ?? undefined,
    businessRating: businessData?.rating ?? undefined,
    businessReviewCount: businessData?.reviewCount ?? undefined,
    leadCity,
    leadCategory,
  }
}

export const getAuditScoringContext = internalQuery({
  args: {
    auditId: v.id("audits"),
  },
  handler: async (ctx, args) => {
    const audit = await ctx.db.get(args.auditId)
    if (!audit) {
      return null
    }
    return {
      status: audit.status,
      auditType: audit.auditType,
      domain: audit.domain,
      hasRawData: Boolean(
        await ctx.db
          .query("auditRawData")
          .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
          .unique(),
      ),
      pagesCount: (
        await ctx.db
          .query("auditPages")
          .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
          .take(10)
      ).length,
      assetsCount: (
        await ctx.db
          .query("auditAssets")
          .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
          .take(10)
      ).length,
      performanceCount: (
        await ctx.db
          .query("auditPerformance")
          .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
          .take(10)
      ).length,
    }
  },
})

export const processDeterministicScoring = internalMutation({
  args: {
    auditId: v.id("audits"),
  },
  handler: async (ctx, args) => {
    console.log("[audit_scoring] processDeterministicScoring started", {
      auditId: args.auditId,
    })

    const audit = await ctx.db.get(args.auditId)
    if (!audit) {
      console.warn("[audit_scoring] audit not found", { auditId: args.auditId })
      return null
    }

    console.log("[audit_scoring] audit status", {
      auditId: args.auditId,
      status: audit.status,
      domain: audit.domain,
    })

    if (audit.status === "completed" || audit.status === "failed" || audit.status === "cancelled") {
      console.log("[audit_scoring] skipping terminal audit", { auditId: args.auditId, status: audit.status })
      return null
    }

    const current = now()
    await ctx.db.patch(audit._id, {
      status: "calculating_scores",
      statusMessage: "Deterministische Checks und Scores werden berechnet",
      updatedAt: current,
    })

    console.log("[audit_scoring] gathering audit data", { auditId: args.auditId })

    const data = await gatherAuditCheckData(ctx, audit)

    console.log("[audit_scoring] gathered data", {
      auditId: args.auditId,
      hasTitle: Boolean(data.title),
      hasRawMarkdown: Boolean(data.extractedMarkdown),
      imageCount: data.imageCount,
      mobilePerformanceScore: data.mobilePerformanceScore,
      hasBusinessData: data.hasBusinessData,
      hasMobileScreenshot: data.hasMobileScreenshot,
    })

    const checks = evaluateChecks(data)

    console.log("[audit_scoring] evaluated checks", {
      auditId: args.auditId,
      checkCount: checks.length,
    })

    const existingChecks = await ctx.db
      .query("auditChecks")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .collect()

    console.log("[audit_scoring] replacing existing checks", {
      auditId: args.auditId,
      existingCount: existingChecks.length,
    })

    for (const existing of existingChecks) {
      await ctx.db.delete(existing._id)
    }

    for (const check of checks) {
      await ctx.db.insert("auditChecks", {
        workspaceId: audit.workspaceId,
        auditId: args.auditId,
        category: check.category,
        key: check.key,
        status: check.status,
        label: check.label,
        evidence: check.evidence,
        source: check.source,
        weight: check.weight,
        createdAt: current,
      })
    }

    const categoryScores = summarizeCategoryScores(checks)
    const overallScore = computeOverallScore(categoryScores)

    console.log("[audit_scoring] computed scores", {
      auditId: args.auditId,
      categoryScores,
      overallScore,
    })

    const existingScore = await ctx.db
      .query("auditScores")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .unique()

    const scoreValues = {
      conversionScore: categoryScores.conversion,
      seoBasicsScore: categoryScores.seo,
      localSeoScore: categoryScores.local_seo,
      performanceScore: categoryScores.performance,
      mobileUxScore: categoryScores.mobile,
      trustScore: categoryScores.trust,
      overallScore,
      scoringVersion: SCORING_VERSION,
    }

    if (existingScore) {
      await ctx.db.patch(existingScore._id, {
        ...scoreValues,
        createdAt: current,
      })
    } else {
      await ctx.db.insert("auditScores", {
        workspaceId: audit.workspaceId,
        auditId: args.auditId,
        ...scoreValues,
        createdAt: current,
      })
    }

    const finishedAt = now()
    await ctx.db.patch(audit._id, {
      overallScore,
      status: "generating_findings",
      statusMessage: "Findings werden vorbereitet",
      updatedAt: finishedAt,
    })

    console.log("[audit_scoring] completed successfully", {
      auditId: args.auditId,
      overallScore,
      checkCount: checks.length,
      durationMs: finishedAt - current,
    })

    try {
      await ctx.scheduler.runAfter(0, internal.audit_agent_action.processAuditAgentOutputs, {
        auditId: args.auditId,
      })
      console.log("[audit_scoring] scheduled audit agent run", { auditId: args.auditId })
    } catch (error) {
      console.error("[audit_scoring] failed to schedule audit agent run", {
        auditId: args.auditId,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    return {
      auditId: args.auditId,
      overallScore,
      checkCount: checks.length,
    }
  },
})
