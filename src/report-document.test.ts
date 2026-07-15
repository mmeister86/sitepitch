import { describe, expect, it } from "vitest"

import {
  isReportSectionVisible,
  reportHasMinimumVisibleContent,
  sanitizeReportFilename,
} from "./lib/report-document"

describe("report document safety helpers", () => {
  it("requires one core report section", () => {
    expect(reportHasMinimumVisibleContent(["score", "summary", "findings"])).toBe(true)
    expect(reportHasMinimumVisibleContent(["score", "summary", "findings", "next_steps"])).toBe(false)
  })

  it("resolves stable section visibility", () => {
    const report = { hiddenSections: ["screenshots"] as const }
    expect(isReportSectionVisible(report, "screenshots")).toBe(false)
    expect(isReportSectionVisible(report, "summary")).toBe(true)
  })

  it("creates a header-safe deterministic filename", () => {
    expect(sanitizeReportFilename(" ACME / Example.COM ", Date.UTC(2026, 6, 14)))
      .toBe("acme-example.com-audit-2026-07-14.pdf")
  })
})
