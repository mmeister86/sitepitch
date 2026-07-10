"use client"

import { useQuery } from "convex/react"
import { Sparkles, AlertCircle, CreditCard } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { api } from "../../convex/_generated/api"

export function BillingSettingsView() {
  const data = useQuery(api.workspaces.getMyWorkspace)

  if (data === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    )
  }

  const remaining = data?.credits.remaining ?? 0
  const monthlyCredits = data?.credits.total ?? 0
  const used = data?.credits.used ?? 0
  const pct = monthlyCredits > 0 ? (used / monthlyCredits) * 100 : 0

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Plan & Credits</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Dein aktuelles Guthaben und Planstatus.
        </p>
      </div>

      <Alert variant="default" className="border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20">
        <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          Abrechnung und Planverwaltung sind in dieser Version noch nicht aktiviert.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Aktueller Plan</CardTitle>
              <CardDescription>
                Dein Workspace nutzt den kostenlosen MVP-Plan.
              </CardDescription>
            </div>
            <Badge className="gap-1.5 border-0 bg-primary/12 font-medium text-primary">
              <Sparkles className="size-3" />
              Free-Plan
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              1 Workspace-Inhaber · unbegrenzte Reports
            </span>
          </div>
          <div className="mt-2">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Credits verbraucht</span>
              <span className="font-medium tabular-nums">
                {used} / {monthlyCredits} · {remaining} übrig
              </span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zahlungsinformationen</CardTitle>
          <CardDescription>
            Sobald TASK-4.9 aktiviert wird, erscheinen hier Rechnungsdaten, Zahlungsanbieter und
            Optionen zum Aufstocken von Credits.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Es gibt aktuell keinen aktiven Zahlungsanbieter. Der Free-Plan ist vollständig kostenlos,
          solange Guthaben verfügbar ist.
        </CardContent>
      </Card>
    </div>
  )
}

BillingSettingsView.displayName = "BillingSettingsView"
