import {
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  CircleCheck,
  CircleAlert,
  Monitor,
  Smartphone,
  ArrowRight,
  ExternalLink,
  Mail,
} from "lucide-react"
import type { ReactNode } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScoreRing } from "@/components/score-ring"
import { scoreColorVar, scoreTextClass, severityMeta } from "@/lib/scores"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Shared report data shape — compatible with both public and internal DTOs
// ---------------------------------------------------------------------------

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
    | Array<{
        key: string
        label: string
        score: number
        weight: number
      }>
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
    ctaText?: string
    ctaUrl?: string
    website?: string
    contactEmail?: string
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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

  return (
    <div className="report-document space-y-4 md:space-y-5">
      {/* Branded header */}
      <ReportHeader report={report} variant={variant} />

      {/* Score + categories */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          {overallScore !== null ? (
            <ScoreRing score={overallScore} size={148} strokeWidth={12} />
          ) : (
            <div className="flex size-[148px] items-center justify-center rounded-full border-4 border-muted text-sm text-muted-foreground">
              Kein Score
            </div>
          )}
          <div className="px-6">
            <p className="text-sm font-medium">Gesamtscore</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Gewichteter Durchschnitt über 6 Kategorien
            </p>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Kategorie-Scores</CardTitle>
            {summary && (
              <CardDescription>{summary.shortSummary.slice(0, 120)}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3.5">
            {categoryScores && categoryScores.length > 0 ? (
              categoryScores.map((c) => (
                <div key={c.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{c.label}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{c.weight}%</span>
                      <span className={cn("font-semibold tabular-nums", scoreTextClass(c.score))}>
                        {c.score}
                      </span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${c.score}%`, backgroundColor: scoreColorVar(c.score) }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Kategorie-Scores noch nicht verfügbar.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary + opportunities */}
      {summary && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Kurzfazit</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {summary.shortSummary}
                </p>
              </CardContent>
            </Card>

            {summary.topOpportunities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="size-4 text-primary" />
                    Top-Chancen
                  </CardTitle>
                  <CardDescription>
                    Priorisierte Ansatzpunkte
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-2.5">
                    {summary.topOpportunities.slice(0, 5).map((o, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {i + 1}
                        </span>
                        <span className="pt-0.5">{o}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {summary.strengths.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ThumbsUp className="size-4 text-score-strong" />
                      Stärken
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {summary.strengths.map((s, i) => (
                        <li key={i} className="flex gap-2">
                          <CircleCheck className="mt-0.5 size-4 shrink-0 text-score-strong" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {summary.weaknesses.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ThumbsDown className="size-4 text-score-weak" />
                      Schwächen
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {summary.weaknesses.map((s, i) => (
                        <li key={i} className="flex gap-2">
                          <CircleAlert className="mt-0.5 size-4 shrink-0 text-score-weak" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Screenshots */}
          <div className="space-y-4">
            <Card className="overflow-hidden py-0">
              <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium">
                <Monitor className="size-4 text-muted-foreground" />
                Desktop
              </div>
              {report.screenshots.desktop ? (
                <img
                  src={report.screenshots.desktop}
                  alt={`Desktop-Ansicht von ${report.domain}`}
                  className="aspect-[4/3] w-full object-cover object-top"
                />
              ) : (
                <ScreenshotFallback />
              )}
            </Card>
            {report.screenshots.mobile && (
              <Card className="overflow-hidden py-0">
                <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium">
                  <Smartphone className="size-4 text-muted-foreground" />
                  Mobil
                </div>
                <img
                  src={report.screenshots.mobile}
                  alt={`Mobile Ansicht von ${report.domain}`}
                  className="mx-auto aspect-[3/4] w-2/3 object-cover object-top"
                />
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Detail findings */}
      {report.findings.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold tracking-tight">Detail-Findings</h3>
          {report.findings.map((f) => (
            <FindingCard key={f.sortOrder} finding={f} variant={variant} />
          ))}
        </div>
      )}

      {/* Next steps */}
      {report.nextSteps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Empfohlene nächste Schritte</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {report.nextSteps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* CTA */}
      <ReportCTA branding={branding} onCtaClick={onCtaClick} />

      <ReportDisclaimer language={report.reportLanguage} />
    </div>
  )
}

function ReportDisclaimer({ language }: { language: AuditReportData["reportLanguage"] }) {
  return (
    <footer className="print:break-inside-avoid">
      <p className="mx-auto max-w-[76ch] px-4 py-2 text-center text-[11px] leading-relaxed text-muted-foreground">
        {language === "en"
          ? "This report assesses publicly visible signals at the time of the audit. It is not legal, privacy, or security advice and does not guarantee revenue or business results."
          : "Dieser Report bewertet öffentlich sichtbare Signale zum Zeitpunkt des Audits. Er ist keine Rechts-, Datenschutz- oder Sicherheitsberatung und garantiert weder Umsatz noch Geschäftserfolg."}
      </p>
    </footer>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ReportHeader({
  report,
  variant,
}: {
  report: AuditReportData
  variant: "public" | "internal"
}) {
  const { branding } = report
  return (
    <Card className="overflow-hidden py-0">
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{ borderTopWidth: 4, borderTopColor: branding.accentColor }}
      >
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: branding.accentColor }}
        >
          {branding.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{branding.name}</p>
          <p className="truncate text-xs text-muted-foreground">Website-Audit</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground">{report.domain}</p>
          {variant === "public" && (
            <p className="text-xs text-muted-foreground">Audit-Report</p>
          )}
        </div>
      </div>
    </Card>
  )
}

function FindingCard({
  finding,
  variant,
}: {
  finding: AuditReportFinding
  variant: "public" | "internal"
}) {
  const sevMeta = severityMeta[finding.severity as keyof typeof severityMeta]
  return (
    <Card>
      <CardContent className="space-y-3 py-5">
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-semibold">{finding.title}</h4>
          {sevMeta && (
            <Badge className={cn("shrink-0 border-0 font-medium", sevMeta.badge)}>
              {sevMeta.label}
            </Badge>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FindingField label="Evidenz" value={finding.evidence} />
          <FindingField label="Erklärung" value={finding.explanation} />
          <FindingField label="Empfehlung" value={finding.recommendation} />
          {variant === "internal" && finding.salesAngle && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">
                Sales-Angle
              </p>
              <p className="mt-1 text-sm text-foreground/80">{finding.salesAngle}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function FindingField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm text-foreground/80">{value}</p>
    </div>
  )
}

function ScreenshotFallback() {
  return (
    <div className="flex aspect-[4/3] items-center justify-center bg-muted text-xs text-muted-foreground">
      Kein Screenshot verfügbar
    </div>
  )
}

function ReportCTA({
  branding,
  onCtaClick,
}: {
  branding: AuditReportData["branding"]
  onCtaClick?: () => void
}) {
  const ctaLabel = branding.ctaText || "In Kontakt treten"
  const ctaHref = resolveCtaHref(branding)
  const icon = ctaHref && ctaHref.startsWith("mailto:")
    ? <Mail className="size-4" />
    : <ArrowRight className="size-4" />

  if (!ctaHref) {
    return (
      <Card className="bg-muted/40">
        <CardContent className="flex items-center justify-center gap-2 py-5 text-center">
          <p className="text-sm text-muted-foreground">
            {branding.name} · {branding.contactEmail ?? branding.website ?? "Website-Audit"}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className="print:break-inside-avoid"
      style={{ borderTopWidth: 4, borderTopColor: branding.accentColor }}
    >
      <CardContent className="flex flex-col items-start gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">{ctaLabel}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {branding.name}
          </p>
        </div>
        <a
          href={ctaHref}
          target={ctaHref.startsWith("mailto:") ? undefined : "_blank"}
          rel="noreferrer"
          onClick={onCtaClick}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 no-underline"
          style={{ backgroundColor: branding.accentColor }}
        >
          {icon}
          {ctaLabel}
          {!ctaHref.startsWith("mailto:") && <ExternalLink className="size-3" />}
        </a>
      </CardContent>
    </Card>
  )
}

function resolveCtaHref(branding: AuditReportData["branding"]): string | null {
  if (branding.ctaUrl) {
    try {
      new URL(branding.ctaUrl)
      return branding.ctaUrl
    } catch {
      // fall through
    }
  }
  if (branding.website) {
    try {
      new URL(branding.website)
      return branding.website
    } catch {
      // fall through
    }
  }
  if (branding.contactEmail) {
    return `mailto:${branding.contactEmail}`
  }
  return null
}
