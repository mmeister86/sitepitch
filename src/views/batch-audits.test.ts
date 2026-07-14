import { describe, expect, test } from "vitest"

import { batchProgress, formatUsd } from "../lib/batch-audits"

describe("batch audit presentation helpers", () => {
  test("counts every terminal item toward progress", () => {
    expect(batchProgress({ totalItems: 10, completedItems: 5, failedItems: 2, cancelledItems: 1 })).toBe(80)
  })

  test("guards empty and inconsistent counters", () => {
    expect(batchProgress({ totalItems: 0, completedItems: 0, failedItems: 0, cancelledItems: 0 })).toBe(0)
    expect(batchProgress({ totalItems: 2, completedItems: 3, failedItems: 0, cancelledItems: 0 })).toBe(100)
  })

  test("distinguishes an unknown cost from a zero cost", () => {
    expect(formatUsd()).toBe("Noch offen")
    expect(formatUsd(0)).not.toBe("Noch offen")
  })
})
