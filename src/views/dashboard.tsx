"use client"

import {
  Eye,
  Copy,
  ScanSearch,
  Target,
  Plus,
  Check,
  Circle,
  ArrowRight,
  Flame,
} from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

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
import { ScoreBadge, LeadStatusBadge } from "@/components/status-badges"
import { useRouter } from "@/lib/router"
import { audits, activities, workspace } from "@/lib/mock-data"
import { formatRelative } from "@/lib/scores"
import { cn } from "@/lib/utils"

const engagementData = [
  { week: "KW 22", views: 18, engaged: 6 },
  { week: "KW 23", views: 24, engaged: 9 },
  { week: "KW 24", views: 31, engaged: 12 },
  { week: "KW 25", views: 27, engaged: 11 },
  { week: "KW 26", views: 39, engaged: 17 },
  { week: "KW 27", views: 44, engaged: 21 },
  { week: "KW 28", views: 52, engaged: 26 },
  { week: "KW 29", views: 61, engaged: 31 },
]

const chartConfig = {
  views: { label: "Report Views", color: "var(--chart-1)" },
  engaged: { label: "Engaged Reports", color: "var(--chart-3)" },
} satisfies ChartConfig

const checklist = [
  { label: "Branding hinterlegt", done: true },
  { label: "Erste Kampagne erstellt", done: true },
  { label: "Ersten Audit abgeschlossen", done: true },
  { label: "Report geteilt", done: true },
  { label: "Team eingeladen", done: false },
  { label: "CRM verbunden", done: false },
]

const activityDot: Record<string, string> = {
  report_viewed: "bg-chart-1",
  outreach_copied: "bg-primary",
  audit_completed: "bg-score-strong",
  status_changed: "bg-score-solid",
  follow_up_scheduled: "bg-score-weak",
  note_added: "bg-muted-foreground",
}

export function DashboardView() {
  const { navigate } = useRouter()
  const recent = audits.slice(0, 5)
  const doneCount = checklist.filter((c) => c.done).length

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 p-4 md:p-6">
      {/* Intro */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Guten Morgen, {workspace.seats[0].name.split(" ")[0]}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            8 Reports wurden diese Woche geöffnet — 3 Leads warten auf ein Follow-up.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => navigate({ name: "leads" })}>
            <Target className="size-4" />
            Leads suchen
          </Button>
          <Button className="gap-2" onClick={() => navigate({ name: "audits" })}>
            <Plus className="size-4" />
            Neuer Audit
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Engaged Reports"
          value="31"
          icon={Flame}
          delta={19}
          hint="Geöffnet + Engagement · diesen Monat"
          accent
        />
        <StatCard label="Abgeschlossene Audits" value="51" icon={ScanSearch} delta={12} hint="187 Credits verbraucht" />
        <StatCard label="Report Views" value="118" icon={Eye} delta={23} hint="Über alle geteilten Reports" />
        <StatCard label="Outreach kopiert" value="36" icon={Copy} delta={-4} hint="E-Mail, LinkedIn & Telefon" />
      </div>

      {/* Chart + Activation */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Report-Engagement</CardTitle>
            <CardDescription>
              Views und engaged Reports der letzten 8 Wochen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <AreaChart data={engagementData} margin={{ left: -16, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="fillViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-views)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-views)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillEngaged" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-engaged)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-engaged)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} width={40} fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="views"
                  type="monotone"
                  fill="url(#fillViews)"
                  stroke="var(--color-views)"
                  strokeWidth={2}
                />
                <Area
                  dataKey="engaged"
                  type="monotone"
                  fill="url(#fillEngaged)"
                  stroke="var(--color-engaged)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

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
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => navigate({ name: "settings" })}>
              Team einladen
              <ArrowRight className="size-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Recent audits + Activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Letzte Audits</CardTitle>
              <CardDescription>Priorisiert nach Potenzial</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate({ name: "audits" })}>
              Alle ansehen
              <ArrowRight className="size-4" />
            </Button>
          </CardHeader>
          <CardContent className="px-2">
            <div className="divide-y">
              {recent.map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate({ name: "audit", id: a.id })}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/60"
                >
                  {a.overallScore !== undefined ? (
                    <ScoreBadge score={a.overallScore} />
                  ) : (
                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                      —
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{a.businessName}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {a.domain} · {a.industry}, {a.city}
                    </div>
                  </div>
                  <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                    <Eye className="size-3.5" />
                    {a.engagement.views}
                  </div>
                  <LeadStatusBadge status={a.leadStatus} />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aktivität</CardTitle>
            <CardDescription>Was Prospects gerade tun</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {activities.map((ac) => (
                <li key={ac.id} className="flex gap-3">
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      activityDot[ac.type]
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">{ac.business}</p>
                    <p className="text-xs text-muted-foreground">{ac.detail}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground/70">
                    {formatRelative(ac.at)}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
