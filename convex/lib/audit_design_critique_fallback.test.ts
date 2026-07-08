import assert from "node:assert/strict"

import { describe, test } from "vitest"

import { generateDeterministicDesignCritique } from "./audit_design_critique_fallback"
import { designCritiqueOutputSchema, validateDesignCritiqueEvidence } from "./audit_design_critique_schemas"
import { buildEvidenceRefs } from "./audit_agent_evidence"
import type { CheckInput, CategoryScores } from "./audit_scoring"

function checks(): CheckInput[] {
  return [
    { category: "conversion", key: "hero_value_proposition", label: "Eindeutiges Nutzenversprechen im Hero", status: "warning", evidence: "Zu kurz", weight: 2 },
    { category: "conversion", key: "primary_cta", label: "Primärer Call-to-Action sichtbar", status: "failed", evidence: "Kein CTA", weight: 3 },
    { category: "mobile", key: "viewport_meta", label: "Viewport-Meta vorhanden", status: "passed", evidence: "width=device-width" },
    { category: "seo", key: "title_length", label: "Title-Länge plausibel", status: "passed", evidence: "45 Zeichen" },
    { category: "trust", key: "imprint_link", label: "Impressum verlinkt", status: "passed" },
  ]
}

function categoryScores(): CategoryScores {
  return {
    conversion: 55,
    seo: 72,
    local_seo: 68,
    performance: 80,
    mobile: 90,
    trust: 60,
  }
}

describe("generateDeterministicDesignCritique", () => {
  test("produces schema-valid output (de)", () => {
    const output = generateDeterministicDesignCritique({
      domain: "example.com",
      reportLanguage: "de",
      categoryScores: categoryScores(),
      overallScore: 70,
      checks: checks(),
    })

    const parsed = designCritiqueOutputSchema.safeParse(output)
    assert.ok(parsed.success)
  })

  test("produces schema-valid output (en)", () => {
    const output = generateDeterministicDesignCritique({
      domain: "example.com",
      reportLanguage: "en",
      categoryScores: categoryScores(),
      overallScore: 70,
      checks: checks(),
    })

    const parsed = designCritiqueOutputSchema.safeParse(output)
    assert.ok(parsed.success)
  })

  test("always has exactly 10 heuristic scores", () => {
    const output = generateDeterministicDesignCritique({
      domain: "example.com",
      reportLanguage: "de",
      categoryScores: categoryScores(),
      overallScore: 70,
      checks: checks(),
    })

    assert.equal(output.heuristicScores.length, 10)
  })

  test("health score equals the sum of heuristic scores", () => {
    const output = generateDeterministicDesignCritique({
      domain: "example.com",
      reportLanguage: "de",
      categoryScores: categoryScores(),
      overallScore: 70,
      checks: checks(),
    })

    const sum = output.heuristicScores.reduce((acc, h) => acc + h.score, 0)
    assert.equal(output.designHealthScore, sum)
  })

  test("evidence refs touch stored checks", () => {
    const output = generateDeterministicDesignCritique({
      domain: "example.com",
      reportLanguage: "de",
      categoryScores: categoryScores(),
      overallScore: 70,
      checks: checks(),
    })

    const refs = buildEvidenceRefs(checks())
    const issues = validateDesignCritiqueEvidence(output, refs)
    assert.equal(issues.length, 0)
  })

  test("produces output even with no failed checks", () => {
    const passedOnly: CheckInput[] = [
      { category: "conversion", key: "primary_cta", label: "Primärer Call-to-Action sichtbar", status: "passed" },
      { category: "seo", key: "title_length", label: "Title-Länge plausibel", status: "passed" },
    ]

    const output = generateDeterministicDesignCritique({
      domain: "example.com",
      reportLanguage: "de",
      categoryScores: categoryScores(),
      overallScore: 90,
      checks: passedOnly,
    })

    assert.ok(output.priorityIssues.length >= 1)
    assert.ok(output.evidenceRefs.length >= 1)
  })
})
