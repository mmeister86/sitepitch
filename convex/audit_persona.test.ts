import assert from "node:assert/strict"

import { describe, test } from "vitest"

import { personaPanelOutputSchema, safeParsePersonaPanel, validatePersonaEvidence, type PersonaReviewOutput } from "./lib/audit_persona_schemas"
import { PERSONA_DEFINITIONS, PERSONA_IDS, type PersonaId } from "./lib/audit_personas"
import { buildPersonaSystemPrompt } from "./lib/audit_persona_prompt"
import { reviewTextsClaimSafety } from "./lib/audit_agent_claim_safety"
import { generateDeterministicPersonaPanel } from "./lib/audit_persona_fallback"
import type { AuditAgentContext } from "./audit_agent"
import { buildEvidenceRefs } from "./lib/audit_agent_evidence"
import type { CheckInput } from "./lib/audit_scoring"

function checks(): CheckInput[] {
  return [
    { category: "conversion", key: "primary_cta", label: "Primärer Call-to-Action sichtbar", status: "warning", evidence: "Kein CTA gefunden" },
    { category: "seo", key: "title_length", label: "Title-Länge plausibel", status: "warning", evidence: "20 Zeichen" },
    { category: "trust", key: "imprint", label: "Impressum verlinkt", status: "passed", evidence: "Impressum vorhanden" },
  ]
}

function validReview(overrides: Partial<PersonaReviewOutput> = {}): PersonaReviewOutput {
  return {
    personaId: "busy_owner",
    personaName: "Vielbeschäftigte:r Geschäftsinhaber:in",
    lens: "Hat wenig Zeit.",
    verdict: "Angebot schnell erkennbar, Kontaktweg könnte prominenter sein.",
    positives: ["Leistungen klar benannt."],
    frictionPoints: ["Kontaktbereich unter dem Fold."],
    topRecommendation: "Kontakt oben fixieren.",
    evidenceRefs: ["conversion:primary_cta"],
    confidence: "medium",
    ...overrides,
  }
}

describe("persona definitions", () => {
  test("defines exactly four personas with unique ids", () => {
    assert.equal(PERSONA_DEFINITIONS.length, 4)
    const ids = new Set(PERSONA_DEFINITIONS.map((p: { id: string }) => p.id))
    assert.equal(ids.size, 4)
    assert.deepEqual(PERSONA_IDS, ["busy_owner", "mobile_customer", "skeptical_buyer", "search_visitor"])
  })

  test("each persona has de and en text", () => {
    for (const persona of PERSONA_DEFINITIONS) {
      assert.ok(persona.name.de.length > 0)
      assert.ok(persona.name.en.length > 0)
      assert.ok(persona.lens.de.length > 0)
      assert.ok(persona.lens.en.length > 0)
      assert.ok(persona.focus.de.length > 0)
      assert.ok(persona.focus.en.length > 0)
    }
  })
})

describe("personaPanelOutputSchema", () => {
  test("accepts a valid panel with all four personas", () => {
    const reviews = PERSONA_IDS.map((id: PersonaId) => validReview({ personaId: id }))
    const parsed = personaPanelOutputSchema.safeParse({ reviews })
    assert.ok(parsed.success)
  })

  test("rejects a review with no frictionPoints", () => {
    const reviews = [validReview({ frictionPoints: [] })]
    const parsed = personaPanelOutputSchema.safeParse({ reviews })
    assert.ok(!parsed.success)
  })

  test("rejects a review with no evidenceRefs", () => {
    const reviews = [validReview({ evidenceRefs: [] })]
    const parsed = personaPanelOutputSchema.safeParse({ reviews })
    assert.ok(!parsed.success)
  })

  test("safeParsePersonaPanel returns error string on failure", () => {
    const result = safeParsePersonaPanel({ reviews: [] })
    assert.ok(!result.ok)
    assert.ok(result.error.length > 0)
  })
})

describe("validatePersonaEvidence", () => {
  test("passes when evidenceRefs touch stored checks", () => {
    const refs = buildEvidenceRefs(checks())
    const issues = validatePersonaEvidence([validReview()], refs)
    assert.equal(issues.length, 0)
  })

  test("passes when evidenceRefs contain a stored label substring", () => {
    const refs = buildEvidenceRefs(checks())
    const reviews = [validReview({ evidenceRefs: ["Primärer Call-to-Action"] })]
    const issues = validatePersonaEvidence(reviews, refs)
    assert.equal(issues.length, 0)
  })

  test("flags reviews with no stored evidence reference", () => {
    const refs = buildEvidenceRefs(checks())
    const reviews = [validReview({ evidenceRefs: ["completely_invented_evidence"] })]
    const issues = validatePersonaEvidence(reviews, refs)
    assert.equal(issues.length, 1)
    assert.equal(issues[0]!.personaId, "busy_owner")
  })
})

