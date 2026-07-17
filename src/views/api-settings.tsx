"use client"

import { useState, type FormEvent } from "react"
import { useMutation, useQuery } from "convex/react"
import {
  AlertTriangle,
  Braces,
  Check,
  Clock3,
  Copy,
  KeyRound,
  Loader2,
  LockKeyhole,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/sonner"
import { useRouter } from "@/lib/router"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

const API_SCOPES = ["audits:create", "audits:read", "reports:read"] as const
type ApiScope = (typeof API_SCOPES)[number]

const SCOPE_COPY: Record<ApiScope, { label: string; description: string }> = {
  "audits:create": {
    label: "Audits starten",
    description: "Neue Audits mit Credits und bestehenden Workspace-Limits anlegen.",
  },
  "audits:read": {
    label: "Auditstatus lesen",
    description: "Status und sichere Laufmetadaten eigener Audits abrufen.",
  },
  "reports:read": {
    label: "Report-Metadaten lesen",
    description: "Scores, Version, Status und optionalen öffentlichen Link abrufen.",
  },
}

const DATE_TIME = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
})

type KeyAction = {
  type: "rotate" | "revoke"
  apiKeyId: Id<"apiKeys">
  label: string
} | null

type RawKeyReveal = {
  rawKey: string
  label: string
  previousKeyGraceExpiresAt?: number
}

function formatDate(value: number | null | undefined): string {
  return value ? DATE_TIME.format(new Date(value)) : "Noch nie"
}

function statusCopy(status: string, graceExpiresAt: number | null) {
  if (status === "revoked") return { label: "Widerrufen", variant: "outline" as const }
  if (status === "grace") {
    return graceExpiresAt && graceExpiresAt > Date.now()
      ? { label: "Läuft nach Rotation aus", variant: "secondary" as const }
      : { label: "Überlappung beendet", variant: "outline" as const }
  }
  return { label: "Aktiv", variant: "secondary" as const }
}

