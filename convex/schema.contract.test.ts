import assert from "node:assert/strict"

import schema from "./schema.ts"
import {
  auditStatusValidator,
  auditPipelineStatusValidator,
  auditTypeValidator,
  creditLedgerTypeValidator,
  providerCallProviderValidator,
  providerCallStatusValidator,
  reportLanguageValidator,
  workspaceMemberRoleValidator,
} from "../src/lib/convex-schema-values.ts"

const tableNames = Object.keys(schema.tables).sort()

assert.deepEqual(tableNames, [
  "auditAgentRuns",
  "auditAssets",
  "auditBusinessData",
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
  "campaignLeads",
  "campaigns",
  "creditBalances",
  "creditLedger",
  "leadActivities",
  "leadSearchSnapshots",
  "leads",
  "outreachDrafts",
  "providerCalls",
  "reportViews",
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

const auditsTable = schema.tables.audits as any
const auditsIndexes = (auditsTable.indexes as Array<{ indexDescriptor: string; fields: string[] }>).map(
  (index) => [index.indexDescriptor, index.fields] as const,
)

assert.ok(auditsIndexes.some(([name, fields]) => name === "by_publicSlug" && fields[0] === "publicSlug"))
assert.ok(auditsIndexes.some(([name, fields]) => name === "by_workspaceId_and_status" && fields.join(",") === "workspaceId,status"))
assert.ok(auditsIndexes.some(([name, fields]) => name === "by_workspaceId_and_createdAt" && fields.join(",") === "workspaceId,createdAt"))
assert.ok(auditsIndexes.some(([name, fields]) => name === "by_workspaceId_and_idempotencyKey" && fields.join(",") === "workspaceId,idempotencyKey"))

const creditLedgerIndexes = (schema.tables.creditLedger as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(creditLedgerIndexes.includes("by_workspaceId_and_auditId"))
assert.ok(creditLedgerIndexes.includes("by_workspaceId_and_subscriptionId"))

const auditAssetsIndexes = (schema.tables.auditAssets as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(auditAssetsIndexes.includes("by_auditId_and_type"))

const usageEventsTable = schema.tables.usageEvents
assert.ok(
  (usageEventsTable as any).indexes.some(
    (index: { indexDescriptor: string }) => index.indexDescriptor === "by_workspaceId_and_event",
  ),
)
assert.ok(
  (usageEventsTable as any).indexes.some(
    (index: { indexDescriptor: string }) => index.indexDescriptor === "by_workspaceId_and_createdAt",
  ),
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

const leadSearchSnapshotIndexes = (schema.tables.leadSearchSnapshots as any).indexes.map(
  (index: { indexDescriptor: string }) => index.indexDescriptor,
)
assert.ok(leadSearchSnapshotIndexes.includes("by_workspaceId"))
assert.ok(leadSearchSnapshotIndexes.includes("by_workspaceId_and_campaignId"))
assert.ok(leadSearchSnapshotIndexes.includes("by_workspaceId_and_updatedAt"))
assert.ok(leadSearchSnapshotIndexes.includes("by_campaignId"))
