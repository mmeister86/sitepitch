"use client"

import { useMemo, useState } from "react"
import { useAction, useQuery } from "convex/react"
import { useReducedMotion } from "motion/react"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  CircleDashed,
  FlaskConical,
  History,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/sonner"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

const DIMENSIONS = ["summary", "findings", "outreach", "evidence", "claim_safety"] as const
type EvalDimension = (typeof DIMENSIONS)[number]

const DIMENSION_LABELS: Record<EvalDimension, string> = {
  summary: "Summary",
  findings: "Findings",
  outreach: "Outreach-Tonalität",
  evidence: "Evidenzbezug",
  claim_safety: "Claim Safety",
}

const EVAL_CHART_CONFIG = {
  score: { label: "Score", color: "var(--color-chart-1)" },
} satisfies ChartConfig

const DATE_TIME = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
})

type RecoveryAction = "revalidate" | "regenerate" | "fallback" | "activate"

function formatDate(value: number | null | undefined): string {
  return value ? DATE_TIME.format(new Date(value)) : "—"
}

function score100(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0
  return Math.round(Math.max(0, Math.min(100, value <= 1 ? value * 100 : value)))
}

function gateLabel(status: string): string {
  switch (status) {
    case "passed": return "Gate bestanden"
    case "failed": return "Gate fehlgeschlagen"
    case "running": return "Gate läuft"
    default: return "Kein Kandidat"
  }
}

function GateBadge({ status }: { status: string }) {
  const passed = status === "passed"
  const failed = status === "failed"
  return (
    <Badge variant={failed ? "destructive" : passed ? "secondary" : "outline"} className="gap-1.5 font-normal">
      {passed ? <CheckCircle2 /> : failed ? <TriangleAlert /> : <CircleDashed className={status === "running" ? "animate-spin" : ""} />}
      {gateLabel(status)}
    </Badge>
  )
}

function DimensionResult({ label, score, passed }: { label: string; score: number; passed: boolean }) {
  const normalized = score100(score)
  return (
    <div className="grid gap-2 border-b py-3 last:border-b-0 sm:grid-cols-[minmax(10rem,1fr)_minmax(12rem,2fr)_4rem] sm:items-center">
      <div className="flex items-center gap-2">
        {passed ? <Check className="size-4 text-score-strong" /> : <X className="size-4 text-destructive" />}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <Progress value={normalized} aria-label={`${label}: ${normalized} von 100`} />
      <span className="text-right text-sm font-semibold tabular-nums">{normalized}</span>
    </div>
  )
}

