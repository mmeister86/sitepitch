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
  Printer,
  Link2,
  Link2Off,
} from "lucide-react"
import { toast } from "@/components/ui/sonner"
import { useState, type ReactNode } from "react"
import { useAction, useMutation, useQuery } from "convex/react"

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
import {
  SeverityBadge,
  LeadStatusBadge,
  ScoreBadge,
  AuditStatusBadge,
} from "@/components/status-badges"
import { CopyButton } from "@/components/copy-button"
import { AuditReport } from "@/components/audit-report"
import { OutreachWorkflows } from "@/components/outreach-workflows"
import { PersonaPanel } from "@/components/persona-panel"
import { CopyReviewPanel } from "@/components/copy-review"
import { DesignCritiquePanel } from "@/components/design-critique"
import { useRouter } from "@/lib/router"
import { auditById, campaignById } from "@/lib/mock-data"
import {
  scoreColorVar,
  scoreTextClass,
  leadStatusMeta,
  formatRelative,
} from "@/lib/scores"
import { cn } from "@/lib/utils"
import { authClient } from "@/lib/auth-client"
import { getUserDisplayName, personalizeOutreachText } from "@/lib/user-display"
import type { Audit, AuditHistoryEntry, CheckResult, LeadStatus, FindingSeverity } from "@/lib/types"
import { api } from "../../convex/_generated/api"
import type { Doc, Id } from "../../convex/_generated/dataModel"
import { Spinner } from "@/components/ui/spinner"

const runningSteps = [
  "URL validiert",
  "Website geladen",
  "Inhalte extrahiert",
  "Screenshots erstellt",
  "Performance geprüft",
  "Findings werden geschrieben",
  "Outreach & Analysen",
]

const checkIcon: Record<CheckResult["status"], ReactNode> = {
  passed: <CircleCheck className="size-4 text-score-strong" />,
  failed: <CircleX className="size-4 text-score-critical" />,
  warning: <CircleAlert className="size-4 text-score-weak" />,
  not_applicable: <MinusCircle className="size-4 text-muted-foreground" />,
}

type LiveAudit = Doc<"audits">

const liveAuditStages: Array<{
  status: LiveAudit["status"]
  title: string
  description: string
}> = [
  {
    status: "queued",
    title: "In Warteschlange",
    description: "Der Audit wartet auf den Start durch die Pipeline.",
  },
  {
    status: "validating_url",
    title: "URL prüfen",
    description: "URL wird normalisiert und gegen private Ziele geprüft.",
  },
  {
    status: "fetching_html",
    title: "HTML laden",
    description: "Der Zielserver wird angefragt und die erste Antwort geprüft.",
  },
  {
    status: "extracting_content",
    title: "Inhalte extrahieren",
    description: "Die relevanten Inhalte werden aus dem Seitenquelltext gelesen.",
  },
  {
    status: "taking_screenshots",
    title: "Screenshots",
    description: "Desktop- und Mobile-Ansichten werden vorbereitet.",
  },
  {
    status: "running_performance_checks",
    title: "Performance",
    description: "Die technischen Leistungswerte werden erfasst.",
  },
  {
    status: "fetching_business_data",
    title: "Externe Prüfungen",
    description: "Performance, Screenshots und lokale Firmendaten werden abgeglichen.",
  },
  {
    status: "running_deterministic_checks",
    title: "Checks zusammenführen",
    description: "Die gesammelten Ergebnisse werden verdichtet und bewertet.",
  },
  {
    status: "generating_findings",
    title: "Findings vorbereiten",
    description: "Die strukturierten Befunde werden für den Report aufbereitet.",
  },
  {
    status: "generating_outreach",
    title: "Outreach & Analysen",
    description: "Outreach-Texte, Copy-Review, Persona-Perspektiven und Design-Kritik werden erstellt.",
  },
  {
    status: "calculating_scores",
    title: "Scores berechnen",
    description: "Checks, Persona-Perspektiven und Design-Kritik werden zum finalen Score zusammengeführt.",
  },
  {
    status: "completed",
    title: "Abgeschlossen",
    description: "Der Report ist fertig und kann geöffnet werden.",
  },
]

