"use client"

import {
  Eye,
  ScanSearch,
  Plus,
  Search,
  Check,
  Circle,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  ChevronDown,
  ArrowUpRight,
} from "lucide-react"
import { useState } from "react"
import { useQuery } from "convex/react"
import { LayoutGroup, motion, useReducedMotion } from "motion/react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { StatCard } from "@/components/stat-card"
import { ScoreBadge } from "@/components/status-badges"
import { NewAuditDialog } from "@/components/new-audit-dialog"
import { useRouter } from "@/lib/router"
import { formatRelativeTs } from "@/lib/scores"
import { cn } from "@/lib/utils"
import { authClient } from "@/lib/auth-client"
import { getFirstName, getUserDisplayName } from "@/lib/user-display"
import { api } from "../../convex/_generated/api"
import { Spinner } from "@/components/ui/spinner"
import { ActivityEmptyState, ActivityFeed } from "@/components/activity-feed"
import { AuditExampleLinks } from "@/components/audit-example-links"
import { formatReportViewCount } from "@/lib/report-view-count"

type SummaryData = NonNullable<
  ReturnType<typeof useQuery<typeof api.reports.getDashboardSummary>>
>

type EngagementData = NonNullable<
  ReturnType<typeof useQuery<typeof api.reports.getDashboardEngagement>>
>

const engagementChartConfig = {
  views: { label: "Views", color: "var(--chart-1)" },
} satisfies ChartConfig

