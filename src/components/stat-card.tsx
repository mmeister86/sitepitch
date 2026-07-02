import type { LucideIcon } from "lucide-react"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  delta?: number
  deltaLabel?: string
  hint?: string
  accent?: boolean
}

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  deltaLabel,
  hint,
  accent,
}: StatCardProps) {
  const positive = (delta ?? 0) >= 0
  return (
    <Card
      className={cn(
        "gap-0 p-5",
        accent && "bg-primary text-primary-foreground border-primary"
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-sm font-medium",
            accent ? "text-primary-foreground/80" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            accent ? "bg-primary-foreground/15" : "bg-muted"
          )}
        >
          <Icon className={cn("size-4", accent ? "text-primary-foreground" : "text-muted-foreground")} />
        </span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        {delta !== undefined && (
          <span
            className={cn(
              "mb-1 inline-flex items-center gap-0.5 text-xs font-medium",
              accent
                ? "text-primary-foreground/90"
                : positive
                  ? "text-score-strong"
                  : "text-score-critical"
            )}
          >
            {positive ? (
              <ArrowUpRight className="size-3.5" />
            ) : (
              <ArrowDownRight className="size-3.5" />
            )}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      {(hint || deltaLabel) && (
        <p
          className={cn(
            "mt-1 text-xs",
            accent ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {hint ?? deltaLabel}
        </p>
      )}
    </Card>
  )
}
