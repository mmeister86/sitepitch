"use client"

import { useMemo, useState, type FormEvent } from "react"
import { useAction, useMutation, usePaginatedQuery, useQuery } from "convex/react"
import {
  ArrowDown,
  AlertCircle,
  AlertTriangle,
  Blocks,
  Building2,
  CheckCircle2,
  CircleOff,
  Clock3,
  ExternalLink,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  Plug,
  RefreshCw,
  RotateCcw,
  Send,
  Table2,
  Unplug,
  Webhook,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/sonner"
import {
  OAUTH_INTEGRATION_PROVIDERS,
  WEBHOOK_EVENTS,
  canUseIntegrationProvider,
  hasWebhookDraftErrors,
  integrationRunStatusLabel,
  integrationStatusLabel,
  validateWebhookDraft,
  type IntegrationPlan,
  type IntegrationProvider,
  type IntegrationStatus,
  type OAuthIntegrationProvider,
  type WebhookDraft,
  type WebhookDraftErrors,
  type WebhookEvent,
  type WebhookPreset,
} from "@/lib/integration-settings"
import { useRouter } from "@/lib/router"
import type { Id } from "../../convex/_generated/dataModel"
import { api } from "../../convex/_generated/api"

interface IntegrationConnectionDto {
  _id: Id<"workspaceIntegrations">
  provider: IntegrationProvider
  status: IntegrationStatus
  configured: boolean
  canUse: boolean
  requiredPlan: "agency" | "scale"
  accountLabel: string | null
  label?: string | null
  preset: WebhookPreset | null
  endpointUrl: string | null
  events: string[]
  lastSuccessAt: number | null
  lastError: string | null
  createdAt: number
  updatedAt: number
}

const PROVIDERS: Record<OAuthIntegrationProvider, {
  name: string
  description: string
  icon: typeof Building2
}> = {
  hubspot: {
    name: "HubSpot",
    description: "Abgeschlossene Campaign-Leads manuell als Unternehmen übertragen.",
    icon: Building2,
  },
  pipedrive: {
    name: "Pipedrive",
    description: "Leads bewusst als Organisation an Pipedrive übergeben.",
    icon: Building2,
  },
  gmail: {
    name: "Gmail",
    description: "Bestätigte Outreach-Texte als Entwurf anlegen – niemals automatisch senden.",
    icon: Mail,
  },
  google_sheets: {
    name: "Google Sheets",
    description: "Campaign-Leads nach Vorschau importieren oder manuell exportieren.",
    icon: Table2,
  },
}

const EVENT_LABELS: Record<WebhookEvent, { label: string; description: string }> = {
  audit_started: {
    label: "Audit gestartet",
    description: "Externe Audit-ID, Domain und aktueller Status.",
  },
  audit_completed: {
    label: "Audit abgeschlossen",
    description: "Domain, Score und optionaler öffentlicher Report-Link.",
  },
  audit_failed: {
    label: "Audit fehlgeschlagen",
    description: "Sicherer Fehlercode und finaler Auditstatus.",
  },
  report_viewed: {
    label: "Report geöffnet",
    description: "Nur der erste datenschutzkonform erfasste Aufruf.",
  },
  outreach_copied: {
    label: "Outreach kopiert",
    description: "Domain, Entwurfstyp und Information zum Report-Link.",
  },
}

const PRESET_LABELS: Record<WebhookPreset, string> = {
  generic: "Eigener Endpunkt",
  zapier: "Zapier Catch Hook",
  make: "Make Custom Webhook",
}

const KIND_LABELS: Record<string, string> = {
  crm_push: "CRM-Übertragung",
  gmail_draft: "Gmail-Entwurf",
  sheet_import: "Sheets-Import",
  sheet_export: "Sheets-Export",
  webhook_delivery: "Webhook-Zustellung",
  oauth_revoke: "Verbindung trennen",
}

const INITIAL_WEBHOOK: WebhookDraft = {
  label: "",
  preset: "generic",
  endpointUrl: "",
  secret: "",
  events: ["audit_completed"],
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
})

function formatDate(value: number | null | undefined): string | null {
  return value ? DATE_FORMAT.format(new Date(value)) : null
}

function providerName(provider: IntegrationProvider): string {
  return provider === "webhook" ? "Webhook" : PROVIDERS[provider].name
}

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const icon = status === "connected"
    ? <CheckCircle2 />
    : status === "connecting"
      ? <Loader2 className="animate-spin" />
      : status === "error"
        ? <AlertCircle />
        : <CircleOff />
  return (
    <Badge
      variant={status === "error" ? "destructive" : status === "connected" ? "secondary" : "outline"}
      className="font-normal"
    >
      {icon}
      {integrationStatusLabel(status)}
    </Badge>
  )
}

