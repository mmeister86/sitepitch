export type BatchAuditSource = "campaign" | "csv"

export type BatchAuditJobStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"

export type BatchAuditItemStatus = BatchAuditJobStatus
export type BatchAuditQaStatus = "pending" | "passed" | "failed" | "skipped"

export const batchJobStatusMeta: Record<
  BatchAuditJobStatus,
  { label: string; className: string }
> = {
  queued: { label: "Wartet", className: "bg-muted text-muted-foreground" },
  running: { label: "Läuft", className: "bg-primary/15 text-primary" },
  paused: { label: "Pausiert", className: "bg-score-weak/15 text-score-weak" },
  completed: { label: "Fertig", className: "bg-score-strong/15 text-score-strong" },
  failed: { label: "Fehlgeschlagen", className: "bg-destructive/15 text-destructive" },
  cancelled: { label: "Abgebrochen", className: "bg-muted text-muted-foreground" },
}

export const batchItemStatusLabel: Record<BatchAuditItemStatus, string> = {
  queued: "Wartet",
  running: "Läuft",
  paused: "Pausiert",
  completed: "Fertig",
  failed: "Fehlgeschlagen",
  cancelled: "Abgebrochen",
}

export const batchQaStatusMeta: Record<BatchAuditQaStatus, { label: string; className: string }> = {
  pending: { label: "Ausstehend", className: "text-muted-foreground" },
  passed: { label: "Bestanden", className: "text-score-strong" },
  failed: { label: "Auffällig", className: "text-destructive" },
  skipped: { label: "Nicht ausgewählt", className: "text-muted-foreground" },
}

export function batchProgress(job: {
  totalItems: number
  completedItems: number
  failedItems: number
  cancelledItems: number
}): number {
  if (job.totalItems <= 0) return 0
  const settled = job.completedItems + job.failedItems + job.cancelledItems
  return Math.min(100, Math.max(0, (settled / job.totalItems) * 100))
}

export function formatUsd(value?: number): string {
  if (value === undefined) return "Noch offen"
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 0.1 ? 3 : 2,
    maximumFractionDigits: value < 0.1 ? 3 : 2,
  }).format(value)
}

export function formatBatchDate(timestamp?: number): string {
  if (!timestamp) return "—"
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp)
}

