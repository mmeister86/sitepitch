import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

import {
  auditCacheKindValidator,
  auditAgentRunPurposeValidator,
  auditAgentRunProviderValidator,
  auditAgentRunStatusValidator,
  auditAssetStorageProviderValidator,
  auditAssetTypeValidator,
  auditCheckCategoryValidator,
  auditCheckStatusValidator,
  campaignLeadStatusValidator,
  campaignOfferTypeValidator,
  campaignStatusValidator,
  auditFindingCategoryValidator,
  auditFindingSeverityValidator,
  auditPerformanceStrategyValidator,
  auditPipelineStatusValidator,
  auditStatusValidator,
  auditTypeValidator,
  batchAuditItemStatusValidator,
  batchAuditJobStatusValidator,
  batchAuditQaStatusValidator,
  batchAuditSourceValidator,
  creditLedgerTypeValidator,
  leadActivityTypeValidator,
  leadSourceProviderValidator,
  leadStatusValidator,
  integrationConnectionStatusValidator,
  integrationEventTypeValidator,
  integrationProviderValidator,
  integrationRunKindValidator,
  integrationRunStatusValidator,
  personaConfidenceValidator,
  personaIdValidator,
  providerCallProviderValidator,
  providerCallStatusValidator,
  outreachDraftTypeValidator,
  reportLanguageValidator,
  subscriptionPlanValidator,
  subscriptionProviderValidator,
  subscriptionStatusValidator,
  usageEventTypeValidator,
  workspaceMemberRoleValidator,
  webhookPresetValidator,
} from "../src/lib/convex-schema-values.ts"

const primitiveMetadataValidator = v.record(
  v.string(),
  v.union(v.string(), v.number(), v.boolean(), v.null()),
)

const reportThemeValidator = v.union(
  v.literal("classic"),
  v.literal("minimal"),
  v.literal("editorial"),
)