export function ApiSettingsView() {
  const data = useQuery(api.api_keys.listApiKeys, {})
  const createApiKey = useMutation(api.api_keys.createApiKey)
  const rotateApiKey = useMutation(api.api_keys.rotateApiKey)
  const revokeApiKey = useMutation(api.api_keys.revokeApiKey)
  const { navigate } = useRouter()
  const [label, setLabel] = useState("")
  const [scopes, setScopes] = useState<ApiScope[]>(["audits:create", "audits:read", "reports:read"])
  const [creating, setCreating] = useState(false)
  const [keyAction, setKeyAction] = useState<KeyAction>(null)
  const [acting, setActing] = useState(false)
  const [rawReveal, setRawReveal] = useState<RawKeyReveal | null>(null)
  const [copied, setCopied] = useState(false)

  if (data === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    )
  }

  const activeKeys = data.keys.filter((key) => key.status === "active")
  const atLimit = activeKeys.length >= data.maxActiveKeys
  const canCreate = data.featureEnabled && data.canManage && !atLimit && label.trim().length > 0 && scopes.length > 0
  const publicApiBaseUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL?.replace(/\/+$/, "") ?? ""

  function toggleScope(scope: ApiScope, checked: boolean) {
    setScopes((current) => checked
      ? Array.from(new Set([...current, scope]))
      : current.filter((item) => item !== scope))
  }

  async function copyRawKey() {
    if (!rawReveal) return
    try {
      await navigator.clipboard.writeText(rawReveal.rawKey)
      setCopied(true)
      toast.success("API-Key kopiert")
      window.setTimeout(() => setCopied(false), 2_000)
    } catch {
      toast.error("API-Key konnte nicht kopiert werden")
    }
  }

  function dismissRawKey() {
    setRawReveal(null)
    setCopied(false)
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canCreate) return
    setCreating(true)
    try {
      const result = await createApiKey({ label: label.trim(), scopes })
      setRawReveal({ rawKey: result.rawKey, label: label.trim() })
      setLabel("")
      toast.success("API-Key erstellt", {
        description: "Kopiere den Schlüssel jetzt. Er wird kein zweites Mal angezeigt.",
      })
    } catch (error) {
      toast.error("API-Key konnte nicht erstellt werden", {
        description: error instanceof Error ? error.message : "Prüfe Plan, Rechte und Key-Limit.",
      })
    } finally {
      setCreating(false)
    }
  }

  async function confirmKeyAction() {
    if (!keyAction) return
    setActing(true)
    try {
      if (keyAction.type === "rotate") {
        const result = await rotateApiKey({ apiKeyId: keyAction.apiKeyId })
        setRawReveal({
          rawKey: result.rawKey,
          label: keyAction.label,
          previousKeyGraceExpiresAt: result.previousKeyGraceExpiresAt,
        })
        toast.success("API-Key rotiert", {
          description: "Der bisherige Schlüssel bleibt noch 24 Stunden gültig.",
        })
      } else {
        await revokeApiKey({ apiKeyId: keyAction.apiKeyId })
        toast.success("API-Key sofort widerrufen")
      }
      setKeyAction(null)
    } catch (error) {
      toast.error(keyAction.type === "rotate" ? "Rotation fehlgeschlagen" : "Widerruf fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Versuche es später erneut.",
      })
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-8 p-4 md:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Braces className="size-5 text-primary" aria-hidden="true" />
            Public API
          </h2>
          <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
            Starte Audits aus eigenen Workflows. Schlüssel gelten immer nur für diesen Workspace und die gewählten Scopes.
          </p>
        </div>
        <Badge variant="outline" className="mt-1 gap-1.5 self-start px-2.5 py-1 font-normal">
          <LockKeyhole className="size-3" />
          Agency · {activeKeys.length}/{data.maxActiveKeys} aktiv
        </Badge>
      </header>

      {!data.featureEnabled ? (
        <Alert>
          <Braces className="size-4" />
          <AlertTitle>Public API ist deaktiviert</AlertTitle>
          <AlertDescription>
            Der Workspace bleibt unverändert nutzbar. Bestehende Schlüssel werden nicht für neue API-Anfragen akzeptiert.
          </AlertDescription>
        </Alert>
      ) : data.plan !== "agency" && data.plan !== "scale" ? (
        <Alert>
          <LockKeyhole className="size-4" />
          <AlertTitle>Im Agency-Plan verfügbar</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>API-Keys und REST v1 sind für Agency-Workspaces freigeschaltet.</span>
            <Button size="sm" variant="outline" className="self-start" onClick={() => navigate({ name: "billing-settings" })}>
              Agency ansehen
            </Button>
          </AlertDescription>
        </Alert>
      ) : !data.canManage ? (
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Keine Verwaltungsrechte</AlertTitle>
          <AlertDescription>Owner und Workspace-Admins dürfen API-Keys verwalten.</AlertDescription>
        </Alert>
      ) : null}

      {rawReveal ? (
        <section aria-labelledby="raw-api-key-heading" className="rounded-xl border border-primary/25 bg-primary/5 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h3 id="raw-api-key-heading" className="flex items-center gap-2 text-sm font-semibold">
                <KeyRound className="size-4 text-primary" />
                {rawReveal.label}: Schlüssel jetzt sichern
              </h3>
              <p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
                Nach dem Schließen wird der Rohwert vollständig aus dieser Seite entfernt und kann nicht wieder angezeigt werden.
              </p>
              {rawReveal.previousKeyGraceExpiresAt ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock3 className="size-3.5" />
                  Alter Key gültig bis {formatDate(rawReveal.previousKeyGraceExpiresAt)}
                </p>
              ) : null}
            </div>
            <Button variant="ghost" size="sm" className="self-start" onClick={dismissRawKey}>Sicher gespeichert</Button>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={rawReveal.rawKey}
              aria-label="Neu erstellter API-Key"
              className="font-mono text-xs sm:text-sm"
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button type="button" className="shrink-0" onClick={() => void copyRawKey()}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Kopiert" : "Key kopieren"}
            </Button>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="create-api-key-heading" className="space-y-5 rounded-xl border bg-card p-4 sm:p-6">
        <div>
          <h3 id="create-api-key-heading" className="text-base font-semibold">Neuen Schlüssel erstellen</h3>
          <p className="mt-1 text-sm text-muted-foreground">Vergib nur die Rechte, die der jeweilige Workflow wirklich braucht.</p>
        </div>
        <form className="space-y-5" onSubmit={(event) => void handleCreate(event)}>
          <div className="space-y-2">
            <Label htmlFor="api-key-label">Name</Label>
            <Input
              id="api-key-label"
              value={label}
              maxLength={80}
              placeholder="z. B. n8n Produktionsworkflow"
              disabled={!data.featureEnabled || !data.canManage || atLimit || creating}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Scopes</legend>
            <div className="grid gap-3 lg:grid-cols-3">
              {API_SCOPES.map((scope) => {
                const checked = scopes.includes(scope)
                return (
                  <label key={scope} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary/5">
                    <Checkbox
                      checked={checked}
                      className="mt-0.5"
                      disabled={!data.featureEnabled || !data.canManage || atLimit || creating}
                      onCheckedChange={(next) => toggleScope(scope, next === true)}
                    />
                    <span>
                      <span className="block text-sm font-medium">{SCOPE_COPY[scope].label}</span>
                      <code className="mt-0.5 block text-[11px] text-primary">{scope}</code>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{SCOPE_COPY[scope].description}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
          <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {atLimit ? `Maximal ${data.maxActiveKeys} regulär aktive Keys. Widerrufe zuerst einen bestehenden Key.` : "Der Rohwert wird genau einmal angezeigt."}
            </p>
            <Button type="submit" className="self-start sm:self-auto" disabled={!canCreate || creating}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Schlüssel erstellen
            </Button>
          </div>
        </form>
      </section>

      <section aria-labelledby="api-keys-heading" className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-1 border-b px-4 py-4 sm:px-6">
          <h3 id="api-keys-heading" className="text-base font-semibold">Workspace-Schlüssel</h3>
          <p className="text-sm text-muted-foreground">Prefix, Scopes und Nutzung sind sichtbar; Secrets werden nie erneut geladen.</p>
        </div>
        {data.keys.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <KeyRound className="size-7 text-muted-foreground/60" />
            <p className="text-sm font-medium">Noch kein API-Key</p>
            <p className="max-w-md text-sm text-muted-foreground">Erstelle oben einen minimal gescopten Schlüssel für deinen ersten Workflow.</p>
          </div>
        ) : (
          <div className="divide-y">
            {data.keys.map((key) => {
              const status = statusCopy(key.status, key.graceExpiresAt)
              const active = key.status === "active"
              return (
                <article key={key._id} className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold">{key.label}</h4>
                      <Badge variant={status.variant} className="font-normal">{status.label}</Badge>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{key.prefix}</code>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {key.scopes.map((scope) => <Badge key={scope} variant="outline" className="font-normal">{scope}</Badge>)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Erstellt {formatDate(key.createdAt)} · Zuletzt genutzt {formatDate(key.lastUsedAt)}
                    </p>
                    {key.graceExpiresAt && key.graceExpiresAt > Date.now() ? (
                      <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                        <Clock3 className="size-3.5" />
                        Rotierter Key gültig bis {formatDate(key.graceExpiresAt)}
                      </p>
                    ) : null}
                  </div>
                  {active ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!data.featureEnabled || !data.canManage || acting}
                        onClick={() => setKeyAction({ type: "rotate", apiKeyId: key._id, label: key.label })}
                      >
                        <RefreshCw className="size-4" />
                        Rotieren
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!data.canManage || acting}
                        onClick={() => setKeyAction({ type: "revoke", apiKeyId: key._id, label: key.label })}
                      >
                        <Trash2 className="size-4" />
                        Widerrufen
                      </Button>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <Separator />
      <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>REST v1 nutzt Bearer-Authentifizierung, externe Audit-IDs und verpflichtende Idempotenz bei Audit-Starts.</p>
        {publicApiBaseUrl ? (
          <Button asChild variant="outline" size="sm" className="self-start">
            <a href={`${publicApiBaseUrl}/api/v1/openapi.json`} target="_blank" rel="noreferrer">OpenAPI 3.1 öffnen</a>
          </Button>
        ) : (
          <Badge variant="outline" className="self-start font-normal">API-Basis-URL nicht konfiguriert</Badge>
        )}
      </div>

      <AlertDialog open={keyAction !== null} onOpenChange={(open) => { if (!open && !acting) setKeyAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {keyAction?.type === "rotate" ? `${keyAction.label} rotieren?` : `${keyAction?.label ?? "API-Key"} widerrufen?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {keyAction?.type === "rotate"
                ? "Ein neuer Rohwert wird einmal angezeigt. Der bisherige Schlüssel bleibt 24 Stunden gültig, damit du den Wechsel ohne Ausfall abschließen kannst."
                : "Der Schlüssel wird sofort ungültig. Laufende oder zukünftige Anfragen mit diesem Key werden mit 401 abgewiesen."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {keyAction?.type === "revoke" ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Sofortige Wirkung</AlertTitle>
              <AlertDescription>Dieser Schritt hat keine Übergangsfrist.</AlertDescription>
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>Abbrechen</AlertDialogCancel>
            <Button variant={keyAction?.type === "revoke" ? "destructive" : "default"} disabled={acting} onClick={() => void confirmKeyAction()}>
              {acting ? <Loader2 className="size-4 animate-spin" /> : keyAction?.type === "rotate" ? <RefreshCw className="size-4" /> : <Trash2 className="size-4" />}
              {keyAction?.type === "rotate" ? "Neuen Key erzeugen" : "Sofort widerrufen"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

ApiSettingsView.displayName = "ApiSettingsView"
