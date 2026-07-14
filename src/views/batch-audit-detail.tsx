"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Ban,
  CircleCheck,
  CirclePause,
  CirclePlay,
  Coins,
  DatabaseZap,
  Loader2,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/sonner"
import { batchAuditApi } from "@/lib/batch-audit-api"
import {
  batchItemStatusLabel,
  batchJobStatusMeta,
  batchProgress,
  batchQaStatusMeta,
  formatBatchDate,
  formatUsd,
} from "@/lib/batch-audits"
import { useRouter } from "@/lib/router"
import { cn } from "@/lib/utils"
import type { Id } from "../../convex/_generated/dataModel"

type Control = "pause" | "resume" | "cancel" | null

export function BatchAuditDetailView({ id }: { id: string }) {
  const { navigate } = useRouter()
  const batchAuditJobId = id as Id<"batchAuditJobs">
  const data = useQuery(batchAuditApi.getBatch, { batchAuditJobId })
  const pauseBatch = useMutation(batchAuditApi.pauseBatch)
  const resumeBatch = useMutation(batchAuditApi.resumeBatch)
  const cancelBatch = useMutation(batchAuditApi.cancelBatch)
  const retryItem = useMutation(batchAuditApi.retryBatchItem)

  const [control, setControl] = useState<Control>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [retryingId, setRetryingId] = useState<Id<"batchAuditItems"> | null>(null)

  const failures = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of data?.items ?? []) {
      if (item.status !== "failed") continue
      const label = item.errorCode ?? "Unbekannter Fehler"
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return Array.from(counts, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
  }, [data?.items])

  async function runControl(next: Exclude<Control, null>) {
    if (control) return
    setControl(next)
    try {
      if (next === "pause") await pauseBatch({ batchAuditJobId })
      if (next === "resume") await resumeBatch({ batchAuditJobId })
      if (next === "cancel") await cancelBatch({ batchAuditJobId })
      toast.success(
        next === "pause" ? "Batch pausiert" : next === "resume" ? "Batch wird fortgesetzt" : "Batch abgebrochen",
      )
      setCancelOpen(false)
    } catch (error) {
      toast.error((error as Error)?.message ?? "Aktion konnte nicht ausgeführt werden")
    } finally {
      setControl(null)
    }
  }

  async function handleRetry(batchAuditItemId: Id<"batchAuditItems">) {
    if (retryingId) return
    setRetryingId(batchAuditItemId)
    try {
      await retryItem({ batchAuditItemId })
      toast.success("Website erneut eingeplant")
    } catch (error) {
      toast.error((error as Error)?.message ?? "Wiederholung konnte nicht gestartet werden")
    } finally {
      setRetryingId(null)
    }
  }

  if (data === undefined) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Spinner className="size-6 text-primary" /></div>
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-10 text-center">
        <p className="text-sm text-muted-foreground">Batch-Audit nicht gefunden.</p>
        <Button variant="outline" onClick={() => navigate({ name: "batch-audits" })}>
          <ArrowLeft className="size-4" /> Zurück zu Batch-Audits
        </Button>
      </div>
    )
  }

  const { job, items } = data
  const status = batchJobStatusMeta[job.status]
  const progress = batchProgress(job)
  const settled = job.completedItems + job.failedItems + job.cancelledItems
  const canCancel = job.status === "queued" || job.status === "running" || job.status === "paused"

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5 p-4 md:p-6">
      <button
        type="button"
        onClick={() => navigate({ name: "batch-audits" })}
        className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Zurück zu Batch-Audits
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              {job.campaignName ?? (job.source === "campaign" ? "Kampagnen-Batch" : "CSV-Batch")}
            </h2>
            <Badge variant="outline" className={cn("border-0", status.className)}>{status.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {job.totalItems} Websites · {job.auditType} · erstellt {formatBatchDate(job.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(job.status === "queued" || job.status === "running") && (
            <Button variant="outline" disabled={control !== null} onClick={() => void runControl("pause")}>
              {control === "pause" ? <Loader2 className="size-4 animate-spin" /> : <CirclePause className="size-4" />}
              Pausieren
            </Button>
          )}
          {job.status === "paused" && (
            <Button disabled={control !== null} onClick={() => void runControl("resume")}>
              {control === "resume" ? <Loader2 className="size-4 animate-spin" /> : <CirclePlay className="size-4" />}
              Fortsetzen
            </Button>
          )}
          {canCancel && (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={control !== null}
              onClick={() => setCancelOpen(true)}
            >
              <Ban className="size-4" /> Abbrechen
            </Button>
          )}
        </div>
      </div>

      <Card className="gap-0 py-0">
        <CardContent className="space-y-3 py-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{settled} von {job.totalItems} abgeschlossen</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {job.runningItems} aktiv · {job.queuedItems} warten · {job.failedItems} fehlgeschlagen
              </p>
            </div>
            <span className="text-sm font-semibold tabular-nums">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} aria-label={`Batch-Fortschritt ${Math.round(progress)} Prozent`} />
        </CardContent>
      </Card>

      <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: WalletCards,
            label: "Credits",
            value: `${job.consumedCredits} verbraucht`,
            detail: `${job.reservedCredits} reserviert · ${job.refundedCredits} erstattet`,
          },
          {
            icon: Coins,
            label: "Provider-Kosten",
            value: formatUsd(job.actualCostUsd ?? job.estimatedCostUsd),
            detail: `${job.providerRequestCount ?? 0} Requests`,
          },
          {
            icon: DatabaseZap,
            label: "Cache",
            value: `${job.cacheHitItems} Websites`,
            detail: `${job.cacheHitOperations} Operationen wiederverwendet`,
          },
          {
            icon: ShieldCheck,
            label: "Stichproben-QA",
            value: `${job.qaPassedItems}/${job.qaSelectedItems} bestanden`,
            detail: `${job.qaFailedItems} auffällig`,
          },
        ].map((metric) => (
          <div key={metric.label} className="bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <metric.icon className="size-4" aria-hidden="true" />
              {metric.label}
            </div>
            <p className="mt-2 text-lg font-semibold tabular-nums">{metric.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{metric.detail}</p>
          </div>
        ))}
      </div>

      {failures.length > 0 && (
        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-destructive" aria-hidden="true" />
              <h3 className="text-sm font-semibold">Fehlerübersicht</h3>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 py-4">
            {failures.map((failure) => (
              <Badge key={failure.label} variant="outline" className="gap-1.5">
                <span className="font-semibold tabular-nums">{failure.count}</span>
                {failure.label}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Websites</h3>
            <span className="text-xs text-muted-foreground">{items.length} Einträge</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {items.map((item) => {
              const qa = batchQaStatusMeta[item.qaStatus]
              return (
                <div
                  key={item._id}
                  className="grid gap-3 px-4 py-4 sm:px-6 lg:grid-cols-[2rem_minmax(0,1fr)_9rem_9rem_auto] lg:items-center"
                >
                  <span className="hidden text-xs tabular-nums text-muted-foreground lg:block">{item.position + 1}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {item.status === "completed" ? (
                        <CircleCheck className="size-4 shrink-0 text-score-strong" aria-hidden="true" />
                      ) : item.status === "failed" ? (
                        <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                      ) : item.status === "running" ? (
                        <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
                      ) : null}
                      <p className="truncate text-sm font-medium">{item.domain}</p>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground" title={item.url}>{item.url}</p>
                    {item.errorMessage && (
                      <p className="mt-1 text-xs text-destructive">{item.errorMessage}</p>
                    )}
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Status </span>
                    <span className="font-medium">{batchItemStatusLabel[item.status]}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">QA </span>
                    <span className={cn("font-medium", qa.className)}>{qa.label}</span>
                    {item.cacheHitCount > 0 && (
                      <span className="ml-2 text-muted-foreground" title="Cache-Treffer">
                        · Cache {item.cacheHitCount}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    {item.status === "failed" && item.retryable && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={retryingId !== null}
                        onClick={() => void handleRetry(item._id)}
                      >
                        {retryingId === item._id ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                        Wiederholen
                      </Button>
                    )}
                    {item.auditId && (
                      <Button size="sm" variant="ghost" onClick={() => navigate({ name: "audit", id: item.auditId! })}>
                        Audit <ArrowRight className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Batch abbrechen?</AlertDialogTitle>
            <AlertDialogDescription>
              Laufende Audits dürfen sicher abschließen. Wartende Websites werden abgebrochen und nicht verbrauchte Credits freigegeben.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Nicht abbrechen</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={control !== null} onClick={() => void runControl("cancel")}>
              {control === "cancel" && <Loader2 className="size-4 animate-spin" />}
              Batch abbrechen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
