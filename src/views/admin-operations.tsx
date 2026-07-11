"use client"

import { useState } from "react"
import { useQuery, useAction } from "convex/react"
import { ShieldAlert, Lock, Loader2, RefreshCw, Ban, Plus } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/sonner"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

function formatPct(value: number | null): string {
  if (value === null) return "—"
  return `${(value * 100).toFixed(1)}%`
}

function formatCost(value: number | null): string {
  if (value === null) return "—"
  return `$${value.toFixed(4)}`
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—"
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

export function AdminOperationsView() {
  const access = useQuery(api.admin_operations.getAdminAccess)
  const metrics = useQuery(api.admin_operations.getOperationsMetrics)
  const failedAudits = useQuery(api.admin_operations.listFailedAudits, {
    paginationOpts: { cursor: null, numItems: 20 },
  })
  const [selectedAuditId, setSelectedAuditId] = useState<Id<"audits"> | null>(null)

  if (access === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    )
  }

  if (!access?.isSupportAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            <Lock className="size-6 text-muted-foreground" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Kein Support-Zugriff</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Dein Account ist nicht für den Support-Zugriff freigeschaltet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 p-4 md:p-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldAlert className="size-6 text-primary" />
          Operations
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Support- und Betriebsübersicht für SitePitch.
        </p>
      </div>

      {metrics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed Audits</CardDescription>
              <CardTitle className="text-2xl">{metrics.totalCompletedAudits}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Completion: {formatPct(metrics.completionRate)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Failed Audits</CardDescription>
              <CardTitle className="text-2xl">{metrics.totalFailedAudits}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Failure: {formatPct(metrics.failureRate)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg Duration</CardDescription>
              <CardTitle className="text-2xl">{formatDuration(metrics.avgDurationMs)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Letzte {metrics.windowDays} Tage
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg Cost/Audit</CardDescription>
              <CardTitle className="text-2xl">{formatCost(metrics.avgCostPerAudit)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Est: ${metrics.totalEstimatedCostUsd.toFixed(2)} · Act: ${metrics.totalActualCostUsd.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {metrics && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Outreach Copy Rate</CardDescription>
              <CardTitle className="text-xl">{formatPct(metrics.outreachCopyRate)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Public Report View Rate</CardDescription>
              <CardTitle className="text-xl">{formatPct(metrics.publicReportViewRate)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Report Views</CardDescription>
              <CardTitle className="text-xl">{metrics.reportViews}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {metrics && Object.keys(metrics.providerFailureRates).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Provider Failure Rates</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(metrics.providerFailureRates).map(([provider, rate]) => (
              <Badge key={provider} variant="outline" className="gap-1">
                {provider}: {formatPct(rate)}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Failed Audits</CardTitle>
          <CardDescription>Letzte fehlgeschlagene Audits über alle Workspaces.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {failedAudits?.items.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine fehlgeschlagenen Audits.</p>
          )}
          {failedAudits?.items.map((audit) => (
            <div
              key={audit._id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{audit.domain}</span>
                  <Badge variant="destructive" className="shrink-0 text-xs">
                    {audit.errorCode ?? "FAILED"}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {audit.workspaceName} · {audit.errorMessage ?? "Keine Fehlermeldung"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedAuditId(audit._id)}
                >
                  Details
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {selectedAuditId && (
        <AuditActions auditId={selectedAuditId} onClose={() => setSelectedAuditId(null)} />
      )}
    </div>
  )
}

function AuditActions({
  auditId,
  onClose,
}: {
  auditId: Id<"audits">
  onClose: () => void
}) {
  const trace = useQuery(api.admin_operations.getAuditTrace, { auditId })
  const rerunAction = useAction(api.admin_operations.rerunAudit)
  const disableAction = useAction(api.admin_operations.disablePublicReport)
  const adjustAction = useAction(api.admin_operations.adjustCredits)
  const [reason, setReason] = useState("")
  const [creditAmount, setCreditAmount] = useState("5")
  const [acting, setActing] = useState<string | null>(null)

  const workspaceId = trace?.audit.workspaceId
  const creditState = useQuery(
    api.admin_operations.getCreditState,
    workspaceId ? { workspaceId } : "skip",
  )

  const handleRerun = async () => {
    const trimmed = reason.trim()
    if (!trimmed) {
      toast.error("Ein Grund ist erforderlich")
      return
    }
    setActing("rerun")
    try {
      const result = await rerunAction({ auditId, reason: trimmed })
      toast.success(`Re-Run gestartet: ${result.newAuditId}`)
      setReason("")
    } catch (error) {
      toast.error("Re-Run fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
      })
    } finally {
      setActing(null)
    }
  }

  const handleDisable = async () => {
    const trimmed = reason.trim()
    if (!trimmed) {
      toast.error("Ein Grund ist erforderlich")
      return
    }
    setActing("disable")
    try {
      await disableAction({ auditId, reason: trimmed })
      toast.success("Public Report deaktiviert")
      setReason("")
    } catch (error) {
      toast.error("Deaktivierung fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
      })
    } finally {
      setActing(null)
    }
  }

  const handleAdjustCredits = async () => {
    const trimmed = reason.trim()
    if (!trimmed) {
      toast.error("Ein Grund ist erforderlich")
      return
    }
    const amount = parseInt(creditAmount, 10)
    if (!Number.isInteger(amount) || amount === 0) {
      toast.error("Credit-Betrag muss eine Nicht-Null-Ganzzahl sein")
      return
    }
    setActing("credits")
    try {
      await adjustAction({
        workspaceId: trace!.audit.workspaceId,
        amount,
        reason: trimmed,
      })
      toast.success(`${amount > 0 ? "+" : ""}${amount} Credits angepasst`)
      setReason("")
    } catch (error) {
      toast.error("Credit-Anpassung fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
      })
    } finally {
      setActing(null)
    }
  }

  if (!trace) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Spinner className="size-5 text-primary" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Audit Trace: {trace.audit.domain}</CardTitle>
            <CardDescription>{trace.audit.status} · {trace.audit.errorCode ?? "—"}</CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Schließen
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status Message</span>
            <span className="font-mono">{trace.audit.statusMessage ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Error Message</span>
            <span className="font-mono">{trace.audit.errorMessage ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pipeline</span>
            <span className="font-mono">
              {trace.pipeline.map((p) => `${p.phase} (${p.status})`).join(", ") || "—"}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Provider Calls ({trace.providerCalls.length})
          </p>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
            {trace.providerCalls.length === 0 && (
              <p className="text-xs text-muted-foreground">Keine Provider-Calls.</p>
            )}
            {trace.providerCalls.map((pc, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="shrink-0">{pc.provider}</Badge>
                <span className="truncate">{pc.operation}</span>
                <Badge
                  variant={pc.status === "completed" ? "default" : "destructive"}
                  className="ml-auto shrink-0"
                >
                  {pc.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {trace.costs && trace.costs.items.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Kosten ({trace.costs.items.length} Einträge)
            </p>
            <div className="space-y-1 rounded-lg border p-2">
              {trace.costs.items.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="shrink-0">{c.provider}</Badge>
                  <span className="truncate">{c.operation}</span>
                  {c.model && <span className="truncate text-muted-foreground">{c.model}</span>}
                  <span className="ml-auto shrink-0 font-mono">
                    {c.actualCostUsd !== null
                      ? `$${c.actualCostUsd.toFixed(6)}`
                      : c.estimatedCostUsd !== null
                        ? `~$${c.estimatedCostUsd.toFixed(6)}`
                        : "—"}
                  </span>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">{c.source}</Badge>
                </div>
              ))}
              <div className="mt-1 flex justify-between border-t pt-1 text-xs font-medium">
                <span>Total</span>
                <span className="font-mono">
                  Est: ${(trace.costs.totalEstimatedCostUsd ?? 0).toFixed(6)} ·
                  Act: ${(trace.costs.totalActualCostUsd ?? 0).toFixed(6)}
                </span>
              </div>
            </div>
          </div>
        )}

        {trace.billingSnapshots && trace.billingSnapshots.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Billing-Abgleich (7 Tage)
            </p>
            <div className="space-y-1 rounded-lg border p-2">
              {trace.billingSnapshots.map((bs, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="shrink-0">{bs.provider}</Badge>
                  <span className="font-mono">${bs.calculatedSpendUsd.toFixed(6)}</span>
                  {bs.providerSpendUsd !== null && (
                    <span className="text-muted-foreground">
                      Provider: ${bs.providerSpendUsd.toFixed(6)}
                    </span>
                  )}
                  {bs.deltaUsd !== null && (
                    <Badge
                      variant={Math.abs(bs.deltaUsd) > 0.5 ? "destructive" : "secondary"}
                      className="shrink-0 text-[10px]"
                    >
                      Δ ${bs.deltaUsd.toFixed(6)}
                    </Badge>
                  )}
                  <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">{bs.source}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {creditState && (
          <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Credits remaining</span>
              <span className="font-mono">{creditState.balance?.remaining ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reserved</span>
              <span className="font-mono">{creditState.balance?.reserved ?? "—"}</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="action-reason">Grund (für alle Aktionen erforderlich)</Label>
          <Input
            id="action-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Begründe die Support-Aktion"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleRerun}
            disabled={acting !== null || trace.audit.status !== "failed"}
          >
            {acting === "rerun" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Audit Re-Run
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleDisable}
            disabled={acting !== null}
          >
            {acting === "disable" ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />}
            Report Deaktivieren
          </Button>
        </div>

        {creditState && (
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="credit-amount">Credits anpassen</Label>
              <Input
                id="credit-amount"
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                step={1}
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handleAdjustCredits}
              disabled={acting !== null}
            >
              {acting === "credits" ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              Anpassen
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
