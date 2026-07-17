import ipaddr from "ipaddr.js"

export type IntegrationWebhookEvent =
  | "audit_started"
  | "audit_completed"
  | "audit_failed"
  | "report_viewed"
  | "outreach_copied"
  | "test"

const CONTROL_OR_SPACE = /[\u0000-\u0020\u007f]/

export function normalizeWebhookEndpoint(input: string): { url: string; hostname: string; display: string } {
  const raw = input.trim()
  if (!raw || CONTROL_OR_SPACE.test(raw) || raw.includes("\\")) {
    throw new Error("Bitte gib eine gültige HTTPS-Webhook-URL ein.")
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error("Bitte gib eine gültige HTTPS-Webhook-URL ein.")
  }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
    throw new Error("Webhooks benötigen HTTPS und dürfen keine Zugangsdaten in der URL enthalten.")
  }
  if (url.port && url.port !== "443") throw new Error("Webhooks sind nur über HTTPS-Port 443 erlaubt.")
  if (url.hash) throw new Error("Webhook-URLs dürfen kein Fragment enthalten.")
  const hostname = url.hostname.replace(/\.$/, "").toLowerCase()
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("Lokale Webhook-Ziele sind nicht erlaubt.")
  }
  try {
    const address = ipaddr.parse(hostname)
    const normalized = address.kind() === "ipv6" && (address as ipaddr.IPv6).isIPv4MappedAddress()
      ? (address as ipaddr.IPv6).toIPv4Address()
      : address
    if (normalized.range() !== "unicast") throw new Error("unsafe")
  } catch (error) {
    if (error instanceof Error && error.message === "unsafe") {
      throw new Error("Private oder lokale Webhook-Ziele sind nicht erlaubt.")
    }
  }
  url.hostname = hostname
  url.port = ""
  const segments = url.pathname.split("/").filter(Boolean)
  const maskedPath = segments.length === 0
    ? "/"
    : `/${segments.slice(0, Math.min(2, segments.length)).map((segment, index) =>
      index === segments.length - 1 || index === 1 ? "••••" : segment,
    ).join("/")}`
  return { url: url.toString(), hostname, display: `${url.origin}${maskedPath}` }
}

export function buildWebhookBody(args: {
  publicEventId: string
  event: IntegrationWebhookEvent
  occurredAt: number
  externalAuditId?: string
  auditStatus?: string
  domain?: string
  score?: number
  apiReportUrl?: string
  reportUrl?: string
  reportStatus?: string
  draftType?: string
  includedReportLink?: boolean
}) {
  const data: Record<string, string | number | boolean | null> = {}
  if (args.domain) data.domain = args.domain
  if (args.event === "audit_started" || args.event === "audit_completed" || args.event === "audit_failed") {
    data.audit_id = args.externalAuditId ?? null
    data.status = args.auditStatus ?? (args.event === "audit_started" ? "queued" : args.event === "audit_failed" ? "failed" : "completed")
    data.score = args.score ?? null
    data.api_report_url = args.apiReportUrl ?? null
    data.report_url = args.reportUrl ?? null
    data.report_status = args.reportStatus ?? (args.event === "audit_failed" ? "failed" : "pending")
  } else if (args.event === "report_viewed") {
    data.report_url = args.reportUrl ?? null
    data.first_view = true
  } else if (args.event === "outreach_copied") {
    data.draft_type = args.draftType ?? null
    data.included_report_link = args.includedReportLink ?? false
  }
  return JSON.stringify({
    event_id: args.publicEventId,
    type: args.event,
    version: "1",
    occurred_at: new Date(args.occurredAt).toISOString(),
    data,
  })
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function signWebhookBody(secret: string, timestamp: number, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  )
  return `v1=${toHex(signature)}`
}

export function isRetryableIntegrationResponse(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

export function integrationRetryDelay(attemptCount: number, retryAfterMs?: number): number | null {
  const schedule = [0, 60_000, 5 * 60_000, 30 * 60_000]
  if (attemptCount >= schedule.length) return null
  const scheduled = schedule[attemptCount]
  if (retryAfterMs === undefined) return scheduled
  return Math.min(Math.max(scheduled, retryAfterMs), 30 * 60_000)
}
