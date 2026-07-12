"use client"

import {
  Bell,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  Link2,
  MousePointerClick,
  type LucideIcon,
} from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { formatRelativeTs } from "@/lib/scores"
import { cn } from "@/lib/utils"

export interface ActivityFeedItemData {
  id: string
  event: string
  createdAt: number
  auditId: string | null
  domain: string | null
  businessName: string | null
  detail: string | null
}

const activityIcon: Record<string, { icon: LucideIcon; tone: string }> = {
  report_opened: { icon: Eye, tone: "bg-chart-1/12 text-chart-1" },
  report_reopened: { icon: Eye, tone: "bg-chart-1/12 text-chart-1" },
  report_cta_clicked: { icon: MousePointerClick, tone: "bg-primary/12 text-primary" },
  outreach_copied: { icon: Copy, tone: "bg-chart-2/12 text-chart-2" },
  public_link_copied: { icon: Link2, tone: "bg-chart-3/12 text-chart-3" },
  pdf_exported: { icon: Download, tone: "bg-chart-4/12 text-chart-4" },
  audit_completed: { icon: CheckCircle2, tone: "bg-score-strong/15 text-score-strong" },
}

function activityLabel(item: ActivityFeedItemData) {
  return item.businessName ?? item.domain ?? "Report"
}

export function ActivityFeed({
  items,
  className,
  itemClassName,
  animateFrom,
  compactAfter,
  compact = false,
  label = "Aktivitäten",
}: {
  items: ActivityFeedItemData[]
  className?: string
  itemClassName?: string
  animateFrom?: number
  compactAfter?: number
  compact?: boolean
  label?: string
}) {
  const reduceMotion = useReducedMotion()
  const layoutTransition = reduceMotion
    ? { duration: 0 }
    : {
        type: "tween" as const,
        duration: 0.36,
        ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      }

  return (
    <motion.ul
      layout={!reduceMotion}
      aria-label={label}
      className={cn("divide-y", className)}
      transition={{ layout: layoutTransition }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((item, index) => {
          const meta = activityIcon[item.event] ?? {
            icon: Bell,
            tone: "bg-muted text-muted-foreground",
          }
          const Icon = meta.icon
          const source = activityLabel(item)
          const animated = animateFrom !== undefined && index >= animateFrom

          return (
            <motion.li
              key={item.id}
              className={cn(
                "flex min-w-0 items-start gap-3 first:pt-0",
                compact ? "py-2" : "py-2.5",
                compactAfter !== undefined && index >= compactAfter && "max-2xl:hidden",
                itemClassName,
              )}
              layout={!reduceMotion}
              initial={animated && !reduceMotion ? { opacity: 0, y: -4 } : false}
              animate={animated && !reduceMotion ? { opacity: 1, y: 0 } : undefined}
              exit={
                animated && !reduceMotion
                  ? {
                      opacity: 0,
                      y: -4,
                      transition: { duration: 0.13, ease: [0.7, 0, 0.84, 0] },
                    }
                  : undefined
              }
              transition={{
                layout: layoutTransition,
                opacity: { duration: 0.2, ease: [0.25, 1, 0.5, 1] },
                y: { duration: 0.2, ease: [0.25, 1, 0.5, 1] },
              }}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full",
                  meta.tone,
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm",
                    compact ? "truncate leading-tight" : "line-clamp-2 leading-snug",
                  )}
                  title={item.detail ?? item.event}
                >
                  {item.detail ?? item.event}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-xs text-muted-foreground",
                    compact ? "truncate leading-4" : "line-clamp-2 leading-relaxed",
                  )}
                  title={[source, item.businessName && item.domain ? item.domain : null]
                    .filter(Boolean)
                    .join(" · ")}
                >
                  <span>{source}</span>
                  {item.businessName && item.domain ? (
                    <span className="text-muted-foreground/75"> · {item.domain}</span>
                  ) : null}
                  <span> · {formatRelativeTs(item.createdAt)}</span>
                </p>
              </div>
            </motion.li>
          )
        })}
      </AnimatePresence>
    </motion.ul>
  )
}

export function ActivityEmptyState({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 text-center", className)}>
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <Bell className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Noch keine Aktivität</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground/70">
        Report-Views, CTA-Klicks und Outreach-Kopien erscheinen hier, sobald der erste
        Prospect interagiert.
      </p>
    </div>
  )
}
