import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  Lightbulb,
  Mail,
  Monitor,
  Smartphone,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"
import type { CSSProperties, ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScoreRing } from "@/components/score-ring"
import { resolveCtaHref } from "@/lib/report-cta-href"
import {
  REPORT_SECTION_KEYS,
  type ReportSectionKey as SharedReportSectionKey,
  type ReportThemePreset,
} from "@/lib/report-document"
import { resolveReportPresentation } from "@/lib/report-presentation"
import { scoreColorVar, scoreTextClass, severityMeta } from "@/lib/scores"
import { cn } from "@/lib/utils"

export const reportSectionKeys = REPORT_SECTION_KEYS
export type ReportSectionKey = SharedReportSectionKey
export type ReportTheme = ReportThemePreset

export interface AuditReportFinding {
  category: string
  severity: string
  title: string
  evidence: string
  explanation: string
  recommendation: string
  sortOrder: number
  salesAngle?: string
}

export interface AuditReportData {
  domain: string
  reportLanguage: "de" | "en"
  overallScore: number | null
  categoryScores:
    | Array<{ key: string; label: string; score: number; weight: number }>
    | null
  summary: {
    shortSummary: string
    strengths: string[]
    weaknesses: string[]
    topOpportunities: string[]
    nextSteps: string[]
  } | null
  findings: AuditReportFinding[]
  nextSteps: string[]
  screenshots: { desktop: string | null; mobile: string | null }
  branding: {
    name: string
    accentColor: string
    logoUrl?: string | null
    ctaText?: string
    ctaUrl?: string
    ctaSnapshotted?: boolean
    website?: string
    contactEmail?: string
  }
  presentation?: {
    theme?: ReportTheme
    primaryColor?: string
    backgroundColor?: string
    textColor?: string
    introText?: string
    hiddenSections?: ReportSectionKey[]
    showPoweredBy?: boolean
  }
  intro?: string
  hiddenSections?: ReportSectionKey[]
  theme?: {
    preset: ReportTheme
    primaryColor: string
    backgroundColor: string
    textColor: string
  }
  showPoweredBy?: boolean
}

type ReportCopy = {
  websiteAudit: string
  auditReport: string
  noScore: string
  overallScore: string
  weightedScore: string
  categoryScores: string
  categoryScoresUnavailable: string
  summary: string
  opportunities: string
  opportunitiesDescription: string
  strengths: string
  weaknesses: string
  desktop: string
  mobile: string
  desktopAlt: (domain: string) => string
  mobileAlt: (domain: string) => string
  screenshotUnavailable: string
  findings: string
  evidence: string
  explanation: string
  recommendation: string
  salesAngle: string
  nextSteps: string
  contact: string
  poweredBy: string
  disclaimer: string
  severity: Record<string, string>
}

