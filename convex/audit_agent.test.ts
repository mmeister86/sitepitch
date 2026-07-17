import assert from "node:assert/strict"

import { describe, test } from "vitest"

import {
  auditAgentOutputSchema,
  safeParseAgentOutput,
  type AuditAgentOutput,
} from "./lib/audit_agent_schemas"
import { reviewClaimSafety, reviewTextsClaimSafety } from "./lib/audit_agent_claim_safety"
import { buildEvidenceRefs, validateFindingEvidence, validateOutputEvidence } from "./lib/audit_agent_evidence"
import type { CheckInput } from "./lib/audit_scoring"

function baseOutput(): AuditAgentOutput {
  return {
    findings: [
      {
        category: "conversion",
        severity: "medium",
        title: "Kontaktbereich optimieren",
        evidence: "Kontakt: clear_cta",
        evidenceRefs: ["conversion:clear_cta"],
        explanation: "Der Kontaktbereich lässt sich verbessern.",
        recommendation: "Klareren CTA setzen.",
        salesAngle: "Mehr Anfragen aus bestehendem Traffic.",
      },
    ],
    summary: {
      shortSummary: "Die Website macht einen soliden Eindruck, verschenkt aber Potenzial.",
      strengths: ["Grundstruktur ist vorhanden."],
      weaknesses: ["Kontakt lässt sich verbessern."],
      topOpportunities: ["Kontaktbereich optimieren."],
      nextSteps: ["CTA prüfen."],
      evidenceRefs: ["conversion:clear_cta"],
    },
    outreach: [
      { type: "email", subject: "Kurzer Audit", body: "Hallo Team, kurzer Audit.", evidenceRefs: ["conversion:clear_cta"] },
      { type: "linkedin", body: "Hallo, kurzer Audit.", evidenceRefs: ["conversion:clear_cta"] },
      { type: "phone_note", body: "Anruf-Notiz: Audit erstellt.", evidenceRefs: ["conversion:clear_cta"] },
    ],
    subjectLines: ["Kurzer Website-Audit"],
  }
}

describe("audit agent schema", () => {
  test("accepts a well-formed output", () => {
    const result = auditAgentOutputSchema.safeParse(baseOutput())
    assert.ok(result.success)
  })

  test("rejects output without required email/phone outreach", () => {
    const output = baseOutput()
    output.outreach = [{ type: "linkedin", body: "x", evidenceRefs: ["conversion:clear_cta"] }]
    const result = auditAgentOutputSchema.safeParse(output)
    assert.ok(!result.success)
  })

  test("rejects findings with empty title", () => {
    const output = baseOutput()
    output.findings[0].title = ""
    const result = safeParseAgentOutput(output)
    assert.ok(!result.ok)
  })

  test("rejects summary with empty strengths", () => {
    const output = baseOutput()
    output.summary.strengths = []
    const result = safeParseAgentOutput(output)
    assert.ok(!result.ok)
  })

  test("rejects subjectLines with empty strings", () => {
    const output = baseOutput()
    output.subjectLines = [""]
    const result = safeParseAgentOutput(output)
    assert.ok(!result.ok)
  })

  test("caps findings at 20", () => {
    const output = baseOutput()
    output.findings = Array.from({ length: 21 }, () => ({ ...baseOutput().findings[0] }))
    const result = safeParseAgentOutput(output)
    assert.ok(!result.ok)
  })
})

