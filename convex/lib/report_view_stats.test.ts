import { describe, expect, test } from "vitest"

import { resolveReportViewCount, resolveWorkspaceReportViewCount } from "./report_view_stats"

describe("report view count contracts", () => {
  test("returns exact accurate aggregates without consulting raw rows", () => {
    expect(resolveReportViewCount({ totalViews: 7, viewAggregationState: "accurate" }, 101)).toEqual({
      count: 7,
      capped: false,
      pending: false,
    })
  })

  test("marks bounded legacy fallback as pending and capped", () => {
    expect(resolveReportViewCount({ totalViews: 0, viewAggregationState: "pending" }, 101)).toEqual({
      count: 100,
      capped: true,
      pending: true,
    })
  })

  test("does not claim a pre-rollout zero-only stats row is exact even without retained raw rows", () => {
    expect(resolveReportViewCount({ totalViews: 0 }, 0)).toEqual({
      count: 0,
      capped: false,
      pending: true,
    })
  })

  test("combines workspace rows without double-counting raw views behind accurate stats", () => {
    const result = resolveWorkspaceReportViewCount(
      [
        { auditId: "accurate", totalViews: 9, viewAggregationState: "accurate" },
        { auditId: "pending", totalViews: 1, viewAggregationState: "pending" },
      ],
      [
        { auditId: "accurate" },
        { auditId: "accurate" },
        { auditId: "pending" },
        { auditId: "pending" },
        { auditId: "legacy-only" },
      ],
      false,
      false,
    )
    expect(result).toEqual({ count: 12, capped: false, pending: true })
  })

  test("marks a bounded workspace scan as capped instead of claiming exactness", () => {
    const result = resolveWorkspaceReportViewCount(
      [],
      Array.from({ length: 500 }, () => ({ auditId: "legacy" })),
      false,
      true,
    )
    expect(result).toEqual({ count: 500, capped: true, pending: true })
  })
})
