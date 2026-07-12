import type { AuditAgentOutput } from "./audit_agent_schemas"

const BLOCKED_CLAIM_PATTERNS: RegExp[] = [
  /rechtlich (unvollständig|nicht ausreichend|fehlerhaft|risik)/i,
  /\b(?:rechtssicher|rechtskonform|rechtswidrig)\b/i,
  /\bverstößt gegen (?:das )?(?:gesetz|recht)\b/i,
  /imp(i|ress)um.*(fehlt|unvollständig)/i,
  /datenschutz.*(rechtswidrig|verstoß|illegal)/i,
  /\b(?:dsgvo|gdpr)[ -]?(?:konform|konformität|verstoß|compliant|non-compliant|violation)\b/i,
  /\b(?:datenschutz|privacy|data protection)[ -]?(?:audit|bewertung|prüfung|assessment|compliant|non-compliant|violation)\b/i,
  /\b(?:legally compliant|legally non-compliant|violates? (?:the )?law|illegal)\b/i,
  /ist (unsicher|gefahrret|verwundbar)/i,
  /security.?scan/i,
  /(?:sicherheitslücke|hackbar|gehackt)/i,
  /\b(?:ist|gilt als) (?:vollständig )?(?:sicher|security-zertifiziert)\b/i,
  /\b(?:is|appears) (?:fully )?(?:secure|insecure|vulnerable|hackable)\b/i,
  /\b(?:security|sicherheits)[ -]?(?:audit|assessment|prüfung).*(?:bestanden|passed|certified|zertifiziert)\b/i,
  /\b(?:passed|certified).*(?:security|sicherheits)[ -]?(?:audit|assessment|prüfung)\b/i,
  /garantiert.*(umsatz|kunden|anfragen|conversion)/i,
  /werden garantiert mehr/i,
  /(?<!not )\b(?:guarantee|guaranteed|guarantees).*(?:revenue|sales|customers|leads|conversions?|business (?:results?|growth|success))\b/i,
  /\b(?:revenue|sales|customers|leads|conversions?|business (?:results?|growth|success)).*(?:is|are) guaranteed\b/i,
  /\bwill (?:increase|double|generate|deliver).*(?:revenue|sales|customers|leads|conversions?|business (?:growth|results?|success))\b/i,
  /\bwird.*(?:umsatz|kunden|anfragen|conversion).*(?:steigern|verdoppeln|erhöhen|bringen)\b/i,
  /verliert?(?:en)? massiv/i,
  /(?:verliert|verlieren) (?:jeden tag|jeden monat)/i,
  /ist (schlecht|hoffnungslos|unprofessionell|peinlich|schlampig)/i,
  /(?:schäme|beschämend|peinlich)/i,
  /(?:scam|betrug|betrügerisch)/i,
  /(?:wcag|barrierefrei) nicht (erfüllt|eingehalten)/i,
]

const SHAMING_CLUES: RegExp[] = [
  /ihre website ist (schlecht|eine katastrophe|peinlich)/i,
  /macht einen unprofessionellen eindruck/i,
  /wirkt (billig|unseriös|amateurhaft)/i,
]

interface ClaimSafetyIssue {
  path: string
  matched: string
}

function scanText(text: string, basePath: string): ClaimSafetyIssue[] {
  const issues: ClaimSafetyIssue[] = []
  for (const pattern of [...BLOCKED_CLAIM_PATTERNS, ...SHAMING_CLUES]) {
    const match = text.match(pattern)
    if (match) {
      issues.push({ path: basePath, matched: match[0] })
    }
  }
  return issues
}

export interface ClaimSafetyResult {
  ok: boolean
  issues: ClaimSafetyIssue[]
}

export function reviewTextsClaimSafety(texts: { text: string; path: string }[]): ClaimSafetyResult {
  const issues: ClaimSafetyIssue[] = []
  for (const entry of texts) {
    issues.push(...scanText(entry.text, entry.path))
  }
  return { ok: issues.length === 0, issues }
}

export function reviewClaimSafety(output: AuditAgentOutput): ClaimSafetyResult {
  const issues: ClaimSafetyIssue[] = []

  for (let i = 0; i < output.findings.length; i++) {
    const finding = output.findings[i]
    issues.push(...scanText(finding.title, `findings[${i}].title`))
    issues.push(...scanText(finding.evidence, `findings[${i}].evidence`))
    issues.push(...scanText(finding.explanation, `findings[${i}].explanation`))
    issues.push(...scanText(finding.recommendation, `findings[${i}].recommendation`))
    issues.push(...scanText(finding.salesAngle, `findings[${i}].salesAngle`))
  }

  issues.push(...scanText(output.summary.shortSummary, "summary.shortSummary"))
  for (let i = 0; i < output.summary.strengths.length; i++) {
    issues.push(...scanText(output.summary.strengths[i], `summary.strengths[${i}]`))
  }
  for (let i = 0; i < output.summary.weaknesses.length; i++) {
    issues.push(...scanText(output.summary.weaknesses[i], `summary.weaknesses[${i}]`))
  }
  for (let i = 0; i < output.summary.topOpportunities.length; i++) {
    issues.push(...scanText(output.summary.topOpportunities[i], `summary.topOpportunities[${i}]`))
  }
  for (let i = 0; i < output.summary.nextSteps.length; i++) {
    issues.push(...scanText(output.summary.nextSteps[i], `summary.nextSteps[${i}]`))
  }
  for (let i = 0; i < output.outreach.length; i++) {
    const draft = output.outreach[i]
    if (draft.subject) {
      issues.push(...scanText(draft.subject, `outreach[${i}].subject`))
    }
    issues.push(...scanText(draft.body, `outreach[${i}].body`))
  }
  for (let i = 0; i < output.subjectLines.length; i++) {
    issues.push(...scanText(output.subjectLines[i], `subjectLines[${i}]`))
  }

  return { ok: issues.length === 0, issues }
}