describe("persona claim safety", () => {
  test("passes for constructive language", () => {
    const texts = [{ text: "Kontaktbereich könnte prominenter sein.", path: "reviews[0].verdict" }]
    const result = reviewTextsClaimSafety(texts)
    assert.ok(result.ok)
  })

  test("flags shaming language", () => {
    const texts = [{ text: "Die Website ist peinlich.", path: "reviews[0].verdict" }]
    const result = reviewTextsClaimSafety(texts)
    assert.ok(!result.ok)
    assert.equal(result.issues[0]!.path, "reviews[0].verdict")
  })

  test("flags guaranteed revenue claims", () => {
    const texts = [{ text: "garantiert mehr Anfragen", path: "reviews[0].topRecommendation" }]
    const result = reviewTextsClaimSafety(texts)
    assert.ok(!result.ok)
  })
})

describe("persona prompt builder", () => {
  test("includes all persona ids in system prompt (de)", () => {
    const prompt = buildPersonaSystemPrompt("de")
    for (const id of PERSONA_IDS) {
      assert.ok(prompt.includes(id), `prompt should mention ${id}`)
    }
  })

  test("includes all persona ids in system prompt (en)", () => {
    const prompt = buildPersonaSystemPrompt("en")
    for (const id of PERSONA_IDS) {
      assert.ok(prompt.includes(id), `prompt should mention ${id}`)
    }
  })

  test("mentions claim safety rules", () => {
    const prompt = buildPersonaSystemPrompt("de")
    assert.ok(prompt.includes("Claim Safety"))
    assert.ok(prompt.includes("evidenceRefs"))
  })
})

describe("generateDeterministicPersonaPanel", () => {
  function baseContext(overrides: Partial<AuditAgentContext> = {}): AuditAgentContext {
    return {
      auditId: "audit1",
      workspaceId: "workspace1",
      domain: "example.com",
      normalizedUrl: "https://example.com/",
      reportLanguage: "de",
      publicSlug: "example",
      isPublic: false,
      overallScore: 58,
      workspace: { name: "Seed Studio" },
      categoryScores: {
        conversion: 40,
        seo: 55,
        local_seo: 60,
        performance: 70,
        mobile: 65,
        trust: 80,
      },
      scoringVersion: "2026.07.1",
      checks: [
        { category: "conversion", key: "primary_cta", label: "Primärer CTA", status: "failed", evidence: "Kein CTA" },
        { category: "seo", key: "title_length", label: "Title-Länge", status: "warning", evidence: "20 Zeichen" },
        { category: "trust", key: "imprint", label: "Impressum", status: "passed", evidence: "Vorhanden" },
      ],
      signals: {},
      business: undefined,
      performance: {},
      screenshots: {},
      ...overrides,
    } as AuditAgentContext
  }

  test("produces one review per persona", () => {
    const output = generateDeterministicPersonaPanel(baseContext())
    assert.equal(output.reviews.length, 4)
    assert.deepEqual(
      output.reviews.map((r) => r.personaId),
      PERSONA_IDS,
    )
  })

  test("produces reviews that pass schema validation", () => {
    const output = generateDeterministicPersonaPanel(baseContext())
    const parsed = personaPanelOutputSchema.safeParse(output)
    assert.ok(parsed.success, JSON.stringify(parsed.error?.issues))
  })

  test("uses reportLanguage for persona names and lenses", () => {
    const de = generateDeterministicPersonaPanel(baseContext({ reportLanguage: "de" }))
    const en = generateDeterministicPersonaPanel(baseContext({ reportLanguage: "en" }))
    assert.ok(de.reviews[0]!.personaName.includes("Geschäftsinhaber"))
    assert.ok(en.reviews[0]!.personaName.includes("business owner"))
  })

  test("references at least one stored check per review", () => {
    const output = generateDeterministicPersonaPanel(baseContext())
    for (const review of output.reviews) {
      assert.ok(review.evidenceRefs.length > 0, `${review.personaId} has no evidenceRefs`)
    }
  })

  test("adapts friction and confidence based on category scores", () => {
    const lowTrust = generateDeterministicPersonaPanel(
      baseContext({
        categoryScores: { ...baseContext().categoryScores, trust: 30 },
      }),
    )
    const skeptical = lowTrust.reviews.find((r) => r.personaId === "skeptical_buyer")!
    assert.equal(skeptical.confidence, "low")
    assert.ok(skeptical.frictionPoints.length > 0)
  })

  test("uses cautious, claim-safe language", () => {
    const output = generateDeterministicPersonaPanel(baseContext({ reportLanguage: "en" }))
    const allText = output.reviews
      .flatMap((r) => [r.verdict, r.topRecommendation, ...r.frictionPoints, ...r.positives])
      .join(" ")
    const safety = reviewTextsClaimSafety([
      { text: allText, path: "fallback" },
    ])
    assert.ok(safety.ok, JSON.stringify(safety.issues))
  })
})
