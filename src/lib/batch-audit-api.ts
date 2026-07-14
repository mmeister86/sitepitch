import type { DefaultFunctionArgs, FunctionReference } from "convex/server"

import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import type {
  BatchAuditItemStatus,
  BatchAuditJobStatus,
  BatchAuditQaStatus,
  BatchAuditSource,
} from "./batch-audits"

export type BatchAuditType = "standard" | "local" | "quick"
export type BatchReportLanguage = "de" | "en"

export type BatchSourceArgs = {
  source: BatchAuditSource
  campaignId?: Id<"campaigns">
  campaignLeadIds?: Id<"campaignLeads">[]
  urls?: string[]
  auditType: BatchAuditType
  reportLanguage: BatchReportLanguage
}

export type BatchPreviewItem = {
  position: number
  sourceIndex?: number
  url: string
  normalizedUrl?: string
  domain?: string
  campaignLeadId?: Id<"campaignLeads">
  leadId?: Id<"leads">
}

export type BatchInvalidItem = {
  position: number
  sourceIndex?: number
  input?: string
  url?: string
  code?: string
  reason?: string
  message: string
  errorMessage?: string
}

export type BatchPreview = {
  effectiveItems: BatchPreviewItem[]
  invalidItems: BatchInvalidItem[]
  allowed: boolean
  plan: string
  planLimit: number
  maxParallelism: number
  estimatedCredits: number
  availableCredits: number
  shortfall: number
  effectiveReportLanguage: BatchReportLanguage
  estimatedCostUsd: number
  costPricingVersion: string
  blockReasons?: string[]
  blockingCode: string | null
}

export type BatchJob = {
  _id: Id<"batchAuditJobs">
  campaignId?: Id<"campaigns">
  campaignName?: string
  source: BatchAuditSource
  planSnapshot: string
  planLimitSnapshot: number
  maxParallelismSnapshot: number
  auditType: BatchAuditType
  reportLanguage: BatchReportLanguage
  status: BatchAuditJobStatus
  totalItems: number
  queuedItems: number
  runningItems: number
  completedItems: number
  failedItems: number
  cancelledItems: number
  initialReservedCredits: number
  reservedCredits: number
  consumedCredits: number
  refundedCredits: number
  estimatedCostUsd?: number
  actualCostUsd?: number
  providerRequestCount?: number
  cacheHitItems: number
  cacheHitOperations: number
  qaSelectedItems: number
  qaPassedItems: number
  qaFailedItems: number
  startedAt?: number
  completedAt?: number
  cancelledAt?: number
  createdAt: number
  updatedAt: number
}

export type BatchItem = {
  _id: Id<"batchAuditItems">
  leadId?: Id<"leads">
  campaignLeadId?: Id<"campaignLeads">
  position: number
  url: string
  normalizedUrl: string
  domain: string
  status: BatchAuditItemStatus
  attemptCount: number
  manualRetryCount: number
  auditId?: Id<"audits">
  previousAuditId?: Id<"audits">
  errorCode?: string
  errorMessage?: string
  retryable?: boolean
  cacheHitCount: number
  qaSelected: boolean
  qaStatus: BatchAuditQaStatus
  startedAt?: number
  completedAt?: number
  createdAt: number
  updatedAt: number
}

type QueryRef<Args extends DefaultFunctionArgs, Result> = FunctionReference<"query", "public", Args, Result>
type MutationRef<Args extends DefaultFunctionArgs, Result = unknown> = FunctionReference<"mutation", "public", Args, Result>
type ActionRef<Args extends DefaultFunctionArgs, Result> = FunctionReference<"action", "public", Args, Result>

type BatchAuditApi = {
  previewBatch: ActionRef<BatchSourceArgs, BatchPreview>
  startBatch: ActionRef<BatchSourceArgs & { idempotencyKey: string }, {
    batchAuditJobId: Id<"batchAuditJobs">
    status: BatchAuditJobStatus
    totalItems: number
  }>
  listMyBatches: QueryRef<Record<string, never>, { items: BatchJob[]; total: number }>
  getBatch: QueryRef<{ batchAuditJobId: Id<"batchAuditJobs"> }, { job: BatchJob; items: BatchItem[] } | null>
  pauseBatch: MutationRef<{ batchAuditJobId: Id<"batchAuditJobs"> }>
  resumeBatch: MutationRef<{ batchAuditJobId: Id<"batchAuditJobs"> }>
  cancelBatch: MutationRef<{ batchAuditJobId: Id<"batchAuditJobs"> }>
  retryBatchItem: MutationRef<{ batchAuditItemId: Id<"batchAuditItems"> }>
}

// The backend module is developed in parallel. Keeping its expected public contract
// explicit here lets the UI remain strict before Convex codegen sees the new module.
export const batchAuditApi = (api as unknown as { batch_audits: BatchAuditApi }).batch_audits
