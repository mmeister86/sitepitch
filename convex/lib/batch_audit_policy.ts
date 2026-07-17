import type { SubscriptionPlan } from "./rate_limit_helpers"

export const MIN_BATCH_AUDIT_ITEMS = 2
export const MAX_BATCH_AUDIT_ITEMS = 100
export const MAX_MANUAL_BATCH_ITEM_RETRIES = 2

export type BatchAuditPlanPolicy = {
  enabled: boolean
  maxItems: number
  maxParallelism: number
}

const POLICY_BY_PLAN: Record<SubscriptionPlan, BatchAuditPlanPolicy> = {
  free: { enabled: false, maxItems: 0, maxParallelism: 0 },
  starter: { enabled: false, maxItems: 0, maxParallelism: 0 },
  pro: { enabled: false, maxItems: 0, maxParallelism: 0 },
  agency: { enabled: true, maxItems: 100, maxParallelism: 4 },
  scale: { enabled: true, maxItems: 100, maxParallelism: 4 },
}

const NON_RETRYABLE_ERROR_CODES = new Set([
  "AUDIT_DELETION_PENDING",
  "BATCH_CANCELLED",
  "FORBIDDEN",
  "INVALID_CAMPAIGN_CONTEXT",
  "INVALID_URL",
  "LEAD_WEBSITE_REQUIRED",
  "NOT_FOUND",
  "UNAUTHENTICATED",
  "UNSAFE_URL",
  "VALIDATION_ERROR",
])

export function getBatchAuditPlanPolicy(plan: SubscriptionPlan): BatchAuditPlanPolicy {
  return POLICY_BY_PLAN[plan]
}

export function validateBatchAuditSize(
  plan: SubscriptionPlan,
  itemCount: number,
): { ok: true; policy: BatchAuditPlanPolicy } | { ok: false; code: string; policy: BatchAuditPlanPolicy } {
  const policy = getBatchAuditPlanPolicy(plan)
  if (!policy.enabled) return { ok: false, code: "BATCH_PLAN_REQUIRED", policy }
  if (!Number.isInteger(itemCount) || itemCount < MIN_BATCH_AUDIT_ITEMS) {
    return { ok: false, code: "BATCH_TOO_SMALL", policy }
  }
  if (itemCount > policy.maxItems || itemCount > MAX_BATCH_AUDIT_ITEMS) {
    return { ok: false, code: "BATCH_PLAN_LIMIT_EXCEEDED", policy }
  }
  return { ok: true, policy }
}

export function isSafeBatchItemRetry(errorCode?: string): boolean {
  if (!errorCode) return true
  return !NON_RETRYABLE_ERROR_CODES.has(errorCode.trim().toUpperCase())
}

export function terminalBatchStatus(args: {
  totalItems: number
  completedItems: number
  failedItems: number
  cancelledItems: number
}): "completed" | "failed" | null {
  const terminalItems = args.completedItems + args.failedItems + args.cancelledItems
  if (terminalItems < args.totalItems) return null
  if (args.completedItems === 0 && args.failedItems > 0) return "failed"
  return "completed"
}