describe("claim safety", () => {
  test("passes for safe output", () => {
    const result = reviewClaimSafety(baseOutput())
    assert.ok(result.ok, JSON.stringify(result.issues))
  })

  test("blocks legal claims", () => {
    const output = baseOutput()
    output.findings[0].recommendation = "Impressum fehlt rechtswidrig."
    const result = reviewClaimSafety(output)
    assert.ok(!result.ok)
    assert.match(result.issues[0].path, /recommendation/)
  })

  test("blocks security claims", () => {
    const output = baseOutput()
    output.summary.shortSummary = "Die Website ist unsicher."
    const result = reviewClaimSafety(output)
    assert.ok(!result.ok)
  })

  test("blocks revenue guarantees", () => {
    const output = baseOutput()
    output.findings[0].salesAngle = "Garantiert mehr Umsatz."
    const result = reviewClaimSafety(output)
    assert.ok(!result.ok)
  })

  test.each([
    ["de legal", "Die Website ist rechtskonform."],
    ["en legal", "This website is legally compliant."],
    ["de privacy", "Die Seite ist DSGVO-konform."],
    ["en privacy", "The site passed a privacy assessment."],
    ["de security", "Die Website gilt als vollständig sicher."],
    ["en security", "The website passed a security audit."],
    ["de outcome", "Diese Änderung wird den Umsatz deutlich steigern."],
    ["en outcome", "This change guarantees more revenue and leads."],
  ])("blocks %s assessment or guarantee claims", (_label, text) => {
    const result = reviewTextsClaimSafety([{ text, path: "claim" }])
    assert.ok(!result.ok, text)
    assert.equal(result.issues[0]?.path, "claim")
  })

  test.each([
    "Dies ist keine Rechts-, Datenschutz- oder Sicherheitsberatung.",
    "This is not legal, privacy, or security advice and does not guarantee business results.",
    "Ein klarerer CTA könnte die Conversion unterstützen.",
    "A clearer CTA may help improve conversion.",
  ])("allows appropriately qualified language: %s", (text) => {
    const result = reviewTextsClaimSafety([{ text, path: "qualified" }])
    assert.ok(result.ok, JSON.stringify(result.issues))
  })

  test("blocks shaming language", () => {
    const output = baseOutput()
    output.summary.weaknesses[0] = "Die Website ist peinlich."
    const result = reviewClaimSafety(output)
    assert.ok(!result.ok)
  })

  test("scans outreach subjects and bodies", () => {
    const output = baseOutput()
    output.outreach[0].body = "Sie verlieren massiv Kunden."
    const result = reviewClaimSafety(output)
    assert.ok(!result.ok)
  })
})

describe("evidence validation", () => {
  const checks: CheckInput[] = [
    { category: "conversion", key: "clear_cta", label: "Klarer CTA", status: "failed", evidence: "Kein CTA gefunden", weight: 1.5 },
    { category: "seo", key: "meta_description", label: "Meta Description", status: "warning", evidence: "Meta Description fehlt" },
  ]

  test("accepts findings referencing exact stored check refs", () => {
    const refs = buildEvidenceRefs(checks)
    const findings = [
      { title: "CTA", evidenceRefs: ["conversion:clear_cta"] },
      { title: "Meta", evidenceRefs: ["seo:meta_description"] },
    ]
    const issues = validateFindingEvidence(findings, refs)
    assert.equal(issues.length, 0)
  })

  test("rejects findings with no stored evidence reference", () => {
    const refs = buildEvidenceRefs(checks)
    const findings = [
      { title: "Erfunden", evidenceRefs: ["conversion:invented"] },
    ]
    const issues = validateFindingEvidence(findings, refs)
    assert.equal(issues.length, 1)
    assert.equal(issues[0].path, "findings[0].evidenceRefs")
  })

  test("rejects labels and category-only refs instead of exact check refs", () => {
    const refs = buildEvidenceRefs(checks)
    const issues = validateFindingEvidence(
      [{ title: "CTA", evidenceRefs: ["conversion:Klarer CTA"] }],
      refs,
    )
    assert.equal(issues.length, 1)
  })

  test("validates summary and every outreach draft", () => {
    const refs = buildEvidenceRefs(checks)
    const output = baseOutput()
    output.summary.evidenceRefs = ["seo:invented"]
    output.outreach[1].evidenceRefs = ["conversion:invented"]
    const issues = validateOutputEvidence(output, refs)
    assert.deepEqual(
      issues.map((issue) => issue.path),
      ["summary.evidenceRefs", "outreach[1].evidenceRefs"],
    )
  })
})
