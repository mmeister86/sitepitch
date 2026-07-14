import assert from "node:assert/strict"

import schema from "./schema.ts"
import {
  auditCacheKindValidator,
  auditStatusValidator,
  auditPipelineStatusValidator,
  auditTypeValidator,
  batchAuditItemStatusValidator,
  batchAuditJobStatusValidator,
  batchAuditQaStatusValidator,
  batchAuditSourceValidator,
  canonicalLeadStatusValidator,
  creditLedgerTypeValidator,
  leadSourceProviderValidator,
  providerCallProviderValidator,
  providerCallStatusValidator,
  reportLanguageValidator,
  usageEventTypeValidator,
  workspaceMemberRoleValidator,
} from "../src/lib/convex-schema-values.ts"

const tableNames = Object.keys(schema.tables).sort()

assert.deepEqual(tableNames, [
  "adminActions",
  "auditAgentRuns",
  "auditAssets",
  "auditBusinessData",
  "auditCacheEntries",
  "auditChecks",
  "auditCopyReviews",
  "auditDesignCritiques",
  "auditFindings",
  "auditPages",
  "auditPerformance",
  "auditPersonaReviews",
  "auditPipelineStates",
  "auditRawData",
  "auditScores",
  "auditSummaries",
  "audits",
  "batchAuditItems",
  "batchAuditJobs",
  "batchAuditQaResults",
  "billingEvents",
  "campaignLeads",
  "campaigns",
  "creditBalances",
  "creditLedger",
  "deletionJobs",
  "leadActivities",
  "leadSearchSnapshots",
  "leads",
  "logoUploads",
  "notifications",
  "outreachDrafts",
  "outreachTemplates",
  "providerBillingSnapshots",
  "providerCalls",
  "providerCosts",
  "reportViewStats",
  "reportViews",
  "retentionPreferenceEvents",
  "subscriptions",
  "usageEvents",
  "users",
  "workspaceMembers",
  "workspaces",
])

const getValidatorValues = (validator: unknown) => {
  const json = validator as { json?: { value?: unknown[] } }
  return json.json?.value ?? []
}

assert.deepEqual(getValidatorValues(reportLanguageValidator), [{ type: "literal", value: "de" }, { type: "literal", value: "en" }])
assert.deepEqual(getValidatorValues(workspaceMemberRoleValidator), [
  { type: "literal", value: "owner" },
  { type: "literal", value: "admin" },
  { type: "literal", value: "member" },
])
assert.deepEqual(getValidatorValues(creditLedgerTypeValidator), [
  { type: "literal", value: "grant" },
  { type: "literal", value: "reserve" },
  { type: "literal", value: "consume" },
  { type: "literal", value: "refund" },
  { type: "literal", value: "expire" },
  { type: "literal", value: "manual_adjustment" },
])
assert.deepEqual(getValidatorValues(auditStatusValidator), [
  { type: "literal", value: "draft" },
  { type: "literal", value: "queued" },
  { type: "literal", value: "validating_url" },
  { type: "literal", value: "fetching_html" },
  { type: "literal", value: "extracting_content" },
  { type: "literal", value: "taking_screenshots" },
  { type: "literal", value: "running_performance_checks" },
  { type: "literal", value: "fetching_business_data" },
  { type: "literal", value: "running_deterministic_checks" },
  { type: "literal", value: "calculating_scores" },
  { type: "literal", value: "generating_findings" },
  { type: "literal", value: "generating_outreach" },
  { type: "literal", value: "completed" },
  { type: "literal", value: "failed" },
  { type: "literal", value: "cancelled" },
])
assert.deepEqual(getValidatorValues(auditPipelineStatusValidator), [
  { type: "literal", value: "queued" },
  { type: "literal", value: "running" },
  { type: "literal", value: "completed" },
  { type: "literal", value: "failed" },
])
assert.deepEqual(getValidatorValues(auditTypeValidator), [
  { type: "literal", value: "standard" },
  { type: "literal", value: "local" },
  { type: "literal", value: "quick" },
])
assert.deepEqual(getValidatorValues(providerCallProviderValidator), [
  { type: "literal", value: "direct_html" },
  { type: "literal", value: "jina" },
  { type: "literal", value: "firecrawl" },
  { type: "literal", value: "screenshotone" },
  { type: "literal", value: "pagespeed" },
  { type: "literal", value: "local_business_data" },
  { type: "literal", value: "google_places" },
  { type: "literal", value: "openai" },
  { type: "literal", value: "anthropic" },
  { type: "literal", value: "other" },
])
assert.deepEqual(getValidatorValues(providerCallStatusValidator), [
  { type: "literal", value: "queued" },
  { type: "literal", value: "started" },
  { type: "literal", value: "completed" },
  { type: "literal", value: "failed" },
])
assert.deepEqual(getValidatorValues(batchAuditJobStatusValidator), [
  { type: "literal", value: "queued" },
  { type: "literal", value: "running" },
  { type: "literal", value: "paused" },
  { type: "literal", value: "completed" },
  { type: "literal", value: "failed" },
  { type: "literal", value: "cancelled" },
])
assert.deepEqual(getValidatorValues(batchAuditItemStatusValidator), [
  { type: "literal", value: "queued" },
  { type: "literal", value: "running" },
  { type: "literal", value: "paused" },
  { type: "literal", value: "completed" },
  { type: "literal", value: "failed" },
  { type: "literal", value: "cancelled" },
])
assert.deepEqual(getValidatorValues(batchAuditSourceValidator), [
  { type: "literal", value: "campaign" },
  { type: "literal", value: "csv" },
])
assert.deepEqual(getValidatorValues(batchAuditQaStatusValidator), [
  { type: "literal", value: "pending" },
  { type: "literal", value: "passed" },
  { type: "literal", value: "failed" },
  { type: "literal", value: "skipped" },
])
assert.deepEqual(getValidatorValues(auditCacheKindValidator), [
  { type: "literal", value: "content" },
  { type: "literal", value: "screenshot" },
  { type: "literal", value: "pagespeed" },
  { type: "literal", value: "business_data" },
])

