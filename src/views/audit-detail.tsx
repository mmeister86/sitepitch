"use client"

import {
  ArrowLeft,
  ExternalLink,
  Eye,
  RefreshCw,
  MousePointerClick,
  Download,
  CircleCheck,
  CircleX,
  CircleAlert,
  MinusCircle,
  Loader2,
  TriangleAlert,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  ShieldCheck,
  Monitor,
  Smartphone,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react"
import { toast } from "sonner"
import type { ReactNode } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScoreRing } from "@/components/score-ring"
import { SeverityBadge, LeadStatusBadge, ScoreBadge } from "@/components/status-badges"
import { CopyButton } from "@/components/copy-button"
import { useRouter } from "@/lib/router"
import { auditById, campaignById, workspace } from "@/lib/mock-data"
import {
  scoreColorVar,
  scoreTextClass,
  leadStatusMeta,
  formatRelative,
} from "@/lib/scores"
import { cn } from "@/lib/utils"
import type { Audit, AuditHistoryEntry, CheckResult, LeadStatus } from "@/lib/types"

const runningSteps = [
  "URL validiert",
  "Website geladen",
  "Inhalte extrahiert",
  "Screenshots erstellt",
  "Performance geprüft",
  "Findings werden geschrieben",
]

const checkIcon: Record<CheckResult["status"], ReactNode> = {
  passed: <CircleCheck className="size-4 text-score-strong" />,
  failed: <CircleX className="size-4 text-score-critical" />,
  warning: <CircleAlert className="size-4 text-score-weak" />,
  not_applicable: <MinusCircle className="size-4 text-muted-foreground" />,
}

export function AuditDetailView({ id }: { id: string }) {
  const { navigate } = useRouter()
  const audit = auditById(id)

  if (!audit) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="text-sm text-muted-foreground">Audit nicht gefunden.</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => navigate({ name: "audits" })}>
          <ArrowLeft className="size-4" />
          Zurück zur Inbox
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5 p-4 md:p-6">
      <AuditHeader audit={audit} />
      {audit.status === "running" && <RunningState audit={audit} />}
      {audit.status === "failed" && <FailedState audit={audit} />}
      {audit.status === "completed" && <CompletedReport audit={audit} />}
    </div>
  )
}

