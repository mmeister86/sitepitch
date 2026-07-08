import { z } from "zod"

import type { EvidenceRef } from "./audit_agent_evidence"
import { PERSONA_IDS, type PersonaId } from "./audit_personas"

export const PERSONA_PANEL_SCHEMA_VERSION = "2026.07.1"

export const personaIdSchema = z.enum(PERSONA_IDS as [PersonaId, ...PersonaId[]])

export const personaConfidenceSchema = z.enum(["low", "medium", "high"])

export const personaReviewOutputSchema = z.object({
  personaId: personaIdSchema,
  personaName: z.string().min(1).max(80),
  lens: z.string().min(1).max(200),
  verdict: z.string().min(1).max(600),
  positives: z.array(z.string().min(1).max(200)).max(5),
  frictionPoints: z.array(z.string().min(1).max(200)).min(1).max(5),
  topRecommendation: z.string().min(1).max(400),
  evidenceRefs: z.array(z.string().min(1).max(120)).min(1).max(8),
  confidence: personaConfidenceSchema,
})

export const personaPanelOutputSchema = z.object({
  reviews: z.array(personaReviewOutputSchema).min(1).max(6),
})

export type PersonaReviewOutput = z.infer<typeof personaReviewOutputSchema>
export type PersonaPanelOutput = z.infer<typeof personaPanelOutputSchema>

export function safeParsePersonaPanel(raw: unknown):
  | { ok: true; data: PersonaPanelOutput }
  | { ok: false; error: string } {
  const parsed = personaPanelOutputSchema.safeParse(raw)
  if (parsed.success) {
    return { ok: true, data: parsed.data }
  }
  const first = parsed.error.issues[0]
  const path = first?.path.length ? first.path.join(".") : "root"
  return { ok: false, error: `${first?.code ?? "invalid"} at ${path}: ${first?.message ?? "validation failed"}` }
}

export interface PersonaEvidenceIssue {
  reviewIndex: number
  personaId: string
  reason: string
}

export function validatePersonaEvidence(
  reviews: PersonaReviewOutput[],
  evidenceRefs: EvidenceRef[],
): PersonaEvidenceIssue[] {
  const issues: PersonaEvidenceIssue[] = []
  const labels = new Set(evidenceRefs.map((ref) => ref.label.toLowerCase()))
  const evidenceTexts = new Set(
    evidenceRefs
      .map((ref) => ref.evidence?.toLowerCase())
      .filter((value): value is string => Boolean(value)),
  )
  const refs = new Set(evidenceRefs.map((ref) => ref.ref.toLowerCase()))

  reviews.forEach((review, index) => {
    const touchesStored = review.evidenceRefs.some((entry) => {
      const value = entry.toLowerCase()
      return (
        labels.has(value) ||
        refs.has(value) ||
        [...labels].some(
          (label) => label.length > 4 && (value.includes(label) || label.includes(value)),
        ) ||
        [...evidenceTexts].some(
          (stored) => stored.length > 4 && (value.includes(stored) || stored.includes(value)),
        )
      )
    })

    if (!touchesStored) {
      issues.push({
        reviewIndex: index,
        personaId: review.personaId,
        reason: "Persona evidenceRefs do not reference any stored audit check.",
      })
    }
  })

  return issues
}
