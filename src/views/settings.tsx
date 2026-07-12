"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import {
  AlertTriangle,
  ArrowRight,
  Database,
  ImageIcon,
  Loader2,
  Mail,
  Palette,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/sonner"
import { authClient } from "@/lib/auth-client"
import {
  ACCOUNT_DELETE_CONFIRMATION,
  blocksSelfServiceAccountDeletion,
  canConfirmAccountDeletion,
  formatConsentDate,
  RETENTION_POLICY_VERSION,
  type RetentionMode,
} from "@/lib/privacy-settings"
import { useRouter } from "@/lib/router"
import { api } from "../../convex/_generated/api"

export function SettingsView() {
  const data = useQuery(api.workspaces.getMyWorkspace)
  const setRetentionPreference = useMutation(api.workspaces.setRetentionPreference)
  const { navigate } = useRouter()
  const [retentionPending, setRetentionPending] = useState(false)
  const [withdrawRetentionOpen, setWithdrawRetentionOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [password, setPassword] = useState("")
  const [deletePending, setDeletePending] = useState(false)

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
  const retentionMode: RetentionMode = data?.workspace.retentionMode ?? "standard"
  const retentionConsentDate = formatConsentDate(data?.workspace.retentionConsentAt)
  const deletionBlocked = blocksSelfServiceAccountDeletion(data?.subscription)

  async function updateRetention(mode: RetentionMode) {
    setRetentionPending(true)
    try {
      await setRetentionPreference({ mode, policyVersion: RETENTION_POLICY_VERSION })
      toast.success(
        mode === "extended"
          ? "Dauerhafte Aufbewahrung aktiviert"
          : "Standard-Aufbewahrung aktiviert",
        {
          description:
            mode === "extended"
              ? "Vorhandene und zukünftige Workspace-Daten bleiben erhalten, bis du sie löschst oder diese Einstellung änderst."
              : "Bereits abgelaufene Daten werden beim nächsten Aufbewahrungslauf gelöscht.",
        },
      )
      setWithdrawRetentionOpen(false)
    } catch {
      toast.error("Aufbewahrungseinstellung konnte nicht gespeichert werden")
    } finally {
      setRetentionPending(false)
    }
  }

  function resetDeleteDialog() {
    setDeleteOpen(false)
    setDeleteConfirmation("")
    setPassword("")
  }

  async function deleteAccount() {
    if (
      !canConfirmAccountDeletion({
        confirmation: deleteConfirmation,
        password,
        blockedBySubscription: deletionBlocked,
        pending: deletePending,
      })
    ) {
      return
    }

    setDeletePending(true)
    try {
      const result = await authClient.deleteUser({ password })
      if (result.error) {
        const code = result.error.code ?? ""
        toast.error("Account konnte nicht gelöscht werden", {
          description: code.includes("INVALID_PASSWORD")
            ? "Das eingegebene Passwort ist nicht korrekt."
            : "Prüfe dein Passwort und dein Abonnement oder versuche es später erneut.",
        })
        setDeletePending(false)
        return
      }

      toast.success("Account-Löschung gestartet")
      window.location.assign("/")
    } catch {
      toast.error("Account konnte nicht gelöscht werden", {
        description: "Die Verbindung ist fehlgeschlagen. Bitte versuche es erneut.",
      })
      setDeletePending(false)
    }
  }

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
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Database className="size-4" />
            </div>
            <div>
              <CardTitle>Datenaufbewahrung</CardTitle>
              <CardDescription>
                Entscheide, ob SitePitch deine Workspace-Daten über die Standardfristen
                hinaus aufbewahren darf.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="extended-retention" className="text-sm font-medium">
                Daten dauerhaft aufbewahren
              </Label>
              <p id="extended-retention-description" className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
                Wenn aktiviert, bewahren wir vorhandene und zukünftige Workspace-Daten
                auf, bis du sie selbst löschst, diese Einstellung ausschaltest oder
                deinen Account löschst.
              </p>
            </div>
            <Switch
              id="extended-retention"
              className="mt-0.5"
              checked={retentionMode === "extended"}
              disabled={retentionPending}
              aria-describedby="extended-retention-description"
              onCheckedChange={(checked) => {
                if (checked) void updateRetention("extended")
                else setWithdrawRetentionOpen(true)
              }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="gap-1.5 font-normal">
              <ShieldCheck className="size-3" />
              {retentionMode === "extended" ? "Einwilligung aktiv" : "Standardfristen aktiv"}
            </Badge>
            {retentionConsentDate ? <span>Einwilligung vom {retentionConsentDate}</span> : null}
            <span>Policy {data?.workspace.retentionPolicyVersion ?? RETENTION_POLICY_VERSION}</span>
          </div>

          <Alert>
            <AlertTriangle className="size-4" />
            <AlertDescription>
              Bereits gelöschte Daten lassen sich durch Einschalten nicht wiederherstellen.
              Diese Option ersetzt kein eigenes Backup und garantiert keine unbegrenzte
              Produktverfügbarkeit. Identifizierende Report-Aufrufdaten werden immer nach
              30 Tagen gelöscht; für Abrechnungsdaten gelten gesetzliche Fristen.
            </AlertDescription>
          </Alert>
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

      <Card className="border-destructive/35">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <Trash2 className="size-4" />
            </div>
            <div>
              <CardTitle>Account löschen</CardTitle>
              <CardDescription>
                Löscht deinen Workspace samt Audits, Reports, Leads, Kampagnen, Branding
                und gespeicherten Dateien dauerhaft.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {deletionBlocked ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>
                Dein Bezahl-Abonnement ist noch aktiv. Beende es zuerst im Billing-Portal;
                die Account-Löschung ist nach Ablauf des Abonnements möglich.
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[64ch] text-sm text-muted-foreground">
              Die Löschung kann nicht rückgängig gemacht werden. Gesetzlich
              aufbewahrungspflichtige Abrechnungsdaten bleiben ohne Workspace-Verknüpfung
              erhalten.
            </p>
            <Button
              variant={deletionBlocked ? "outline" : "destructive"}
              className="shrink-0"
              onClick={() => {
                if (deletionBlocked) navigate({ name: "billing-settings" })
                else setDeleteOpen(true)
              }}
            >
              {deletionBlocked ? "Abonnement verwalten" : "Account löschen"}
              {deletionBlocked ? <ArrowRight className="size-4" /> : <Trash2 className="size-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={withdrawRetentionOpen} onOpenChange={setWithdrawRetentionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dauerhafte Aufbewahrung ausschalten?</AlertDialogTitle>
            <AlertDialogDescription>
              Danach gelten die Standardfristen wieder ab dem ursprünglichen
              Erstellungsdatum. Bereits abgelaufene Daten werden beim nächsten
              Aufbewahrungslauf dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={retentionPending}>Beibehalten</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={retentionPending}
              onClick={() => void updateRetention("standard")}
            >
              {retentionPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Standardfristen aktivieren
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !deletePending) resetDeleteDialog()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>SitePitch-Account dauerhaft löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle Workspace-Daten werden zur Löschung eingeplant und öffentliche Reports
              sofort deaktiviert. Dieser Vorgang kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delete-confirmation">
                Tippe <span className="font-semibold text-foreground">{ACCOUNT_DELETE_CONFIRMATION}</span>
              </Label>
              <Input
                id="delete-confirmation"
                autoComplete="off"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                disabled={deletePending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-password">Aktuelles Passwort</Label>
              <Input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={deletePending}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Abbrechen</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!canConfirmAccountDeletion({
                confirmation: deleteConfirmation,
                password,
                blockedBySubscription: deletionBlocked,
                pending: deletePending,
              })}
              onClick={() => void deleteAccount()}
            >
              {deletePending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Endgültig löschen
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

SettingsView.displayName = "SettingsView"
