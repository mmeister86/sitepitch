import { z } from "zod"

import type { EvidenceRef } from "./audit_agent_evidence"

export const COPY_REVIEW_SCHEMA_VERSION = "2026.07.1"

export const copyReviewOutputSchema = z.object({
  heroClarity: z.string().min(1).max(400),
  valueProposition: z.string().min(1).max(400),
  offerClarity: z.string().min(1).max(400),
  ctaClarity: z.string().min(1).max(400),
  snippetClarity: z.string().min(1).max(400),
  overallVerdict: z.string().min(1).max(600),
  recommendations: z.array(z.string().min(1).max(300)).min(1).max(6),
  evidenceRefs: z.array(z.string().min(1).max(120)).min(1).max(8),
})

export type CopyReviewOutput = z.infer<typeof copyReviewOutputSchema>

export function safeParseCopyReview(raw: unknown):
  | { ok: true; data: CopyReviewOutput }
  | { ok: false; error: string } {
  const parsed = copyReviewOutputSchema.safeParse(raw)
  if (parsed.success) {
    return { ok: true, data: parsed.data }
  }
  const first = parsed.error.issues[0]
  const path = first?.path.length ? first.path.join(".") : "root"
  return { ok: false, error: `${first?.code ?? "invalid"} at ${path}: ${first?.message ?? "validation failed"}` }
}

export interface CopyEvidenceIssue {
  reason: string
}

export function validateCopyEvidence(
  review: CopyReviewOutput,
  evidenceRefs: EvidenceRef[],
): CopyEvidenceIssue[] {
  const issues: CopyEvidenceIssue[] = []
  const labels = new Set(evidenceRefs.map((ref) => ref.label.toLowerCase()))
  const evidenceTexts = new Set(
    evidenceRefs
      .map((ref) => ref.evidence?.toLowerCase())
      .filter((value): value is string => Boolean(value)),
  )
  const refs = new Set(evidenceRefs.map((ref) => ref.ref.toLowerCase()))

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
      reason: "Copy review evidenceRefs do not reference any stored audit check.",
    })
  }

  return issues
}
