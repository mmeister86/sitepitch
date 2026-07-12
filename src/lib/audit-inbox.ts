import type { LeadStatus } from "./types"

export type AuditFilter = "all" | "running" | "completed" | "failed"
export type OutreachStatus = "not_started" | "ready" | "copied"

export const leadStatusOptions: ReadonlyArray<{ value: LeadStatus; label: string }> = [
  { value: "new", label: "Neu" },
  { value: "audited", label: "Auditiert" },
  { value: "contacted", label: "Kontaktiert" },
  { value: "follow_up", label: "Follow-up" },
  { value: "interested", label: "Interessiert" },
  { value: "won", label: "Gewonnen" },
  { value: "lost", label: "Verloren" },
]

export const outreachStatusMeta: Record<OutreachStatus, { label: string; className: string }> = {
  not_started: { label: "Nicht begonnen", className: "bg-muted text-muted-foreground" },
  ready: { label: "Bereit", className: "bg-chart-2/12 text-chart-2" },
  copied: { label: "Kopiert", className: "bg-score-strong/15 text-score-strong" },
}

export function matchesAuditFilter(status: string, filter: AuditFilter): boolean {
  if (filter === "all") return true
  if (filter === "completed") return status === "completed"
  if (filter === "failed") return status === "failed" || status === "cancelled"
  return !["completed", "failed", "cancelled", "draft"].includes(status)
}

export function matchesAuditSearch(
  audit: { businessName: string | null; domain: string; city: string | null; category: string | null },
  query: string,
): boolean {
  const terms = query.trim().toLocaleLowerCase("de").split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const haystack = `${audit.businessName ?? ""} ${audit.domain} ${audit.city ?? ""} ${audit.category ?? ""}`
    .toLocaleLowerCase("de")
  return terms.every((term) => haystack.includes(term))
}
