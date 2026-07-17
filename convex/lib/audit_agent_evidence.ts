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
  path: string
  title?: string
  reason: string
}

export function validateFindingEvidence(
  findings: { title: string; evidenceRefs: string[] }[],
  evidenceRefs: EvidenceRef[],
): EvidenceValidationIssue[] {
  const issues: EvidenceValidationIssue[] = []
  const refs = new Set(evidenceRefs.map((ref) => ref.ref.toLowerCase()))

  findings.forEach((finding, index) => {
    const invalid = finding.evidenceRefs.find((ref) => !refs.has(ref.toLowerCase()))
    if (invalid || finding.evidenceRefs.length === 0) {
      issues.push({
        path: `findings[${index}].evidenceRefs`,
        title: finding.title,
        reason: invalid
          ? `Unknown audit check reference: ${invalid}`
          : "Finding must reference at least one stored audit check.",
      })
    }
  })

  return issues
}

export function validateOutputEvidence(
  output: {
    findings: { title: string; evidenceRefs: string[] }[]
    summary: { evidenceRefs: string[] }
    outreach: { evidenceRefs: string[] }[]
  },
  evidenceRefs: EvidenceRef[],
): EvidenceValidationIssue[] {
  const issues = validateFindingEvidence(output.findings, evidenceRefs)
  const refs = new Set(evidenceRefs.map((ref) => ref.ref.toLowerCase()))
  const validateRefs = (path: string, values: string[]) => {
    const invalid = values.find((ref) => !refs.has(ref.toLowerCase()))
    if (invalid || values.length === 0) {
      issues.push({
        path,
        reason: invalid
          ? `Unknown audit check reference: ${invalid}`
          : "Output section must reference at least one stored audit check.",
      })
    }
  }
  validateRefs("summary.evidenceRefs", output.summary.evidenceRefs)
  output.outreach.forEach((draft, index) => {
    validateRefs(`outreach[${index}].evidenceRefs`, draft.evidenceRefs)
  })
  return issues
}
