import { describe, expect, test } from "vitest"

import {
  estimateBatchAuditCostUsd,
  PROVIDER_COST_RATE_VERSION,
} from "./provider_cost_rates"

describe("batch audit provider cost estimate", () => {
  test("uses the versioned one-pass token budget for every audit type", () => {
    expect(PROVIDER_COST_RATE_VERSION).toBe("2026-07-11")
    expect(estimateBatchAuditCostUsd("quick", 1)).toBe(0.0093)
    expect(estimateBatchAuditCostUsd("standard", 1)).toBe(0.012)
    expect(estimateBatchAuditCostUsd("local", 1)).toBe(0.0123)
  })

  test("multiplies only the effective item count and rounds to six decimals", () => {
    expect(estimateBatchAuditCostUsd("standard", 3)).toBe(0.036)
    expect(estimateBatchAuditCostUsd("local", 25)).toBe(0.3075)
    expect(estimateBatchAuditCostUsd("local", 100)).toBe(1.23)
  })

  test("returns zero for an empty or invalid count", () => {
    expect(estimateBatchAuditCostUsd("quick", 0)).toBe(0)
    expect(estimateBatchAuditCostUsd("quick", -1)).toBe(0)
    expect(estimateBatchAuditCostUsd("quick", Number.NaN)).toBe(0)
  })
})
