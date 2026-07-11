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
  Bell,
  MousePointerClick,
  Copy,
  Download,
  Link2,
  type LucideIcon,
} from "lucide-react"
import { useQuery } from "convex/react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import {
  Card,
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

type SummaryData = NonNullable<
  ReturnType<typeof useQuery<typeof api.reports.getDashboardSummary>>
>

type EngagementData = NonNullable<
  ReturnType<typeof useQuery<typeof api.reports.getDashboardEngagement>>
>

const engagementChartConfig = {
  views: { label: "Views", color: "var(--chart-1)" },
} satisfies ChartConfig

const activityIcon: Record<string, { icon: LucideIcon; tone: string }> = {
  report_opened: { icon: Eye, tone: "bg-chart-1/12 text-chart-1" },
  report_cta_clicked: { icon: MousePointerClick, tone: "bg-primary/12 text-primary" },
  outreach_copied: { icon: Copy, tone: "bg-chart-2/12 text-chart-2" },
  public_link_copied: { icon: Link2, tone: "bg-chart-3/12 text-chart-3" },
  pdf_exported: { icon: Download, tone: "bg-chart-4/12 text-chart-4" },
  audit_completed: { icon: CheckCircle2, tone: "bg-score-strong/15 text-score-strong" },
}

export function DashboardView() {
  const { navigate } = useRouter()
  const ws = useQuery(api.workspaces.getMyWorkspace)
  const summary = useQuery(api.reports.getDashboardSummary, {
    tzOffsetMinutes: typeof window !== "undefined" ? new Date().getTimezoneOffset() : 0,
  })
  const engagement = useQuery(api.reports.getDashboardEngagement, {
    tzOffsetMinutes: typeof window !== "undefined" ? new Date().getTimezoneOffset() : 0,
  })
  const session = authClient.useSession()

  const displayName = getUserDisplayName(
    ws?.user.name ?? session.data?.user?.name,
    ws?.user.email ?? session.data?.user?.email,
  )

  if (ws === undefined || summary === undefined || engagement === undefined) {
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
    hasPublicReport: false,
    hasOutreachCopy: false,
    recentAudits: [],
  }

  const workspace = ws?.workspace
  const brandingDone = workspace
    ? workspace.updatedAt > workspace.createdAt
    : false
  const firstAuditDone = summaryData.auditsThisMonth > 0
  const completedDone = summaryData.completedAudits > 0

  const checklist = [
    {
      label: "Branding einrichten",
      done: brandingDone,
      cta: { label: "Branding öffnen", route: { name: "branding-settings" } as const },
    },
    {
      label: "Ersten Audit starten",
      done: firstAuditDone,
      cta: { label: "Ersten Audit starten", route: { name: "new-audit" } as const },
    },
    {
      label: "Audit abschließen",
      done: completedDone,
      cta: { label: "Audits ansehen", route: { name: "audits" } as const },
    },
    {
      label: "Report freigeben",
      done: summaryData.hasPublicReport,
      cta: { label: "Audits ansehen", route: { name: "audits" } as const },
    },
    {
      label: "Outreach kopieren",
      done: summaryData.hasOutreachCopy,
      cta: { label: "Audits ansehen", route: { name: "audits" } as const },
    },
  ]
  const doneCount = checklist.filter((c) => c.done).length

  const firstOpenStep = checklist.find((c) => !c.done)
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
              ? "Starte deinen ersten Audit, um Website-Potenziale zu entdecken."
              : `${total} Audits diesen Monat · ${summaryData.completedAudits} abgeschlossen · ${summaryData.reportViews} Report Views`}
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
          value={String(summaryData.reportViews)}
          icon={Eye}
          hint="Über alle freigegebenen Reports"
        />
      </div>

      {/* Engagement + Activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <EngagementCard engagement={engagement} />
        <ActivityCard engagement={engagement} />
      </div>

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
          {firstOpenStep ? (
            <CardFooter>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => navigate(firstOpenStep.cta.route)}
              >
                {firstOpenStep.cta.label}
                <ArrowRight className="size-4" />
              </Button>
            </CardFooter>
          ) : null}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Letzte Audits</CardTitle>
              <CardDescription>Nach Erstellungsdatum</CardDescription>
            </div>
            {recent.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => navigate({ name: "audits" })}
              >
                Alle ansehen
                <ArrowRight className="size-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="px-2">
            {recent.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <ScanSearch className="size-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Noch keine Audits</p>
                  <p className="text-xs text-muted-foreground">
                    Starte deinen ersten Audit, um loszulegen.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
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
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/60"
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
                      {a.viewCount}
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
    <Card className="lg:col-span-2">
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

function ActivityCard({ engagement }: { engagement: EngagementData | null }) {
  const items = engagement?.activity ?? []
  const empty = items.length === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aktivität</CardTitle>
        <CardDescription>Was Prospects gerade tun</CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <Bell className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Noch keine Aktivität</p>
            <p className="max-w-xs text-xs text-muted-foreground/70">
              Report-Views, CTA-Klicks und Outreach-Kopien erscheinen hier, sobald
              der erste Prospect interagiert.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((item) => {
              const meta = activityIcon[item.event] ?? {
                icon: Bell,
                tone: "bg-muted text-muted-foreground",
              }
              const Icon = meta.icon
              const label = item.businessName ?? item.domain ?? "Report"
              return (
                <li key={item.id} className="flex items-start gap-3 py-2.5 first:pt-0">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full",
                      meta.tone,
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-tight">{item.detail ?? item.event}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {label} · {formatRelativeTs(item.createdAt)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