const copy: Record<AuditReportData["reportLanguage"], ReportCopy> = {
  de: {
    websiteAudit: "Website-Audit",
    auditReport: "Audit-Report",
    noScore: "Kein Score",
    overallScore: "Gesamtscore",
    weightedScore: "Gewichteter Durchschnitt über alle Kategorien",
    categoryScores: "Kategorie-Scores",
    categoryScoresUnavailable: "Kategorie-Scores noch nicht verfügbar.",
    summary: "Kurzfazit",
    opportunities: "Top-Chancen",
    opportunitiesDescription: "Priorisierte Ansatzpunkte",
    strengths: "Stärken",
    weaknesses: "Schwächen",
    desktop: "Desktop",
    mobile: "Mobil",
    desktopAlt: (domain) => `Desktop-Ansicht von ${domain}`,
    mobileAlt: (domain) => `Mobile Ansicht von ${domain}`,
    screenshotUnavailable: "Kein Screenshot verfügbar",
    findings: "Detail-Findings",
    evidence: "Evidenz",
    explanation: "Erklärung",
    recommendation: "Empfehlung",
    salesAngle: "Sales-Angle",
    nextSteps: "Empfohlene nächste Schritte",
    contact: "In Kontakt treten",
    poweredBy: "Erstellt mit SitePitch",
    disclaimer:
      "Dieser Report bewertet öffentlich sichtbare Signale zum Zeitpunkt des Audits. Er ist keine Rechts-, Datenschutz- oder Sicherheitsberatung und garantiert weder Umsatz noch Geschäftserfolg.",
    severity: { critical: "Kritisch", high: "Hoch", medium: "Mittel", low: "Niedrig", info: "Hinweis" },
  },
  en: {
    websiteAudit: "Website audit",
    auditReport: "Audit report",
    noScore: "No score",
    overallScore: "Overall score",
    weightedScore: "Weighted average across all categories",
    categoryScores: "Category scores",
    categoryScoresUnavailable: "Category scores are not available yet.",
    summary: "Executive summary",
    opportunities: "Top opportunities",
    opportunitiesDescription: "Prioritized areas for improvement",
    strengths: "Strengths",
    weaknesses: "Weaknesses",
    desktop: "Desktop",
    mobile: "Mobile",
    desktopAlt: (domain) => `Desktop view of ${domain}`,
    mobileAlt: (domain) => `Mobile view of ${domain}`,
    screenshotUnavailable: "No screenshot available",
    findings: "Detailed findings",
    evidence: "Evidence",
    explanation: "Explanation",
    recommendation: "Recommendation",
    salesAngle: "Sales angle",
    nextSteps: "Recommended next steps",
    contact: "Get in touch",
    poweredBy: "Created with SitePitch",
    disclaimer:
      "This report assesses publicly visible signals at the time of the audit. It is not legal, privacy, or security advice and does not guarantee revenue or business results.",
    severity: { critical: "Critical", high: "High", medium: "Medium", low: "Low", info: "Info" },
  },
}

export { resolveReportPresentation } from "@/lib/report-presentation"

function contrastTextColor(hex: string): string {
  const red = Number.parseInt(hex.slice(1, 3), 16)
  const green = Number.parseInt(hex.slice(3, 5), 16)
  const blue = Number.parseInt(hex.slice(5, 7), 16)
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
  return luminance > 0.58 ? "#182033" : "#f8fafc"
}

