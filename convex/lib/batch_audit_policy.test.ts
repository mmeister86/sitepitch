import { describe, expect, test } from "vitest"

import {
  getBatchAuditPlanPolicy,
  isSafeBatchItemRetry,
  terminalBatchStatus,
  validateBatchAuditSize,
} from "./batch_audit_policy"

describe("batch audit policy", () => {
  test("gives Agency the former Scale batch profile", () => {
    expect(getBatchAuditPlanPolicy("agency")).toEqual({ enabled: true, maxItems: 100, maxParallelism: 4 })
    expect(getBatchAuditPlanPolicy("scale")).toEqual({ enabled: true, maxItems: 100, maxParallelism: 4 })
    expect(validateBatchAuditSize("pro", 2)).toMatchObject({ ok: false, code: "BATCH_PLAN_REQUIRED" })
  })

  test("accepts arbitrary sizes from two through the plan maximum", () => {
    expect(validateBatchAuditSize("agency", 2).ok).toBe(true)
    expect(validateBatchAuditSize("agency", 100).ok).toBe(true)
    expect(validateBatchAuditSize("agency", 101)).toMatchObject({ ok: false, code: "BATCH_PLAN_LIMIT_EXCEEDED" })
    expect(validateBatchAuditSize("scale", 100).ok).toBe(true)
  })

  test("only retries failures without terminal input or authorization errors", () => {
    expect(isSafeBatchItemRetry("PROVIDER_TIMEOUT")).toBe(true)
    expect(isSafeBatchItemRetry("RATE_LIMITED")).toBe(true)
    expect(isSafeBatchItemRetry("UNSAFE_URL")).toBe(false)
    expect(isSafeBatchItemRetry("FORBIDDEN")).toBe(false)
  })

  test("fails only all-failed terminal batches and completes partial-success batches", () => {
    expect(terminalBatchStatus({ totalItems: 2, completedItems: 0, failedItems: 1, cancelledItems: 0 })).toBeNull()
    expect(terminalBatchStatus({ totalItems: 2, completedItems: 0, failedItems: 2, cancelledItems: 0 })).toBe("failed")
    expect(terminalBatchStatus({ totalItems: 2, completedItems: 1, failedItems: 1, cancelledItems: 0 })).toBe("completed")
  })
})