export function AdminEvalsView() {
  const prefersReducedMotion = useReducedMotion()
  const access = useQuery(api.eve_evals.getAccess)
  const [dimension, setDimension] = useState<EvalDimension>("summary")
  const overview = useQuery(api.eve_evals.getOverview, access?.allowed ? { dimension } : "skip")
  const [runsCursor, setRunsCursor] = useState<string | null>(null)
  const [runsCursorHistory, setRunsCursorHistory] = useState<Array<string | null>>([])
  const runs = useQuery(
    api.eve_evals.listRuns,
    access?.allowed ? {
      ...(runsCursor ? { cursor: runsCursor } : {}),
      limit: 20,
    } : "skip",
  )
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [casesCursor, setCasesCursor] = useState<string | null>(null)
  const [casesCursorHistory, setCasesCursorHistory] = useState<Array<string | null>>([])
  const effectiveRunId = selectedRunId ?? overview?.candidateRunId ?? overview?.baselineRunId ?? null
  const cases = useQuery(
    api.eve_evals.listCaseResults,
    access?.allowed && effectiveRunId
      ? { runId: effectiveRunId, ...(casesCursor ? { cursor: casesCursor } : {}), limit: 20 }
      : "skip",
  )

  const currentRun = useMemo(
    () => runs?.page.find((run) => run.runId === effectiveRunId) ?? null,
    [effectiveRunId, runs?.page],
  )

  if (access === undefined) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Spinner className="size-6 text-primary" /></div>
  }

  if (!access.allowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted"><Lock className="size-6 text-muted-foreground" /></div>
          <h1 className="text-lg font-semibold tracking-tight">Kein Support-Zugriff</h1>
          <p className="mt-2 text-sm text-muted-foreground">Eval-Ergebnisse enthalten interne Release-Metadaten und sind nur für Support-Admins sichtbar.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-8 p-4 md:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <FlaskConical className="size-5 text-primary" />
            Eve Release-Gate
          </h2>
          <p className="mt-1 max-w-[72ch] text-sm leading-relaxed text-muted-foreground">
            Vergleiche Kandidaten mit der zuletzt freigegebenen Baseline. Prompt- und Skill-Releases bleiben bewusst repo-basiert.
          </p>
        </div>
        {overview ? <GateBadge status={overview.gateStatus} /> : null}
      </header>

      {overview === undefined ? (
        <div className="flex min-h-72 items-center justify-center"><Spinner className="size-6 text-primary" /></div>
      ) : (
        <>
          <section aria-labelledby="release-comparison-heading" className="overflow-hidden rounded-xl border bg-card">
            <div className="grid gap-0 lg:grid-cols-[minmax(18rem,0.9fr)_minmax(24rem,1.4fr)]">
              <div className="border-b p-5 lg:border-b-0 lg:border-r lg:p-6">
                <h3 id="release-comparison-heading" className="text-base font-semibold">Release-Vergleich</h3>
                <div className="mt-5 space-y-5">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Freigegebene Baseline</p>
                    <p className="mt-1 break-all text-sm font-semibold">{overview.baselineRunId ?? "Noch nicht vorhanden"}</p>
                  </div>
                  <div className="flex items-center gap-3" aria-hidden="true">
                    <span className="h-px flex-1 bg-border" />
                    <ArrowRight className="size-4 text-muted-foreground" />
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Aktueller Kandidat</p>
                    <p className="mt-1 break-all text-sm font-semibold">{overview.candidateRunId ?? "Kein Kandidat"}</p>
                    {currentRun ? (
                      <p className="mt-1 text-xs text-muted-foreground">Release {currentRun.releaseVersion} · Suite {currentRun.suiteVersion}</p>
                    ) : null}
                  </div>
                </div>
                <Alert className="mt-6">
                  <ShieldCheck className="size-4" />
                  <AlertTitle>Kein Unsafe-Override</AlertTitle>
                  <AlertDescription>Schema, Evidenz und Claim Safety müssen vollständig bestehen.</AlertDescription>
                </Alert>
              </div>
              <div className="p-5 lg:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold">Qualitätsdimensionen</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Sichtbare Scores sind auf 0–100 normalisiert.</p>
                  </div>
                  <GateBadge status={overview.gateStatus} />
                </div>
                <div className="mt-4">
                  {overview.dimensions.map((result) => (
                    <DimensionResult
                      key={result.key}
                      label={DIMENSION_LABELS[result.key as EvalDimension] ?? result.key}
                      score={result.score}
                      passed={result.passed}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section aria-labelledby="quality-trend-heading" className="rounded-xl border bg-card p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 id="quality-trend-heading" className="text-base font-semibold">Qualitätstrend</h3>
                <p className="mt-1 text-sm text-muted-foreground">Sanitisierte Main- und Nightly-Ergebnisse der letzten 180 Tage.</p>
              </div>
              <Select value={dimension} onValueChange={(value) => setDimension(value as EvalDimension)}>
                <SelectTrigger className="w-full sm:w-52" aria-label="Qualitätsdimension auswählen"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIMENSIONS.map((key) => <SelectItem key={key} value={key}>{DIMENSION_LABELS[key]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {overview.trends.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
                <History className="size-7 text-muted-foreground/60" />
                <p className="text-sm font-medium">Noch keine Trenddaten</p>
                <p className="text-sm text-muted-foreground">Nach dem ersten signierten Eval-Run erscheint der Verlauf hier.</p>
              </div>
            ) : (
              <ChartContainer config={EVAL_CHART_CONFIG} className="mt-5 aspect-auto h-64 w-full">
                <LineChart
                  data={overview.trends.map((point) => ({
                    ...point,
                    score: score100(point.score),
                    date: new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short" }).format(new Date(point.timestamp)),
                  }))}
                  margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={40} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="var(--color-score)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={!prefersReducedMotion}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </section>
        </>
      )}

      <section aria-labelledby="eval-runs-heading" className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-4 py-5 sm:px-6">
          <h3 id="eval-runs-heading" className="text-base font-semibold">Eval-Läufe</h3>
          <p className="mt-1 text-sm text-muted-foreground">Wähle einen Lauf, um Fallregressionen und Gate-Fehler zu prüfen.</p>
        </div>
        {runs === undefined ? (
          <div className="flex min-h-48 items-center justify-center"><Spinner className="size-6 text-primary" /></div>
        ) : runs.page.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-6 text-center">
            <Bot className="size-7 text-muted-foreground/60" />
            <p className="text-sm font-medium">Keine Eval-Läufe gespeichert</p>
            <p className="text-sm text-muted-foreground">CI überträgt ausschließlich sanitisierte Scores, Gates und Fehlercodes.</p>
          </div>
        ) : (
          <div className="divide-y">
            {runs.page.map((run) => {
              const selected = effectiveRunId === run.runId
              return (
                <button
                  key={run.runId}
                  type="button"
                  className={cn("flex w-full flex-col gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/45 sm:px-6 lg:flex-row lg:items-center lg:justify-between", selected && "bg-primary/5")}
                  aria-pressed={selected}
                  onClick={() => { setSelectedRunId(run.runId); setCasesCursor(null); setCasesCursorHistory([]) }}
                >
                  <span className="min-w-0 space-y-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">Release {run.releaseVersion}</span>
                      <GateBadge status={run.status} />
                      {run.runId === overview?.baselineRunId ? <Badge variant="outline">Baseline</Badge> : null}
                    </span>
                    <span className="block text-xs text-muted-foreground">Suite {run.suiteVersion} · {formatDate(run.completedAt ?? run.startedAt)}</span>
                    {run.buildSha ? <code className="block text-xs text-muted-foreground">Build {run.buildSha}</code> : null}
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              )
            })}
          </div>
        )}
        {runs && runs.page.length > 0 ? (
          <div className="flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-6">
            <Button
              variant="ghost"
              size="sm"
              disabled={runsCursorHistory.length === 0}
              onClick={() => {
                const history = [...runsCursorHistory]
                const previous = history.pop() ?? null
                setRunsCursorHistory(history)
                setRunsCursor(previous)
              }}
            ><ArrowLeft className="size-4" /> Zurück</Button>
            <Button
              variant="outline"
              size="sm"
              disabled={runs.isDone || !runs.continueCursor}
              onClick={() => {
                setRunsCursorHistory((history) => [...history, runsCursor])
                setRunsCursor(runs.continueCursor ?? null)
              }}
            >Weitere Läufe <ArrowRight className="size-4" /></Button>
          </div>
        ) : null}
      </section>

      {effectiveRunId ? (
        <section aria-labelledby="case-results-heading" className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-4 py-5 sm:px-6">
            <h3 id="case-results-heading" className="text-base font-semibold">Fallregressionen</h3>
            <p className="mt-1 break-all text-sm text-muted-foreground">Run {effectiveRunId}</p>
          </div>
          {cases === undefined ? (
            <div className="flex min-h-48 items-center justify-center"><Spinner className="size-6 text-primary" /></div>
          ) : cases.page.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-6 text-center">
              <CheckCircle2 className="size-7 text-score-strong" />
              <p className="text-sm font-medium">Keine Fallresultate für diesen Lauf</p>
            </div>
          ) : (
            <div className="divide-y">
              {cases.page.map((result) => {
                const failed = result.status === "failed" || result.regressions.length > 0
                const values = [
                  ["Summary", result.scores.summary],
                  ["Findings", result.scores.findings],
                  ["Outreach", result.scores.outreach],
                  ["Evidence", result.scores.evidence],
                  ["Claims", result.scores.claimSafety],
                ] as const
                return (
                  <article key={result.caseId} className="space-y-4 px-4 py-5 sm:px-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-semibold">{result.caseId}</h4>
                          <Badge variant="outline" className="font-normal">{result.language.toUpperCase()}</Badge>
                          <Badge variant={failed ? "destructive" : "secondary"} className="font-normal">{failed ? "Regression" : "Bestanden"}</Badge>
                        </div>
                        {result.errorCode ? <p className="mt-1 text-xs text-destructive">Fehlercode: {result.errorCode}</p> : null}
                      </div>
                      {result.regressions.length > 0 ? (
                        <div className="max-w-xl space-y-1 text-xs text-destructive">
                          {result.regressions.map((regression) => <p key={regression} className="flex items-start gap-1.5"><AlertTriangle className="mt-0.5 size-3 shrink-0" />{regression}</p>)}
                        </div>
                      ) : null}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-5">
                      {values.map(([label, value]) => (
                        <div key={label} className="rounded-md bg-muted/55 px-3 py-2">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="mt-0.5 text-sm font-semibold tabular-nums">{score100(value)}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
          {cases && cases.page.length > 0 ? (
            <div className="flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-6">
              <Button
                variant="ghost"
                size="sm"
                disabled={casesCursorHistory.length === 0}
                onClick={() => {
                  const history = [...casesCursorHistory]
                  const previous = history.pop() ?? null
                  setCasesCursorHistory(history)
                  setCasesCursor(previous)
                }}
              ><ArrowLeft className="size-4" /> Zurück</Button>
              <Button
                variant="outline"
                size="sm"
                disabled={cases.isDone || !cases.continueCursor}
                onClick={() => {
                  setCasesCursorHistory((history) => [...history, casesCursor])
                  setCasesCursor(cases.continueCursor ?? null)
                }}
              >Weitere Fälle <ArrowRight className="size-4" /></Button>
            </div>
          ) : null}
        </section>
      ) : null}

      <RecoveryConsole />
    </div>
  )
}

function RecoveryConsole() {
  const [auditIdDraft, setAuditIdDraft] = useState("")
  const [auditId, setAuditId] = useState<Id<"audits"> | null>(null)
  const [reason, setReason] = useState("")
  const [pendingAction, setPendingAction] = useState<RecoveryAction | null>(null)
  const [activationTarget, setActivationTarget] = useState<Id<"auditOutputVersions"> | null>(null)
  const versions = useQuery(api.audit_recovery.listVersions, auditId ? { auditId } : "skip")
  const revalidateActive = useAction(api.audit_recovery.revalidateActive)
  const regenerateCore = useAction(api.audit_recovery.regenerateCore)
  const createFallback = useAction(api.audit_recovery.createDeterministicFallback)
  const activateVersion = useAction(api.audit_recovery.activateVersion)

  async function runRecovery(action: RecoveryAction, versionId?: Id<"auditOutputVersions">) {
    if (!auditId || !reason.trim()) return
    setPendingAction(action)
    try {
      if (action === "revalidate") await revalidateActive({ auditId, reason: reason.trim() })
      if (action === "regenerate") await regenerateCore({ auditId, reason: reason.trim() })
      if (action === "fallback") await createFallback({ auditId, reason: reason.trim() })
      if (action === "activate" && versionId) await activateVersion({ auditId, versionId, reason: reason.trim() })
      toast.success(action === "activate" ? "Outputversion aktiviert" : "Recovery-Aktion eingeplant", {
        description: "Die Aktion ist kosten- und versionsbezogen protokolliert; Kundencredits bleiben unverändert.",
      })
      setActivationTarget(null)
      setReason("")
    } catch (error) {
      toast.error("Recovery-Aktion fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Prüfe Audit-ID, Limits und Versionsstatus.",
      })
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <section aria-labelledby="recovery-heading" className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-4 py-5 sm:px-6">
        <h3 id="recovery-heading" className="flex items-center gap-2 text-base font-semibold"><RotateCcw className="size-4 text-primary" /> Audit-Recovery</h3>
        <p className="mt-1 max-w-[72ch] text-sm leading-relaxed text-muted-foreground">
          Revalidiere oder regeneriere sichere Outputversionen ohne neue Kundencredits. Es gibt keinen Unsafe-Override.
        </p>
      </div>
      <div className="space-y-5 p-4 sm:p-6">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            const trimmed = auditIdDraft.trim()
            if (!/^[a-z0-9]{20,40}$/.test(trimmed)) {
              toast.error("Ungültiges Audit-ID-Format", { description: "Kopiere die interne ID direkt aus Operations." })
              return
            }
            setAuditId(trimmed as Id<"audits">)
          }}
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="recovery-audit-id">Interne Audit-ID aus Operations</Label>
            <Input id="recovery-audit-id" value={auditIdDraft} placeholder="Audit-ID einfügen" onChange={(event) => setAuditIdDraft(event.target.value)} />
          </div>
          <Button type="submit" variant="outline" className="mt-auto self-start" disabled={!auditIdDraft.trim()}>
            <RefreshCw className="size-4" /> Versionen laden
          </Button>
        </form>

        {auditId && versions === undefined ? <div className="flex min-h-28 items-center justify-center"><Spinner className="size-5 text-primary" /></div> : null}

        {versions ? (
          <>
            <div className="flex flex-col gap-3 rounded-lg bg-muted/45 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">{versions.audit.domain}</p>
                <p className="mt-1 text-xs text-muted-foreground">Status {versions.audit.status} · aktive Version {versions.audit.activeOutputVersionId ?? "keine"}</p>
              </div>
              <Badge variant="outline" className="self-start font-normal">{versions.versions.length} Versionen</Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recovery-reason">Protokollierter Grund für die nächste Aktion</Label>
              <Textarea
                id="recovery-reason"
                value={reason}
                maxLength={500}
                rows={3}
                placeholder="Was wurde geprüft und warum ist diese Recovery-Aktion erforderlich?"
                disabled={pendingAction !== null}
                onChange={(event) => setReason(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">Limits: 10 Aktionen/Stunde je Admin und 3/Stunde je Audit. Kosten werden intern erfasst.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!reason.trim() || pendingAction !== null} onClick={() => void runRecovery("revalidate")}>
                {pendingAction === "revalidate" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Aktive Version revalidieren
              </Button>
              <Button variant="outline" disabled={!reason.trim() || pendingAction !== null} onClick={() => void runRecovery("regenerate")}>
                {pendingAction === "regenerate" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Kern-Ausgabe regenerieren
              </Button>
              <Button variant="outline" disabled={!reason.trim() || pendingAction !== null} onClick={() => void runRecovery("fallback")}>
                {pendingAction === "fallback" ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />} Deterministischen Fallback erzeugen
              </Button>
            </div>

            <div className="divide-y rounded-lg border">
              {versions.versions.map((version) => {
                const safe = version.schemaPass && version.evidencePass && version.claimSafetyPass
                const active = versions.audit.activeOutputVersionId === version._id
                return (
                  <article key={version._id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">Version {version.versionNumber}</p>
                        <Badge variant={active ? "secondary" : "outline"} className="font-normal">{active ? "Aktiv" : version.status}</Badge>
                        <Badge variant={safe ? "secondary" : "destructive"} className="font-normal">{safe ? "Safety bestanden" : "Safety fehlgeschlagen"}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{version.executor} · {version.provider}/{version.model} · Release {version.releaseVersion} · {formatDate(version.createdAt)}</p>
                      <p className="text-xs text-muted-foreground">Prompt {version.promptVersion} · Schema {version.outputSchemaVersion}</p>
                      {version.rejectionCode ? <p className="text-xs text-destructive">Rejection: {version.rejectionCode}</p> : null}
                    </div>
                    {!active ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="self-start lg:self-auto"
                        disabled={!safe || !reason.trim() || pendingAction !== null}
                        onClick={() => setActivationTarget(version._id)}
                      >
                        <RotateCcw className="size-4" /> Nach Safety-Prüfung aktivieren
                      </Button>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </>
        ) : null}
      </div>

      <AlertDialog open={activationTarget !== null} onOpenChange={(open) => { if (!open && pendingAction === null) setActivationTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Frühere Outputversion aktivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              SitePitch führt die aktuelle Schema-, Evidence- und Claim-Safety-Prüfung erneut aus. Nur ein vollständiger Pass wird atomar aktiviert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Alert>
            <ShieldCheck className="size-4" />
            <AlertTitle>Sicherheitsprüfung bleibt zwingend</AlertTitle>
            <AlertDescription>Der aktive Report bleibt unverändert, falls die Version heute nicht mehr besteht.</AlertDescription>
          </Alert>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingAction !== null}>Abbrechen</AlertDialogCancel>
            <Button
              disabled={!activationTarget || !reason.trim() || pendingAction !== null}
              onClick={() => { if (activationTarget) void runRecovery("activate", activationTarget) }}
            >
              {pendingAction === "activate" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Prüfen und aktivieren
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

AdminEvalsView.displayName = "AdminEvalsView"
