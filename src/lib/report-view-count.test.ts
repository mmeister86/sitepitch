import { describe, expect, test } from "vitest"

import { formatReportViewCount } from "./report-view-count"

describe("formatReportViewCount", () => {
  test("never presents a pending count as exact", () => {
    expect(formatReportViewCount(42, false, true)).toBe("Wird aktualisiert")
  })

  test("marks capped stable counts and preserves exact stable counts", () => {
    expect(formatReportViewCount(500, true, false)).toBe("500+")
    expect(formatReportViewCount(7, false, false)).toBe("7")
  })
})
