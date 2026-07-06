import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

import {
  auditAgentRunPurposeValidator,
  auditAgentRunProviderValidator,
  auditAgentRunStatusValidator,
  auditAssetStorageProviderValidator,
  auditAssetTypeValidator,
  auditCheckCategoryValidator,
  auditCheckStatusValidator,
  auditFindingCategoryValidator,
  auditFindingSeverityValidator,
  auditPerformanceStrategyValidator,
  auditPipelineStatusValidator,
  auditStatusValidator,
  auditTypeValidator,
  creditLedgerTypeValidator,
  leadSourceProviderValidator,
  leadStatusValidator,
  providerCallProviderValidator,
  providerCallStatusValidator,
  outreachDraftTypeValidator,
  reportLanguageValidator,
  subscriptionPlanValidator,
  subscriptionProviderValidator,
  subscriptionStatusValidator,
  usageEventTypeValidator,
  workspaceMemberRoleValidator,
} from "../src/lib/convex-schema-values.ts"

const primitiveMetadataValidator = v.record(
  v.string(),
  v.union(v.string(), v.number(), v.boolean(), v.null()),
)

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    betterAuthUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    createdAt: v.number(),
    lastSeenAt: v.optional(v.number()),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_betterAuthUserId", ["betterAuthUserId"])
    .index("by_email", ["email"]),

  workspaces: defineTable({
    name: v.string(),
    ownerUserId: v.id("users"),
    logoStorageId: v.optional(v.id("_storage")),
    accentColor: v.optional(v.string()),
    website: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    ctaText: v.optional(v.string()),
    ctaUrl: v.optional(v.string()),
    reportLanguage: reportLanguageValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_ownerUserId", ["ownerUserId"]),

  workspaceMembers: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: workspaceMemberRoleValidator,
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_userId", ["userId"])
    .index("by_workspaceId_and_userId", ["workspaceId", "userId"]),

  subscriptions: defineTable({
    workspaceId: v.id("workspaces"),
    provider: subscriptionProviderValidator,
    providerCustomerId: v.optional(v.string()),
    providerSubscriptionId: v.optional(v.string()),
    plan: subscriptionPlanValidator,
    status: subscriptionStatusValidator,
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_status", ["workspaceId", "status"])
    .index("by_provider_and_providerCustomerId", ["provider", "providerCustomerId"])
    .index("by_provider_and_providerSubscriptionId", ["provider", "providerSubscriptionId"]),

  creditBalances: defineTable({
    workspaceId: v.id("workspaces"),
    periodStart: v.number(),
    periodEnd: v.number(),
    monthlyCredits: v.number(),
    extraCredits: v.number(),
    usedMonthlyCredits: v.number(),
    usedExtraCredits: v.number(),
    reservedCredits: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_periodStart", ["workspaceId", "periodStart"])
    .index("by_workspaceId_and_periodEnd", ["workspaceId", "periodEnd"]),

  creditLedger: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.optional(v.id("audits")),
    subscriptionId: v.optional(v.id("subscriptions")),
    type: creditLedgerTypeValidator,
    amount: v.number(),
    balanceScope: v.union(v.literal("monthly"), v.literal("extra"), v.literal("mixed")),
    idempotencyKey: v.optional(v.string()),
    reason: v.optional(v.string()),
    createdByUserId: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_workspaceId_and_subscriptionId", ["workspaceId", "subscriptionId"])
    .index("by_workspaceId_and_type", ["workspaceId", "type"])
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"]),

  leads: defineTable({
    workspaceId: v.id("workspaces"),
    businessName: v.string(),
    websiteUrl: v.optional(v.string()),
    normalizedWebsiteUrl: v.optional(v.string()),
    category: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    sourceProvider: leadSourceProviderValidator,
    sourceId: v.optional(v.string()),
    status: leadStatusValidator,
    auditId: v.optional(v.id("audits")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_status", ["workspaceId", "status"])
    .index("by_workspaceId_and_city", ["workspaceId", "city"])
    .index("by_workspaceId_and_category", ["workspaceId", "category"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_sourceProvider_and_sourceId", ["sourceProvider", "sourceId"]),

  audits: defineTable({
    workspaceId: v.id("workspaces"),
    leadId: v.optional(v.id("leads")),
    createdByUserId: v.id("users"),
    url: v.string(),
    normalizedUrl: v.string(),
    domain: v.string(),
    auditType: auditTypeValidator,
    reportLanguage: reportLanguageValidator,
    idempotencyKey: v.string(),
    status: auditStatusValidator,
    statusMessage: v.optional(v.string()),
    publicSlug: v.string(),
    isPublic: v.boolean(),
    reportVersion: v.string(),
    overallScore: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    queuedAt: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_status", ["workspaceId", "status"])
    .index("by_workspaceId_and_createdByUserId", ["workspaceId", "createdByUserId"])
    .index("by_workspaceId_and_idempotencyKey", ["workspaceId", "idempotencyKey"])
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"])
    .index("by_leadId", ["leadId"])
    .index("by_publicSlug", ["publicSlug"])
    .index("by_workspaceId_and_publicSlug", ["workspaceId", "publicSlug"]),

  auditRawData: defineTable({
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
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_auditId", ["auditId"]),

  auditAssets: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    type: auditAssetTypeValidator,
    storageProvider: auditAssetStorageProviderValidator,
    storageId: v.optional(v.id("_storage")),
    url: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_auditId", ["auditId"])
    .index("by_auditId_and_type", ["auditId", "type"])
    .index("by_workspaceId_and_type", ["workspaceId", "type"]),

  auditPerformance: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    strategy: auditPerformanceStrategyValidator,
    performanceScore: v.optional(v.number()),
    accessibilityScore: v.optional(v.number()),
    bestPracticesScore: v.optional(v.number()),
    seoScore: v.optional(v.number()),
    lcp: v.optional(v.number()),
    cls: v.optional(v.number()),
    fcp: v.optional(v.number()),
    speedIndex: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_auditId", ["auditId"])
    .index("by_auditId_and_strategy", ["auditId", "strategy"])
    .index("by_workspaceId_and_strategy", ["workspaceId", "strategy"]),

  auditChecks: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    category: auditCheckCategoryValidator,
    key: v.string(),
    status: auditCheckStatusValidator,
    label: v.string(),
    evidence: v.optional(v.string()),
    source: v.optional(v.string()),
    weight: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_auditId", ["auditId"])
    .index("by_auditId_and_category_and_key", ["auditId", "category", "key"])
    .index("by_workspaceId_and_category", ["workspaceId", "category"])
    .index("by_workspaceId_and_category_and_key", ["workspaceId", "category", "key"]),

  auditScores: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    conversionScore: v.number(),
    seoBasicsScore: v.number(),
    localSeoScore: v.number(),
    performanceScore: v.number(),
    mobileUxScore: v.number(),
    trustScore: v.number(),
    overallScore: v.number(),
    scoringVersion: v.string(),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_auditId", ["auditId"])
    .index("by_auditId_and_scoringVersion", ["auditId", "scoringVersion"]),

  auditFindings: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    category: auditFindingCategoryValidator,
    severity: auditFindingSeverityValidator,
    title: v.string(),
    evidence: v.string(),
    explanation: v.string(),
    recommendation: v.string(),
    salesAngle: v.string(),
    sortOrder: v.number(),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_auditId", ["auditId"])
    .index("by_workspaceId_and_category", ["workspaceId", "category"])
    .index("by_auditId_and_sortOrder", ["auditId", "sortOrder"]),

  auditSummaries: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    shortSummary: v.string(),
    strengths: v.array(v.string()),
    weaknesses: v.array(v.string()),
    topOpportunities: v.array(v.string()),
    nextSteps: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_auditId", ["auditId"]),

  outreachDrafts: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    type: outreachDraftTypeValidator,
    subject: v.optional(v.string()),
    subjectLines: v.optional(v.array(v.string())),
    body: v.string(),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_auditId", ["auditId"])
    .index("by_workspaceId_and_type", ["workspaceId", "type"]),

  reportViews: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    viewerIpHash: v.optional(v.string()),
    userAgentHash: v.optional(v.string()),
    referrer: v.optional(v.string()),
    viewedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_auditId", ["auditId"])
    .index("by_workspaceId_and_viewedAt", ["workspaceId", "viewedAt"]),

  usageEvents: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.optional(v.id("users")),
    auditId: v.optional(v.id("audits")),
    event: usageEventTypeValidator,
    idempotencyKey: v.optional(v.string()),
    metadata: v.optional(primitiveMetadataValidator),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_workspaceId_and_event", ["workspaceId", "event"])
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"]),

  auditPipelineStates: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    status: auditPipelineStatusValidator,
    phase: v.string(),
    leaseToken: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    attemptCount: v.number(),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    lastErrorMessage: v.optional(v.string()),
    lastErrorCode: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_auditId", ["auditId"])
    .index("by_workspaceId_and_status", ["workspaceId", "status"]),

  providerCalls: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.optional(v.id("audits")),
    provider: providerCallProviderValidator,
    operation: v.string(),
    status: providerCallStatusValidator,
    attempt: v.number(),
    requestEvidence: v.optional(v.string()),
    latencyMs: v.optional(v.number()),
    retryCount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    responseStatus: v.optional(v.number()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_auditId", ["auditId"])
    .index("by_workspaceId_and_provider", ["workspaceId", "provider"])
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"]),

  auditPages: defineTable({
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
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_auditId", ["auditId"])
    .index("by_auditId_and_pageIndex", ["auditId", "pageIndex"]),

  auditBusinessData: defineTable({
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
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_auditId", ["auditId"]),

  auditAgentRuns: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    provider: auditAgentRunProviderValidator,
    model: v.string(),
    purpose: auditAgentRunPurposeValidator,
    status: auditAgentRunStatusValidator,
    skillVersions: v.optional(v.record(v.string(), v.string())),
    tokensIn: v.optional(v.number()),
    tokensOut: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_auditId", ["auditId"])
    .index("by_workspaceId_and_purpose", ["workspaceId", "purpose"])
    .index("by_workspaceId_and_status", ["workspaceId", "status"]),
})
