import type { CheckInput, CategoryScores } from "./audit_scoring"
import { DESIGN_CRITIQUE_NIELSEN_HEURISTICS_DE, DESIGN_CRITIQUE_NIELSEN_HEURISTICS_EN } from "./audit_design_critique_prompt"
import type { DesignCritiqueOutput } from "./audit_design_critique_schemas"

export interface DesignFallbackContext {
  domain: string
  reportLanguage: "de" | "en"
  categoryScores: CategoryScores
  overallScore: number
  checks: CheckInput[]
}

function heuristicScoreFrom(value: number | undefined): number {
  const v = value ?? 50
  if (v >= 85) return 4
  if (v >= 70) return 3
  if (v >= 50) return 2
  if (v >= 30) return 1
  return 0
}

function ratingBandFor(healthScore: number, isEnglish: boolean): string {
  if (healthScore >= 36) return isEnglish ? "Excellent" : "Exzellent"
  if (healthScore >= 28) return isEnglish ? "Good" : "Gut"
  if (healthScore >= 20) return isEnglish ? "Acceptable" : "Akzeptabel"
  if (healthScore >= 12) return isEnglish ? "Poor" : "Ausbaufähig"
  return isEnglish ? "Critical" : "Kritisch"
}

function topIssues(checks: CheckInput[], limit: number): CheckInput[] {
  return checks
    .filter((check) => check.status === "failed" || check.status === "warning")
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, limit)
}

function passedChecks(checks: CheckInput[], limit: number): CheckInput[] {
  return checks.filter((check) => check.status === "passed").slice(0, limit)
}

export function generateDeterministicDesignCritique(
  ctx: DesignFallbackContext,
): DesignCritiqueOutput {
  const isEnglish = ctx.reportLanguage === "en"
  const heuristics = isEnglish
    ? DESIGN_CRITIQUE_NIELSEN_HEURISTICS_EN
    : DESIGN_CRITIQUE_NIELSEN_HEURISTICS_DE
  const s = ctx.categoryScores

  const sources = [
    s.conversion,
    s.trust,
    s.conversion,
    ctx.overallScore,
    s.conversion,
    s.seo,
    s.mobile,
    ctx.overallScore,
    s.trust,
    s.trust,
  ]

  const heuristicScores = heuristics.map((name, i) => ({
    name,
    score: heuristicScoreFrom(sources[i]),
    keyIssue: isEnglish
      ? `Assessment derived from stored audit checks (category proxy). Visual verification pending.`
      : `Bewertung abgeleitet aus gespeicherten Checks (Kategorie-Proxy). Visuelle Verifikation ausstehend.`,
  }))

  const designHealthScore = heuristicScores.reduce((sum, h) => sum + h.score, 0)

  const weakCategoryCount = (Object.values(s) as number[]).filter((v) => v < 70).length
  const cognitiveLoadFailedCount = Math.min(8, weakCategoryCount)
  const cognitiveLoadLevel: "low" | "moderate" | "high" =
    cognitiveLoadFailedCount <= 1 ? "low" : cognitiveLoadFailedCount <= 3 ? "moderate" : "high"

  const issues = topIssues(ctx.checks, 5)
  const issueBase = issues.length ? issues : ctx.checks.slice(0, 3)
  const strengths = passedChecks(ctx.checks, 3)

  const priorityIssues = issueBase.slice(0, 5).map((check) => {
    const severity: "P1" | "P2" = check.status === "failed" && (check.weight ?? 0) >= 1 ? "P1" : "P2"
    return {
      severity,
      title: check.label,
      whyItMatters: isEnglish
        ? `Stored check "${check.category}:${check.key}" reports room for improvement.`
        : `Gespeicherter Check "${check.category}:${check.key}" zeigt Optimierungspotenzial.`,
      fix: isEnglish
        ? `Address "${check.label}" based on the stored evidence.`
        : `"${check.label}" anhand der gespeicherten Evidence verbessern.`,
      evidenceRefs: [`${check.category}:${check.key}`],
    }
  })

  const recommendations = issueBase.slice(0, 6).map((check) =>
    isEnglish
      ? `Improve ${check.label.toLowerCase()} based on the stored evidence.`
      : `"${check.label}" anhand der gespeicherten Evidence verbessern.`,
  )

  const evidenceRefs = issueBase.slice(0, 6).map((check) => `${check.category}:${check.key}`)

  const overallImpression = isEnglish
    ? `The website ${ctx.domain} has a ${ratingBandFor(designHealthScore, true).toLowerCase()} design-health basis from stored checks. This is a deterministic fallback because the LLM design critique was unavailable; it focuses on check-derived signals rather than a visual review.`
    : `Die Website ${ctx.domain} hat eine ${ratingBandFor(designHealthScore, false).toLowerCase()} Design-Health-Grundlage aus gespeicherten Checks. Dies ist ein deterministischer Fallback, da die LLM-Design-Kritik nicht verfügbar war; er fokussiert sich auf Check-Signale statt auf eine visuelle Bewertung.`

  const cognitiveLoadNotes = isEnglish
    ? `Cognitive load estimated from weak categories (${weakCategoryCount}). Visual verification pending.`
    : `Kognitive Last geschätzt aus schwachen Kategorien (${weakCategoryCount}). Visuelle Verifikation ausstehend.`

  const antiPatternVerdict = isEnglish
    ? `Visual anti-pattern detection was not available (deterministic fallback). No template/clone verdict can be made from stored checks alone.`
    : `Visuelle Anti-Pattern-Erkennung war nicht verfügbar (deterministischer Fallback). Aus gespeicherten Checks allein ist keine Template-/Klon-Beurteilung möglich.`

  const whatsWorking = strengths.length
    ? strengths.map((check) =>
        isEnglish ? `${check.label} is already well set up.` : `${check.label} ist bereits gut aufgestellt.`,
      )
    : [isEnglish ? "Basic website structure is in place." : "Grundlegende Struktur der Website ist vorhanden."]

  return {
    designHealthScore,
    ratingBand: ratingBandFor(designHealthScore, isEnglish),
    overallImpression,
    heuristicScores,
    cognitiveLoad: {
      failedCount: cognitiveLoadFailedCount,
      level: cognitiveLoadLevel,
      notes: cognitiveLoadNotes,
    },
    antiPatternVerdict,
    whatsWorking,
    priorityIssues,
    recommendations,
    evidenceRefs,
  }
}
