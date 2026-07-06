"use client"

import {
  Eye,
  ScanSearch,
  Plus,
  Check,
  Circle,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react"
import { useQuery } from "convex/react"

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

export function DashboardView() {
  const { navigate } = useRouter()
  const ws = useQuery(api.workspaces.getMyWorkspace)
  const auditsData = useQuery(api.audits.listMyAudits, {})
  const session = authClient.useSession()

  const displayName = getUserDisplayName(
    ws?.user.name ?? session.data?.user?.name,
    ws?.user.email ?? session.data?.user?.email,
  )

  if (ws === undefined || auditsData === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    )
  }

  const items = auditsData?.items ?? []
  const total = auditsData?.total ?? 0
  const completed = items.filter((a) => a.status === "completed").length
  const totalViews = items.reduce((sum, a) => sum + a.viewCount, 0)
  const hasPublic = items.some((a) => a.isPublic)
  const hasOutreach = items.some((a) => a.hasOutreach)
  const creditsRemaining = ws?.credits.remaining ?? 0
  const creditsTotal = ws?.credits.total ?? 0

  const checklist = [
    { label: "Branding hinterlegt", done: ws !== null },
    { label: "Ersten Audit gestartet", done: total > 0 },
    { label: "Audit abgeschlossen", done: completed > 0 },
    { label: "Report freigegeben", done: hasPublic },
    { label: "Outreach genutzt", done: hasOutreach },
  ]
  const doneCount = checklist.filter((c) => c.done).length

  const recent = items.slice(0, 5)

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
              : `${total} Audits · ${completed} abgeschlossen · ${totalViews} Report Views`}
          </p>
        </div>
        <NewAuditDialog
          trigger={
            <Button className="gap-2">
              <Plus className="size-4" />
              Neuer Audit
            </Button>
          }
        />
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Audits"
          value={String(total)}
          icon={ScanSearch}
          hint={`${completed} abgeschlossen`}
          accent
        />
        <StatCard
          label="Report Views"
          value={String(totalViews)}
          icon={Eye}
          hint="Über alle freigegebenen Reports"
        />
        <StatCard
          label="Credits"
          value={`${creditsRemaining}/${creditsTotal}`}
          icon={Sparkles}
          hint="Verbleibend in diesem Monat"
        />
        <StatCard
          label="Aktivierung"
          value={`${doneCount}/${checklist.length}`}
          icon={CheckCircle2}
          hint="Onboarding-Schritte erledigt"
        />
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
          {doneCount < checklist.length && (
            <CardFooter>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => navigate({ name: "audits" })}
              >
                {total === 0 ? "Ersten Audit starten" : "Weitermachen"}
                <ArrowRight className="size-4" />
              </Button>
            </CardFooter>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Letzte Audits</CardTitle>
              <CardDescription>Nach Erstellungsdatum</CardDescription>
            </div>
            {total > 0 && (
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
                <NewAuditDialog
                  trigger={
                    <Button size="sm" className="gap-1.5">
                      <Plus className="size-4" />
                      Audit starten
                    </Button>
                  }
                />
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
                      <div className="truncate text-xs text-muted-foreground">
                        {a.domain}
                      </div>
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