export function AuditReport({
  report,
  variant = "public",
  onCtaClick,
}: {
  report: AuditReportData
  variant?: "public" | "internal"
  onCtaClick?: () => void
}) {
  const { branding, summary, overallScore, categoryScores } = report
  const labels = copy[report.reportLanguage]
  const presentation = resolveReportPresentation(report)
  const visible = (section: ReportSectionKey) => !presentation.hiddenSections.has(section)
  const style = {
    "--background": presentation.backgroundColor,
    "--foreground": presentation.textColor,
    "--card": presentation.backgroundColor,
    "--card-foreground": presentation.textColor,
    "--popover": presentation.backgroundColor,
    "--popover-foreground": presentation.textColor,
    "--primary": presentation.primaryColor,
    "--primary-foreground": contrastTextColor(presentation.primaryColor),
    "--muted": `color-mix(in srgb, ${presentation.textColor} 7%, ${presentation.backgroundColor})`,
    "--muted-foreground": `color-mix(in srgb, ${presentation.textColor} 68%, ${presentation.backgroundColor})`,
    "--border": `color-mix(in srgb, ${presentation.textColor} 16%, ${presentation.backgroundColor})`,
    backgroundColor: presentation.backgroundColor,
    color: presentation.textColor,
  } as CSSProperties

  return (
    <div
      className={cn(
        "report-document space-y-4 rounded-xl p-1 md:space-y-5 md:p-2",
        presentation.theme === "minimal" &&
          "[&_[data-slot=card]]:rounded-none [&_[data-slot=card]]:border-x-0 [&_[data-slot=card]]:border-t-0 [&_[data-slot=card]]:shadow-none",
        presentation.theme === "editorial" &&
          "[&_[data-slot=card]]:rounded-sm [&_[data-slot=card-title]]:font-serif [&_[data-slot=card-title]]:tracking-tight",
      )}
      data-report-theme={presentation.theme}
      style={style}
    >
      <ReportHeader report={report} variant={variant} labels={labels} />

      {presentation.introText && (
        <div className="px-2 py-4 md:px-5 md:py-6">
          <p className="max-w-[72ch] text-base leading-7 text-foreground/80">
            {presentation.introText}
          </p>
        </div>
      )}

      {visible("score") && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            {overallScore !== null ? (
              <ScoreRing score={overallScore} size={148} strokeWidth={12} />
            ) : (
              <div className="flex size-[148px] items-center justify-center rounded-full border-4 border-muted text-sm text-muted-foreground">
                {labels.noScore}
              </div>
            )}
            <div className="px-6">
              <p className="text-sm font-medium">{labels.overallScore}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{labels.weightedScore}</p>
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{labels.categoryScores}</CardTitle>
              {summary && <CardDescription>{summary.shortSummary.slice(0, 120)}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-3.5">
              {categoryScores && categoryScores.length > 0 ? (
                categoryScores.map((category) => (
                  <div key={category.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{category.label}</span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{category.weight}%</span>
                        <span className={cn("font-semibold tabular-nums", scoreTextClass(category.score))}>
                          {category.score}
                        </span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${category.score}%`, backgroundColor: scoreColorVar(category.score) }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">{labels.categoryScoresUnavailable}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {summary && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className={cn("space-y-4", visible("screenshots") && "lg:col-span-2", !visible("screenshots") && "lg:col-span-3")}>
            {visible("summary") && (
              <Card>
                <CardHeader><CardTitle>{labels.summary}</CardTitle></CardHeader>
                <CardContent>
                  <p className="max-w-[75ch] text-sm leading-relaxed text-muted-foreground">{summary.shortSummary}</p>
                </CardContent>
              </Card>
            )}

            {visible("opportunities") && summary.topOpportunities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="size-4 text-primary" />
                    {labels.opportunities}
                  </CardTitle>
                  <CardDescription>{labels.opportunitiesDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-2.5">
                    {summary.topOpportunities.slice(0, 5).map((opportunity, index) => (
                      <li key={index} className="flex gap-3 text-sm">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
                        <span className="pt-0.5">{opportunity}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}

            {visible("strengths_weaknesses") && (
              <div className="grid gap-4 sm:grid-cols-2">
                {summary.strengths.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ThumbsUp className="size-4 text-score-strong" />{labels.strengths}</CardTitle></CardHeader>
                    <CardContent><ReportList icon={<CircleCheck className="mt-0.5 size-4 shrink-0 text-score-strong" />} items={summary.strengths} /></CardContent>
                  </Card>
                )}
                {summary.weaknesses.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ThumbsDown className="size-4 text-score-weak" />{labels.weaknesses}</CardTitle></CardHeader>
                    <CardContent><ReportList icon={<CircleAlert className="mt-0.5 size-4 shrink-0 text-score-weak" />} items={summary.weaknesses} /></CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>

          {visible("screenshots") && (
            <div className="space-y-4">
              <Card className="overflow-hidden py-0">
                <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium"><Monitor className="size-4 text-muted-foreground" />{labels.desktop}</div>
                {report.screenshots.desktop ? (
                  <img src={report.screenshots.desktop} alt={labels.desktopAlt(report.domain)} className="aspect-[4/3] w-full object-cover object-top" />
                ) : <ScreenshotFallback label={labels.screenshotUnavailable} />}
              </Card>
              {report.screenshots.mobile && (
                <Card className="overflow-hidden py-0">
                  <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium"><Smartphone className="size-4 text-muted-foreground" />{labels.mobile}</div>
                  <img src={report.screenshots.mobile} alt={labels.mobileAlt(report.domain)} className="mx-auto aspect-[3/4] w-2/3 object-cover object-top" />
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {visible("findings") && report.findings.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold tracking-tight">{labels.findings}</h3>
          {report.findings.map((finding) => (
            <FindingCard key={finding.sortOrder} finding={finding} variant={variant} labels={labels} />
          ))}
        </div>
      )}

      {visible("next_steps") && report.nextSteps.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{labels.nextSteps}</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {report.nextSteps.map((step, index) => (
                <li key={index} className="flex gap-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-xs font-semibold text-primary">{index + 1}</span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {visible("cta") && <ReportCTA branding={branding} labels={labels} onCtaClick={onCtaClick} />}

      <footer className="space-y-1 print:break-inside-avoid">
        {presentation.showPoweredBy && (
          <p className="text-center text-[11px] font-medium text-muted-foreground">{labels.poweredBy}</p>
        )}
        <p className="mx-auto max-w-[76ch] px-4 py-2 text-center text-[11px] leading-relaxed text-muted-foreground">{labels.disclaimer}</p>
      </footer>
    </div>
  )
}

function ReportHeader({ report, variant, labels }: { report: AuditReportData; variant: "public" | "internal"; labels: ReportCopy }) {
  const { branding } = report
  return (
    <Card className="overflow-hidden py-0">
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderTopWidth: 4, borderTopColor: "var(--primary)" }}>
        {branding.logoUrl ? (
          <div className="flex h-11 w-28 shrink-0 items-center justify-start overflow-hidden">
            <img src={branding.logoUrl} alt={branding.name} className="max-h-11 max-w-28 object-contain object-left" />
          </div>
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">{branding.name.charAt(0)}</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{branding.name}</p>
          <p className="truncate text-xs text-muted-foreground">{labels.websiteAudit}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="truncate text-sm font-semibold text-foreground">{report.domain}</p>
          {variant === "public" && <p className="text-xs text-muted-foreground">{labels.auditReport}</p>}
        </div>
      </div>
    </Card>
  )
}

function FindingCard({ finding, variant, labels }: { finding: AuditReportFinding; variant: "public" | "internal"; labels: ReportCopy }) {
  const sevMeta = severityMeta[finding.severity as keyof typeof severityMeta]
  return (
    <Card>
      <CardContent className="space-y-3 py-5">
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-semibold">{finding.title}</h4>
          {sevMeta && <Badge className={cn("shrink-0 border-0 font-medium", sevMeta.badge)}>{labels.severity[finding.severity] ?? sevMeta.label}</Badge>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FindingField label={labels.evidence} value={finding.evidence} />
          <FindingField label={labels.explanation} value={finding.explanation} />
          <FindingField label={labels.recommendation} value={finding.recommendation} />
          {variant === "internal" && finding.salesAngle && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">{labels.salesAngle}</p>
              <p className="mt-1 text-sm text-foreground/80">{finding.salesAngle}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function FindingField({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm text-foreground/80">{value}</p></div>
}

function ReportList({ icon, items }: { icon: ReactNode; items: string[] }) {
  return <ul className="space-y-2 text-sm text-muted-foreground">{items.map((item, index) => <li key={index} className="flex gap-2">{icon}{item}</li>)}</ul>
}

function ScreenshotFallback({ label }: { label: string }) {
  return <div className="flex aspect-[4/3] items-center justify-center bg-muted text-xs text-muted-foreground">{label}</div>
}

function ReportCTA({ branding, labels, onCtaClick }: { branding: AuditReportData["branding"]; labels: ReportCopy; onCtaClick?: () => void }) {
  const ctaLabel = branding.ctaText || labels.contact
  const ctaHref = resolveCtaHref({ ...branding, ctaSnapshotted: branding.ctaSnapshotted ?? true })
  const icon = ctaHref?.startsWith("mailto:") ? <Mail className="size-4" /> : <ArrowRight className="size-4" />

  if (!ctaHref) {
    return <Card className="bg-muted/40"><CardContent className="flex items-center justify-center gap-2 py-5 text-center"><p className="text-sm text-muted-foreground">{branding.name} · {branding.contactEmail ?? branding.website ?? labels.websiteAudit}</p></CardContent></Card>
  }

  return (
    <Card className="print:break-inside-avoid" style={{ borderTopWidth: 4, borderTopColor: "var(--primary)" }}>
      <CardContent className="flex flex-col items-start gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="font-semibold">{ctaLabel}</p><p className="mt-0.5 text-sm text-muted-foreground">{branding.name}</p></div>
        <a href={ctaHref} target={ctaHref.startsWith("mailto:") || ctaHref.startsWith("tel:") ? undefined : "_blank"} rel="noreferrer" onClick={onCtaClick} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground no-underline transition-opacity hover:opacity-90">
          {icon}{ctaLabel}{!ctaHref.startsWith("mailto:") && !ctaHref.startsWith("tel:") && <ExternalLink className="size-3" />}
        </a>
      </CardContent>
    </Card>
  )
}
