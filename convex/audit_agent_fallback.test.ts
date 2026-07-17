import assert from "node:assert/strict"

import { describe, test } from "vitest"

import { generateDeterministicAgentOutput } from "./lib/audit_agent_fallback"
import { auditAgentOutputSchema } from "./lib/audit_agent_schemas"
import { reviewClaimSafety } from "./lib/audit_agent_claim_safety"
import { buildEvidenceRefs, validateOutputEvidence } from "./lib/audit_agent_evidence"
import type { CheckInput, CategoryScores } from "./lib/audit_scoring"

function checks(): CheckInput[] {
  return [
    { category: "conversion", key: "clear_cta", label: "Klarer CTA", status: "failed", evidence: "Kein CTA gefunden", weight: 1.5 },
    { category: "seo", key: "meta_description", label: "Meta Description", status: "warning", evidence: "Meta Description fehlt" },
    { category: "trust", key: "imprint", label: "Impressum", status: "passed", evidence: "Impressum vorhanden" },
  ]
}

function scores(): CategoryScores {
  return { conversion: 40, seo: 55, local_seo: 60, performance: 70, mobile: 65, trust: 80 }
}

describe("deterministic fallback", () => {
  test("produces schema-valid output in German", () => {
    const output = generateDeterministicAgentOutput({
      domain: "example.com",
      reportLanguage: "de",
      reportLink: "https://trysitepitch.com/r/abc",
      workspaceName: "Studio",
      categoryScores: scores(),
      overallScore: 58,
      checks: checks(),
    })
    const parsed = auditAgentOutputSchema.safeParse(output)
    assert.ok(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues))
  })

  test("produces schema-valid output in English", () => {
    const output = generateDeterministicAgentOutput({
      domain: "example.com",
      reportLanguage: "en",
      categoryScores: scores(),
      overallScore: 58,
      checks: checks(),
    })
    const parsed = auditAgentOutputSchema.safeParse(output)
    assert.ok(parsed.success)
  })

  test("passes claim safety", () => {
    const output = generateDeterministicAgentOutput({
      domain: "example.com",
      reportLanguage: "de",
      categoryScores: scores(),
      overallScore: 58,
      checks: checks(),
    })
    const safety = reviewClaimSafety(output)
    assert.ok(safety.ok, JSON.stringify(safety.issues))
  })

  test("findings reference stored evidence", () => {
    const cs = checks()
    const output = generateDeterministicAgentOutput({
      domain: "example.com",
      reportLanguage: "de",
      categoryScores: scores(),
      overallScore: 58,
      checks: cs,
    })
    const refs = buildEvidenceRefs(cs)
    const issues = validateOutputEvidence(output, refs)
    assert.equal(issues.length, 0)
  })

  test("includes email, linkedin, phone_note outreach", () => {
    const output = generateDeterministicAgentOutput({
      domain: "example.com",
      reportLanguage: "de",
      categoryScores: scores(),
      overallScore: 58,
      checks: checks(),
    })
    const types = new Set(output.outreach.map((draft) => draft.type))
    assert.ok(types.has("email"))
    assert.ok(types.has("linkedin"))
    assert.ok(types.has("phone_note"))
  })

  test("produces subject lines", () => {
    const output = generateDeterministicAgentOutput({
      domain: "example.com",
      reportLanguage: "de",
      categoryScores: scores(),
      overallScore: 58,
      checks: checks(),
    })
    assert.ok(output.subjectLines.length >= 1)
  })
})