function AuditHeader({ audit }: { audit: Audit }) {
  const { navigate } = useRouter()
  const shareUrl = `https://trysitepitch.com/r/${audit.publicSlug}`

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate({ name: "audits" })}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Audit-Inbox
      </button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{audit.businessName}</h2>
            <LeadStatusBadge status={audit.leadStatus} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <a
              href={audit.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              {audit.domain}
              <ExternalLink className="size-3" />
            </a>
            <span>·</span>
            <span>{audit.industry}, {audit.city}</span>
            {audit.campaignId && (
              <>
                <span>·</span>
                <span>{campaignById(audit.campaignId)?.name}</span>
              </>
            )}
          </div>
        </div>

        {audit.status === "completed" && (
          <div className="flex shrink-0 items-center gap-2">
            <StatusSelect status={audit.leadStatus} />
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => toast.success("Re-Audit gestartet", { description: "Der neue Score erscheint nach Abschluss im Verlauf." })}
            >
              <RefreshCw className="size-4" />
              Re-Audit
            </Button>
            <CopyButton
              text={shareUrl}
              label="Link teilen"
              toastMessage="Report-Link kopiert"
            />
            <Button className="gap-2" onClick={() => toast("Öffentlicher Report", { description: shareUrl })}>
              <ExternalLink className="size-4" />
              Report öffnen
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusSelect({ status }: { status: LeadStatus }) {
  return (
    <Select
      defaultValue={status}
      onValueChange={(v) =>
        toast.success("Status aktualisiert", {
          description: `Neu: ${leadStatusMeta[v as LeadStatus].label}`,
        })
      }
    >
      <SelectTrigger className="h-9 w-[150px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(leadStatusMeta) as LeadStatus[]).map((s) => (
          <SelectItem key={s} value={s}>
            {leadStatusMeta[s].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function RunningState({ audit }: { audit: Audit }) {
  const activeIndex = Math.floor((audit.progress / 100) * runningSteps.length)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit läuft …</CardTitle>
        <CardDescription>
          Der Fortschritt wird in Echtzeit angezeigt. Das dauert meist 1–4 Minuten.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Progress value={audit.progress} className="h-2" />
        <ol className="space-y-3">
          {runningSteps.map((step, i) => {
            const done = i < activeIndex
            const active = i === activeIndex
            return (
              <li key={step} className="flex items-center gap-3 text-sm">
                {done ? (
                  <CircleCheck className="size-5 text-score-strong" />
                ) : active ? (
                  <Loader2 className="size-5 animate-spin text-primary" />
                ) : (
                  <MinusCircle className="size-5 text-muted-foreground/30" />
                )}
                <span className={cn(!done && !active && "text-muted-foreground")}>{step}</span>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}

function FailedState({ audit }: { audit: Audit }) {
  return (
    <Card className="border-score-critical/30 bg-score-critical/5">
      <CardContent className="flex flex-col items-start gap-4 py-8 sm:flex-row sm:items-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-score-critical/15">
          <TriangleAlert className="size-6 text-score-critical" />
        </span>
        <div className="flex-1">
          <h3 className="font-semibold">Audit fehlgeschlagen</h3>
          <p className="mt-1 text-sm text-muted-foreground">{audit.errorMessage}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Es wurde kein Credit verbraucht.
          </p>
        </div>
        <Button
          className="gap-2"
          onClick={() => toast.success("Audit wird erneut versucht …")}
        >
          <RefreshCw className="size-4" />
          Erneut versuchen
        </Button>
      </CardContent>
    </Card>
  )
}

function CompletedReport({ audit }: { audit: Audit }) {
  const score = audit.overallScore!
  return (
    <>
      {/* Score overview */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <ScoreRing score={score} size={148} strokeWidth={12} />
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
            <CardDescription>{audit.summary.short.slice(0, 96)}…</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {audit.categoryScores.map((c) => (
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
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Engagement strip */}
      <Card className="py-0">
        <CardContent className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border p-0 sm:grid-cols-4">
          <EngagementStat icon={<Eye className="size-4" />} label="Report Views" value={audit.engagement.views} />
          <EngagementStat icon={<RefreshCw className="size-4" />} label="Erneut geöffnet" value={audit.engagement.reopened ? "Ja" : "Nein"} />
          <EngagementStat icon={<MousePointerClick className="size-4" />} label="CTA-Klicks" value={audit.engagement.ctaClicks} />
          <EngagementStat icon={<Download className="size-4" />} label="PDF-Downloads" value={audit.engagement.pdfDownloads} />
        </CardContent>
      </Card>

      {audit.history && audit.history.length >= 2 && (
        <HistorySection history={audit.history} />
      )}

      {/* Tabs */}
      <Tabs defaultValue="report" className="w-full">
        <TabsList>
          <TabsTrigger value="report">Report</TabsTrigger>
          <TabsTrigger value="findings">
            Findings
            <Badge className="ml-1.5 h-5 min-w-5 border-0 bg-muted px-1 text-muted-foreground">
              {audit.findings.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="outreach">Outreach</TabsTrigger>
          <TabsTrigger value="checks">Checks</TabsTrigger>
        </TabsList>

        <TabsContent value="report" className="space-y-4">
          <ReportTab audit={audit} />
        </TabsContent>
        <TabsContent value="findings" className="space-y-3">
          <FindingsTab audit={audit} />
        </TabsContent>
        <TabsContent value="outreach" className="space-y-4">
          <OutreachTab audit={audit} />
        </TabsContent>
        <TabsContent value="checks">
          <ChecksTab audit={audit} />
        </TabsContent>
      </Tabs>
    </>
  )
}

function HistorySection({ history }: { history: AuditHistoryEntry[] }) {
  const first = history[0]
  const latest = history[history.length - 1]
  const totalDelta = latest.overallScore - first.overallScore

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-4 text-score-strong" />
            Score-Verlauf
          </CardTitle>
          <CardDescription>
            Fortschritt über {history.length} Audits seit dem Erstkontakt
          </CardDescription>
        </div>
        {totalDelta !== 0 && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums",
              totalDelta > 0
                ? "bg-score-strong/15 text-score-strong"
                : "bg-score-critical/12 text-score-critical"
            )}
          >
            <ArrowUpRight className={cn("size-4", totalDelta < 0 && "rotate-90")} />
            {totalDelta > 0 ? "+" : ""}
            {totalDelta} Punkte
          </span>
        )}
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
          {history.map((entry, i) => {
            const prev = i > 0 ? history[i - 1] : undefined
            const delta = prev ? entry.overallScore - prev.overallScore : 0
            return (
              <li key={i} className="flex flex-1 items-center gap-4">
                {prev && (
                  <span
                    className={cn(
                      "hidden shrink-0 items-center gap-0.5 text-xs font-medium tabular-nums sm:inline-flex",
                      delta >= 0 ? "text-score-strong" : "text-score-critical"
                    )}
                  >
                    <ArrowUpRight className={cn("size-3", delta < 0 && "rotate-90")} />
                    {delta > 0 ? "+" : ""}
                    {delta}
                  </span>
                )}
                <div className="flex flex-1 items-center gap-3 rounded-xl border p-3">
                  <ScoreBadge score={entry.overallScore} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{entry.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatRelative(entry.at)}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}

function EngagementStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 bg-card px-5 py-4">
      <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <div>
        <div className="text-lg font-semibold tabular-nums leading-none">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}

function ReportTab({ audit }: { audit: Audit }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Kurzfazit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {audit.summary.short}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="size-4 text-primary" />
              Top-Chancen
            </CardTitle>
            <CardDescription>Priorisierte Gesprächsanlässe für den Outreach</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2.5">
              {audit.summary.topOpportunities.map((o, i) => (
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

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ThumbsUp className="size-4 text-score-strong" />
                Stärken
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {audit.summary.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-score-strong" />
                    {s}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ThumbsDown className="size-4 text-score-weak" />
                Schwächen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {audit.summary.weaknesses.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-score-weak" />
                    {s}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Screenshots + branding */}
      <div className="space-y-4">
        <Card className="overflow-hidden py-0">
          <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium">
            <Monitor className="size-4 text-muted-foreground" />
            Desktop
          </div>
          {audit.screenshotDesktop ? (
            <img
              src={audit.screenshotDesktop}
              alt={`Desktop-Ansicht von ${audit.domain}`}
              className="aspect-[4/3] w-full object-cover object-top"
            />
          ) : (
            <ScreenshotFallback />
          )}
        </Card>
        {audit.screenshotMobile && (
          <Card className="overflow-hidden py-0">
            <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium">
              <Smartphone className="size-4 text-muted-foreground" />
              Mobil
            </div>
            <img
              src={audit.screenshotMobile}
              alt={`Mobile Ansicht von ${audit.domain}`}
              className="mx-auto aspect-[3/4] w-2/3 object-cover object-top"
            />
          </Card>
        )}
        <Card className="bg-muted/40">
          <CardContent className="flex items-center gap-3 py-4">
            <div
              className="flex size-9 items-center justify-center rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: workspace.accentColor }}
            >
              {workspace.name.charAt(0)}
            </div>
            <div className="text-xs">
              <p className="font-medium text-foreground">Gebrandet für {workspace.name}</p>
              <p className="text-muted-foreground">{workspace.ctaText}</p>
            </div>
          </CardContent>
        </Card>
      </div>
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

function FindingsTab({ audit }: { audit: Audit }) {
  return (
    <>
      {audit.findings.map((f) => (
        <Card key={f.id}>
          <CardContent className="space-y-3 py-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">{f.title}</h3>
              <SeverityBadge severity={f.severity} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Evidenz" value={f.evidence} />
              <Field label="Erklärung" value={f.explanation} />
              <Field label="Empfehlung" value={f.recommendation} />
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-primary">
                  Sales-Angle
                </p>
                <p className="mt-1 text-sm text-foreground/80">{f.salesAngle}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm text-foreground/80">{value}</p>
    </div>
  )
}

function OutreachTab({ audit }: { audit: Audit }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {audit.outreach.map((draft) => {
          const full = draft.subject ? `Betreff: ${draft.subject}\n\n${draft.body}` : draft.body
          return (
            <Card key={draft.type}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="text-base">{draft.label}</CardTitle>
                  {draft.subject && (
                    <CardDescription className="mt-1 font-medium text-foreground/70">
                      {draft.subject}
                    </CardDescription>
                  )}
                </div>
                <CopyButton text={full} label="Kopieren" toastMessage={`${draft.label}-Text kopiert`} />
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 font-sans text-sm leading-relaxed text-foreground/80">
                  {draft.body}
                </pre>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="space-y-4">
        <Card className="border-score-strong/25 bg-score-strong/5">
          <CardContent className="space-y-2 py-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-score-strong" />
              <p className="text-sm font-medium">Claim-Safety geprüft</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Alle Texte wurden auf belegbare Aussagen geprüft. Keine rechtlichen,
              Umsatz- oder Security-Behauptungen ohne Evidenz.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tonalität</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {["Freundlich", "Direkt", "Beratend"].map((tone, i) => (
              <label
                key={tone}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                  i === 0 ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted/60"
                )}
              >
                <span
                  className={cn(
                    "size-3.5 rounded-full border-2",
                    i === 0 ? "border-primary bg-primary" : "border-muted-foreground/40"
                  )}
                />
                {tone}
              </label>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">
              Texte lassen sich als Workspace-Template speichern.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ChecksTab({ audit }: { audit: Audit }) {
  const passed = audit.checks.filter((c) => c.status === "passed").length
  return (
    <Card className="py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-base">Deterministische Checks</CardTitle>
        <CardDescription>
          {passed} von {audit.checks.length} bestanden · reproduzierbare Grundlage des Scores
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {audit.checks.map((c) => (
            <li key={c.key} className="flex items-center gap-3 px-6 py-3">
              {checkIcon[c.status]}
              <span className="flex-1 text-sm">{c.label}</span>
              <Badge className="border-0 bg-muted text-xs font-normal text-muted-foreground">
                {c.category}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