export function AuditDetailView({ id }: { id: string }) {
  const { navigate } = useRouter()
  const data = useQuery(api.workspaces.getMyWorkspace)
  const session = authClient.useSession()
  const isMockAudit = id.startsWith("aud_")
  const audit = isMockAudit ? auditById(id) : null
  const displayName = getUserDisplayName(
    data?.user.name ?? session.data?.user?.name,
    data?.user.email ?? session.data?.user?.email
  )
  const branding = {
    name: data?.workspace.name ?? "Workspace",
    accentColor: data?.workspace.accentColor ?? "#5b5bd6",
    ctaText: data?.workspace.ctaText ?? "",
  }

  if (!isMockAudit) {
    return <LiveAuditDetail id={id} />
  }

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
      {audit.status === "completed" && (
        <CompletedReport audit={audit} displayName={displayName} branding={branding} />
      )}
    </div>
  )
}

function LiveAuditDetail({ id }: { id: string }) {
  const { navigate } = useRouter()
  const report = useQuery(api.reports.getInternalReportById, {
    auditId: id as Id<"audits">,
  })

  if (report === undefined) {
    return (
      <div className="mx-auto flex min-h-[40vh] items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    )
  }

  if (report === null) {
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

  if (report.status === "completed") {
    return <LiveCompletedReport report={report} navigate={navigate} />
  }

  if (report.status === "failed") {
    return <LiveFailedReport report={report} navigate={navigate} />
  }

  return <LiveProgressReport report={report} navigate={navigate} />
}

const shareBaseUrl =
  typeof window !== "undefined" ? window.location.origin : "https://trysitepitch.com"

function buildShareUrl(slug: string): string {
  return `${shareBaseUrl}/r/${slug}`
}

type ProviderCallStatus = "queued" | "started" | "completed" | "failed"

interface ProviderCallItem {
  operation: string
  status: ProviderCallStatus
  attempt: number
  latencyMs?: number
  errorMessage?: string
}

interface ProviderCallsSummary {
  items: ProviderCallItem[]
  overall: "idle" | "running" | "completed" | "failed"
}

function providerCallLabel(operation: string): string {
  const labels: Record<string, string> = {
    capture_desktop_screenshot: "Desktop-Screenshot",
    capture_mobile_screenshot: "Mobile-Screenshot",
    run_mobile_pagespeed: "PageSpeed Mobile",
    run_desktop_pagespeed: "PageSpeed Desktop",
    search_business_data: "Firmendaten",
    scrape_homepage: "Startseite laden",
    fetch_priority_page: "Zusätzliche Seite laden",
    map_site_urls: "Seiten verzeichnen",
  }
  return labels[operation] ?? operation
}

function providerCallStatusText(status: ProviderCallStatus): string {
  switch (status) {
    case "queued":
      return "wartend"
    case "started":
      return "läuft"
    case "completed":
      return "abgeschlossen"
    case "failed":
      return "fehlgeschlagen"
  }
}

function ProviderCallStatusIcon({ status }: { status: ProviderCallStatus }) {
  if (status === "completed") {
    return <CircleCheck className="size-4 text-score-strong" />
  }
  if (status === "failed") {
    return <CircleX className="size-4 text-score-critical" />
  }
  return <Loader2 className="size-4 animate-spin text-primary" />
}

function ProviderSubstatus({ providerCalls }: { providerCalls?: ProviderCallsSummary }) {
  if (!providerCalls || providerCalls.items.length === 0) {
    return null
  }

  const items = providerCalls.items
    .slice()
    .sort((a, b) => {
      const order: Record<ProviderCallStatus, number> = {
        started: 0,
        queued: 1,
        failed: 2,
        completed: 3,
      }
      return order[a.status] - order[b.status]
    })

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-xs font-medium text-muted-foreground">Aktuelle Prüfungen</div>
      <div className="mt-2 space-y-2">
        {items.map((item, index) => (
          <div key={`${item.operation}-${index}`} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <ProviderCallStatusIcon status={item.status} />
              <span>{providerCallLabel(item.operation)}</span>
              {item.attempt > 1 && (
                <span className="text-xs text-muted-foreground">(Versuch {item.attempt})</span>
              )}
            </div>
            <span
              className={cn(
                "text-xs",
                item.status === "failed"
                  ? "text-score-critical"
                  : item.status === "completed"
                    ? "text-score-strong"
                    : "text-muted-foreground",
              )}
            >
              {providerCallStatusText(item.status)}
            </span>
          </div>
        ))}
      </div>
      {providerCalls.overall === "failed" && (
        <p className="mt-2 text-xs text-score-critical">
          Einige optionale Prüfungen konnten nicht abgeschlossen werden. Der Audit läuft trotzdem weiter.
        </p>
      )}
    </div>
  )
}

function LiveProgressReport({
  report,
  navigate,
}: {
  report: NonNullable<ReturnType<typeof useQuery<typeof api.reports.getInternalReportById>>>
  navigate: ReturnType<typeof useRouter>["navigate"]
}) {
  const stageIndex = liveAuditStages.findIndex((stage) => stage.status === report.status)
  const progress =
    stageIndex < 0 ? 0 : Math.min(100, ((stageIndex + 1) / liveAuditStages.length) * 100)
  const currentStage = liveAuditStages[stageIndex >= 0 ? stageIndex : 0]

  return (
    <div className="mx-auto w-full max-w-[960px] space-y-5 p-4 md:p-6">
      <button
        onClick={() => navigate({ name: "audits" })}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Audit-Inbox
      </button>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <span>{report.domain}</span>
                <AuditStatusBadge status={report.status} />
              </CardTitle>
              <CardDescription className="mt-1 break-all">
                {report.normalizedUrl}
              </CardDescription>
            </div>
            <Button variant="outline" className="gap-2" asChild>
              <a href={report.normalizedUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                Website öffnen
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Audit-Typ</div>
              <div className="mt-1 text-sm font-medium capitalize">{report.auditType}</div>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Report-Sprache</div>
              <div className="mt-1 text-sm font-medium">
                {report.reportLanguage === "de" ? "Deutsch" : "English"}
              </div>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="mt-1 text-sm font-medium">
                {currentStage ? currentStage.title : report.status}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {currentStage ? currentStage.title : "Audit läuft"}
              </span>
              <span className="font-medium tabular-nums">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            {report.statusMessage && (
              <p className="text-sm text-muted-foreground">{report.statusMessage}</p>
            )}
            {report.status !== "completed" && report.status !== "failed" && (
              <ProviderSubstatus providerCalls={report.providerCalls} />
            )}
          </div>

          <div className="space-y-2">
            {liveAuditStages.map((stage, index) => {
              const done = index < stageIndex
              const active = index === stageIndex
              return (
                <div
                  key={stage.status}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3",
                    done ? "bg-score-strong/5" : active ? "bg-primary/5" : "bg-background",
                  )}
                >
                  <div className="mt-0.5">
                    {done ? (
                      <CircleCheck className="size-5 text-score-strong" />
                    ) : active ? (
                      <Loader2 className="size-5 animate-spin text-primary" />
                    ) : (
                      <MinusCircle className="size-5 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{stage.title}</div>
                    <div className="text-xs text-muted-foreground">{stage.description}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function LiveFailedReport({
  report,
  navigate,
}: {
  report: NonNullable<ReturnType<typeof useQuery<typeof api.reports.getInternalReportById>>>
  navigate: ReturnType<typeof useRouter>["navigate"]
}) {
  return (
    <div className="mx-auto w-full max-w-[640px] space-y-5 p-4 md:p-6">
      <button
        onClick={() => navigate({ name: "audits" })}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Audit-Inbox
      </button>
      <Card className="border-score-critical/30 bg-score-critical/5">
        <CardContent className="flex flex-col items-start gap-4 py-8 sm:flex-row sm:items-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-score-critical/15">
            <TriangleAlert className="size-6 text-score-critical" />
          </span>
          <div className="flex-1">
            <h3 className="font-semibold">Audit fehlgeschlagen</h3>
            <p className="mt-1 break-all text-sm text-muted-foreground">
              {report.errorMessage ?? report.statusMessage ?? "Unbekannter Fehler."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Es wurde kein Credit verbraucht.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function LiveCompletedReport({
  report,
  navigate,
}: {
  report: NonNullable<ReturnType<typeof useQuery<typeof api.reports.getInternalReportById>>>
  navigate: ReturnType<typeof useRouter>["navigate"]
}) {
  const setPublic = useMutation(api.reports.setPublicReportEnabled)
  const recordCopy = useMutation(api.reports.recordReportCopyEvent)
  const generateDesignCritique = useAction(api.audit_agent_action.generateDesignCritique)
  const [isGeneratingDesignCritique, setIsGeneratingDesignCritique] = useState(false)
  const shareUrl = buildShareUrl(report.publicSlug)
  const hasOutreach = report.outreachDrafts.length > 0
  const hasChecks = report.checks.length > 0
  const hasPersonas = report.personaReviews.length > 0
  const hasCopyReview = report.copyReview !== null

  const togglePublic = async (enabled: boolean) => {
    try {
      await setPublic({ auditId: report.auditId, enabled })
      toast.success(
        enabled ? "Report freigegeben" : "Report deaktiviert",
        { description: enabled ? shareUrl : undefined },
      )
    } catch {
      toast.error("Freigabe konnte nicht geändert werden")
    }
  }

  const recordPublicLinkCopy = async () => {
    try {
      await recordCopy({ auditId: report.auditId, kind: "public_link" })
    } catch {
      /* analytics only */
    }
  }

  const handleGenerateDesignCritique = async () => {
    setIsGeneratingDesignCritique(true)
    try {
      await generateDesignCritique({ auditId: report.auditId })
      toast.success("Design-Analyse erzeugt")
    } catch {
      toast.error("Design-Analyse konnte nicht erzeugt werden")
    } finally {
      setIsGeneratingDesignCritique(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5 p-4 md:p-6">
      {/* Back button */}
      <button
        onClick={() => navigate({ name: "audits" })}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground no-print"
      >
        <ArrowLeft className="size-4" />
        Audit-Inbox
      </button>

      {/* Header with controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{report.domain}</h2>
            <AuditStatusBadge status={report.status} />
          </div>
          <p className="mt-1 break-all text-sm text-muted-foreground">{report.normalizedUrl}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 no-print">
          <Button variant="outline" className="gap-2" asChild>
            <a href={report.normalizedUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              Website
            </a>
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => window.print()}>
            <Printer className="size-4" />
            Drucken
          </Button>
          {report.isPublic ? (
            <>
              <CopyButton text={shareUrl} label="Link kopieren" toastMessage="Report-Link kopiert" onCopied={recordPublicLinkCopy} />
              <Button variant="outline" className="gap-2" asChild>
                <a href={`/r/${report.publicSlug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Öffnen
                </a>
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => togglePublic(false)}
              >
                <Link2Off className="size-4" />
                Deaktivieren
              </Button>
            </>
          ) : (
            <Button className="gap-2" onClick={() => togglePublic(true)}>
              <Link2 className="size-4" />
              Report freigeben
            </Button>
          )}
        </div>
      </div>

      {/* Warnings */}
      {report.warnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-score-weak/30 bg-score-weak/5 p-3 text-sm text-muted-foreground no-print">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-score-weak" />
          <div>
            <span className="font-medium text-foreground">Unvollständige Daten:</span>{" "}
            {report.warnings.join(", ")}
          </div>
        </div>
      )}

      {/* Engagement strip */}
      <Card className="py-0 no-print">
        <CardContent className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border p-0 sm:grid-cols-3">
          <EngagementStat icon={<Eye className="size-4" />} label="Report Views" value={report.viewCount} />
          <EngagementStat icon={<CircleCheck className="size-4" />} label="Öffentlich" value={report.isPublic ? "Ja" : "Nein"} />
          <EngagementStat icon={<ShieldCheck className="size-4" />} label="Findings" value={report.findings.length} />
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="report" className="w-full">
        <TabsList className="no-print">
          <TabsTrigger value="report">Report</TabsTrigger>
          <TabsTrigger value="findings">
            Findings
            <Badge className="ml-1.5 h-5 min-w-5 border-0 bg-muted px-1 text-muted-foreground">
              {report.findings.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="copy" className="no-print">
            Copy
          </TabsTrigger>
          <TabsTrigger value="design" className="no-print">
            Design
          </TabsTrigger>
          <TabsTrigger value="personas" className="no-print">
            Personas
            {hasPersonas && (
              <Badge className="ml-1.5 h-5 min-w-5 border-0 bg-muted px-1 text-muted-foreground">
                {report.personaReviews.length}
              </Badge>
            )}
          </TabsTrigger>
          {hasOutreach && <TabsTrigger value="outreach">Outreach</TabsTrigger>}
          {hasChecks && <TabsTrigger value="checks">Checks</TabsTrigger>}
        </TabsList>

        <TabsContent value="report">
          <AuditReport report={report} variant="internal" />
        </TabsContent>

        <TabsContent value="findings" className="space-y-3">
          {report.findings.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Keine Findings verfügbar.
              </CardContent>
            </Card>
          ) : (
            report.findings.map((f) => (
              <Card key={f.sortOrder}>
                <CardContent className="space-y-3 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold">{f.title}</h3>
                    <SeverityBadge severity={f.severity as FindingSeverity} />
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
            ))
          )}
        </TabsContent>

        <TabsContent value="copy" className="no-print">
          <CopyReviewPanel review={report.copyReview} />
        </TabsContent>

        <TabsContent value="design" className="no-print">
          <DesignCritiquePanel
            critique={report.designCritique}
            isGenerating={isGeneratingDesignCritique}
            onGenerate={handleGenerateDesignCritique}
          />
        </TabsContent>

        <TabsContent value="personas" className="no-print">
          <PersonaPanel reviews={report.personaReviews} />
        </TabsContent>

        {hasOutreach && (
          <TabsContent value="outreach">
            <OutreachWorkflows
              auditId={report.auditId}
              outreachDrafts={report.outreachDrafts}
              shareUrl={shareUrl}
              isPublic={report.isPublic}
              onEnablePublic={report.isPublic ? undefined : () => togglePublic(true)}
            />
          </TabsContent>
        )}

        {hasChecks && (
          <TabsContent value="checks">
            <Card className="py-0">
              <CardHeader className="border-b py-4">
                <CardTitle className="text-base">Deterministische Checks</CardTitle>
                <CardDescription>
                  {report.checks.filter((c) => c.status === "passed").length} von{" "}
                  {report.checks.length} bestanden
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {report.checks.map((c) => (
                    <li key={`${c.category}-${c.key}`} className="flex items-center gap-3 px-6 py-3">
                      {checkIcon[c.status as keyof typeof checkIcon] ?? (
                        <MinusCircle className="size-4 text-muted-foreground" />
                      )}
                      <span className="flex-1 text-sm">{c.label}</span>
                      <Badge className="border-0 bg-muted text-xs font-normal text-muted-foreground">
                        {c.category}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
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

function CompletedReport({
  audit,
  displayName,
  branding,
}: {
  audit: Audit
  displayName: string
  branding: { name: string; accentColor: string; ctaText: string }
}) {
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
          <ReportTab audit={audit} branding={branding} />
        </TabsContent>
        <TabsContent value="findings" className="space-y-3">
          <FindingsTab audit={audit} />
        </TabsContent>
        <TabsContent value="outreach" className="space-y-4">
          <OutreachTab
            audit={audit}
            displayName={displayName}
            workspaceName={branding.name}
          />
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

function ReportTab({
  audit,
  branding,
}: {
  audit: Audit
  branding: { name: string; accentColor: string; ctaText: string }
}) {
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
              style={{ backgroundColor: branding.accentColor }}
            >
              {branding.name.charAt(0)}
            </div>
            <div className="text-xs">
              <p className="font-medium text-foreground">Gebrandet für {branding.name}</p>
              <p className="text-muted-foreground">{branding.ctaText}</p>
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

function OutreachTab({
  audit,
  displayName,
  workspaceName,
}: {
  audit: Audit
  displayName: string
  workspaceName: string
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {audit.outreach.map((draft) => {
          const body = personalizeOutreachText(draft.body, displayName, workspaceName)
          const full = draft.subject ? `Betreff: ${draft.subject}\n\n${body}` : body
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
                  {body}
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
