"use client"

import { useQuery } from "convex/react"
import { Palette, Mail, Sparkles, ImageIcon, ArrowRight } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { useRouter } from "@/lib/router"
import { api } from "../../convex/_generated/api"

export function SettingsView() {
  const data = useQuery(api.workspaces.getMyWorkspace)
  const { navigate } = useRouter()

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
        <h2 className="text-2xl font-semibold tracking-tight">Einstellungen</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Workspace-Branding, Credits und Team auf einen Blick.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Report-Branding</CardTitle>
              <CardDescription>
                Name, Logo, Farbe und Call-to-Action für Reports.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              className="gap-2 self-start"
              onClick={() => navigate({ name: "branding-settings" })}
            >
              <Palette className="size-4" />
              Branding bearbeiten
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex size-10 items-center justify-center overflow-hidden rounded-md bg-muted">
              {data?.workspace.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.workspace.logoUrl}
                  alt=""
                  className="h-full w-full object-contain"
                />
              ) : (
                <ImageIcon className="size-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium">{data?.workspace.name}</p>
              <p className="text-muted-foreground">
                Akzentfarbe{" "}
                <span
                  className="ml-1 inline-block size-3 rounded-full align-middle"
                  style={{ backgroundColor: data?.workspace.accentColor }}
                />
              </p>
            </div>
          </div>
          {data?.workspace.ctaText && (
            <p className="text-muted-foreground">
              CTA: <span className="text-foreground">{data.workspace.ctaText}</span>
              {data.workspace.ctaUrl && (
                <span className="ml-1 text-muted-foreground/70">
                  → {data.workspace.ctaUrl}
                </span>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Plan & Credits</CardTitle>
              <CardDescription>Dein aktuelles Guthaben für diesen Monat.</CardDescription>
            </div>
            <Button
              variant="outline"
              className="gap-2 self-start"
              onClick={() => navigate({ name: "billing-settings" })}
            >
              <Sparkles className="size-4" />
              Plan & Credits ansehen
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className="gap-1.5 border-0 bg-primary/12 font-medium text-primary">
              <Sparkles className="size-3" />
              Free-Plan
            </Badge>
            <span className="text-sm text-muted-foreground">1 Workspace-Inhaber</span>
          </div>
          <div>
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
          <div>
            <CardTitle>Team</CardTitle>
            <CardDescription>MVP unterstützt einen Workspace-Inhaber.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {(data.user.name ?? data.user.email).slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {data.user.name ?? "Workspace-Inhaber"}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="size-3" />
                {data.user.email}
              </div>
            </div>
            <Badge variant="secondary" className="font-normal">
              Inhaber
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

SettingsView.displayName = "SettingsView"