const indexDescriptors = (tableName: keyof typeof schema.tables) =>
  (schema.tables[tableName] as any).indexes.map(
    (index: { indexDescriptor: string }) => index.indexDescriptor,
  )

for (const index of [
  "by_workspaceId_and_createdAt",
  "by_workspaceId_and_idempotencyKey",
  "by_status_and_updatedAt",
  "by_campaignId_and_createdAt",
]) {
  assert.ok(indexDescriptors("batchAuditJobs").includes(index))
}
for (const index of [
  "by_batchAuditJobId",
  "by_batchAuditJobId_and_status",
  "by_batchAuditJobId_and_position",
  "by_auditId",
  "by_previousAuditId",
  "by_workspaceId_and_createdAt",
]) {
  assert.ok(indexDescriptors("batchAuditItems").includes(index))
}
for (const index of [
  "by_batchAuditJobId_and_checkedAt",
  "by_batchAuditItemId",
  "by_auditId",
  "by_workspaceId_and_checkedAt",
]) {
  assert.ok(indexDescriptors("batchAuditQaResults").includes(index))
}
for (const index of [
  "by_workspaceId_and_cacheKey",
  "by_workspaceId_and_expiresAt",
  "by_expiresAt",
  "by_sourceAuditId",
]) {
  assert.ok(indexDescriptors("auditCacheEntries").includes(index))
}
assert.ok(indexDescriptors("creditLedger").includes("by_workspaceId_and_batchAuditJobId"))
assert.ok(indexDescriptors("creditLedger").includes("by_batchAuditItemId"))
assert.ok(indexDescriptors("audits").includes("by_batchAuditJobId_and_createdAt"))
assert.ok(indexDescriptors("audits").includes("by_batchAuditItemId"))
assert.ok(indexDescriptors("providerCalls").includes("by_batchAuditJobId_and_createdAt"))
assert.ok(indexDescriptors("providerCalls").includes("by_batchAuditItemId_and_createdAt"))
assert.ok(indexDescriptors("providerCosts").includes("by_batchAuditJobId_and_createdAt"))
assert.ok(indexDescriptors("providerCosts").includes("by_batchAuditItemId_and_createdAt"))