const reportSectionValidator = v.union(
  v.literal("score"),
  v.literal("summary"),
  v.literal("opportunities"),
  v.literal("strengths_weaknesses"),
  v.literal("screenshots"),
  v.literal("findings"),
  v.literal("next_steps"),
  v.literal("cta"),
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
    brandingCompletedAt: v.optional(v.number()),
    retentionMode: v.optional(v.union(v.literal("standard"), v.literal("extended"))),
    retentionConsentAt: v.optional(v.number()),
    retentionPolicyVersion: v.optional(v.string()),
    deletionRequestedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_ownerUserId", ["ownerUserId"]),

  apiKeys: defineTable({
    workspaceId: v.id("workspaces"),
    createdByUserId: v.id("users"),
    label: v.string(),
    publicId: v.string(),
    prefix: v.string(),
    secretHash: v.string(),
    scopes: v.array(v.union(
      v.literal("audits:create"),
      v.literal("audits:read"),
      v.literal("reports:read"),
    )),
    status: v.union(v.literal("active"), v.literal("grace"), v.literal("revoked")),
    rotatedFromApiKeyId: v.optional(v.id("apiKeys")),
    rotatedToApiKeyId: v.optional(v.id("apiKeys")),
    graceExpiresAt: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_publicId", ["publicId"])
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"])
    .index("by_workspaceId_and_status", ["workspaceId", "status"]),

  workspaceIntegrations: defineTable({
    workspaceId: v.id("workspaces"),
    provider: integrationProviderValidator,
    status: integrationConnectionStatusValidator,
    connectionGeneration: v.number(),
    accountLabel: v.optional(v.string()),
    providerAccountId: v.optional(v.string()),
    scopes: v.optional(v.array(v.string())),
    configured: v.boolean(),
    crmFieldMapping: v.optional(v.record(v.string(), v.string())),
    webhookLabel: v.optional(v.string()),
    webhookPreset: v.optional(webhookPresetValidator),
    webhookEndpointUrl: v.optional(v.string()),
    webhookEvents: v.optional(v.array(integrationEventTypeValidator)),
    connectedByUserId: v.id("users"),
    connectedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    lastSuccessAt: v.optional(v.number()),
    lastErrorCode: v.optional(v.string()),
    lastErrorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId_and_provider", ["workspaceId", "provider"])
    .index("by_workspaceId_and_status", ["workspaceId", "status"])
    .index("by_status_and_updatedAt", ["status", "updatedAt"]),

  integrationCredentials: defineTable({
    workspaceId: v.id("workspaces"),
    integrationId: v.id("workspaceIntegrations"),
    keyVersion: v.string(),
    ciphertext: v.string(),
    nonce: v.string(),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_integrationId", ["integrationId"])
    .index("by_workspaceId_and_integrationId", ["workspaceId", "integrationId"]),

  integrationOAuthStates: defineTable({
    workspaceId: v.id("workspaces"),
    integrationId: v.id("workspaceIntegrations"),
    userId: v.id("users"),
    provider: integrationProviderValidator,
    stateHash: v.string(),
    encryptedVerifier: v.optional(v.string()),
    verifierNonce: v.optional(v.string()),
    keyVersion: v.optional(v.string()),
    expiresAt: v.number(),
    claimedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_stateHash", ["stateHash"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_integrationId", ["integrationId"])
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"]),

  integrationRuns: defineTable({
    workspaceId: v.id("workspaces"),
    integrationId: v.id("workspaceIntegrations"),
    kind: integrationRunKindValidator,
    status: integrationRunStatusValidator,
    idempotencyKey: v.string(),
    publicRunId: v.string(),
    leadId: v.optional(v.id("leads")),
    campaignId: v.optional(v.id("campaigns")),
    campaignLeadId: v.optional(v.id("campaignLeads")),
    auditId: v.optional(v.id("audits")),
    integrationEventId: v.optional(v.id("integrationEvents")),
    redeliveryOfRunId: v.optional(v.id("integrationRuns")),
    redeliveryReason: v.optional(v.string()),
    payloadHash: v.optional(v.string()),
    attemptCount: v.number(),
    maxAttempts: v.number(),
    nextAttemptAt: v.optional(v.number()),
    leaseToken: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    remoteObjectType: v.optional(v.string()),
    remoteObjectId: v.optional(v.string()),
    responseStatus: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"])
    .index("by_workspaceId_and_idempotencyKey", ["workspaceId", "idempotencyKey"])
    .index("by_integrationId_and_createdAt", ["integrationId", "createdAt"])
    .index("by_integrationId_and_status_and_nextAttemptAt", ["integrationId", "status", "nextAttemptAt"])
    .index("by_status_and_nextAttemptAt", ["status", "nextAttemptAt"])
    .index("by_campaignLeadId_and_createdAt", ["campaignLeadId", "createdAt"])
    .index("by_integrationEventId", ["integrationEventId"])
    .index("by_redeliveryOfRunId", ["redeliveryOfRunId"])
    .index("by_auditId", ["auditId"])
    .index("by_createdAt", ["createdAt"])
    .index("by_status_and_leaseExpiresAt", ["status", "leaseExpiresAt"]),

  integrationEntityLinks: defineTable({
    workspaceId: v.id("workspaces"),
    integrationId: v.id("workspaceIntegrations"),
    connectionGeneration: v.number(),
    leadId: v.id("leads"),
    remoteObjectType: v.string(),
    remoteObjectId: v.string(),
    normalizedDomain: v.string(),
    lastSyncedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_integrationId_and_leadId", ["integrationId", "leadId"])
    .index("by_workspaceId_and_leadId", ["workspaceId", "leadId"]),

  gmailDraftIntents: defineTable({
    workspaceId: v.id("workspaces"),
    integrationId: v.id("workspaceIntegrations"),
    auditId: v.id("audits"),
    userId: v.id("users"),
    recipient: v.string(),
    subject: v.string(),
    body: v.string(),
    includedReportLink: v.boolean(),
    messageId: v.string(),
    expiresAt: v.number(),
    confirmedAt: v.optional(v.number()),
    consumedAt: v.optional(v.number()),
    runId: v.optional(v.id("integrationRuns")),
    createdAt: v.number(),
  })
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_runId", ["runId"])
    .index("by_auditId", ["auditId"]),

  sheetImportSnapshots: defineTable({
    workspaceId: v.id("workspaces"),
    integrationId: v.id("workspaceIntegrations"),
    campaignId: v.id("campaigns"),
    userId: v.id("users"),
    spreadsheetId: v.string(),
    sheetName: v.string(),
    digest: v.string(),
    rows: v.array(v.object({
      rowNumber: v.number(),
      businessName: v.string(),
      websiteUrl: v.optional(v.string()),
      category: v.optional(v.string()),
      city: v.optional(v.string()),
      country: v.optional(v.string()),
      address: v.optional(v.string()),
      phone: v.optional(v.string()),
      businessEmail: v.optional(v.string()),
    })),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"])
    .index("by_expiresAt", ["expiresAt"]),

  integrationEvents: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.optional(v.id("audits")),
    publicEventId: v.string(),
    event: integrationEventTypeValidator,
    idempotencyKey: v.string(),
    occurredAt: v.number(),
    externalAuditId: v.optional(v.string()),
    auditStatus: v.optional(auditStatusValidator),
    domain: v.optional(v.string()),
    score: v.optional(v.number()),
    apiReportUrl: v.optional(v.string()),
    reportUrl: v.optional(v.string()),
    reportStatus: v.optional(v.union(v.literal("pending"), v.literal("private"), v.literal("published"), v.literal("failed"))),
    draftType: v.optional(outreachDraftTypeValidator),
    includedReportLink: v.optional(v.boolean()),
    dispatchedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_workspaceId_and_idempotencyKey", ["workspaceId", "idempotencyKey"])
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"])
    .index("by_dispatchedAt", ["dispatchedAt"])
    .index("by_createdAt", ["createdAt"])
    .index("by_auditId", ["auditId"]),

  retentionPreferenceEvents: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    mode: v.union(v.literal("standard"), v.literal("extended")),
    policyVersion: v.string(),
    createdAt: v.number(),
  })
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"]),

  logoUploads: defineTable({
    workspaceId: v.id("workspaces"),
    storageId: v.id("_storage"),
    contentType: v.string(),
    size: v.number(),
    createdAt: v.number(),
  })
    .index("by_storageId", ["storageId"])
    .index("by_workspaceId", ["workspaceId"]),

  deletionJobs: defineTable({
    kind: v.union(v.literal("audit"), v.literal("workspace")),
    workspaceId: v.id("workspaces"),
    auditId: v.optional(v.id("audits")),
    userId: v.optional(v.id("users")),
    phase: v.string(),
    status: v.union(
      v.literal("prepared"),
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_auditId", ["auditId"])
    .index("by_workspaceId_and_status", ["workspaceId", "status"])
    .index("by_status_and_updatedAt", ["status", "updatedAt"]),

  workspaceMembers: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: workspaceMemberRoleValidator,
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_userId", ["userId"])
    .index("by_workspaceId_and_userId", ["workspaceId", "userId"]),

  reportDomains: defineTable({
    workspaceId: v.id("workspaces"),
    hostname: v.string(),
    verificationToken: v.string(),
    status: v.union(
      v.literal("pending_dns"),
      v.literal("verified"),
      v.literal("pending_host"),
      v.literal("active"),
      v.literal("suspended"),
      v.literal("disabled"),
      v.literal("error"),
    ),
    failureCount: v.number(),
    verifiedAt: v.optional(v.number()),
    activatedAt: v.optional(v.number()),
    lastCheckedAt: v.optional(v.number()),
    updatedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_hostname", ["hostname"])
    .index("by_status_and_updatedAt", ["status", "updatedAt"]),

  subscriptions: defineTable({
    workspaceId: v.id("workspaces"),
    provider: subscriptionProviderValidator,
    providerCustomerId: v.optional(v.string()),
    providerSubscriptionId: v.optional(v.string()),
    providerVariantId: v.optional(v.string()),
    customerPortalUrl: v.optional(v.string()),
    providerUpdatedAt: v.optional(v.number()),
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

  billingEvents: defineTable({
    provider: subscriptionProviderValidator,
    providerEventId: v.string(),
    eventName: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    providerOrderId: v.optional(v.string()),
    providerSubscriptionId: v.optional(v.string()),
    providerVariantId: v.optional(v.string()),
    testMode: v.boolean(),
    status: v.union(v.literal("processed"), v.literal("ignored"), v.literal("failed")),
    reason: v.optional(v.string()),
    occurredAt: v.optional(v.number()),
    processedAt: v.number(),
  })
    .index("by_provider_and_providerEventId", ["provider", "providerEventId"])
    .index("by_workspaceId_and_processedAt", ["workspaceId", "processedAt"])
    .index("by_providerOrderId", ["providerOrderId"]),

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
    batchAuditJobId: v.optional(v.id("batchAuditJobs")),
    batchAuditItemId: v.optional(v.id("batchAuditItems")),
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
    .index("by_workspaceId_and_batchAuditJobId", ["workspaceId", "batchAuditJobId"])
    .index("by_batchAuditItemId", ["batchAuditItemId"])
    .index("by_workspaceId_and_subscriptionId", ["workspaceId", "subscriptionId"])
    .index("by_workspaceId_and_type", ["workspaceId", "type"])
    .index("by_workspaceId_and_idempotencyKey", ["workspaceId", "idempotencyKey"])
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"]),

  leadSearchSnapshots: defineTable({
    workspaceId: v.id("workspaces"),
    campaignId: v.optional(v.id("campaigns")),
    industry: v.string(),
    city: v.string(),
    country: v.string(),
    keyword: v.optional(v.string()),
    radiusKm: v.optional(v.number()),
    provider: leadSourceProviderValidator,
    sourceLabel: v.string(),
    resultCount: v.number(),
    items: v.array(
      v.object({
        businessName: v.string(),
        websiteUrl: v.optional(v.string()),
        normalizedWebsiteUrl: v.optional(v.string()),
        category: v.optional(v.string()),
        city: v.optional(v.string()),
        country: v.optional(v.string()),
        address: v.optional(v.string()),
        phone: v.optional(v.string()),
        businessEmail: v.optional(v.string()),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
        sourceProvider: leadSourceProviderValidator,
        sourceId: v.optional(v.string()),
        sourceLabel: v.string(),
        auditReady: v.boolean(),
      }),
    ),
    searchedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_campaignId", ["workspaceId", "campaignId"])
    .index("by_workspaceId_and_updatedAt", ["workspaceId", "updatedAt"])
    .index("by_campaignId", ["campaignId"]),

  leads: defineTable({
    workspaceId: v.id("workspaces"),
    businessName: v.string(),
    websiteUrl: v.optional(v.string()),
    normalizedWebsiteUrl: v.optional(v.string()),
    // Deploy-1 field: optional until backfillNormalizedLeadDomains has run.
    normalizedDomain: v.optional(v.string()),
    category: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    businessEmail: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    sourceProvider: leadSourceProviderValidator,
    sourceId: v.optional(v.string()),
    status: leadStatusValidator,
    auditId: v.optional(v.id("audits")),
    reportCtaText: v.optional(v.string()),
    reportCtaUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_status", ["workspaceId", "status"])
    .index("by_workspaceId_and_city", ["workspaceId", "city"])
    .index("by_workspaceId_and_category", ["workspaceId", "category"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_workspaceId_and_normalizedDomain", ["workspaceId", "normalizedDomain"])
    .index("by_workspaceId_and_sourceProvider_and_sourceId", ["workspaceId", "sourceProvider", "sourceId"])
    .index("by_sourceProvider_and_sourceId", ["sourceProvider", "sourceId"]),

  audits: defineTable({
    workspaceId: v.id("workspaces"),
    batchAuditJobId: v.optional(v.id("batchAuditJobs")),
    batchAuditItemId: v.optional(v.id("batchAuditItems")),
    leadId: v.optional(v.id("leads")),
    campaignId: v.optional(v.id("campaigns")),
    campaignLeadId: v.optional(v.id("campaignLeads")),
    createdByUserId: v.id("users"),
    externalApiId: v.optional(v.string()),
    creationChannel: v.optional(v.union(v.literal("ui"), v.literal("api"), v.literal("batch"), v.literal("admin"))),
    apiKeyId: v.optional(v.id("apiKeys")),
    publishRequested: v.optional(v.boolean()),
    apiPayloadHash: v.optional(v.string()),
    activeOutputVersionId: v.optional(v.id("auditOutputVersions")),
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
    rerunOfAuditId: v.optional(v.id("audits")),
    overallScore: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    deletionRequestedAt: v.optional(v.number()),
    reportCtaText: v.optional(v.string()),
    reportCtaUrl: v.optional(v.string()),
    reportCtaSnapshottedAt: v.optional(v.number()),
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
    .index("by_externalApiId", ["externalApiId"])
    .index("by_workspaceId_and_externalApiId", ["workspaceId", "externalApiId"])
    .index("by_batchAuditJobId_and_createdAt", ["batchAuditJobId", "createdAt"])
    .index("by_batchAuditItemId", ["batchAuditItemId"])
    .index("by_leadId", ["leadId"])
    .index("by_campaignId_and_createdAt", ["campaignId", "createdAt"])
    .index("by_campaignLeadId_and_createdAt", ["campaignLeadId", "createdAt"])
    .index("by_publicSlug", ["publicSlug"])
    .index("by_rerunOfAuditId", ["rerunOfAuditId"])
    .index("by_workspaceId_and_publicSlug", ["workspaceId", "publicSlug"])
    .index("by_status_and_createdAt", ["status", "createdAt"]),

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
    .index("by_auditId", ["auditId"])
    .index("by_createdAt", ["createdAt"]),

  auditAssets: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    auditCacheEntryId: v.optional(v.id("auditCacheEntries")),
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
    .index("by_workspaceId_and_type", ["workspaceId", "type"])
    .index("by_auditCacheEntryId", ["auditCacheEntryId"])
    .index("by_createdAt", ["createdAt"]),

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
    outputVersionId: v.optional(v.id("auditOutputVersions")),
    auditAgentRunId: v.optional(v.id("auditAgentRuns")),
    category: auditFindingCategoryValidator,
    severity: auditFindingSeverityValidator,
    title: v.string(),
    evidence: v.string(),
    evidenceRefs: v.optional(v.array(v.string())),
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
    outputVersionId: v.optional(v.id("auditOutputVersions")),
    auditAgentRunId: v.optional(v.id("auditAgentRuns")),
    shortSummary: v.string(),
    strengths: v.array(v.string()),
    weaknesses: v.array(v.string()),
    topOpportunities: v.array(v.string()),
    nextSteps: v.array(v.string()),
    evidenceRefs: v.optional(v.array(v.string())),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_auditId", ["auditId"]),

  outreachDrafts: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    outputVersionId: v.optional(v.id("auditOutputVersions")),
    auditAgentRunId: v.optional(v.id("auditAgentRuns")),
    type: outreachDraftTypeValidator,
    subject: v.optional(v.string()),
    subjectLines: v.optional(v.array(v.string())),
    body: v.string(),
    evidenceRefs: v.optional(v.array(v.string())),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_auditId", ["auditId"])
    .index("by_workspaceId_and_type", ["workspaceId", "type"]),

  outreachTemplates: defineTable({
    workspaceId: v.id("workspaces"),
    createdByUserId: v.id("users"),
    name: v.string(),
    type: outreachDraftTypeValidator,
    language: v.optional(reportLanguageValidator),
    subject: v.optional(v.string()),
    body: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId_and_updatedAt", ["workspaceId", "updatedAt"])
    .index("by_workspaceId_and_type", ["workspaceId", "type"]),

  notifications: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    recipientUserId: v.id("users"),
    type: v.union(v.literal("first_open"), v.literal("first_reopen")),
    idempotencyKey: v.string(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_auditId_and_type", ["auditId", "type"])
    .index("by_workspaceId_and_idempotencyKey", ["workspaceId", "idempotencyKey"])
    .index("by_recipientUserId_and_createdAt", ["recipientUserId", "createdAt"])
    .index("by_recipientUserId_and_readAt", ["recipientUserId", "readAt"])
    .index("by_workspaceId_and_recipientUserId_and_createdAt", ["workspaceId", "recipientUserId", "createdAt"])
    .index("by_workspaceId_and_recipientUserId_and_readAt", ["workspaceId", "recipientUserId", "readAt"])
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"]),

  reportViews: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    viewerIpHash: v.optional(v.string()),
    userAgentHash: v.optional(v.string()),
    referrer: v.optional(v.string()),
    viewedAt: v.number(),
    // Deploy-1 marker: legacy rows omit it until the resumable stats backfill
    // has incorporated them into reportViewStats.
    includedInStats: v.optional(v.boolean()),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_auditId", ["auditId"])
    .index("by_auditId_and_viewedAt", ["auditId", "viewedAt"])
    .index("by_auditId_and_includedInStats", ["auditId", "includedInStats"])
    .index("by_workspaceId_and_viewedAt", ["workspaceId", "viewedAt"])
    .index("by_includedInStats", ["includedInStats"])
    .index("by_viewedAt", ["viewedAt"]),

  reportViewStats: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    totalViews: v.number(),
    lastViewedAt: v.optional(v.number()),
    firstViewedAt: v.optional(v.number()),
    reopenCount: v.optional(v.number()),
    ctaClicks: v.optional(v.number()),
    pdfDownloads: v.optional(v.number()),
    // `pending` rows may contain action aggregates while view totals still
    // come from legacy reportViews. Readers only trust `accurate` totals.
    viewAggregationState: v.optional(v.union(v.literal("pending"), v.literal("accurate"))),
  })
    .index("by_auditId", ["auditId"])
    .index("by_viewAggregationState", ["viewAggregationState"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"]),

  reportSettings: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    sourceCampaignId: v.optional(v.id("campaigns")),
    sourceLeadId: v.optional(v.id("leads")),
    brandName: v.string(),
    logoStorageId: v.optional(v.id("_storage")),
    theme: reportThemeValidator,
    primaryColor: v.string(),
    backgroundColor: v.string(),
    textColor: v.string(),
    language: reportLanguageValidator,
    hiddenSections: v.array(reportSectionValidator),
    introText: v.optional(v.string()),
    ctaText: v.optional(v.string()),
    ctaUrl: v.optional(v.string()),
    introOverride: v.optional(v.string()),
    ctaTextOverride: v.optional(v.string()),
    ctaUrlOverride: v.optional(v.string()),
    introSource: v.optional(v.union(v.literal("report"), v.literal("campaign"))),
    ctaTextSource: v.optional(v.union(
      v.literal("report"),
      v.literal("lead"),
      v.literal("campaign"),
      v.literal("workspace"),
    )),
    ctaUrlSource: v.optional(v.union(
      v.literal("report"),
      v.literal("lead"),
      v.literal("campaign"),
      v.literal("workspace"),
    )),
    showPoweredByPreference: v.boolean(),
    passwordHash: v.optional(v.string()),
    passwordSalt: v.optional(v.string()),
    passwordAlgorithm: v.optional(v.literal("scrypt-v1")),
    expiresAt: v.optional(v.number()),
    settingsVersion: v.number(),
    accessVersion: v.number(),
    snapshottedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_auditId", ["auditId"])
    .index("by_logoStorageId", ["logoStorageId"])
    .index("by_workspaceId_and_updatedAt", ["workspaceId", "updatedAt"]),

  reportAccessGrants: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    tokenHash: v.string(),
    accessVersion: v.number(),
    expiresAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_auditId_and_accessVersion", ["auditId", "accessVersion"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_expiresAt", ["expiresAt"]),

  reportPdfArtifacts: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    settingsVersion: v.number(),
    status: v.union(
      v.literal("queued"),
      v.literal("generating"),
      v.literal("ready"),
      v.literal("failed"),
      v.literal("stale"),
    ),
    storageId: v.optional(v.id("_storage")),
    size: v.optional(v.number()),
    checksum: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_auditId", ["auditId"])
    .index("by_auditId_and_settingsVersion", ["auditId", "settingsVersion"])
    .index("by_workspaceId_and_status", ["workspaceId", "status"]),

  usageEvents: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.optional(v.id("users")),
    auditId: v.optional(v.id("audits")),
    event: usageEventTypeValidator,
    isFeedActivity: v.optional(v.boolean()),
    idempotencyKey: v.optional(v.string()),
    metadata: v.optional(primitiveMetadataValidator),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_workspaceId_and_event", ["workspaceId", "event"])
    .index("by_workspaceId_and_event_and_createdAt", ["workspaceId", "event", "createdAt"])
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"])
    .index("by_workspaceId_and_isFeedActivity_and_createdAt", [
      "workspaceId",
      "isFeedActivity",
      "createdAt",
    ])
    .index("by_workspaceId_and_idempotencyKey", ["workspaceId", "idempotencyKey"])
    .index("by_auditId_and_event", ["auditId", "event"])
    .index("by_event_and_createdAt", ["event", "createdAt"])
    .index("by_createdAt", ["createdAt"]),

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
    batchAuditJobId: v.optional(v.id("batchAuditJobs")),
    batchAuditItemId: v.optional(v.id("batchAuditItems")),
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
    .index("by_batchAuditJobId_and_createdAt", ["batchAuditJobId", "createdAt"])
    .index("by_batchAuditItemId_and_createdAt", ["batchAuditItemId", "createdAt"])
    .index("by_auditId", ["auditId"])
    .index("by_workspaceId_and_provider", ["workspaceId", "provider"])
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"])
    .index("by_createdAt", ["createdAt"]),

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
    executor: v.optional(v.union(v.literal("eve"), v.literal("ai_sdk"), v.literal("deterministic"), v.literal("legacy"))),
    releaseVersion: v.optional(v.string()),
    promptVersion: v.optional(v.string()),
    outputSchemaVersion: v.optional(v.string()),
    eveVersion: v.optional(v.string()),
    eveSessionId: v.optional(v.string()),
    buildSha: v.optional(v.string()),
    loadedSkillVersions: v.optional(v.record(v.string(), v.string())),
    outputVersionId: v.optional(v.id("auditOutputVersions")),
    schemaPass: v.optional(v.boolean()),
    evidencePass: v.optional(v.boolean()),
    claimSafetyPass: v.optional(v.boolean()),
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
    .index("by_workspaceId_and_status", ["workspaceId", "status"])
    .index("by_createdAt", ["createdAt"]),

  auditOutputVersions: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    auditAgentRunId: v.optional(v.id("auditAgentRuns")),
    versionNumber: v.number(),
    status: v.union(
      v.literal("candidate"),
      v.literal("active"),
      v.literal("rejected"),
      v.literal("superseded"),
    ),
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
    output: v.any(),
    schemaPass: v.boolean(),
    evidencePass: v.boolean(),
    claimSafetyPass: v.boolean(),
    rejectionCode: v.optional(v.string()),
    activationReason: v.optional(v.string()),
    activatedByUserId: v.optional(v.id("users")),
    createdAt: v.number(),
    activatedAt: v.optional(v.number()),
    rejectedAt: v.optional(v.number()),
    supersededAt: v.optional(v.number()),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_auditId", ["auditId"])
    .index("by_auditId_and_versionNumber", ["auditId", "versionNumber"])
    .index("by_auditId_and_status", ["auditId", "status"])
    .index("by_createdAt", ["createdAt"]),

  eveEvalRuns: defineTable({
    publicRunId: v.string(),
    candidateReleaseVersion: v.string(),
    baselineReleaseVersion: v.string(),
    suiteVersion: v.string(),
    fixtureVersion: v.string(),
    eveVersion: v.optional(v.string()),
    trigger: v.union(v.literal("pull_request"), v.literal("manual"), v.literal("nightly"), v.literal("main")),
    status: v.union(v.literal("running"), v.literal("passed"), v.literal("failed")),
    buildSha: v.optional(v.string()),
    dimensionScores: v.record(v.string(), v.number()),
    gates: v.record(v.string(), v.boolean()),
    caseCount: v.number(),
    passedCaseCount: v.number(),
    failedCaseCount: v.number(),
    errorCode: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    retentionExpiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_publicRunId", ["publicRunId"])
    .index("by_status_and_createdAt", ["status", "createdAt"])
    .index("by_candidateReleaseVersion_and_createdAt", ["candidateReleaseVersion", "createdAt"])
    .index("by_createdAt", ["createdAt"])
    .index("by_retentionExpiresAt", ["retentionExpiresAt"]),

  eveEvalCaseResults: defineTable({
    evalRunId: v.id("eveEvalRuns"),
    caseId: v.string(),
    label: v.string(),
    locale: v.union(v.literal("de"), v.literal("en")),
    dimensionScores: v.record(v.string(), v.number()),
    gates: v.record(v.string(), v.boolean()),
    regressions: v.record(v.string(), v.number()),
    passed: v.boolean(),
    errorCode: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_evalRunId", ["evalRunId"])
    .index("by_evalRunId_and_caseId", ["evalRunId", "caseId"])
    .index("by_caseId_and_createdAt", ["caseId", "createdAt"])
    .index("by_createdAt", ["createdAt"]),

  auditPersonaReviews: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    personaId: personaIdValidator,
    personaName: v.string(),
    lens: v.string(),
    verdict: v.string(),
    positives: v.array(v.string()),
    frictionPoints: v.array(v.string()),
    topRecommendation: v.string(),
    evidenceRefs: v.array(v.string()),
    confidence: personaConfidenceValidator,
    sortOrder: v.number(),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_auditId", ["auditId"])
    .index("by_auditId_and_sortOrder", ["auditId", "sortOrder"]),

  auditCopyReviews: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    heroClarity: v.string(),
    valueProposition: v.string(),
    offerClarity: v.string(),
    ctaClarity: v.string(),
    snippetClarity: v.string(),
    overallVerdict: v.string(),
    recommendations: v.array(v.string()),
    evidenceRefs: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_auditId", ["auditId"]),

  auditDesignCritiques: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    designHealthScore: v.number(),
    ratingBand: v.string(),
    overallImpression: v.string(),
    heuristicScores: v.array(
      v.object({
        name: v.string(),
        score: v.number(),
        keyIssue: v.string(),
      }),
    ),
    cognitiveLoadFailedCount: v.number(),
    cognitiveLoadLevel: v.union(v.literal("low"), v.literal("moderate"), v.literal("high")),
    cognitiveLoadNotes: v.string(),
    antiPatternVerdict: v.string(),
    whatsWorking: v.array(v.string()),
    priorityIssues: v.array(
      v.object({
        severity: v.union(v.literal("P0"), v.literal("P1"), v.literal("P2"), v.literal("P3")),
        title: v.string(),
        whyItMatters: v.string(),
        fix: v.string(),
        evidenceRefs: v.array(v.string()),
      }),
    ),
    recommendations: v.array(v.string()),
    evidenceRefs: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_auditId", ["workspaceId", "auditId"])
    .index("by_auditId", ["auditId"]),

  campaigns: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    targetIndustry: v.string(),
    targetCity: v.string(),
    targetCountry: v.string(),
    offerType: campaignOfferTypeValidator,
    language: reportLanguageValidator,
    reportIntro: v.optional(v.string()),
    reportCtaText: v.optional(v.string()),
    reportCtaUrl: v.optional(v.string()),
    status: campaignStatusValidator,
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_status", ["workspaceId", "status"])
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"]),

  campaignLeads: defineTable({
    workspaceId: v.id("workspaces"),
    campaignId: v.id("campaigns"),
    leadId: v.id("leads"),
    status: campaignLeadStatusValidator,
    note: v.optional(v.string()),
    noteUpdatedAt: v.optional(v.number()),
    followUpAt: v.optional(v.number()),
    lastContactedAt: v.optional(v.number()),
    outcomeReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_campaignId", ["campaignId"])
    .index("by_campaignId_and_status", ["campaignId", "status"])
    .index("by_campaignId_and_followUpAt", ["campaignId", "followUpAt"])
    .index("by_campaignId_and_leadId", ["campaignId", "leadId"])
    .index("by_workspaceId_and_leadId", ["workspaceId", "leadId"]),

  leadActivities: defineTable({
    workspaceId: v.id("workspaces"),
    campaignId: v.id("campaigns"),
    campaignLeadId: v.optional(v.id("campaignLeads")),
    leadId: v.optional(v.id("leads")),
    type: leadActivityTypeValidator,
    message: v.string(),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_campaignId_and_createdAt", ["campaignId", "createdAt"])
    .index("by_campaignLeadId_and_createdAt", ["campaignLeadId", "createdAt"])
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"]),

  providerCosts: defineTable({
    workspaceId: v.id("workspaces"),
    auditId: v.optional(v.id("audits")),
    batchAuditJobId: v.optional(v.id("batchAuditJobs")),
    batchAuditItemId: v.optional(v.id("batchAuditItems")),
    providerCallId: v.optional(v.id("providerCalls")),
    costKey: v.string(),
    provider: providerCallProviderValidator,
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
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"])
    .index("by_auditId", ["auditId"])
    .index("by_batchAuditJobId_and_createdAt", ["batchAuditJobId", "createdAt"])
    .index("by_batchAuditItemId_and_createdAt", ["batchAuditItemId", "createdAt"])
    .index("by_provider_and_createdAt", ["provider", "createdAt"])
    .index("by_createdAt", ["createdAt"])
    .index("by_costKey", ["costKey"]),

  batchAuditJobs: defineTable({
    workspaceId: v.id("workspaces"),
    campaignId: v.optional(v.id("campaigns")),
    createdByUserId: v.id("users"),
    source: batchAuditSourceValidator,
    planSnapshot: subscriptionPlanValidator,
    planLimitSnapshot: v.number(),
    maxParallelismSnapshot: v.number(),
    auditType: auditTypeValidator,
    reportLanguage: reportLanguageValidator,
    idempotencyKey: v.string(),
    status: batchAuditJobStatusValidator,
    totalItems: v.number(),
    queuedItems: v.number(),
    runningItems: v.number(),
    completedItems: v.number(),
    failedItems: v.number(),
    cancelledItems: v.number(),
    initialReservedCredits: v.number(),
    reservedCredits: v.number(),
    consumedCredits: v.number(),
    refundedCredits: v.number(),
    estimatedCostUsd: v.optional(v.number()),
    actualCostUsd: v.optional(v.number()),
    providerRequestCount: v.optional(v.number()),
    cacheHitItems: v.number(),
    cacheHitOperations: v.number(),
    qaSelectedItems: v.number(),
    qaPassedItems: v.number(),
    qaFailedItems: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"])
    .index("by_workspaceId_and_idempotencyKey", ["workspaceId", "idempotencyKey"])
    .index("by_status_and_updatedAt", ["status", "updatedAt"])
    .index("by_campaignId_and_createdAt", ["campaignId", "createdAt"]),

  batchAuditItems: defineTable({
    batchAuditJobId: v.id("batchAuditJobs"),
    workspaceId: v.id("workspaces"),
    leadId: v.optional(v.id("leads")),
    campaignLeadId: v.optional(v.id("campaignLeads")),
    position: v.number(),
    url: v.string(),
    normalizedUrl: v.string(),
    domain: v.string(),
    status: batchAuditItemStatusValidator,
    attemptCount: v.number(),
    manualRetryCount: v.number(),
    auditId: v.optional(v.id("audits")),
    previousAuditId: v.optional(v.id("audits")),
    workpoolId: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    retryable: v.optional(v.boolean()),
    creditSettled: v.boolean(),
    cacheHitCount: v.number(),
    qaSelected: v.boolean(),
    qaStatus: batchAuditQaStatusValidator,
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_batchAuditJobId", ["batchAuditJobId"])
    .index("by_batchAuditJobId_and_status", ["batchAuditJobId", "status"])
    .index("by_batchAuditJobId_and_position", ["batchAuditJobId", "position"])
    .index("by_auditId", ["auditId"])
    .index("by_previousAuditId", ["previousAuditId"])
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"]),

  batchAuditQaResults: defineTable({
    workspaceId: v.id("workspaces"),
    batchAuditJobId: v.id("batchAuditJobs"),
    batchAuditItemId: v.id("batchAuditItems"),
    auditId: v.id("audits"),
    status: batchAuditQaStatusValidator,
    ruleVersion: v.string(),
    schemaValid: v.boolean(),
    evidenceGrounded: v.boolean(),
    claimSafetyPassed: v.boolean(),
    issueCount: v.number(),
    summary: v.optional(v.string()),
    checkedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_batchAuditJobId_and_checkedAt", ["batchAuditJobId", "checkedAt"])
    .index("by_batchAuditItemId", ["batchAuditItemId"])
    .index("by_auditId", ["auditId"])
    .index("by_workspaceId_and_checkedAt", ["workspaceId", "checkedAt"]),

  auditCacheEntries: defineTable({
    workspaceId: v.id("workspaces"),
    kind: auditCacheKindValidator,
    cacheKey: v.string(),
    normalizedUrl: v.string(),
    domain: v.string(),
    auditType: auditTypeValidator,
    provider: providerCallProviderValidator,
    operation: v.string(),
    version: v.string(),
    sourceAuditId: v.optional(v.id("audits")),
    payload: v.optional(v.any()),
    storageId: v.optional(v.id("_storage")),
    mimeType: v.optional(v.string()),
    referenceCount: v.number(),
    expiresAt: v.number(),
    lastHitAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId_and_cacheKey", ["workspaceId", "cacheKey"])
    .index("by_workspaceId_and_expiresAt", ["workspaceId", "expiresAt"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_sourceAuditId", ["sourceAuditId"]),

  adminActions: defineTable({
    actorUserId: v.id("users"),
    workspaceId: v.id("workspaces"),
    auditId: v.optional(v.id("audits")),
    action: v.union(
      v.literal("credit_adjusted"),
      v.literal("report_disabled"),
      v.literal("audit_rerun"),
      v.literal("output_revalidated"),
      v.literal("output_regenerated"),
      v.literal("output_fallback_created"),
      v.literal("output_version_activated"),
    ),
    reason: v.string(),
    metadata: v.optional(primitiveMetadataValidator),
    createdAt: v.number(),
  })
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"])
    .index("by_auditId_and_createdAt", ["auditId", "createdAt"])
    .index("by_actorUserId_and_createdAt", ["actorUserId", "createdAt"])
    .index("by_createdAt", ["createdAt"]),

  providerBillingSnapshots: defineTable({
    provider: providerCallProviderValidator,
    periodStart: v.number(),
    periodEnd: v.number(),
    providerSpendUsd: v.optional(v.number()),
    calculatedSpendUsd: v.number(),
    deltaUsd: v.optional(v.number()),
    creditBalance: v.optional(v.number()),
    source: v.union(v.literal("provider_api"), v.literal("unavailable")),
    idempotencyKey: v.string(),
    createdAt: v.number(),
  })
    .index("by_provider_and_createdAt", ["provider", "createdAt"])
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_createdAt", ["createdAt"]),
})
