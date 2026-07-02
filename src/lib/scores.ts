import type { LeadStatus, AuditStatus, FindingSeverity } from "./types"

export type ScoreBand = "critical" | "weak" | "solid" | "strong"

export function scoreBand(score: number): ScoreBand {
  if (score < 40) return "critical"
  if (score < 60) return "weak"
  if (score < 75) return "solid"
  return "strong"
}

export function scoreLabel(score: number): string {
  const band = scoreBand(score)
  if (band === "critical") return "Kritisch"
  if (band === "weak") return "Ausbaufähig"
  if (band === "solid") return "Solide"
  return score >= 90 ? "Sehr stark" : "Stark"
}

// Tailwind color token per band (registered in index.css @theme inline).
export function scoreColorVar(score: number): string {
  return `var(--score-${scoreBand(score)})`
}

export function scoreTextClass(score: number): string {
  const band = scoreBand(score)
  return {
    critical: "text-score-critical",
    weak: "text-score-weak",
    solid: "text-score-solid",
    strong: "text-score-strong",
  }[band]
}

export const leadStatusMeta: Record<
  LeadStatus,
  { label: string; dot: string; badge: string }
> = {
  new: {
    label: "Neu",
    dot: "bg-muted-foreground",
    badge: "bg-muted text-muted-foreground",
  },
  audited: {
    label: "Auditiert",
    dot: "bg-chart-2",
    badge: "bg-chart-2/12 text-chart-2",
  },
  contacted: {
    label: "Kontaktiert",
    dot: "bg-primary",
    badge: "bg-primary/12 text-primary",
  },
  follow_up: {
    label: "Follow-up",
    dot: "bg-score-weak",
    badge: "bg-score-weak/15 text-score-weak",
  },
  interested: {
    label: "Interessiert",
    dot: "bg-score-solid",
    badge: "bg-score-solid/15 text-score-solid",
  },
  won: {
    label: "Gewonnen",
    dot: "bg-score-strong",
    badge: "bg-score-strong/15 text-score-strong",
  },
  lost: {
    label: "Verloren",
    dot: "bg-score-critical",
    badge: "bg-score-critical/12 text-score-critical",
  },
}

export const auditStatusMeta: Record<
  AuditStatus,
  { label: string; badge: string }
> = {
  queued: { label: "In Warteschlange", badge: "bg-muted text-muted-foreground" },
  running: { label: "Läuft", badge: "bg-primary/12 text-primary" },
  completed: { label: "Fertig", badge: "bg-score-strong/15 text-score-strong" },
  failed: { label: "Fehlgeschlagen", badge: "bg-score-critical/12 text-score-critical" },
}

export const severityMeta: Record<
  FindingSeverity,
  { label: string; badge: string }
> = {
  high: { label: "Hoch", badge: "bg-score-critical/12 text-score-critical" },
  medium: { label: "Mittel", badge: "bg-score-weak/15 text-score-weak" },
  low: { label: "Niedrig", badge: "bg-chart-2/12 text-chart-2" },
}

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const mins = Math.round(diff / 60000)
  if (mins < 1) return "gerade eben"
  if (mins < 60) return `vor ${mins} Min.`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `vor ${hrs} Std.`
  const days = Math.round(hrs / 24)
  if (days < 30) return `vor ${days} Tg.`
  const months = Math.round(days / 30)
  return `vor ${months} Mon.`
}