const auditsTable = schema.tables.audits as any
const auditsIndexes = (auditsTable.indexes as Array<{ indexDescriptor: string; fields: string[] }>).map(
  (index) => [index.indexDescriptor, index.fields] as const,
)

assert.ok(auditsIndexes.some(([name, fields]) => name === "by_publicSlug" && fields[0] === "publicSlug"))
assert.ok(auditsIndexes.some(([name, fields]) => name === "by_workspaceId_and_status" && fields.join(",") === "workspaceId,status"))
assert.ok(auditsIndexes.some(([name, fields]) => name === "by_workspaceId_and_createdAt" && fields.join(",") === "workspaceId,createdAt"))
assert.ok(auditsIndexes.some(([name, fields]) => name === "by_workspaceId_and_idempotencyKey" && fields.join(",") === "workspaceId,idempotencyKey"))
assert.ok(auditsIndexes.some(([name, fields]) => name === "by_campaignId_and_createdAt" && fields.join(",") === "campaignId,createdAt"))
assert.ok(auditsIndexes.some(([name, fields]) => name === "by_campaignLeadId_and_createdAt" && fields.join(",") === "campaignLeadId,createdAt"))

const creditLedgerIndexes = (schema.tables.creditLedger as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(creditLedgerIndexes.includes("by_workspaceId_and_auditId"))
assert.ok(creditLedgerIndexes.includes("by_workspaceId_and_subscriptionId"))
assert.ok(creditLedgerIndexes.includes("by_workspaceId_and_idempotencyKey"))

const billingEventIndexes = (schema.tables.billingEvents as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(billingEventIndexes.includes("by_provider_and_providerEventId"))
assert.ok(billingEventIndexes.includes("by_workspaceId_and_processedAt"))
assert.ok(billingEventIndexes.includes("by_providerOrderId"))

const auditAssetsIndexes = (schema.tables.auditAssets as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(auditAssetsIndexes.includes("by_auditId_and_type"))
assert.ok(auditAssetsIndexes.includes("by_auditCacheEntryId"))

const usageEventsTable = schema.tables.usageEvents
assert.ok(
  (usageEventsTable as any).indexes.some(
    (index: { indexDescriptor: string }) => index.indexDescriptor === "by_workspaceId_and_event",
  ),
)
assert.ok(
  (usageEventsTable as any).indexes.some(
    (index: { indexDescriptor: string }) =>
      index.indexDescriptor === "by_workspaceId_and_event_and_createdAt",
  ),
)
assert.ok(
  (usageEventsTable as any).indexes.some(
    (index: { indexDescriptor: string }) => index.indexDescriptor === "by_workspaceId_and_createdAt",
  ),
)
assert.ok(
  (usageEventsTable as any).indexes.some(
    (index: { indexDescriptor: string }) =>
      index.indexDescriptor === "by_workspaceId_and_isFeedActivity_and_createdAt",
  ),
)
assert.ok(
  Object.keys((usageEventsTable as any).validator.fields).includes("isFeedActivity"),
  "usageEvents should include the optional feed discriminator",
)

const campaignsTable = schema.tables.campaigns as any
const campaignIndexes = campaignsTable.indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(campaignIndexes.includes("by_workspaceId"))
assert.ok(campaignIndexes.includes("by_workspaceId_and_status"))
assert.ok(campaignIndexes.includes("by_workspaceId_and_createdAt"))

const campaignLeadsTable = schema.tables.campaignLeads as any
const campaignLeadsIndexes = campaignLeadsTable.indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(campaignLeadsIndexes.includes("by_campaignId"))
assert.ok(campaignLeadsIndexes.includes("by_campaignId_and_status"))
assert.ok(campaignLeadsIndexes.includes("by_campaignId_and_followUpAt"))
assert.ok(campaignLeadsIndexes.includes("by_campaignId_and_leadId"))
assert.ok(campaignLeadsIndexes.includes("by_workspaceId_and_leadId"))

const leadActivitiesTable = schema.tables.leadActivities as any
const leadActivitiesIndexes = leadActivitiesTable.indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(leadActivitiesIndexes.includes("by_campaignId_and_createdAt"))
assert.ok(leadActivitiesIndexes.includes("by_campaignLeadId_and_createdAt"))
assert.ok(leadActivitiesIndexes.includes("by_workspaceId_and_createdAt"))

const pipelineIndexes = (schema.tables.auditPipelineStates as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(pipelineIndexes.includes("by_auditId"))
assert.ok(pipelineIndexes.includes("by_workspaceId_and_status"))

const providerCallsIndexes = (schema.tables.providerCalls as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(providerCallsIndexes.includes("by_workspaceId_and_auditId"))
assert.ok(providerCallsIndexes.includes("by_auditId"))

const auditPagesIndexes = (schema.tables.auditPages as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(auditPagesIndexes.includes("by_auditId_and_pageIndex"))

const auditPerformanceIndexes = (schema.tables.auditPerformance as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(auditPerformanceIndexes.includes("by_auditId_and_strategy"))

const auditBusinessIndexes = (schema.tables.auditBusinessData as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(auditBusinessIndexes.includes("by_auditId"))

const auditChecksIndexes = (schema.tables.auditChecks as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(auditChecksIndexes.includes("by_auditId"))
assert.ok(auditChecksIndexes.includes("by_auditId_and_category_and_key"))

const auditScoresIndexes = (schema.tables.auditScores as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(auditScoresIndexes.includes("by_auditId"))
assert.ok(auditScoresIndexes.includes("by_auditId_and_scoringVersion"))

const auditRawDataFields = Object.keys((schema.tables.auditRawData as any).validator.fields)
for (const field of [
  "imageCount",
  "imagesMissingAltCount",
  "phoneLinkFound",
  "contactFormFound",
  "viewportMetaFound",
]) {
  assert.ok(auditRawDataFields.includes(field), `auditRawData should include ${field}`)
}

const personaReviewsIndexes = (schema.tables.auditPersonaReviews as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(personaReviewsIndexes.includes("by_auditId"))
assert.ok(personaReviewsIndexes.includes("by_auditId_and_sortOrder"))
assert.ok(personaReviewsIndexes.includes("by_workspaceId_and_auditId"))

const designCritiqueIndexes = (schema.tables.auditDesignCritiques as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(designCritiqueIndexes.includes("by_auditId"))
assert.ok(designCritiqueIndexes.includes("by_workspaceId_and_auditId"))

const leadsIndexes = (schema.tables.leads as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(leadsIndexes.includes("by_workspaceId"))
assert.ok(leadsIndexes.includes("by_workspaceId_and_status"))
assert.ok(leadsIndexes.includes("by_workspaceId_and_sourceProvider_and_sourceId"))
assert.ok(leadsIndexes.includes("by_workspaceId_and_normalizedDomain"))
assert.ok(getValidatorValues(leadSourceProviderValidator).some((value: any) => value.value === "csv"))

const leadSearchSnapshotIndexes = (schema.tables.leadSearchSnapshots as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(leadSearchSnapshotIndexes.includes("by_workspaceId"))
assert.ok(leadSearchSnapshotIndexes.includes("by_workspaceId_and_campaignId"))
assert.ok(leadSearchSnapshotIndexes.includes("by_workspaceId_and_updatedAt"))
assert.ok(leadSearchSnapshotIndexes.includes("by_campaignId"))

// ---------------------------------------------------------------------------
// TASK-4.13 additions
// ---------------------------------------------------------------------------

const usageEventsIndexesFinal = (schema.tables.usageEvents as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(usageEventsIndexesFinal.includes("by_auditId_and_event"))

const workspacesFields = Object.keys((schema.tables.workspaces as any).validator.fields)
assert.ok(workspacesFields.includes("brandingCompletedAt"), "workspaces should include brandingCompletedAt")

const auditsFields = Object.keys((schema.tables.audits as any).validator.fields)
assert.ok(auditsFields.includes("rerunOfAuditId"), "audits should include rerunOfAuditId")

const providerCostsIndexes = (schema.tables.providerCosts as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(providerCostsIndexes.includes("by_workspaceId"))
assert.ok(providerCostsIndexes.includes("by_workspaceId_and_createdAt"))
assert.ok(providerCostsIndexes.includes("by_auditId"))
assert.ok(providerCostsIndexes.includes("by_provider_and_createdAt"))
assert.ok(providerCostsIndexes.includes("by_costKey"))

const providerCostsFields = Object.keys((schema.tables.providerCosts as any).validator.fields)
assert.ok(providerCostsFields.includes("costKey"), "providerCosts should include costKey")
assert.ok(providerCostsFields.includes("source"), "providerCosts should include source")
assert.ok(providerCostsFields.includes("model"), "providerCosts should include model")
assert.ok(providerCostsFields.includes("providerRequestId"), "providerCosts should include providerRequestId")
assert.ok(providerCostsFields.includes("pricingVersion"), "providerCosts should include pricingVersion")

const billingSnapshotsIndexes = (schema.tables.providerBillingSnapshots as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(billingSnapshotsIndexes.includes("by_provider_and_createdAt"))
assert.ok(billingSnapshotsIndexes.includes("by_idempotencyKey"))

const adminActionsIndexes = (schema.tables.adminActions as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(adminActionsIndexes.includes("by_workspaceId_and_createdAt"))
assert.ok(adminActionsIndexes.includes("by_auditId_and_createdAt"))
assert.ok(adminActionsIndexes.includes("by_actorUserId_and_createdAt"))

// TASK-4.14 privacy, retention, and deletion additions.
const privacyWorkspaceFields = Object.keys((schema.tables.workspaces as any).validator.fields)
assert.ok(privacyWorkspaceFields.includes("retentionMode"))
assert.ok(privacyWorkspaceFields.includes("retentionConsentAt"))
assert.ok(privacyWorkspaceFields.includes("retentionPolicyVersion"))
assert.ok(privacyWorkspaceFields.includes("deletionRequestedAt"))
assert.ok(Object.keys((schema.tables.audits as any).validator.fields).includes("deletionRequestedAt"))

const deletionJobIndexes = (schema.tables.deletionJobs as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(deletionJobIndexes.includes("by_auditId"))
assert.ok(deletionJobIndexes.includes("by_workspaceId_and_status"))
assert.ok(deletionJobIndexes.includes("by_status_and_updatedAt"))

const logoUploadIndexes = (schema.tables.logoUploads as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(logoUploadIndexes.includes("by_storageId"))
assert.ok(logoUploadIndexes.includes("by_workspaceId"))

const reportViewStatsIndexes = (schema.tables.reportViewStats as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(reportViewStatsIndexes.includes("by_auditId"))
assert.ok(reportViewStatsIndexes.includes("by_workspaceId_and_auditId"))
assert.ok(reportViewStatsIndexes.includes("by_viewAggregationState"))

const reportViewIndexes = (schema.tables.reportViews as any).indexes as Array<{
  indexDescriptor: string
  fields: string[]
}>
assert.deepEqual(
  reportViewIndexes.find((index) => index.indexDescriptor === "by_auditId_and_viewedAt")?.fields,
  ["auditId", "viewedAt"],
)
assert.ok(reportViewIndexes.some((index) => index.indexDescriptor === "by_includedInStats"))
assert.deepEqual(
  reportViewIndexes.find((index) => index.indexDescriptor === "by_auditId_and_includedInStats")?.fields,
  ["auditId", "includedInStats"],
)
assert.ok(Object.keys((schema.tables.reportViews as any).validator.fields).includes("includedInStats"))

const leadStatusValues = getValidatorValues(
  (schema.tables.leads as any).validator.fields.status,
)
assert.ok(leadStatusValues.some((value: any) => value.value === "follow_up"))
assert.ok(leadStatusValues.some((value: any) => value.value === "not_interested"))

for (const field of ["reportCtaText", "reportCtaUrl", "reportCtaSnapshottedAt"]) {
  assert.ok(Object.keys((schema.tables.audits as any).validator.fields).includes(field))
}
for (const field of ["reportCtaText", "reportCtaUrl"]) {
  assert.ok(Object.keys((schema.tables.leads as any).validator.fields).includes(field))
}
for (const field of ["firstViewedAt", "reopenCount", "ctaClicks", "pdfDownloads", "viewAggregationState"]) {
  assert.ok(Object.keys((schema.tables.reportViewStats as any).validator.fields).includes(field))
}

const notificationIndexes = (schema.tables.notifications as any).indexes as Array<{
  indexDescriptor: string
  fields: string[]
}>
assert.deepEqual(Object.keys((schema.tables.notifications as any).validator.fields), [
  "workspaceId",
  "auditId",
  "recipientUserId",
  "type",
  "idempotencyKey",
  "readAt",
  "createdAt",
])
assert.deepEqual(
  notificationIndexes.find((index) => index.indexDescriptor === "by_workspaceId_and_idempotencyKey")?.fields,
  ["workspaceId", "idempotencyKey"],
)
assert.deepEqual(
  notificationIndexes.find((index) => index.indexDescriptor === "by_auditId_and_type")?.fields,
  ["auditId", "type"],
)
assert.deepEqual(
  notificationIndexes.find((index) => index.indexDescriptor === "by_recipientUserId_and_createdAt")?.fields,
  ["recipientUserId", "createdAt"],
)
assert.deepEqual(
  notificationIndexes.find((index) => index.indexDescriptor === "by_recipientUserId_and_readAt")?.fields,
  ["recipientUserId", "readAt"],
)
assert.deepEqual(
  notificationIndexes.find((index) => index.indexDescriptor === "by_workspaceId_and_recipientUserId_and_createdAt")?.fields,
  ["workspaceId", "recipientUserId", "createdAt"],
)
assert.deepEqual(
  notificationIndexes.find((index) => index.indexDescriptor === "by_workspaceId_and_recipientUserId_and_readAt")?.fields,
  ["workspaceId", "recipientUserId", "readAt"],
)
assert.deepEqual(
  notificationIndexes.find((index) => index.indexDescriptor === "by_workspaceId_and_createdAt")?.fields,
  ["workspaceId", "createdAt"],
)

const templateIndexes = (schema.tables.outreachTemplates as any).indexes as Array<{
  indexDescriptor: string
  fields: string[]
}>
assert.deepEqual(Object.keys((schema.tables.outreachTemplates as any).validator.fields), [
  "workspaceId",
  "createdByUserId",
  "name",
  "type",
  "language",
  "subject",
  "body",
  "createdAt",
  "updatedAt",
])
assert.deepEqual(
  templateIndexes.find((index) => index.indexDescriptor === "by_workspaceId_and_updatedAt")?.fields,
  ["workspaceId", "updatedAt"],
)
assert.deepEqual(
  templateIndexes.find((index) => index.indexDescriptor === "by_workspaceId_and_type")?.fields,
  ["workspaceId", "type"],
)

const usageEventValues = getValidatorValues(usageEventTypeValidator)
assert.ok(usageEventValues.some((value: any) => value.value === "report_reopened"))
assert.ok(usageEventValues.some((value: any) => value.value === "first_shared_report"))
assert.deepEqual(getValidatorValues(canonicalLeadStatusValidator), [
  { type: "literal", value: "new" },
  { type: "literal", value: "audited" },
  { type: "literal", value: "contacted" },
  { type: "literal", value: "follow_up" },
  { type: "literal", value: "interested" },
  { type: "literal", value: "won" },
  { type: "literal", value: "lost" },
])
assert.ok((schema.tables.auditRawData as any).indexes.some((index: { indexDescriptor: string }) => index.indexDescriptor === "by_createdAt"))
assert.ok((schema.tables.auditAssets as any).indexes.some((index: { indexDescriptor: string }) => index.indexDescriptor === "by_createdAt"))
assert.ok((schema.tables.auditAgentRuns as any).indexes.some((index: { indexDescriptor: string }) => index.indexDescriptor === "by_createdAt"))
assert.ok((schema.tables.audits as any).indexes.some((index: { indexDescriptor: string }) => index.indexDescriptor === "by_rerunOfAuditId"))

console.log("schema contract tests passed")
