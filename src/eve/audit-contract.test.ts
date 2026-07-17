import { describe, expect, it } from "vitest"

import {
  eveAuditContextSchema,
  eveAuditOutputSchema,
  validateEveAuditCandidate,
  type EveAuditOutput,
} from "../lib/eve/audit-contract"

const context = eveAuditContextSchema.parse({
  auditId: "aud_fixture",
  domain: "example.invalid",
  reportLanguage: "de",
  overallScore: 70,
  categoryScores: { conversion: 70 },
  checks: [
    {
      ref: "conversion:primary_cta",
      category: "conversion",
      key: "primary_cta",
      status: "warning",
      label: "CTA ist allgemein",
    },
  ],
})

const validOutput: EveAuditOutput = eveAuditOutputSchema.parse({
  findings: [
    {
      category: "conversion",
      severity: "medium",
      title: "CTA konkreter formulieren",
      evidence: "Der CTA ist allgemein beschriftet.",
      evidenceRefs: ["conversion:primary_cta"],
      explanation: "Ein konkreter Text kann den nächsten Schritt verständlicher machen.",
      recommendation: "Den erwartbaren nächsten Schritt im CTA nennen.",
      salesAngle: "Eine kleine, nachvollziehbare Verbesserung am Kontaktweg.",
    },
  ],
  summary: {
    shortSummary: "Der Kontaktweg lässt sich klarer beschreiben.",
    strengths: ["Die zentrale Aktion ist sichtbar."],
    weaknesses: ["Die Beschriftung ist allgemein."],
    topOpportunities: ["CTA-Text konkretisieren."],
    nextSteps: ["Alternative Beschriftung prüfen."],
    evidenceRefs: ["conversion:primary_cta"],
  },
  outreach: [
    {
      type: "email",
      subject: "Eine kleine Idee zum Kontaktweg",
      body: "Mir ist aufgefallen, dass der CTA sehr allgemein formuliert ist.",
      evidenceRefs: ["conversion:primary_cta"],
    },
    {
      type: "linkedin",
      body: "Ich habe eine konkrete Idee für die Beschriftung Ihres Kontakt-CTA.",
      evidenceRefs: ["conversion:primary_cta"],
    },
    {
      type: "phone_note",
      body: "Allgemeine CTA-Beschriftung respektvoll ansprechen.",
      evidenceRefs: ["conversion:primary_cta"],
    },
  ],
  subjectLines: ["Eine kleine Idee zum Kontaktweg"],
})

describe("validateEveAuditCandidate", () => {
  it("accepts schema-valid, exactly referenced, claim-safe output", () => {
    expect(validateEveAuditCandidate(context, validOutput)).toEqual({
      schemaPassed: true,
      evidencePassed: true,
      claimSafetyPassed: true,
      invalidEvidenceRefs: [],
      unsafeClaimCodes: [],
    })
  })

  it("rejects refs that merely contain an existing ref", () => {
    const candidate = structuredClone(validOutput)
    candidate.findings[0]!.evidenceRefs = ["conversion:primary_cta.extra"]
    const result = validateEveAuditCandidate(context, candidate)
    expect(result.evidencePassed).toBe(false)
    expect(result.invalidEvidenceRefs).toEqual(["conversion:primary_cta.extra"])
  })

  it("rejects adversarial legal, security, shaming, and guaranteed-outcome claims", () => {
    const candidate = structuredClone(validOutput)
    candidate.outreach[0]!.body =
      "Die Website ist peinlich und hackbar, begeht einen DSGVO-Verstoß und garantiert mehr Umsatz."
    const result = validateEveAuditCandidate(context, candidate)
    expect(result.claimSafetyPassed).toBe(false)
    expect(result.unsafeClaimCodes).toEqual(
      expect.arrayContaining(["legal_judgement", "security_claim", "guaranteed_outcome", "shaming"]),
    )
  })

  it("fails closed when output does not match the schema", () => {
    expect(validateEveAuditCandidate(context, { findings: [] })).toEqual({
      schemaPassed: false,
      evidencePassed: false,
      claimSafetyPassed: false,
      invalidEvidenceRefs: [],
      unsafeClaimCodes: ["schema_invalid"],
    })
  })
})
