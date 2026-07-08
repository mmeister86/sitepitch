import assert from "node:assert/strict"

import { describe, test } from "vitest"

import {
  designCritiqueOutputSchema,
  safeParseDesignCritique,
  validateDesignCritiqueEvidence,
  type DesignCritiqueOutput,
} from "./lib/audit_design_critique_schemas"
import { buildDesignCritiqueSystemPrompt } from "./lib/audit_design_critique_prompt"
import { reviewTextsClaimSafety } from "./lib/audit_agent_claim_safety"
import { buildEvidenceRefs } from "./lib/audit_agent_evidence"
import type { CheckInput } from "./lib/audit_scoring"

function checks(): CheckInput[] {
  return [
    { category: "conversion", key: "hero_value_proposition", label: "Eindeutiges Nutzenversprechen im Hero", status: "warning", evidence: "Zu kurz" },
    { category: "conversion", key: "primary_cta", label: "Primärer Call-to-Action sichtbar", status: "warning", evidence: "Mehr erfahren" },
    { category: "mobile", key: "viewport_meta", label: "Viewport-Meta vorhanden", status: "passed", evidence: "width=device-width" },
    { category: "seo", key: "title_length", label: "Title-Länge plausibel", status: "warning", evidence: "20 Zeichen" },
  ]
}

function heuristics() {
  const names = [
    "Visibility of System Status",
    "Match Between System and Real World",
    "User Control and Freedom",
    "Consistency and Standards",
    "Error Prevention",
    "Recognition Rather Than Recall",
    "Flexibility and Efficiency of Use",
    "Aesthetic and Minimalist Design",
    "Help Users Recognize, Diagnose, and Recover from Errors",
    "Help and Documentation",
  ]
  return names.map((name) => ({ name, score: 3, keyIssue: "Konkrete Beobachtung." }))
}

function validCritique(overrides: Partial<DesignCritiqueOutput> = {}): DesignCritiqueOutput {
  return {
    designHealthScore: 28,
    ratingBand: "Good",
    overallImpression: "Solide Basis mit Potenzial bei der Hero-Klarheit.",
    heuristicScores: heuristics(),
    cognitiveLoad: { failedCount: 2, level: "moderate", notes: "Einige Entscheidungen könnten gruppiert werden." },
    antiPatternVerdict: "Das Layout wirkt eigenständig, keine typischen Template-Merkmale.",
    whatsWorking: ["Klare Leistungsnennung."],
    priorityIssues: [
      {
        severity: "P1",
        title: "Hero-Nutzen könnte prominenter sein",
        whyItMatters: "Besucher erkennen das Angebot sonst verzögert.",
        fix: "Nutzenversprechen größer und weiter oben platzieren.",
        evidenceRefs: ["conversion:hero_value_proposition"],
      },
    ],
    recommendations: ["Hero-Headline konkreter formulieren."],
    evidenceRefs: ["conversion:hero_value_proposition"],
    ...overrides,
  }
}

describe("designCritiqueOutputSchema", () => {
  test("accepts a valid critique", () => {
    const parsed = designCritiqueOutputSchema.safeParse(validCritique())
    assert.ok(parsed.success)
  })

  test("rejects a critique with fewer than 10 heuristic scores", () => {
    const parsed = designCritiqueOutputSchema.safeParse(
      validCritique({ heuristicScores: heuristics().slice(0, 9) }),
    )
    assert.ok(!parsed.success)
  })

  test("rejects an out-of-range design health score", () => {
    const parsed = designCritiqueOutputSchema.safeParse(validCritique({ designHealthScore: 50 }))
    assert.ok(!parsed.success)
  })

  test("rejects a critique with no priority issues", () => {
    const parsed = designCritiqueOutputSchema.safeParse(validCritique({ priorityIssues: [] }))
    assert.ok(!parsed.success)
  })

  test("rejects a critique with no evidenceRefs", () => {
    const parsed = designCritiqueOutputSchema.safeParse(validCritique({ evidenceRefs: [] }))
    assert.ok(!parsed.success)
  })

  test("safeParseDesignCritique returns error string on failure", () => {
    const result = safeParseDesignCritique({ ratingBand: "ok" })
    assert.ok(!result.ok)
    assert.ok(result.error.length > 0)
  })
})

describe("validateDesignCritiqueEvidence", () => {
  test("passes when evidenceRefs touch stored checks", () => {
    const refs = buildEvidenceRefs(checks())
    const issues = validateDesignCritiqueEvidence(validCritique(), refs)
    assert.equal(issues.length, 0)
  })

  test("passes when evidenceRefs contain a stored label substring", () => {
    const refs = buildEvidenceRefs(checks())
    const critique = validCritique({
      evidenceRefs: ["Nutzenversprechen im Hero"],
      priorityIssues: [
        {
          severity: "P1",
          title: "Hero",
          whyItMatters: "x",
          fix: "y",
          evidenceRefs: ["Primärer Call-to-Action sichtbar"],
        },
      ],
    })
    const issues = validateDesignCritiqueEvidence(critique, refs)
    assert.equal(issues.length, 0)
  })

  test("allows priority issues derived from screenshots or heuristics without a stored check", () => {
    const refs = buildEvidenceRefs(checks())
    const critique = validCritique({
      evidenceRefs: ["conversion:hero_value_proposition"],
      priorityIssues: [
        {
          severity: "P2",
          title: "Hilfe und Dokumentation kaum sichtbar",
          whyItMatters: "Besucher finden keine Unterstützung bei Problemen.",
          fix: "Hilfe-Bereich zugänglicher platzieren.",
          evidenceRefs: ["heuristic:help-documentation"],
        },
      ],
    })
    const issues = validateDesignCritiqueEvidence(critique, refs)
    assert.equal(issues.length, 0)
  })

  test("flags critique with no stored evidence reference", () => {
    const refs = buildEvidenceRefs(checks())
    const critique = validCritique({
      evidenceRefs: ["completely_invented"],
      priorityIssues: [
        {
          severity: "P1",
          title: "x",
          whyItMatters: "y",
          fix: "z",
          evidenceRefs: ["also_invented"],
        },
      ],
    })
    const issues = validateDesignCritiqueEvidence(critique, refs)
    assert.ok(issues.length > 0)
  })
})

describe("design critique claim safety", () => {
  test("passes for constructive language", () => {
    const texts = [{ text: "Das Layout könnte mehr Hierarchie vertragen.", path: "overallImpression" }]
    const result = reviewTextsClaimSafety(texts)
    assert.ok(result.ok)
  })

  test("flags shaming language", () => {
    const texts = [{ text: "Die Seite wirkt peinlich und unprofessionell.", path: "antiPatternVerdict" }]
    const result = reviewTextsClaimSafety(texts)
    assert.ok(!result.ok)
  })
})

describe("design critique prompt builder", () => {
  test("includes heuristics and dimensions in system prompt (de)", () => {
    const prompt = buildDesignCritiqueSystemPrompt("de")
    assert.ok(prompt.includes("Nielsen"))
    assert.ok(prompt.includes("designHealthScore"))
    assert.ok(prompt.includes("priorityIssues"))
    assert.ok(prompt.includes("Claim Safety"))
  })

  test("includes dimensions in system prompt (en)", () => {
    const prompt = buildDesignCritiqueSystemPrompt("en")
    assert.ok(prompt.includes("designHealthScore"))
    assert.ok(prompt.includes("evidenceRefs"))
  })
})
