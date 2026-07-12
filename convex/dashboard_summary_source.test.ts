import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

describe("dashboard summary query shape", () => {
  test("uses constant workspace aggregation and limits per-audit lookups to the recent slice", () => {
    const source = readFileSync(new URL("./reports.ts", import.meta.url), "utf8")
    const summary = source.slice(
      source.indexOf("export const getDashboardSummary"),
      source.indexOf("// Dashboard: getDashboardEngagement"),
    )
    expect(summary).toContain("const recentSlice = allAudits.slice(0, 5)")
    expect(summary).toContain("loadWorkspaceReportViewCount(ctx, workspace._id)")
    expect(summary).not.toContain("for (const audit of allAudits)")
    expect(summary).not.toContain(".collect()")
  })
})
