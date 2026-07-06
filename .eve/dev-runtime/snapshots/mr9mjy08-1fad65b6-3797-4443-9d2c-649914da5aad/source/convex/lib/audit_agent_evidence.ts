import type { CheckInput } from "./audit_scoring"

export interface EvidenceRef {
  ref: string
  category: string
  key: string
  label: string
  status: string
  evidence?: string
  source?: string
}

export function buildEvidenceRefs(checks: CheckInput[]): EvidenceRef[] {
  return checks.map((check) => ({
    ref: `${check.category}:${check.key}`,
    category: check.category,
    key: check.key,
    label: check.label,
    status: check.status,
    evidence: check.evidence,
    source: check.source,
  }))
}

export interface EvidenceValidationIssue {
  findingIndex: number
  title: string
  reason: string
}

export function validateFindingEvidence(
  findings: { title: string; evidence: string; category: string }[],
  evidenceRefs: EvidenceRef[],
): EvidenceValidationIssue[] {
  const issues: EvidenceValidationIssue[] = []
  const labels = new Set(evidenceRefs.map((ref) => ref.label.toLowerCase()))
  const evidenceTexts = new Set(
    evidenceRefs
      .map((ref) => ref.evidence?.toLowerCase())
      .filter((value): value is string => Boolean(value)),
  )
  const refs = new Set(evidenceRefs.map((ref) => ref.ref.toLowerCase()))

  findings.forEach((finding, index) => {
    const text = finding.evidence.toLowerCase()
    const touchesStored =
      labels.has(finding.evidence.toLowerCase()) ||
      refs.has(finding.evidence.toLowerCase()) ||
      [...labels].some((label) => label.length > 4 && text.includes(label)) ||
      [...evidenceTexts].some((stored) => stored.length > 4 && text.includes(stored)) ||
      text.includes(finding.category.toLowerCase())

    if (!touchesStored) {
      issues.push({
        findingIndex: index,
        title: finding.title,
        reason: "Finding evidence does not reference any stored audit check evidence.",
      })
    }
  })

  return issues
}
