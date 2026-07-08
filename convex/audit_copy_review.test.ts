import assert from "node:assert/strict"

import { describe, test } from "vitest"

import { copyReviewOutputSchema, safeParseCopyReview, validateCopyEvidence, type CopyReviewOutput } from "./lib/audit_copy_review_schemas"
import { buildCopyReviewSystemPrompt } from "./lib/audit_copy_review_prompt"
import { reviewTextsClaimSafety } from "./lib/audit_agent_claim_safety"
import { buildEvidenceRefs } from "./lib/audit_agent_evidence"
import type { CheckInput } from "./lib/audit_scoring"

function checks(): CheckInput[] {
  return [
    { category: "conversion", key: "hero_value_proposition", label: "Eindeutiges Nutzenversprechen im Hero", status: "warning", evidence: "Zu kurz" },
    { category: "conversion", key: "primary_cta", label: "Primärer Call-to-Action sichtbar", status: "warning", evidence: "Mehr erfahren" },
    { category: "seo", key: "meta_length", label: "Meta-Description-Länge plausibel", status: "warning", evidence: "20 Zeichen" },
  ]
}

function validReview(overrides: Partial<CopyReviewOutput> = {}): CopyReviewOutput {
  return {
    heroClarity: "Die Hero-Headline nennt keinen klaren Kundennutzen.",
    valueProposition: "Das Nutzenversprechen könnte konkreter sein.",
    offerClarity: "Das Angebot wird nicht sofort erkennbar.",
    ctaClarity: "Der CTA ist generisch ('Mehr erfahren').",
    snippetClarity: "Title und Meta Description sind zu kurz.",
    overallVerdict: "Die Copy hat Potenzial bei Hero-Klarheit und CTA-Wording.",
    recommendations: [
      "Hero-Headline konkreter formulieren.",
      "CTA handlungsorientierter gestalten.",
    ],
    evidenceRefs: ["conversion:hero_value_proposition"],
    ...overrides,
  }
}

describe("copyReviewOutputSchema", () => {
  test("accepts a valid review", () => {
    const parsed = copyReviewOutputSchema.safeParse(validReview())
    assert.ok(parsed.success)
  })

  test("rejects a review with no recommendations", () => {
    const parsed = copyReviewOutputSchema.safeParse(validReview({ recommendations: [] }))
    assert.ok(!parsed.success)
  })

  test("rejects a review with no evidenceRefs", () => {
    const parsed = copyReviewOutputSchema.safeParse(validReview({ evidenceRefs: [] }))
    assert.ok(!parsed.success)
  })

  test("safeParseCopyReview returns error string on failure", () => {
    const result = safeParseCopyReview({ heroClarity: "ok" })
    assert.ok(!result.ok)
    assert.ok(result.error.length > 0)
  })
})

describe("validateCopyEvidence", () => {
  test("passes when evidenceRefs touch stored checks", () => {
    const refs = buildEvidenceRefs(checks())
    const issues = validateCopyEvidence(validReview(), refs)
    assert.equal(issues.length, 0)
  })

  test("passes when evidenceRefs contain a stored label substring", () => {
    const refs = buildEvidenceRefs(checks())
    const review = validReview({ evidenceRefs: ["Nutzenversprechen im Hero"] })
    const issues = validateCopyEvidence(review, refs)
    assert.equal(issues.length, 0)
  })

  test("flags review with no stored evidence reference", () => {
    const refs = buildEvidenceRefs(checks())
    const review = validReview({ evidenceRefs: ["completely_invented"] })
    const issues = validateCopyEvidence(review, refs)
    assert.equal(issues.length, 1)
  })
})

describe("copy review claim safety", () => {
  test("passes for constructive language", () => {
    const texts = [{ text: "Die Hero-Headline könnte konkreter sein.", path: "heroClarity" }]
    const result = reviewTextsClaimSafety(texts)
    assert.ok(result.ok)
  })

  test("flags shaming language", () => {
    const texts = [{ text: "Die Texte sind peinlich.", path: "overallVerdict" }]
    const result = reviewTextsClaimSafety(texts)
    assert.ok(!result.ok)
  })
})

describe("copy review prompt builder", () => {
  test("includes copy dimensions in system prompt (de)", () => {
    const prompt = buildCopyReviewSystemPrompt("de")
    assert.ok(prompt.includes("heroClarity"))
    assert.ok(prompt.includes("valueProposition"))
    assert.ok(prompt.includes("ctaClarity"))
    assert.ok(prompt.includes("Claim Safety"))
  })

  test("includes copy dimensions in system prompt (en)", () => {
    const prompt = buildCopyReviewSystemPrompt("en")
    assert.ok(prompt.includes("heroClarity"))
    assert.ok(prompt.includes("evidenceRefs"))
  })
})
