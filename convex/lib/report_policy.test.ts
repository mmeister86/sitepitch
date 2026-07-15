import { describe, expect, test } from "vitest"

import {
  normalizeHiddenSections,
  normalizeReportColor,
  reportFeaturePolicy,
} from "./report_policy"

describe("report feature policy", () => {
  test.each(["free", "starter"] as const)("%s receives only the standard report", (plan) => {
    expect(reportFeaturePolicy(plan)).toEqual({
      themes: false,
      customColors: false,
      sectionVisibility: false,
      intro: false,
      campaignCta: false,
      passwordProtection: false,
      expiration: false,
      pdfExport: false,
      poweredByToggle: false,
      customDomain: false,
    })
  })

  test("pro receives report customization but not agency white-label features", () => {
    expect(reportFeaturePolicy("pro")).toMatchObject({
      themes: true,
      customColors: true,
      sectionVisibility: true,
      intro: true,
      campaignCta: true,
      passwordProtection: true,
      expiration: true,
      pdfExport: true,
      poweredByToggle: false,
      customDomain: false,
    })
  })

  test("agency receives all report capabilities", () => {
    expect(Object.values(reportFeaturePolicy("agency"))).not.toContain(false)
  })

  test("scale remains outside agency-only packaging", () => {
    expect(reportFeaturePolicy("scale")).toMatchObject({
      pdfExport: true,
      poweredByToggle: false,
      customDomain: false,
    })
  })
})

describe("report setting validation", () => {
  test("normalizes colors and section order", () => {
    expect(normalizeReportColor(" #AABBCC ", "Primärfarbe")).toBe("#aabbcc")
    expect(normalizeHiddenSections(["cta", "score", "cta"])).toEqual(["score", "cta"])
  })

  test("keeps at least one core section visible", () => {
    expect(() => normalizeHiddenSections(["score", "summary", "findings", "next_steps"]))
      .toThrow(/Kernsektion/)
  })
})
