"use client"

import { useQuery } from "convex/react"
import { ArrowRight, FileStack, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { batchAuditApi } from "@/lib/batch-audit-api"
import {
  batchJobStatusMeta,
  batchProgress,
  formatBatchDate,
  formatUsd,
} from "@/lib/batch-audits"
import { useRouter } from "@/lib/router"
import { cn } from "@/lib/utils"

export function BatchAuditsView() {
  const { navigate } = useRouter()
  const data = useQuery(batchAuditApi.listMyBatches, {})

  if (data === undefined) {
    return (
      <div className="mx-auto flex min-h-[40vh] w-full max-w-[1100px] items-center justify-center p-4 md:p-6">
        <Spinner className="size-6 text-primary" />
      </div>
    )
  }

  const jobs = data.items

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Batch-Audits</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Mehrere Websites kontrolliert prüfen und Fortschritt verfolgen
          </p>
        </div>
        <Button className="gap-2" onClick={() => navigate({ name: "new-batch-audit" })}>
          <Plus className="size-4" aria-hidden="true" />
          Batch vorbereiten
        </Button>
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileStack className="size-4 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-sm font-semibold">Letzte Batches</h3>
            </div>
            <span className="text-xs text-muted-foreground">{data.total} gesamt</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <FileStack className="size-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium">Noch keine Batch-Audits</p>
                <p className="mt-1 max-w-md text-xs text-muted-foreground">
                  Wähle Kampagnen-Leads aus oder lade eine vorhandene Kampagnen-CSV hoch.
                  Vor dem Start siehst du Limits, Credits und Ausschlüsse.
                </p>
              </div>
              <Button size="sm" onClick={() => navigate({ name: "new-batch-audit" })}>
                Ersten Batch vorbereiten
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {jobs.map((job) => {
                const status = batchJobStatusMeta[job.status]
                const progress = batchProgress(job)
                return (
                  <button
                    key={job._id}
                    type="button"
                    className="grid w-full gap-3 px-4 py-4 text-left outline-none transition-colors hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6 lg:grid-cols-[minmax(0,1fr)_13rem_10rem_auto] lg:items-center"
                    onClick={() => navigate({ name: "batch-audit", id: job._id })}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {job.campaignName ?? (job.source === "campaign" ? "Kampagnen-Batch" : "CSV-Batch")}
                        </p>
                        <Badge variant="outline" className={cn("border-0", status.className)}>
                          {status.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {job.totalItems} Websites · {job.auditType} · {formatBatchDate(job.createdAt)}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Fortschritt</span>
                        <span className="font-medium tabular-nums">
                          {job.completedItems + job.failedItems + job.cancelledItems}/{job.totalItems}
                        </span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 text-xs lg:block">
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-muted-foreground">Credits</dt>
                        <dd className="font-medium tabular-nums">{job.consumedCredits}/{job.initialReservedCredits}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-muted-foreground">Kosten</dt>
                        <dd className="font-medium tabular-nums">{formatUsd(job.actualCostUsd ?? job.estimatedCostUsd)}</dd>
                      </div>
                    </dl>
                    <ArrowRight className="hidden size-4 text-muted-foreground lg:block" aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
