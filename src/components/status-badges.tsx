import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  leadStatusMeta,
  auditStatusMeta,
  severityMeta,
  scoreTextClass,
  scoreBand,
} from "@/lib/scores"
import type { LeadStatus, AuditStatus, FindingSeverity } from "@/lib/types"

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const meta = leadStatusMeta[status]
  return (
    <Badge className={cn("gap-1.5 border-0 font-medium", meta.badge)}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </Badge>
  )
}

export function AuditStatusBadge({ status }: { status: AuditStatus }) {
  const meta = auditStatusMeta[status]
  const pulsingStatuses: AuditStatus[] = [
    "validating_url",
    "fetching_html",
    "extracting_content",
    "taking_screenshots",
    "running_performance_checks",
    "fetching_business_data",
    "running_deterministic_checks",
    "calculating_scores",
    "generating_findings",
    "generating_outreach",
    "running",
  ]
  return (
    <Badge className={cn("border-0 font-medium", meta.badge)}>
      {pulsingStatuses.includes(status) && (
        <span className="mr-1 size-1.5 animate-pulse rounded-full bg-current" />
      )}
      {meta.label}
    </Badge>
  )
}

export function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  const meta = severityMeta[severity]
  return (
    <Badge className={cn("border-0 font-medium", meta.badge)}>{meta.label}</Badge>
  )
}

export function ScoreBadge({
  score,
  className,
}: {
  score: number
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-lg text-sm font-semibold tabular-nums",
        `bg-score-${scoreBand(score)}/12`,
        scoreTextClass(score),
        className
      )}
    >
      {score}
    </span>
  )
}
