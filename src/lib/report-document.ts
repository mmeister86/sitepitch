export const REPORT_SECTION_KEYS = [
  "score",
  "summary",
  "opportunities",
  "strengths_weaknesses",
  "screenshots",
  "findings",
  "next_steps",
  "cta",
] as const

export type ReportSectionKey = (typeof REPORT_SECTION_KEYS)[number]
export type ReportThemePreset = "classic" | "minimal" | "editorial"

export interface PublicReportDocumentModel {
  domain: string
  normalizedUrl: string
  completedAt: number | null
  reportLanguage: "de" | "en"
  overallScore: number | null
  categoryScores: Array<{
    key: string
    label: string
    score: number
    weight: number
  }> | null
  summary: {
    shortSummary: string
    strengths: string[]
    weaknesses: string[]
    topOpportunities: string[]
    nextSteps: string[]
  } | null
  findings: Array<{
    category: string
    severity: string
    title: string
    evidence: string
    explanation: string
    recommendation: string
    sortOrder: number
  }>
  nextSteps: string[]
  screenshots: {
    desktop: string | null
    mobile: string | null
  }
  intro?: string
  hiddenSections: ReportSectionKey[]
  theme: {
    preset: ReportThemePreset
    primaryColor: string
    backgroundColor: string
    textColor: string
  }
  branding: {
    name: string
    logoUrl?: string
    accentColor: string
    ctaText?: string
    ctaUrl?: string
    ctaSnapshotted?: boolean
    website?: string
    contactEmail?: string
  }
  showPoweredBy: boolean
}

export function isReportSectionVisible(
  report: { hiddenSections: readonly ReportSectionKey[] },
  section: ReportSectionKey,
) {
  return !report.hiddenSections.includes(section)
}

export function reportHasMinimumVisibleContent(hiddenSections: ReportSectionKey[]) {
  return (["score", "summary", "findings", "next_steps"] as const)
    .some((section) => !hiddenSections.includes(section))
}

export function sanitizeReportFilename(domain: string, completedAt: number | null) {
  const safeDomain = domain
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "website"
  const date = new Date(completedAt ?? Date.now()).toISOString().slice(0, 10)
  return `${safeDomain}-audit-${date}.pdf`
}
