import { describe, expect, it } from "vitest"

import { REPORT_SECTION_KEYS } from "../lib/report-document"
import {
  resolveReportPresentation,
  type ReportPresentationInput,
} from "../lib/report-presentation"

function report(overrides: Partial<ReportPresentationInput> = {}): ReportPresentationInput {
  return {
    branding: {
      accentColor: "#2563eb",
    },
    ...overrides,
  }
}

describe("report presentation", () => {
  it("keeps secure visible legacy defaults", () => {
    const presentation = resolveReportPresentation(report())

    expect(presentation.theme).toBe("classic")
    expect(presentation.primaryColor).toBe("#2563eb")
    expect(presentation.hiddenSections.size).toBe(0)
    expect(presentation.showPoweredBy).toBe(true)
  })

  it("reads the shared public report document shape", () => {
    const presentation = resolveReportPresentation(report({
      intro: "A concise introduction",
      hiddenSections: ["screenshots", "cta"],
      theme: {
        preset: "editorial",
        primaryColor: "#b45309",
        backgroundColor: "#fffbeb",
        textColor: "#292524",
      },
      showPoweredBy: false,
    }))

    expect(presentation).toMatchObject({
      theme: "editorial",
      primaryColor: "#b45309",
      backgroundColor: "#fffbeb",
      textColor: "#292524",
      introText: "A concise introduction",
      showPoweredBy: false,
    })
    expect(presentation.hiddenSections).toEqual(new Set(["screenshots", "cta"]))
  })

  it("exposes all stable section keys exactly once", () => {
    expect(REPORT_SECTION_KEYS).toEqual([
      "score",
      "summary",
      "opportunities",
      "strengths_weaknesses",
      "screenshots",
      "findings",
      "next_steps",
      "cta",
    ])
    expect(new Set(REPORT_SECTION_KEYS).size).toBe(REPORT_SECTION_KEYS.length)
  })

  it("rejects malformed snapshot colors", () => {
    const presentation = resolveReportPresentation(report({
      theme: {
        preset: "minimal",
        primaryColor: "red",
        backgroundColor: "not-a-color",
        textColor: "#123",
      },
    }))

    expect(presentation.primaryColor).toBe("#2563eb")
    expect(presentation.backgroundColor).toBe("#f8fafc")
    expect(presentation.textColor).toBe("#172033")
  })
})
