export const OAUTH_INTEGRATION_PROVIDERS = [
  "hubspot",
  "pipedrive",
  "gmail",
  "google_sheets",
] as const

export const WEBHOOK_EVENTS = [
  "audit_started",
  "audit_completed",
  "audit_failed",
  "report_viewed",
  "outreach_copied",
] as const

export type OAuthIntegrationProvider = (typeof OAUTH_INTEGRATION_PROVIDERS)[number]
export type IntegrationProvider = OAuthIntegrationProvider | "webhook"
export type IntegrationPlan = "free" | "starter" | "pro" | "agency" | "scale"
export type IntegrationStatus = "connecting" | "connected" | "error" | "revoked"
export type IntegrationRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "retryable_failed"
  | "permanent_failed"
  | "unknown"
  | "cancelled"
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]
export type WebhookPreset = "generic" | "zapier" | "make"

const PLAN_RANK: Record<IntegrationPlan, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  agency: 3,
  scale: 4,
}

export function requiredPlanForProvider(_provider: IntegrationProvider): "agency" | "scale" {
  return "agency"
}

export function canUseIntegrationProvider(
  plan: IntegrationPlan,
  provider: IntegrationProvider,
): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[requiredPlanForProvider(provider)]
}

export function integrationStatusLabel(status: IntegrationStatus): string {
  switch (status) {
    case "connected":
      return "Verbunden"
    case "connecting":
      return "Verbindung läuft"
    case "error":
      return "Aktion erforderlich"
    case "revoked":
      return "Getrennt"
  }
}

export function integrationRunStatusLabel(status: IntegrationRunStatus): string {
  switch (status) {
    case "queued":
      return "Wartet"
    case "running":
      return "Läuft"
    case "succeeded":
      return "Erfolgreich"
    case "retryable_failed":
      return "Erneut versuchen"
    case "permanent_failed":
      return "Fehlgeschlagen"
    case "unknown":
      return "Ergebnis unklar"
    case "cancelled":
      return "Abgebrochen"
  }
}

export interface WebhookDraft {
  label: string
  preset: WebhookPreset
  endpointUrl: string
  secret: string
  events: WebhookEvent[]
}

export type WebhookDraftErrors = Partial<Record<"label" | "endpointUrl" | "secret" | "events", string>>

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".")
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false
  const octets = parts.map(Number)
  if (octets.some((part) => part > 255)) return false
  const [a, b] = octets
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  )
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "")
  const isIpv6 = normalized.includes(":")
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    (isIpv6 && (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
    )) ||
    isPrivateIpv4(normalized)
  )
}

export function validateWebhookDraft(draft: WebhookDraft): WebhookDraftErrors {
  const errors: WebhookDraftErrors = {}
  const label = draft.label.trim()
  if (!label) errors.label = "Gib dem Endpunkt einen Namen."
  else if (label.length > 80) errors.label = "Der Name darf höchstens 80 Zeichen lang sein."

  try {
    const endpoint = new URL(draft.endpointUrl.trim())
    if (endpoint.protocol !== "https:") {
      errors.endpointUrl = "Nur HTTPS-Endpunkte sind erlaubt."
    } else if (endpoint.username || endpoint.password) {
      errors.endpointUrl = "Zugangsdaten dürfen nicht in der URL stehen."
    } else if (endpoint.port && endpoint.port !== "443") {
      errors.endpointUrl = "Der Endpunkt muss Port 443 verwenden."
    } else if (isLocalHostname(endpoint.hostname)) {
      errors.endpointUrl = "Lokale oder private Ziele sind nicht erlaubt."
    }
  } catch {
    errors.endpointUrl = "Gib eine vollständige HTTPS-URL ein."
  }

  if (draft.secret.length < 32 || draft.secret.length > 256) {
    errors.secret = "Das Secret muss 32 bis 256 Zeichen lang sein."
  }
  if (draft.events.length === 0) {
    errors.events = "Wähle mindestens ein Ereignis."
  }
  return errors
}

export function hasWebhookDraftErrors(errors: WebhookDraftErrors): boolean {
  return Object.keys(errors).length > 0
}
