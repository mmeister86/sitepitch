import { describe, expect, test } from "vitest"

import { isPublicReportPreview } from "./public-report-tracking"

describe("isPublicReportPreview", () => {
  test("only treats preview=1 as an internal preview", () => {
    expect(isPublicReportPreview(new URLSearchParams("preview=1"))).toBe(true)
    expect(isPublicReportPreview(new URLSearchParams("preview=0"))).toBe(false)
    expect(isPublicReportPreview(new URLSearchParams("preview=true"))).toBe(false)
    expect(isPublicReportPreview(new URLSearchParams())).toBe(false)
  })
})