function ProviderRow({
  provider,
  connection,
  plan,
  featureEnabled,
  canManage,
  pendingProvider,
  configuringProvider,
  onConnect,
  onConfigure,
  onDisconnect,
  onUpgrade,
}: {
  provider: OAuthIntegrationProvider
  connection: IntegrationConnectionDto | undefined
  plan: IntegrationPlan
  featureEnabled: boolean
  canManage: boolean
  pendingProvider: OAuthIntegrationProvider | null
  configuringProvider: OAuthIntegrationProvider | null
  onConnect: (provider: OAuthIntegrationProvider) => void
  onConfigure: (connection: IntegrationConnectionDto) => void
  onDisconnect: (connection: IntegrationConnectionDto) => void
  onUpgrade: () => void
}) {
  const config = PROVIDERS[provider]
  const Icon = config.icon
  const unlocked = connection?.canUse ?? canUseIntegrationProvider(plan, provider)
  const connected = connection?.status === "connected"
  const pending = pendingProvider === provider
  const configuring = configuringProvider === provider
  const needsCrmConfiguration = connected && (provider === "hubspot" || provider === "pipedrive") && !connection.configured
  const lastSuccess = formatDate(connection?.lastSuccessAt)

  return (
    <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{config.name}</h3>
            {connection ? <StatusBadge status={connection.status} /> : (
              <Badge variant="outline" className="font-normal">Nicht verbunden</Badge>
            )}
            {!unlocked ? (
              <Badge variant="outline" className="gap-1 font-normal">
                <LockKeyhole />
                Agency
              </Badge>
            ) : null}
          </div>
          <p className="max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
            {config.description}
          </p>
          {needsCrmConfiguration ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              SitePitch-Felder müssen vor der ersten manuellen Übertragung zugeordnet werden.
            </p>
          ) : null}
          {connection?.accountLabel ? (
            <p className="truncate text-xs text-muted-foreground">
              Konto: <span className="font-medium text-foreground">{connection.accountLabel}</span>
            </p>
          ) : null}
          {connection?.lastError ? (
            <p className="flex items-start gap-1.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              {connection.lastError}
            </p>
          ) : lastSuccess ? (
            <p className="text-xs text-muted-foreground">Letzte erfolgreiche Aktion: {lastSuccess}</p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        {!unlocked ? (
          <Button variant="outline" size="sm" onClick={onUpgrade}>
            Agency ansehen
            <ExternalLink className="size-3.5" />
          </Button>
        ) : (
          <>
            {needsCrmConfiguration ? (
              <Button
                variant="default"
                size="sm"
                disabled={!featureEnabled || !canManage || configuringProvider !== null}
                onClick={() => onConfigure(connection)}
              >
                {configuring ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                Felder einrichten
              </Button>
            ) : null}
            <Button
              variant={connected ? "outline" : "default"}
              size="sm"
              disabled={!featureEnabled || !canManage || pendingProvider !== null || connection?.status === "connecting"}
              onClick={() => onConnect(provider)}
            >
              {pending || connection?.status === "connecting" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : connected ? (
                <RefreshCw className="size-4" />
              ) : (
                <Plug className="size-4" />
              )}
              {connection?.status === "connecting"
                ? "Verbindung läuft"
                : connected
                  ? "Neu verbinden"
                  : connection?.status === "error" || connection?.status === "revoked"
                    ? "Erneut verbinden"
                    : "Verbinden"}
            </Button>
            {connected ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={!featureEnabled || !canManage || pendingProvider !== null}
                onClick={() => onDisconnect(connection)}
              >
                <Unplug className="size-4" />
                Trennen
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export function IntegrationSettingsView() {
  const rawData = useQuery(api.integrations.listConnections, {})
  const beginOAuth = useAction(api.integration_actions.beginOAuth)
  const disconnect = useAction(api.integration_actions.disconnect)
  const configureCrmFields = useAction(api.integration_actions.configureCrmFields)
  const createWebhook = useMutation(api.integrations.createWebhook)
  const updateWebhookConnection = useMutation(api.integrations.updateWebhook)
  const disableWebhook = useMutation(api.integrations.disableWebhook)
  const testWebhook = useMutation(api.integrations.testWebhook)
  const retryRun = useMutation(api.integrations.retryRun)
  const redeliverWebhook = useMutation(api.integrations.redeliverWebhook)
  const { navigate } = useRouter()

  const data = rawData
  const plan = data?.plan ?? "free"
  const [pendingProvider, setPendingProvider] = useState<OAuthIntegrationProvider | null>(null)
  const [disconnectTarget, setDisconnectTarget] = useState<IntegrationConnectionDto | null>(null)
  const [disconnectPending, setDisconnectPending] = useState(false)
  const [configuringProvider, setConfiguringProvider] = useState<OAuthIntegrationProvider | null>(null)
  const [webhookDraft, setWebhookDraft] = useState<WebhookDraft>(INITIAL_WEBHOOK)
  const [webhookErrors, setWebhookErrors] = useState<WebhookDraftErrors>({})
  const [webhookPending, setWebhookPending] = useState(false)
  const [editingWebhookId, setEditingWebhookId] = useState<Id<"workspaceIntegrations"> | null>(null)
  const [pendingWebhookAction, setPendingWebhookAction] = useState<string | null>(null)
  const [pendingRun, setPendingRun] = useState<Id<"integrationRuns"> | null>(null)
  const [deliveryIntegrationId, setDeliveryIntegrationId] = useState("all")
  const [deliveryEvent, setDeliveryEvent] = useState("all")
  const [deliveryStatus, setDeliveryStatus] = useState("all")
  const [redeliveryTarget, setRedeliveryTarget] = useState<{
    runId: Id<"integrationRuns">
    eventId: string
    deliveryId: string
  } | null>(null)
  const [redeliveryReason, setRedeliveryReason] = useState("")
  const [redeliveryPending, setRedeliveryPending] = useState(false)

  const deliveryArgs = {
    ...(deliveryIntegrationId !== "all" ? { integrationId: deliveryIntegrationId as Id<"workspaceIntegrations"> } : {}),
    ...(deliveryEvent !== "all" ? { event: deliveryEvent as WebhookEvent } : {}),
    ...(deliveryStatus !== "all" ? { status: deliveryStatus as "queued" | "running" | "succeeded" | "retryable_failed" | "permanent_failed" | "unknown" | "cancelled" } : {}),
  }
  const deliveries = usePaginatedQuery(
    api.integrations.listWebhookDeliveries,
    deliveryArgs,
    { initialNumItems: 20 },
  )

  const oauthConnections = useMemo(() => {
    const byProvider = new Map<OAuthIntegrationProvider, IntegrationConnectionDto>()
    for (const connection of data?.connections ?? []) {
      if (connection.provider !== "webhook") byProvider.set(connection.provider, connection)
    }
    return byProvider
  }, [data?.connections])
  const webhooks = (data?.connections ?? []).filter((item) => item.provider === "webhook")
  const activeWebhookCount = webhooks.filter((item) => item.status !== "revoked").length
  const featureEnabled = data?.featureEnabled ?? false
  const canManage = data?.canManage ?? true
  const webhookUnlocked = canUseIntegrationProvider(plan, "webhook")
  const webhookLimit = 5
  const webhookFormDisabled = webhookPending || !featureEnabled || !canManage

  if (data === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    )
  }

  async function connectProvider(provider: OAuthIntegrationProvider) {
    setPendingProvider(provider)
    try {
      const result = await beginOAuth({ provider })
      if (!result?.url) throw new Error("missing_oauth_url")
      window.location.assign(result.url)
    } catch {
      toast.error(`${PROVIDERS[provider].name} konnte nicht verbunden werden`, {
        description: "Bitte versuche es erneut. Es wurden keine Zugangsdaten gespeichert.",
      })
      setPendingProvider(null)
    }
  }

  async function confirmDisconnect() {
    if (!disconnectTarget) return
    setDisconnectPending(true)
    try {
      await disconnect({ integrationId: disconnectTarget._id })
      toast.success(`${providerName(disconnectTarget.provider)} wurde getrennt`, {
        description: "Neue Integrationsaktionen sind ab sofort gesperrt.",
      })
      setDisconnectTarget(null)
    } catch {
      toast.error("Verbindung konnte nicht getrennt werden", {
        description: "Prüfe den angezeigten Status und versuche es erneut.",
      })
    } finally {
      setDisconnectPending(false)
    }
  }

  async function configureCrm(connection: IntegrationConnectionDto) {
    if (connection.provider !== "hubspot" && connection.provider !== "pipedrive") return
    setConfiguringProvider(connection.provider)
    try {
      let result = await configureCrmFields({ integrationId: connection._id, createMissingFields: false })
      if (result.requiresConfirmation) {
        const accepted = window.confirm(
          `${providerName(connection.provider)} fehlen folgende Felder: ${result.missing.join(", ")}. Soll SitePitch diese Felder jetzt anlegen?`,
        )
        if (!accepted) return
        result = await configureCrmFields({ integrationId: connection._id, createMissingFields: true })
      }
      if (result.configured) toast.success(`${providerName(connection.provider)}-Felder sind eingerichtet`)
    } catch (error) {
      toast.error((error as Error)?.message ?? "CRM-Felder konnten nicht eingerichtet werden")
    } finally {
      setConfiguringProvider(null)
    }
  }

  function updateWebhook<K extends keyof WebhookDraft>(key: K, value: WebhookDraft[K]) {
    setWebhookDraft((current) => ({ ...current, [key]: value }))
    setWebhookErrors((current) => ({ ...current, [key]: undefined }))
  }

  async function submitWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors = validateWebhookDraft(
      editingWebhookId && !webhookDraft.secret
        ? { ...webhookDraft, secret: "x".repeat(32) }
        : webhookDraft,
    )
    setWebhookErrors(errors)
    if (hasWebhookDraftErrors(errors)) return

    setWebhookPending(true)
    try {
      const values = { label: webhookDraft.label.trim(), preset: webhookDraft.preset, endpointUrl: webhookDraft.endpointUrl.trim(), events: webhookDraft.events }
      if (editingWebhookId) {
        await updateWebhookConnection({ integrationId: editingWebhookId, ...values, secret: webhookDraft.secret || undefined })
      } else {
        await createWebhook({ ...values, secret: webhookDraft.secret })
      }
      setWebhookDraft(INITIAL_WEBHOOK)
      setEditingWebhookId(null)
      setWebhookErrors({})
      toast.success(editingWebhookId ? "Webhook-Endpunkt aktualisiert" : "Webhook-Endpunkt angelegt", {
        description: "Das Secret wurde verschlüsselt gespeichert und wird nicht wieder angezeigt.",
      })
    } catch {
      toast.error("Webhook konnte nicht angelegt werden", {
        description: "Prüfe Endpunkt, Secret, Plan und Feature-Freigabe.",
      })
    } finally {
      setWebhookPending(false)
    }
  }

  function editWebhook(webhook: IntegrationConnectionDto) {
    setEditingWebhookId(webhook._id)
    setWebhookDraft({
      label: webhook.label ?? "Webhook",
      preset: webhook.preset ?? "generic",
      endpointUrl: "",
      secret: "",
      events: webhook.events.filter((event): event is WebhookEvent => WEBHOOK_EVENTS.includes(event as WebhookEvent)),
    })
    setWebhookErrors({})
  }

  async function runWebhookAction(
    action: "test" | "disable",
    integrationId: Id<"workspaceIntegrations">,
  ) {
    setPendingWebhookAction(`${action}:${integrationId}`)
    try {
      if (action === "test") {
        await testWebhook({ integrationId })
        toast.success("Test-Delivery eingeplant")
      } else {
        await disableWebhook({ integrationId })
        toast.success("Webhook deaktiviert")
      }
    } catch {
      toast.error(action === "test" ? "Test konnte nicht gestartet werden" : "Webhook konnte nicht deaktiviert werden")
    } finally {
      setPendingWebhookAction(null)
    }
  }

  async function retryFailure(runId: Id<"integrationRuns">) {
    setPendingRun(runId)
    try {
      await retryRun({ runId })
      toast.success("Integrationsaktion erneut eingeplant")
    } catch {
      toast.error("Aktion kann nicht erneut versucht werden")
    } finally {
      setPendingRun(null)
    }
  }

  async function confirmRedelivery() {
    if (!redeliveryTarget || !redeliveryReason.trim()) return
    setRedeliveryPending(true)
    try {
      await redeliverWebhook({ runId: redeliveryTarget.runId, reason: redeliveryReason.trim() })
      toast.success("Webhook-Delivery neu eingeplant", {
        description: "Die Event-ID bleibt stabil; die Delivery erhält eine neue ID.",
      })
      setRedeliveryTarget(null)
      setRedeliveryReason("")
    } catch (error) {
      toast.error("Redelivery konnte nicht gestartet werden", {
        description: error instanceof Error ? error.message : "Prüfe Rate-Limit und Endpoint-Status.",
      })
    } finally {
      setRedeliveryPending(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Integrationen</h2>
          <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
            Verbinde externe Dienste bewusst. SitePitch synchronisiert nichts automatisch und sendet keine E-Mails.
          </p>
        </div>
        <Badge variant="outline" className="mt-1 gap-1.5 self-start px-2.5 py-1 font-normal">
          <LockKeyhole className="size-3" />
          Nur Workspace-Inhaber
        </Badge>
      </div>

      {!featureEnabled ? (
        <Alert>
          <Blocks className="size-4" />
          <AlertTitle>Noch nicht freigeschaltet</AlertTitle>
          <AlertDescription>
            Die Integrationen sind für diesen Workspace vorbereitet, aber noch deaktiviert. Bestehende Audits und Reports funktionieren unverändert.
          </AlertDescription>
        </Alert>
      ) : !canManage ? (
        <Alert>
          <LockKeyhole className="size-4" />
          <AlertTitle>Keine Verwaltungsrechte</AlertTitle>
          <AlertDescription>Nur der Workspace-Inhaber darf Verbindungen und Secrets verwalten.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Apps verbinden</CardTitle>
          <CardDescription>
            OAuth-Zugriffe gelten immer nur für den ausgewählten Dienst und Workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {OAUTH_INTEGRATION_PROVIDERS.map((provider) => (
              <ProviderRow
                key={provider}
                provider={provider}
                connection={oauthConnections.get(provider)}
                plan={plan}
                featureEnabled={featureEnabled}
                canManage={canManage}
                pendingProvider={pendingProvider}
                configuringProvider={configuringProvider}
                onConnect={(value) => void connectProvider(value)}
                onConfigure={(connection) => void configureCrm(connection)}
                onDisconnect={setDisconnectTarget}
                onUpgrade={() => navigate({ name: "billing-settings" })}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="webhook-deliveries-heading" className="overflow-hidden rounded-xl border bg-card">
        <div className="space-y-4 border-b px-4 py-5 sm:px-6">
          <div>
            <h3 id="webhook-deliveries-heading" className="text-base font-semibold">Delivery-Protokoll</h3>
            <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
              Sichere Zustellmetadaten der letzten 30 Tage. Payloads, Secrets und unredigierte Providerfehler werden nicht angezeigt.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="delivery-endpoint" className="text-xs">Endpunkt</Label>
              <Select value={deliveryIntegrationId} onValueChange={setDeliveryIntegrationId}>
                <SelectTrigger id="delivery-endpoint" className="w-full">
                  <SelectValue placeholder="Alle Endpunkte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Endpunkte</SelectItem>
                  {webhooks.map((webhook) => (
                    <SelectItem key={webhook._id} value={webhook._id}>
                      {webhook.label ?? webhook.accountLabel ?? "Webhook"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delivery-event" className="text-xs">Event</Label>
              <Select value={deliveryEvent} onValueChange={setDeliveryEvent}>
                <SelectTrigger id="delivery-event" className="w-full">
                  <SelectValue placeholder="Alle Events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Events</SelectItem>
                  {WEBHOOK_EVENTS.map((event) => <SelectItem key={event} value={event}>{EVENT_LABELS[event].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delivery-status" className="text-xs">Status</Label>
              <Select value={deliveryStatus} onValueChange={setDeliveryStatus}>
                <SelectTrigger id="delivery-status" className="w-full">
                  <SelectValue placeholder="Alle Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="queued">Wartet</SelectItem>
                  <SelectItem value="running">Läuft</SelectItem>
                  <SelectItem value="succeeded">Erfolgreich</SelectItem>
                  <SelectItem value="retryable_failed">Retry geplant</SelectItem>
                  <SelectItem value="permanent_failed">Terminal fehlgeschlagen</SelectItem>
                  <SelectItem value="unknown">Ergebnis unklar</SelectItem>
                  <SelectItem value="cancelled">Abgebrochen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {deliveries.status === "LoadingFirstPage" ? (
          <div className="flex min-h-56 items-center justify-center" aria-label="Webhook-Deliveries werden geladen">
            <Spinner className="size-6 text-primary" />
          </div>
        ) : deliveries.results.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-2 px-6 text-center">
            <Send className="size-6 text-muted-foreground/60" />
            <p className="text-sm font-medium">Keine passenden Deliveries</p>
            <p className="max-w-md text-sm text-muted-foreground">Nach dem ersten ausgewählten Event erscheinen Endpoint, Event-ID, Versuchszahl und Status hier.</p>
          </div>
        ) : (
          <div className="divide-y">
            {deliveries.results.map((delivery) => (
              <article key={delivery._id} className="flex flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{EVENT_LABELS[delivery.event as WebhookEvent]?.label ?? delivery.event}</p>
                    <Badge
                      variant={delivery.status === "permanent_failed" ? "destructive" : delivery.status === "succeeded" ? "secondary" : "outline"}
                      className="font-normal"
                    >
                      {integrationRunStatusLabel(delivery.status)}
                    </Badge>
                    {delivery.responseStatus ? <Badge variant="outline" className="font-normal">HTTP {delivery.responseStatus}</Badge> : null}
                  </div>
                  <p className="break-all text-xs text-muted-foreground">{delivery.endpoint ?? "Endpoint nicht mehr verfügbar"}</p>
                  <p className="text-xs text-muted-foreground">
                    Event {delivery.eventId} · Delivery {delivery.deliveryId} · {delivery.attempts} {delivery.attempts === 1 ? "Versuch" : "Versuche"} · {formatDate(delivery.updatedAt)}
                  </p>
                  {delivery.safeError ? <p className="text-xs text-destructive">{delivery.safeError}</p> : null}
                </div>
                {delivery.canRedeliver ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-start lg:self-auto"
                    disabled={!featureEnabled || !canManage || redeliveryPending}
                    onClick={() => setRedeliveryTarget({ runId: delivery._id, eventId: delivery.eventId, deliveryId: delivery.deliveryId })}
                  >
                    <RotateCcw className="size-4" />
                    Bestätigt erneut senden
                  </Button>
                ) : null}
              </article>
            ))}
          </div>
        )}

        {deliveries.results.length > 0 || deliveries.status === "CanLoadMore" || deliveries.status === "LoadingMore" ? (
          <div className="flex min-h-16 items-center justify-center border-t px-4 py-3">
            {deliveries.status === "CanLoadMore" || deliveries.status === "LoadingMore" ? (
              <Button
                variant="outline"
                className="min-w-36"
                disabled={deliveries.status === "LoadingMore"}
                onClick={() => deliveries.loadMore(20)}
              >
                {deliveries.status === "LoadingMore" ? <Spinner className="size-4" /> : <ArrowDown className="size-4" />}
                {deliveries.status === "LoadingMore" ? "Wird geladen …" : "Mehr laden"}
              </Button>
            ) : <p className="text-sm text-muted-foreground">Alle passenden Deliveries geladen</p>}
          </div>
        ) : null}
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="size-4 text-primary" />
                Webhooks
              </CardTitle>
              <CardDescription>
                Signierte Events an einen eigenen Endpunkt, Zapier oder Make zustellen.
              </CardDescription>
            </div>
            <Badge variant="outline" className="gap-1 font-normal">
              <LockKeyhole />
              Agency · {activeWebhookCount}/{webhookLimit}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!webhookUnlocked ? (
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/35 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Webhooks sind im Agency-Plan enthalten</p>
                <p className="mt-1 text-sm text-muted-foreground">CRM, Gmail und Sheets bleiben davon unabhängig.</p>
              </div>
              <Button variant="outline" className="self-start" onClick={() => navigate({ name: "billing-settings" })}>
                Agency ansehen
                <ExternalLink className="size-3.5" />
              </Button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={(event) => void submitWebhook(event)} noValidate>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="webhook-label">Name</Label>
                  <Input
                    id="webhook-label"
                    placeholder="z. B. Sales-Automation"
                    maxLength={80}
                    value={webhookDraft.label}
                    disabled={webhookFormDisabled}
                    aria-invalid={Boolean(webhookErrors.label)}
                    aria-describedby={webhookErrors.label ? "webhook-label-error" : undefined}
                    onChange={(event) => updateWebhook("label", event.target.value)}
                  />
                  {webhookErrors.label ? <p id="webhook-label-error" className="text-xs text-destructive">{webhookErrors.label}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhook-preset">Vorlage</Label>
                  <Select
                    value={webhookDraft.preset}
                    disabled={webhookFormDisabled}
                    onValueChange={(value) => updateWebhook("preset", value as WebhookPreset)}
                  >
                    <SelectTrigger id="webhook-preset" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PRESET_LABELS) as WebhookPreset[]).map((preset) => (
                        <SelectItem key={preset} value={preset}>{PRESET_LABELS[preset]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-url">Endpoint-URL</Label>
                <Input
                  id="webhook-url"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder={webhookDraft.preset === "generic" ? "https://hooks.example.com/sitepitch" : "HTTPS-URL aus der gewählten Automation"}
                  value={webhookDraft.endpointUrl}
                  disabled={webhookFormDisabled}
                  aria-invalid={Boolean(webhookErrors.endpointUrl)}
                  aria-describedby={webhookErrors.endpointUrl ? "webhook-url-help webhook-url-error" : "webhook-url-help"}
                  onChange={(event) => updateWebhook("endpointUrl", event.target.value)}
                />
                <p id="webhook-url-help" className="text-xs text-muted-foreground">
                  Nur öffentliche HTTPS-Endpunkte auf Port 443; Weiterleitungen und private Ziele werden abgelehnt.
                  {editingWebhookId ? " Gib die vollständige URL aus Sicherheitsgründen erneut ein." : ""}
                </p>
                {webhookErrors.endpointUrl ? <p id="webhook-url-error" className="text-xs text-destructive">{webhookErrors.endpointUrl}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-secret">Signatur-Secret</Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="webhook-secret"
                    type="password"
                    autoComplete="new-password"
                    className="pl-9"
                    maxLength={256}
                    placeholder={editingWebhookId ? "Leer lassen, um das Secret beizubehalten" : "Mindestens 32 Zeichen"}
                    value={webhookDraft.secret}
                    disabled={webhookFormDisabled}
                    aria-invalid={Boolean(webhookErrors.secret)}
                    aria-describedby={webhookErrors.secret ? "webhook-secret-help webhook-secret-error" : "webhook-secret-help"}
                    onChange={(event) => updateWebhook("secret", event.target.value)}
                  />
                </div>
                <p id="webhook-secret-help" className="text-xs text-muted-foreground">
                  Write-only: Nach dem Speichern wird das Secret weder angezeigt noch vorausgefüllt.{editingWebhookId ? " Leer lassen behält das vorhandene Secret." : ""}
                </p>
                {webhookErrors.secret ? <p id="webhook-secret-error" className="text-xs text-destructive">{webhookErrors.secret}</p> : null}
              </div>

              <fieldset className="space-y-3" aria-describedby={webhookErrors.events ? "webhook-events-error" : undefined}>
                <legend className="text-sm font-medium">Ereignisse</legend>
                <div className="grid gap-3 md:grid-cols-3">
                  {WEBHOOK_EVENTS.map((event) => {
                    const checked = webhookDraft.events.includes(event)
                    return (
                      <label key={event} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary/5">
                        <Checkbox
                          className="mt-0.5"
                          checked={checked}
                          disabled={webhookFormDisabled}
                          onCheckedChange={(next) => updateWebhook(
                            "events",
                            next === true
                              ? [...webhookDraft.events, event]
                              : webhookDraft.events.filter((item) => item !== event),
                          )}
                        />
                        <span className="space-y-1">
                          <span className="block text-sm font-medium">{EVENT_LABELS[event].label}</span>
                          <span className="block text-xs leading-relaxed text-muted-foreground">{EVENT_LABELS[event].description}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
                {webhookErrors.events ? <p id="webhook-events-error" className="text-xs text-destructive">{webhookErrors.events}</p> : null}
              </fieldset>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                <p className="max-w-[58ch] text-xs leading-relaxed text-muted-foreground">
                  Signatur: HMAC-SHA-256 über Timestamp und unveränderten Request-Body. Zapier und Make nutzen denselben sicheren Delivery-Pfad.
                </p>
                <div className="flex gap-2">
                  {editingWebhookId ? (
                    <Button type="button" variant="ghost" disabled={webhookPending} onClick={() => { setEditingWebhookId(null); setWebhookDraft(INITIAL_WEBHOOK); setWebhookErrors({}) }}>
                      Abbrechen
                    </Button>
                  ) : null}
                  <Button type="submit" disabled={webhookFormDisabled || (!editingWebhookId && activeWebhookCount >= webhookLimit)}>
                    {webhookPending ? <Loader2 className="size-4 animate-spin" /> : <Webhook className="size-4" />}
                    {editingWebhookId ? "Änderungen speichern" : "Endpunkt anlegen"}
                  </Button>
                </div>
              </div>
            </form>
          )}

          {webhooks.length > 0 ? (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Konfigurierte Endpunkte</h3>
                <div className="divide-y rounded-lg border">
                  {webhooks.map((webhook) => {
                    const testPending = pendingWebhookAction === `test:${webhook._id}`
                    const disablePending = pendingWebhookAction === `disable:${webhook._id}`
                    return (
                      <div key={webhook._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">{webhook.label ?? webhook.accountLabel ?? "Webhook"}</p>
                            <StatusBadge status={webhook.status} />
                            {webhook.preset ? <Badge variant="outline" className="font-normal">{PRESET_LABELS[webhook.preset]}</Badge> : null}
                          </div>
                          {webhook.endpointUrl ? <p className="break-all text-xs text-muted-foreground">{webhook.endpointUrl}</p> : null}
                          <p className="text-xs text-muted-foreground">
                            {webhook.events.map((event) => EVENT_LABELS[event as WebhookEvent]?.label ?? event).join(" · ") || "Keine Events"}
                          </p>
                          {webhook.lastError ? <p className="flex items-start gap-1.5 text-xs text-destructive"><AlertTriangle className="mt-0.5 size-3 shrink-0" />{webhook.lastError}</p> : null}
                          {!webhook.lastError && webhook.lastSuccessAt ? <p className="text-xs text-muted-foreground">Letzte erfolgreiche Delivery: {formatDate(webhook.lastSuccessAt)}</p> : null}
                        </div>
                        {webhook.status !== "revoked" ? (
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!featureEnabled || !canManage || pendingWebhookAction !== null}
                              onClick={() => editWebhook(webhook)}
                            >
                              Bearbeiten
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!featureEnabled || !canManage || pendingWebhookAction !== null || webhook.status !== "connected"}
                              onClick={() => void runWebhookAction("test", webhook._id)}
                            >
                              {testPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                              Testen
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!featureEnabled || !canManage || pendingWebhookAction !== null}
                              onClick={() => void runWebhookAction("disable", webhook._id)}
                            >
                              {disablePending ? <Loader2 className="size-4 animate-spin" /> : <CircleOff className="size-4" />}
                              Deaktivieren
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Letzte fehlgeschlagene Aktionen</CardTitle>
          <CardDescription>
            Fehler bleiben sichtbar, bis die Ursache behoben oder die Aktion erfolgreich wiederholt wurde.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentFailures.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="size-6 text-score-strong" />
              <p className="text-sm font-medium">Keine offenen Integrationsfehler</p>
              <p className="text-xs text-muted-foreground">Neue Zustellungsfehler erscheinen dauerhaft an dieser Stelle.</p>
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {data.recentFailures.map((failure) => {
                const retryable = failure.status === "retryable_failed" || failure.status === "permanent_failed"
                const retryPending = pendingRun === failure._id
                return (
                  <div key={failure._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{providerName(failure.provider)} · {KIND_LABELS[failure.operation] ?? failure.operation}</p>
                        <Badge variant={failure.status === "permanent_failed" ? "destructive" : "outline"} className="font-normal">
                          {failure.status === "unknown" ? <Clock3 /> : <AlertTriangle />}
                          {integrationRunStatusLabel(failure.status)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {failure.attempts} {failure.attempts === 1 ? "Versuch" : "Versuche"} · {formatDate(failure.createdAt)}
                      </p>
                      {failure.safeError ? <p className="text-xs text-destructive">{failure.safeError}</p> : null}
                      {failure.status === "unknown" ? <p className="text-xs text-muted-foreground">Wird nicht automatisch wiederholt, damit kein Duplikat entsteht.</p> : null}
                    </div>
                    {retryable ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="self-start sm:self-auto"
                        disabled={!featureEnabled || !canManage || pendingRun !== null}
                        onClick={() => void retryFailure(failure._id)}
                      >
                        {retryPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                        Erneut versuchen
                      </Button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={disconnectTarget !== null} onOpenChange={(open) => { if (!open && !disconnectPending) setDisconnectTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{disconnectTarget ? `${providerName(disconnectTarget.provider)} trennen?` : "Verbindung trennen?"}</AlertDialogTitle>
            <AlertDialogDescription>
              Neue Aktionen werden sofort blockiert und die lokal gespeicherten Zugangsdaten gelöscht. Bereits übertragene Daten bleiben beim Anbieter bestehen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnectPending}>Abbrechen</AlertDialogCancel>
            <Button variant="destructive" disabled={disconnectPending} onClick={() => void confirmDisconnect()}>
              {disconnectPending ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />}
              Verbindung trennen
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={redeliveryTarget !== null} onOpenChange={(open) => {
        if (!open && !redeliveryPending) {
          setRedeliveryTarget(null)
          setRedeliveryReason("")
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Webhook erneut senden?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Event-ID {redeliveryTarget?.eventId} bleibt unverändert, während für Delivery {redeliveryTarget?.deliveryId} eine neue Delivery-ID erzeugt wird. Das erleichtert die Deduplizierung im Zielsystem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="redelivery-reason">Protokollierter Grund</Label>
            <Input
              id="redelivery-reason"
              value={redeliveryReason}
              maxLength={240}
              placeholder="z. B. Zielsystem nach Ausfall wieder verfügbar"
              disabled={redeliveryPending}
              onChange={(event) => setRedeliveryReason(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">Die Aktion ist rate-limitiert und wird mit deinem Nutzerkonto protokolliert.</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={redeliveryPending}>Abbrechen</AlertDialogCancel>
            <Button disabled={!redeliveryReason.trim() || redeliveryPending} onClick={() => void confirmRedelivery()}>
              {redeliveryPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              Erneut senden
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

IntegrationSettingsView.displayName = "IntegrationSettingsView"