export function DashboardView() {
  const { navigate } = useRouter()
  const reduceMotion = useReducedMotion()
  const [activityExpanded, setActivityExpanded] = useState(false)
  const ws = useQuery(api.workspaces.getMyWorkspace)
  const summary = useQuery(api.reports.getDashboardSummary, {
    tzOffsetMinutes: typeof window !== "undefined" ? new Date().getTimezoneOffset() : 0,
  })
  const engagement = useQuery(api.reports.getDashboardEngagement, {
    tzOffsetMinutes: typeof window !== "undefined" ? new Date().getTimezoneOffset() : 0,
  })
  const activation = useQuery(api.activation.getMyActivationStatus, {})
  const session = authClient.useSession()

  const displayName = getUserDisplayName(
    ws?.user.name ?? session.data?.user?.name,
    ws?.user.email ?? session.data?.user?.email,
  )

  if (ws === undefined || summary === undefined || engagement === undefined || activation === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    )
  }

  const summaryData = summary ?? {
    auditsThisMonth: 0,
    completedAudits: 0,
    reportViews: 0,
    reportViewsCapped: false,
    reportViewsPending: false,
    hasPublicReport: false,
    hasOutreachCopy: false,
    recentAudits: [],
  }

  const checklist = [
    {
      label: "Branding einrichten",
      done: activation?.completed.branding ?? false,
      cta: { label: "Branding öffnen", route: { name: "branding-settings" } as const },
      key: "branding" as const,
    },
    {
      label: "Ersten Audit abschließen",
      done: activation?.completed.firstAudit ?? false,
      cta: { label: "Ersten Audit starten", route: { name: "new-audit" } as const },
      key: "firstAudit" as const,
    },
    {
      label: "Outreach kopieren",
      done: activation?.completed.outreach ?? false,
      cta: { label: "Outreach öffnen", route: { name: "audits" } as const },
      key: "outreach" as const,
    },
    {
      label: "Ersten Report teilen",
      done: activation?.completed.firstShare ?? false,
      cta: { label: "Report freigeben", route: { name: "audits" } as const },
      key: "firstShare" as const,
    },
  ]
  const doneCount = activation?.completedCount ?? 0

  const firstOpenStep = checklist.find((c) => c.key === activation?.nextStep)
  const creditsRemaining = ws?.credits.remaining ?? 0
  const creditsTotal = ws?.credits.total ?? 0
  const recent = summaryData.recentAudits
  const total = summaryData.auditsThisMonth

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 p-4 md:p-6">
      {/* Intro */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Hallo, {getFirstName(displayName)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 0
              ? "In unter fünf Minuten: Beispiel ansehen, Website eingeben und den ersten Audit starten."
              : `${total} Audits diesen Monat · ${summaryData.completedAudits} abgeschlossen · ${formatReportViewCount(summaryData.reportViews, summaryData.reportViewsCapped, summaryData.reportViewsPending)} Report Views`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate({ name: "lead-search" })}
          >
            <Search className="size-4" />
            Leads suchen
          </Button>
          <NewAuditDialog
            trigger={
              <Button className="gap-2">
                <Plus className="size-4" />
                Neuer Audit
              </Button>
            }
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Credits"
          value={`${creditsRemaining}/${creditsTotal}`}
          icon={Sparkles}
          hint="Verbleibend in diesem Monat"
          accent
        />
        <StatCard
          label="Audits diesen Monat"
          value={String(total)}
          icon={ScanSearch}
          hint={`${summaryData.completedAudits} abgeschlossen`}
        />
        <StatCard
          label="Abgeschlossene Audits"
          value={String(summaryData.completedAudits)}
          icon={CheckCircle2}
          hint="Alle Audits"
        />
        <StatCard
          label="Report Views"
          value={formatReportViewCount(summaryData.reportViews, summaryData.reportViewsCapped, summaryData.reportViewsPending)}
          icon={Eye}
          hint="Über alle freigegebenen Reports"
        />
      </div>

      {/* Engagement + Activity */}
      <LayoutGroup id="dashboard-engagement-activity">
        <div className="grid gap-4 lg:grid-cols-3 2xl:grid-cols-12">
          <motion.div
            layout={!reduceMotion}
            className={cn(
              "min-w-0 lg:col-span-2",
              activityExpanded ? "2xl:col-span-5" : "2xl:col-span-8",
            )}
            transition={{
              layout: reduceMotion
                ? { duration: 0 }
                : {
                    type: "tween",
                    duration: 0.36,
                    ease: [0.22, 1, 0.36, 1],
                  },
            }}
          >
            <EngagementCard engagement={engagement} />
          </motion.div>
          <motion.div
            layout={!reduceMotion}
            className={cn(
              "min-w-0 lg:col-span-1",
              activityExpanded ? "2xl:col-span-7" : "2xl:col-span-4",
            )}
            transition={{
              layout: reduceMotion
                ? { duration: 0 }
                : {
                    type: "tween",
                    duration: 0.36,
                    ease: [0.22, 1, 0.36, 1],
                  },
            }}
          >
            <ActivityCard
              engagement={engagement}
              expanded={activityExpanded}
              onExpandedChange={setActivityExpanded}
            />
          </motion.div>
        </div>
      </LayoutGroup>

      {/* Activation + Recent */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Aktivierung</CardTitle>
            <CardDescription>
              {doneCount} von {checklist.length} Schritten erledigt
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={(doneCount / checklist.length) * 100} className="h-1.5" />
            <ul className="space-y-1">
              {checklist.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-sm"
                >
                  {item.done ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-score-strong/15">
                      <Check className="size-3 text-score-strong" />
                    </span>
                  ) : (
                    <Circle className="size-5 text-muted-foreground/40" strokeWidth={1.5} />
                  )}
                  <span className={cn(item.done && "text-muted-foreground line-through")}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            {firstOpenStep ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => navigate(firstOpenStep.cta.route)}
              >
                {firstOpenStep.cta.label}
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <div className="flex h-8 w-full items-center justify-center gap-2 text-sm text-score-strong">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Aktivierung abgeschlossen
              </div>
            )}
          </CardFooter>
        </Card>

        <Card className="lg:col-span-2 lg:gap-5 lg:py-5">
          <CardHeader>
            <CardTitle>Letzte Audits</CardTitle>
            <CardDescription>Nach Erstellungsdatum</CardDescription>
            {recent.length > 0 && (
              <CardAction>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => navigate({ name: "audits" })}
                >
                  Alle ansehen
                  <ArrowRight className="size-4" />
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="px-2">
            {recent.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center lg:py-4">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <ScanSearch className="size-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Noch keine Audits</p>
                  <p className="text-xs text-muted-foreground">
                    Sieh dir zuerst einen Beispielreport an oder starte direkt mit einer Website.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <AuditExampleLinks className="w-full pb-1" />
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => navigate({ name: "lead-search" })}
                    variant="outline"
                  >
                    <Search className="size-4" />
                    Leads suchen
                  </Button>
                  <NewAuditDialog
                    trigger={
                      <Button size="sm" className="gap-1.5">
                        <Plus className="size-4" />
                        Audit starten
                      </Button>
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {recent.map((a) => (
                  <button
                    key={a._id}
                    onClick={() => navigate({ name: "audit", id: a._id })}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/60 lg:py-1"
                  >
                    {a.overallScore !== null ? (
                      <ScoreBadge score={a.overallScore} />
                    ) : (
                      <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                        —
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {a.businessName ?? a.domain}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{a.domain}</div>
                    </div>
                    <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                      <Eye className="size-3.5" />
                      {formatReportViewCount(a.viewCount, a.viewCountCapped, a.viewCountPending)}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground/70">
                      {formatRelativeTs(a.createdAt)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function EngagementCard({ engagement }: { engagement: EngagementData | null }) {
  const empty = !engagement || !engagement.hasData
  const totalViews = engagement?.totals.views ?? 0

  return (
    <Card className="h-full min-w-0">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>Report-Engagement</CardTitle>
            <CardDescription>Views über die letzten 14 Tage</CardDescription>
          </div>
          {!empty && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Eye className="size-4 text-chart-1" />
              <span className="font-semibold tabular-nums text-foreground">{totalViews}</span>
              Views
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <TrendingUp className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Noch keine Daten</p>
            <p className="max-w-xs text-xs text-muted-foreground/70">
              Sobald du Reports freigibst und teilst, erscheinen hier Views und
              CTA-Klicks im Zeitverlauf.
            </p>
          </div>
        ) : (
          <ChartContainer
            config={engagementChartConfig}
            className="aspect-auto h-[220px] w-full"
          >
            <BarChart
              data={engagement!.series}
              margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={16}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="views" fill="var(--color-views)" radius={4} maxBarSize={28} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

function ActivityCard({
  engagement,
  expanded,
  onExpandedChange,
}: {
  engagement: EngagementData | null
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}) {
  const { navigate } = useRouter()
  const items = engagement?.activity ?? []
  const empty = items.length === 0
  const compactItems = items.slice(0, 5)
  const expandedItems = items.slice(0, 15)
  const canExpand = items.length > 5
  const hasMore = engagement?.activityHasMore ?? false

  return (
    <Card className="h-full min-w-0">
      <CardHeader>
        <CardTitle>Aktivität</CardTitle>
        <CardDescription>Was Prospects gerade tun</CardDescription>
        {canExpand ? (
          <CardAction className="flex items-center gap-1">
            {expanded && hasMore ? (
              <Button
                variant="link"
                size="sm"
                className="hidden px-2 2xl:inline-flex"
                onClick={() => navigate({ name: "activity" })}
              >
                Alle Aktivitäten ansehen
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 2xl:hidden"
              onClick={() => navigate({ name: "activity" })}
            >
              Mehr anzeigen
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="hidden gap-1.5 2xl:inline-flex"
              aria-expanded={expanded}
              aria-controls="dashboard-activity-feed"
              onClick={() => onExpandedChange(!expanded)}
            >
              {expanded ? "Weniger anzeigen" : "Mehr anzeigen"}
              <ChevronDown
                className={cn(
                  "size-4 motion-safe:transition-transform motion-safe:duration-200",
                  expanded && "rotate-180",
                )}
                aria-hidden="true"
              />
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent
        id="dashboard-activity-feed"
        className="relative flex h-[220px] shrink-0 flex-col overflow-clip"
      >
        {empty ? (
          <ActivityEmptyState className="h-[220px]" />
        ) : (
          <ActivityFeed
            items={expanded ? expandedItems : compactItems}
            label="Letzte Aktivitäten"
            animateFrom={5}
            compactAfter={5}
            compact
            className={cn(
              "h-full content-start",
              expanded && "2xl:grid 2xl:grid-cols-3 2xl:gap-x-6 2xl:divide-y-0",
            )}
            itemClassName={cn(expanded && "2xl:border-b")}
          />
        )}
      </CardContent>
    </Card>
  )
}
