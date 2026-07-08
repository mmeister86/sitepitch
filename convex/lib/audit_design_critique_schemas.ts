import { z } from "zod"

import type { EvidenceRef } from "./audit_agent_evidence"

export const DESIGN_CRITIQUE_SCHEMA_VERSION = "2026.07.1"

export const cognitiveLoadLevelSchema = z.enum(["low", "moderate", "high"])

export const designIssueSeveritySchema = z.enum(["P0", "P1", "P2", "P3"])

export const heuristicScoreSchema = z.object({
  name: z.string().min(1).max(80),
  score: z.number().int().min(0).max(4),
  keyIssue: z.string().min(1).max(240),
})

export const cognitiveLoadSchema = z.object({
  failedCount: z.number().int().min(0).max(8),
  level: cognitiveLoadLevelSchema,
  notes: z.string().min(1).max(400),
})

export const designPriorityIssueSchema = z.object({
  severity: designIssueSeveritySchema,
  title: z.string().min(1).max(140),
  whyItMatters: z.string().min(1).max(400),
  fix: z.string().min(1).max(400),
  evidenceRefs: z.array(z.string().min(1).max(120)).min(1).max(8),
})

export const designCritiqueOutputSchema = z.object({
  designHealthScore: z.number().int().min(0).max(40),
  ratingBand: z.string().min(1).max(60),
  overallImpression: z.string().min(1).max(600),
  heuristicScores: z.array(heuristicScoreSchema).length(10),
  cognitiveLoad: cognitiveLoadSchema,
  antiPatternVerdict: z.string().min(1).max(600),
  whatsWorking: z.array(z.string().min(1).max(240)).min(1).max(3),
  priorityIssues: z.array(designPriorityIssueSchema).min(1).max(5),
  recommendations: z.array(z.string().min(1).max(300)).min(1).max(6),
  evidenceRefs: z.array(z.string().min(1).max(120)).min(1).max(8),
})

export type DesignCritiqueOutput = z.infer<typeof designCritiqueOutputSchema>

export function safeParseDesignCritique(raw: unknown):
  | { ok: true; data: DesignCritiqueOutput }
  | { ok: false; error: string } {
  const parsed = designCritiqueOutputSchema.safeParse(raw)
  if (parsed.success) {
    return { ok: true, data: parsed.data }
  }
  const first = parsed.error.issues[0]
  const path = first?.path.length ? first.path.join(".") : "root"
  return { ok: false, error: `${first?.code ?? "invalid"} at ${path}: ${first?.message ?? "validation failed"}` }
}

export interface DesignCritiqueEvidenceIssue {
  reason: string
}

function touchesStoredEvidence(entries: string[], evidenceRefs: EvidenceRef[]): boolean {
  const labels = new Set(evidenceRefs.map((ref) => ref.label.toLowerCase()))
  const evidenceTexts = new Set(
    evidenceRefs
      .map((ref) => ref.evidence?.toLowerCase())
      .filter((value): value is string => Boolean(value)),
  )
  const refs = new Set(evidenceRefs.map((ref) => ref.ref.toLowerCase()))

  return entries.some((entry) => {
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
}

export function validateDesignCritiqueEvidence(
  critique: DesignCritiqueOutput,
  evidenceRefs: EvidenceRef[],
): DesignCritiqueEvidenceIssue[] {
  const issues: DesignCritiqueEvidenceIssue[] = []

  if (!touchesStoredEvidence(critique.evidenceRefs, evidenceRefs)) {
    issues.push({
      reason: "Design critique evidenceRefs do not reference any stored audit check.",
    })
  }

  return issues
}
