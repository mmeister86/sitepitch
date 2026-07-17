"use node"

import { lookup } from "node:dns/promises"
import https from "node:https"
import type { IncomingHttpHeaders } from "node:http"

import ipaddr from "ipaddr.js"
import { ConvexError, v } from "convex/values"

import { api, internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import { action, env, internalAction, type ActionCtx } from "./_generated/server"
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  randomBase64Url,
  sha256Base64Url,
} from "./lib/integration_crypto"
import {
  buildWebhookBody,
  isRetryableIntegrationResponse,
  normalizeWebhookEndpoint,
  signWebhookBody,
} from "./lib/integration_webhook"
import {
  CAMPAIGN_CSV_MAX_BYTES,
  parseCampaignCsv,
  spreadsheetSafeText,
  type CampaignImportRow,
} from "../src/lib/campaign-csv"

type OAuthProvider = "hubspot" | "pipedrive" | "gmail" | "google_sheets"
type IntegrationProvider = OAuthProvider | "webhook"

type StoredCredential = {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  apiDomain?: string
  scope?: string
  tokenType?: string
  endpointUrl?: string
  secret?: string
}

type CredentialContext = {
  integration: Doc<"workspaceIntegrations">
  credential: Doc<"integrationCredentials">
}

class ProviderError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
    readonly retryable = false,
    readonly unknown = false,
    readonly retryAfterMs?: number,
  ) {
    super(message)
  }
}

function fail(code: string, message: string): never {
  throw new ConvexError({ code, message })
}

function oauthSecrets(provider: OAuthProvider) {
  if (provider === "hubspot") return {
    clientId: env.HUBSPOT_CLIENT_ID,
    clientSecret: env.HUBSPOT_CLIENT_SECRET,
    tokenUrl: "https://api.hubapi.com/oauth/2026-03/token",
  }
  if (provider === "pipedrive") return {
    clientId: env.PIPEDRIVE_CLIENT_ID,
    clientSecret: env.PIPEDRIVE_CLIENT_SECRET,
    tokenUrl: "https://oauth.pipedrive.com/oauth/token",
  }
  if (provider === "gmail") return {
    clientId: env.GOOGLE_GMAIL_CLIENT_ID,
    clientSecret: env.GOOGLE_GMAIL_CLIENT_SECRET,
    tokenUrl: "https://oauth2.googleapis.com/token",
  }
  return {
    clientId: env.GOOGLE_SHEETS_CLIENT_ID,
    clientSecret: env.GOOGLE_SHEETS_CLIENT_SECRET,
    tokenUrl: "https://oauth2.googleapis.com/token",
  }
}

function aad(context: CredentialContext) {
  return `${context.integration.workspaceId}:${context.integration._id}:${context.integration.provider}`
}

async function decodeCredential(context: CredentialContext): Promise<StoredCredential> {
  const decrypted = await decryptIntegrationSecret(context.credential, env.INTEGRATION_CREDENTIAL_KEYRING, aad(context))
  const parsed: unknown = JSON.parse(decrypted.plaintext)
  if (!parsed || typeof parsed !== "object") throw new ProviderError("CREDENTIAL_INVALID", "Verbindung muss erneut hergestellt werden.")
  return parsed as StoredCredential
}

function retryAfter(response: Response) {
  const value = response.headers.get("retry-after")
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(value)
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined
}

async function safeJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > 1_000_000) throw new ProviderError("RESPONSE_TOO_LARGE", "Provider-Antwort war zu groß.", response.status)
  if (!text) return {}
  try {
    const value: unknown = JSON.parse(text)
    return value && typeof value === "object" ? value as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 15_000) {
  let response: Response
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), redirect: "error" })
  } catch (error) {
    const ambiguous = error instanceof DOMException && error.name === "TimeoutError"
    throw new ProviderError(ambiguous ? "PROVIDER_TIMEOUT" : "NETWORK_ERROR", "Provider ist vorübergehend nicht erreichbar.", undefined, true, ambiguous)
  }
  const body = await safeJson(response)
  if (!response.ok) {
    throw new ProviderError(
      `PROVIDER_HTTP_${response.status}`,
      response.status === 401 ? "Verbindung muss erneut hergestellt werden." : "Provider hat die Aktion abgelehnt.",
      response.status,
      isRetryableIntegrationResponse(response.status),
      false,
      retryAfter(response),
    )
  }
  return { response, body }
}

async function saveCredential(ctx: ActionCtx, context: CredentialContext, value: StoredCredential) {
  const encrypted = await encryptIntegrationSecret(JSON.stringify(value), env.INTEGRATION_CREDENTIAL_KEYRING, aad(context))
  await ctx.runMutation(internal.integrations.replaceCredential, {
    integrationId: context.integration._id,
    ...encrypted,
    expiresAt: value.expiresAt,
  })
}

async function refreshAccessToken(ctx: ActionCtx, context: CredentialContext, credential: StoredCredential) {
  if (credential.accessToken && (!credential.expiresAt || credential.expiresAt > Date.now() + 60_000)) return credential
  if (!credential.refreshToken || context.integration.provider === "webhook") {
    throw new ProviderError("TOKEN_EXPIRED", "Verbindung muss erneut hergestellt werden.", 401)
  }
  const provider = context.integration.provider as OAuthProvider
  const secrets = oauthSecrets(provider)
  if (!secrets.clientId || !secrets.clientSecret) throw new ProviderError("OAUTH_NOT_CONFIGURED", "OAuth ist nicht konfiguriert.")
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: credential.refreshToken })
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" }
  if (provider === "pipedrive") {
    headers.authorization = `Basic ${Buffer.from(`${secrets.clientId}:${secrets.clientSecret}`).toString("base64")}`
  } else {
    body.set("client_id", secrets.clientId)
    body.set("client_secret", secrets.clientSecret)
  }
  const { body: token } = await fetchJson(secrets.tokenUrl, { method: "POST", headers, body })
  if (typeof token.access_token !== "string") throw new ProviderError("TOKEN_REFRESH_FAILED", "Verbindung muss erneut hergestellt werden.")
  const refreshed: StoredCredential = {
    ...credential,
    accessToken: token.access_token,
    refreshToken: typeof token.refresh_token === "string" ? token.refresh_token : credential.refreshToken,
    expiresAt: Date.now() + (typeof token.expires_in === "number" ? token.expires_in : 3600) * 1000,
    scope: typeof token.scope === "string" ? token.scope : credential.scope,
    apiDomain: typeof token.api_domain === "string" ? token.api_domain : credential.apiDomain,
  }
  await saveCredential(ctx, context, refreshed)
  return refreshed
}

async function oauthToken(provider: OAuthProvider, code: string) {
  const config = oauthSecrets(provider)
  if (!config.clientId || !config.clientSecret || !env.INTEGRATION_OAUTH_REDIRECT_URL) {
    throw new ProviderError("OAUTH_NOT_CONFIGURED", "OAuth ist nicht konfiguriert.")
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.INTEGRATION_OAUTH_REDIRECT_URL,
  })
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" }
  if (provider === "pipedrive") {
    headers.authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`
  } else {
    body.set("client_id", config.clientId)
    body.set("client_secret", config.clientSecret)
  }
  const { body: token } = await fetchJson(config.tokenUrl, { method: "POST", headers, body })
  if (typeof token.access_token !== "string") throw new ProviderError("OAUTH_TOKEN_INVALID", "OAuth-Antwort war ungültig.")
  return token
}

async function accountIdentity(provider: OAuthProvider, credential: StoredCredential) {
  const headers = { authorization: `Bearer ${credential.accessToken}` }
  if (provider === "gmail") {
    const { body } = await fetchJson("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers })
    return { label: typeof body.emailAddress === "string" ? body.emailAddress : "Gmail", id: typeof body.emailAddress === "string" ? body.emailAddress : undefined }
  }
  if (provider === "pipedrive" && credential.apiDomain) {
    const { body } = await fetchJson(`${credential.apiDomain}/api/v1/users/me`, { headers })
    const data = body.data && typeof body.data === "object" ? body.data as Record<string, unknown> : {}
    return { label: typeof data.email === "string" ? data.email : "Pipedrive-Konto", id: data.id === undefined ? undefined : String(data.id) }
  }
  return { label: provider === "hubspot" ? "HubSpot-Konto" : "Google Sheets", id: undefined }
}

export const beginOAuth = action({
  args: { provider: v.union(v.literal("hubspot"), v.literal("pipedrive"), v.literal("gmail"), v.literal("google_sheets")) },
  handler: async (ctx, args): Promise<{ url: string; expiresAt: number }> => {
    const result: { authorizationUrl: string; expiresAt: number } = await ctx.runMutation(api.integrations.beginOAuth, args)
    return { url: result.authorizationUrl, expiresAt: result.expiresAt }
  },
})

export const exchangeOAuthCallback = internalAction({
  args: { code: v.string(), state: v.string() },
  handler: async (ctx, args): Promise<{ provider: OAuthProvider; ok: boolean }> => {
    const stateHash = await sha256Base64Url(args.state)
    const claimed: { workspaceId: Id<"workspaces">; integrationId: Id<"workspaceIntegrations">; provider: OAuthProvider; connectionGeneration: number } | null =
      await ctx.runMutation(internal.integrations.claimOAuthState, { stateHash })
    if (!claimed) throw new ProviderError("OAUTH_STATE_INVALID", "OAuth-State ist ungültig oder abgelaufen.")
    try {
      const token = await oauthToken(claimed.provider, args.code)
      const credential: StoredCredential = {
        accessToken: token.access_token as string,
        refreshToken: typeof token.refresh_token === "string" ? token.refresh_token : undefined,
        expiresAt: Date.now() + (typeof token.expires_in === "number" ? token.expires_in : 3600) * 1000,
        apiDomain: typeof token.api_domain === "string" ? token.api_domain : undefined,
        scope: typeof token.scope === "string" ? token.scope : undefined,
        tokenType: typeof token.token_type === "string" ? token.token_type : "Bearer",
      }
      const identity = await accountIdentity(claimed.provider, credential)
      const integration = { workspaceId: claimed.workspaceId, _id: claimed.integrationId, provider: claimed.provider } as Doc<"workspaceIntegrations">
      const encrypted = await encryptIntegrationSecret(JSON.stringify(credential), env.INTEGRATION_CREDENTIAL_KEYRING, `${claimed.workspaceId}:${claimed.integrationId}:${claimed.provider}`)
      const scopes = credential.scope?.split(/\s+/).filter(Boolean) ?? []
      const completed: boolean = await ctx.runMutation(internal.integrations.completeOAuth, {
        integrationId: claimed.integrationId, connectionGeneration: claimed.connectionGeneration, accountLabel: identity.label,
        providerAccountId: identity.id, scopes, ...encrypted, expiresAt: credential.expiresAt,
      })
      if (!completed) throw new ProviderError("OAUTH_CONNECTION_CHANGED", "Verbindungsversuch wurde ersetzt.")
      void integration
      return { provider: claimed.provider, ok: true }
    } catch (error) {
      await ctx.runMutation(internal.integrations.failOAuth, {
        integrationId: claimed.integrationId,
        connectionGeneration: claimed.connectionGeneration,
        errorCode: error instanceof ProviderError ? error.code : "OAUTH_FAILED",
      })
      throw error
    }
  },
})

export const disconnect = action({
  args: { integrationId: v.id("workspaceIntegrations") },
  handler: async (ctx, args): Promise<{ status: "revoked" }> => {
    const context: { integration: Doc<"workspaceIntegrations">; credential: Doc<"integrationCredentials"> | null } = await ctx.runQuery(internal.integrations.prepareDisconnect, args)
    if (context.credential) {
      try {
        const credential = await decodeCredential({ integration: context.integration, credential: context.credential })
        if (credential.accessToken) {
          const provider = context.integration.provider
          if (provider === "hubspot") {
            await fetch("https://api.hubapi.com/oauth/2026-03/token/revoke", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: credential.accessToken }), signal: AbortSignal.timeout(8000) })
          } else if (provider === "pipedrive") {
            await fetch("https://oauth.pipedrive.com/oauth/revoke", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: credential.accessToken }), signal: AbortSignal.timeout(8000) })
          } else if (provider === "gmail" || provider === "google_sheets") {
            await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: credential.refreshToken ?? credential.accessToken }), signal: AbortSignal.timeout(8000) })
          }
        }
      } catch {
        // Local revocation is authoritative; remote revocation is best effort.
      }
    }
    const result: { status: "revoked" } = await ctx.runMutation(internal.integrations.finalizeDisconnect, args)
    return result
  },
})

const CRM_FIELD_DEFINITIONS = [
  { key: "score", name: "sitepitch_score", label: "SitePitch Score", hubspotType: "number", hubspotFieldType: "number", pipedriveType: "double" },
  { key: "reportUrl", name: "sitepitch_public_report", label: "SitePitch Report-Link", hubspotType: "string", hubspotFieldType: "text", pipedriveType: "varchar" },
  { key: "outcome", name: "sitepitch_outcome", label: "SitePitch Outcome", hubspotType: "enumeration", hubspotFieldType: "select", pipedriveType: "varchar" },
] as const

async function configureHubSpot(token: string, createMissing: boolean) {
  const headers = bearer(token)
  const { body } = await fetchJson("https://api.hubapi.com/crm/properties/2026-03/companies", { headers })
  const results = Array.isArray(body.results) ? body.results : []
  const names = new Set(results.flatMap((item) => item && typeof item === "object" && typeof (item as Record<string, unknown>).name === "string" ? [(item as Record<string, unknown>).name as string] : []))
  const missing = CRM_FIELD_DEFINITIONS.filter((field) => !names.has(field.name))
  if (missing.length && !createMissing) return { mapping: null, missing: missing.map((field) => field.label) }
  for (const field of missing) {
    await fetchJson("https://api.hubapi.com/crm/properties/2026-03/companies", {
      method: "POST", headers,
      body: JSON.stringify({
        groupName: "companyinformation", name: field.name, label: field.label,
        type: field.hubspotType, fieldType: field.hubspotFieldType,
        ...(field.key === "outcome" ? { options: ["interested", "won", "lost"].map((value, index) => ({ label: value, value, displayOrder: index, hidden: false })) } : {}),
      }),
    })
  }
  return {
    mapping: { domain: "domain", score: "sitepitch_score", reportUrl: "sitepitch_public_report", outcome: "sitepitch_outcome" },
    missing: [] as string[],
  }
}

async function configurePipedrive(credential: StoredCredential, createMissing: boolean) {
  if (!credential.accessToken || !credential.apiDomain) throw new ProviderError("CREDENTIAL_INVALID", "Pipedrive muss erneut verbunden werden.")
  const headers = bearer(credential.accessToken)
  const fields = await pipedriveCustomFields(credential.apiDomain, credential.accessToken)
  const domainKey = fields.get("website") ?? fields.get("domain")
  const definitions = [
    { key: "domain", label: "Website", type: "varchar" },
    ...CRM_FIELD_DEFINITIONS.map((field) => ({ key: field.key, label: field.label, type: field.pipedriveType })),
  ]
  const missing = definitions.filter((field) => field.key === "domain" ? !domainKey : !fields.get(field.label.toLowerCase()))
  if (missing.length && !createMissing) return { mapping: null, missing: missing.map((field) => field.label) }
  for (const field of missing) {
    const { body } = await fetchJson(`${credential.apiDomain}/api/v1/organizationFields`, {
      method: "POST", headers, body: JSON.stringify({ name: field.label, field_type: field.type }),
    })
    const data = body.data && typeof body.data === "object" ? body.data as Record<string, unknown> : {}
    if (typeof data.key !== "string") throw new ProviderError("CRM_FIELD_CREATE_FAILED", `${field.label} konnte nicht angelegt werden.`)
    fields.set(field.label.toLowerCase(), data.key)
  }
  return {
    mapping: {
      domain: domainKey ?? fields.get("website")!,
      score: fields.get("sitepitch score")!,
      reportUrl: fields.get("sitepitch report-link")!,
      outcome: fields.get("sitepitch outcome")!,
    },
    missing: [] as string[],
  }
}

export const configureCrmFields = action({
  args: { integrationId: v.id("workspaceIntegrations"), createMissingFields: v.boolean() },
  handler: async (ctx, args): Promise<{ configured: boolean; requiresConfirmation: boolean; missing: string[] }> => {
    const managed: { integration: Doc<"workspaceIntegrations">; credential: Doc<"integrationCredentials"> | null } = await ctx.runQuery(internal.integrations.prepareDisconnect, { integrationId: args.integrationId })
    if ((managed.integration.provider !== "hubspot" && managed.integration.provider !== "pipedrive") || !managed.credential) fail("NOT_FOUND", "CRM-Verbindung nicht gefunden.")
    const context: CredentialContext = { integration: managed.integration, credential: managed.credential }
    const credential = await refreshAccessToken(ctx, context, await decodeCredential(context))
    if (!credential.accessToken) fail("NOT_CONNECTED", "CRM muss erneut verbunden werden.")
    const result = managed.integration.provider === "hubspot"
      ? await configureHubSpot(credential.accessToken, args.createMissingFields)
      : await configurePipedrive(credential, args.createMissingFields)
    if (!result.mapping) return { configured: false, requiresConfirmation: true, missing: result.missing }
    await ctx.runMutation(internal.integrations.saveCrmConfiguration, { integrationId: managed.integration._id, fieldMapping: result.mapping })
    return { configured: true, requiresConfirmation: false, missing: [] }
  },
})

function bearer(token: string) {
  return { authorization: `Bearer ${token}`, "content-type": "application/json" }
}

function reportUrlForAudit(audit: Doc<"audits"> | null) {
  if (!audit?.isPublic) return null
  const base = (env.SITE_URL ?? "").replace(/\/$/, "")
  return base ? `${base}/report/${audit.publicSlug}` : null
}

function crmFields(context: {
  lead: Doc<"leads">
  campaignLead: Doc<"campaignLeads">
  audit: Doc<"audits">
}) {
  return {
    businessName: context.lead.businessName,
    domain: context.lead.normalizedDomain!,
    website: context.lead.normalizedWebsiteUrl ?? context.lead.websiteUrl ?? undefined,
    city: context.lead.city,
    country: context.lead.country,
    score: context.audit.overallScore,
    reportUrl: reportUrlForAudit(context.audit) ?? undefined,
    outcome: ["interested", "won", "lost"].includes(context.campaignLead.status)
      ? context.campaignLead.status as "interested" | "won" | "lost"
      : undefined,
  }
}

async function pushHubSpot(
  token: string,
  run: Doc<"integrationRuns">,
  context: { lead: Doc<"leads">; campaignLead: Doc<"campaignLeads">; audit: Doc<"audits">; entityLink: Doc<"integrationEntityLinks"> | null; fieldMapping: Record<string, string> },
) {
  const fields = crmFields(context)
  const properties: Record<string, string> = {
    name: fields.businessName,
    domain: fields.domain,
  }
  if (fields.website) properties.website = fields.website
  if (fields.city) properties.city = fields.city
  if (fields.country) properties.country = fields.country
  if (fields.score !== undefined) properties[context.fieldMapping.score] = String(fields.score)
  if (fields.reportUrl) properties[context.fieldMapping.reportUrl] = fields.reportUrl
  if (fields.outcome) properties[context.fieldMapping.outcome] = fields.outcome
  const headers = bearer(token)
  let remoteId = context.entityLink?.remoteObjectId
  if (!remoteId) {
    const { body } = await fetchJson("https://api.hubapi.com/crm/objects/2026-03/companies/search", {
      method: "POST",
      headers,
      body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "domain", operator: "EQ", value: fields.domain }] }], properties: ["domain"], limit: 1 }),
    })
    const results = Array.isArray(body.results) ? body.results : []
    const first = results[0]
    if (first && typeof first === "object" && typeof (first as Record<string, unknown>).id === "string") remoteId = (first as Record<string, unknown>).id as string
  }
  if (remoteId) {
    await fetchJson(`https://api.hubapi.com/crm/objects/2026-03/companies/${encodeURIComponent(remoteId)}`, { method: "PATCH", headers, body: JSON.stringify({ properties }) })
  } else {
    const { body } = await fetchJson("https://api.hubapi.com/crm/objects/2026-03/companies", { method: "POST", headers, body: JSON.stringify({ properties }) })
    if (typeof body.id !== "string") throw new ProviderError("PROVIDER_RESPONSE_INVALID", "HubSpot-Antwort war unvollständig.")
    remoteId = body.id
  }
  return { remoteObjectType: "company", remoteObjectId: remoteId, responseStatus: 200, runId: run._id }
}

async function pipedriveCustomFields(apiDomain: string, token: string) {
  const { body } = await fetchJson(`${apiDomain}/api/v1/organizationFields?limit=500`, { headers: bearer(token) })
  const data = Array.isArray(body.data) ? body.data : []
  const byName = new Map<string, string>()
  for (const item of data) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    if (typeof row.name === "string" && typeof row.key === "string") byName.set(row.name.trim().toLowerCase(), row.key)
  }
  return byName
}

async function pushPipedrive(
  credential: StoredCredential,
  run: Doc<"integrationRuns">,
  context: { lead: Doc<"leads">; campaignLead: Doc<"campaignLeads">; audit: Doc<"audits">; entityLink: Doc<"integrationEntityLinks"> | null; fieldMapping: Record<string, string> },
) {
  if (!credential.accessToken || !credential.apiDomain) throw new ProviderError("CREDENTIAL_INVALID", "Pipedrive muss erneut verbunden werden.")
  const fields = crmFields(context)
  const headers = bearer(credential.accessToken)
  const customFields: Record<string, string | number> = { [context.fieldMapping.domain]: fields.domain }
  if (fields.score !== undefined) customFields[context.fieldMapping.score] = fields.score
  if (fields.reportUrl) customFields[context.fieldMapping.reportUrl] = fields.reportUrl
  if (fields.outcome) customFields[context.fieldMapping.outcome] = fields.outcome
  const payload = {
    name: fields.businessName,
    address: [fields.city, fields.country].filter(Boolean).join(", ") || undefined,
    custom_fields: customFields,
  }
  let remoteId = context.entityLink?.remoteObjectId
  if (!remoteId) {
    const url = new URL(`${credential.apiDomain}/api/v2/organizations/search`)
    url.searchParams.set("term", fields.domain)
    url.searchParams.set("fields", "custom_fields")
    url.searchParams.set("limit", "1")
    const { body } = await fetchJson(url.toString(), { headers })
    const data = body.data && typeof body.data === "object" ? body.data as Record<string, unknown> : {}
    const items = Array.isArray(data.items) ? data.items : []
    const item = items[0] && typeof items[0] === "object" ? items[0] as Record<string, unknown> : null
    const organization = item?.item && typeof item.item === "object" ? item.item as Record<string, unknown> : item
    if (organization?.id !== undefined) remoteId = String(organization.id)
  }
  if (remoteId) {
    await fetchJson(`${credential.apiDomain}/api/v2/organizations/${encodeURIComponent(remoteId)}`, { method: "PATCH", headers, body: JSON.stringify(payload) })
  } else {
    const { body } = await fetchJson(`${credential.apiDomain}/api/v2/organizations`, { method: "POST", headers, body: JSON.stringify(payload) })
    const data = body.data && typeof body.data === "object" ? body.data as Record<string, unknown> : {}
    if (data.id === undefined) throw new ProviderError("PROVIDER_RESPONSE_INVALID", "Pipedrive-Antwort war unvollständig.")
    remoteId = String(data.id)
  }
  return { remoteObjectType: "organization", remoteObjectId: remoteId, responseStatus: 200, runId: run._id }
}

function cleanHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim()
}

function gmailMime(intent: Doc<"gmailDraftIntents">) {
  const subject = Buffer.from(cleanHeader(intent.subject), "utf8").toString("base64")
  const mime = [
    `To: ${cleanHeader(intent.recipient)}`,
    `Subject: =?UTF-8?B?${subject}?=`,
    `Message-ID: ${cleanHeader(intent.messageId)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    intent.body.replace(/\r?\n/g, "\r\n"),
  ].join("\r\n")
  return Buffer.from(mime, "utf8").toString("base64url")
}

async function createGmailDraft(token: string, intent: Doc<"gmailDraftIntents">) {
  let response: Response
  try {
    response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
      method: "POST",
      headers: bearer(token),
      body: JSON.stringify({ message: { raw: gmailMime(intent) } }),
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    })
  } catch {
    // Gmail has no draft-create idempotency key. An ambiguous transport result is
    // never retried automatically because that could create a duplicate draft.
    throw new ProviderError("GMAIL_RESULT_UNKNOWN", "Gmail konnte die Erstellung nicht eindeutig bestätigen.", undefined, false, true)
  }
  const body = await safeJson(response)
  if (!response.ok) throw new ProviderError(`PROVIDER_HTTP_${response.status}`, "Gmail hat den Entwurf abgelehnt.", response.status, false)
  if (typeof body.id !== "string") throw new ProviderError("PROVIDER_RESPONSE_INVALID", "Gmail-Antwort war unvollständig.")
  return { remoteObjectType: "draft", remoteObjectId: body.id, responseStatus: response.status }
}

function publicAddress(address: string) {
  const parsed = ipaddr.parse(address)
  const normalized = parsed.kind() === "ipv6" && "isIPv4MappedAddress" in parsed && parsed.isIPv4MappedAddress()
    ? parsed.toIPv4Address()
    : parsed
  return normalized.range() === "unicast"
}

async function resolvePublicAddresses(hostname: string) {
  const records = await lookup(hostname, { all: true, verbatim: true })
  if (records.length === 0 || records.some((record) => !publicAddress(record.address))) {
    throw new ProviderError("UNSAFE_WEBHOOK_TARGET", "Private oder lokale Webhook-Ziele sind nicht erlaubt.")
  }
  return records
}

function pinnedHttpsRequest(args: { url: string; address: string; family: number; method: "HEAD" | "POST"; headers?: Record<string, string>; body?: string }) {
  return new Promise<{ status: number; headers: IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const target = new URL(args.url)
    let size = 0
    const chunks: Buffer[] = []
    const request = https.request({
      protocol: "https:", hostname: target.hostname, port: 443, path: `${target.pathname}${target.search}`,
      method: args.method, headers: args.headers, servername: target.hostname, timeout: 15_000,
      lookup: (_hostname, _options, callback) => callback(null, args.address, args.family),
    }, (response) => {
      response.on("data", (chunk: Buffer) => {
        size += chunk.length
        if (size > 64 * 1024) request.destroy(new Error("response_too_large"))
        else chunks.push(chunk)
      })
      response.on("end", () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks).toString("utf8") }))
    })
    request.on("timeout", () => request.destroy(new Error("timeout")))
    request.on("error", reject)
    if (args.body) request.write(args.body)
    request.end()
  })
}

export const validateWebhookEndpoint = internalAction({
  args: { integrationId: v.id("workspaceIntegrations") },
  handler: async (ctx, args) => {
    try {
      const context: CredentialContext | null = await ctx.runQuery(internal.integrations.getCredentialContext, args)
      if (!context || context.integration.provider !== "webhook") return null
      const credential = await decodeCredential(context)
      if (!credential.endpointUrl) throw new ProviderError("CREDENTIAL_INVALID", "Webhook-Konfiguration ist ungültig.")
      const endpoint = normalizeWebhookEndpoint(credential.endpointUrl)
      await resolvePublicAddresses(endpoint.hostname)
      await ctx.runMutation(internal.integrations.setWebhookValidation, { integrationId: args.integrationId, ok: true })
    } catch (error) {
      await ctx.runMutation(internal.integrations.setWebhookValidation, { integrationId: args.integrationId, ok: false, errorCode: error instanceof ProviderError ? error.code : "UNSAFE_ENDPOINT" })
    }
    return null
  },
})

async function deliverWebhook(context: CredentialContext, event: Doc<"integrationEvents">, run: Doc<"integrationRuns">) {
  const credential = await decodeCredential(context)
  if (!credential.endpointUrl || !credential.secret) throw new ProviderError("CREDENTIAL_INVALID", "Webhook muss erneut konfiguriert werden.")
  const endpoint = normalizeWebhookEndpoint(credential.endpointUrl)
  const addresses = await resolvePublicAddresses(endpoint.hostname)
  const selected = addresses[0]
  const body = buildWebhookBody({
    publicEventId: event.publicEventId, event: event.event, occurredAt: event.occurredAt,
    externalAuditId: event.externalAuditId, auditStatus: event.auditStatus,
    domain: event.domain, score: event.score, apiReportUrl: event.apiReportUrl,
    reportUrl: event.reportUrl, reportStatus: event.reportStatus,
    draftType: event.draftType, includedReportLink: event.includedReportLink,
  })
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = await signWebhookBody(credential.secret, timestamp, body)
  let response: Awaited<ReturnType<typeof pinnedHttpsRequest>>
  try {
    response = await pinnedHttpsRequest({
      url: endpoint.url, address: selected.address, family: selected.family, method: "POST", body,
      headers: {
        "content-type": "application/json", "content-length": String(Buffer.byteLength(body)),
        "user-agent": "SitePitch-Integrations/1.0", "x-sitepitch-event-id": event.publicEventId,
        "x-sitepitch-delivery-id": run.publicRunId, "x-sitepitch-timestamp": String(timestamp), "x-sitepitch-signature": signature,
      },
    })
  } catch (error) {
    const unknown = error instanceof Error && error.message === "timeout"
    throw new ProviderError("WEBHOOK_NETWORK_ERROR", "Webhook-Ziel ist nicht erreichbar.", undefined, true, unknown)
  }
  if (response.status >= 300 && response.status < 400) throw new ProviderError("WEBHOOK_REDIRECT_REJECTED", "Webhook-Redirects sind nicht erlaubt.", response.status)
  if (response.status < 200 || response.status >= 300) {
    const retryAfterHeader = Array.isArray(response.headers["retry-after"]) ? response.headers["retry-after"][0] : response.headers["retry-after"]
    const retryAfterMs = retryAfterHeader && Number.isFinite(Number(retryAfterHeader)) ? Number(retryAfterHeader) * 1000 : undefined
    throw new ProviderError(`PROVIDER_HTTP_${response.status}`, "Webhook-Ziel hat die Zustellung abgelehnt.", response.status, isRetryableIntegrationResponse(response.status), false, retryAfterMs)
  }
  return { remoteObjectType: "delivery", remoteObjectId: run.publicRunId, responseStatus: response.status }
}

type ClaimedRun = {
  run: Doc<"integrationRuns">
  integration: Doc<"workspaceIntegrations">
  credential: Doc<"integrationCredentials">
  lead: Doc<"leads"> | null
  campaignLead: Doc<"campaignLeads"> | null
  audit: Doc<"audits"> | null
  event: Doc<"integrationEvents"> | null
  gmailIntent: Doc<"gmailDraftIntents"> | null
  entityLink: Doc<"integrationEntityLinks"> | null
}

export const processIntegrationRun = internalAction({
  args: { runId: v.id("integrationRuns") },
  handler: async (ctx, args): Promise<{ status: string; remoteObjectId?: string } | null> => {
    const leaseToken = randomBase64Url(18)
    const claimed: ClaimedRun | null = await ctx.runMutation(internal.integrations.claimIntegrationRun, { runId: args.runId, leaseToken })
    if (!claimed) return null
    const credentialContext: CredentialContext = { integration: claimed.integration, credential: claimed.credential }
    try {
      let result: { remoteObjectType?: string; remoteObjectId?: string; responseStatus?: number }
      if (claimed.run.kind === "crm_push") {
        if (!claimed.lead || !claimed.campaignLead || !claimed.audit || !claimed.lead.normalizedDomain || claimed.audit.status !== "completed") {
          throw new ProviderError("LOCAL_OBJECT_CHANGED", "Lead oder Audit ist nicht mehr exportierbar.")
        }
        const credential = await refreshAccessToken(ctx, credentialContext, await decodeCredential(credentialContext))
        if (!credential.accessToken) throw new ProviderError("CREDENTIAL_INVALID", "CRM muss erneut verbunden werden.")
        if (!claimed.integration.crmFieldMapping) throw new ProviderError("CRM_FIELDS_NOT_CONFIGURED", "Richte zuerst die CRM-Felder ein.", 422)
        const providerContext = { lead: claimed.lead, campaignLead: claimed.campaignLead, audit: claimed.audit, entityLink: claimed.entityLink, fieldMapping: claimed.integration.crmFieldMapping }
        result = claimed.integration.provider === "hubspot"
          ? await pushHubSpot(credential.accessToken, claimed.run, providerContext)
          : await pushPipedrive(credential, claimed.run, providerContext)
      } else if (claimed.run.kind === "gmail_draft") {
        if (!claimed.gmailIntent) throw new ProviderError("INTENT_MISSING", "Gmail-Bestätigung ist nicht mehr verfügbar.")
        const credential = await refreshAccessToken(ctx, credentialContext, await decodeCredential(credentialContext))
        if (!credential.accessToken) throw new ProviderError("CREDENTIAL_INVALID", "Gmail muss erneut verbunden werden.")
        result = await createGmailDraft(credential.accessToken, claimed.gmailIntent)
      } else if (claimed.run.kind === "webhook_delivery") {
        if (!claimed.event) throw new ProviderError("EVENT_MISSING", "Webhook-Event ist nicht mehr verfügbar.")
        result = await deliverWebhook(credentialContext, claimed.event, claimed.run)
      } else {
        throw new ProviderError("UNSUPPORTED_RUN", "Dieser Integrationslauf wird nicht unterstützt.")
      }
      await ctx.runMutation(internal.integrations.completeIntegrationRun, { runId: claimed.run._id, leaseToken, ...result })
      return { status: "succeeded", remoteObjectId: result.remoteObjectId }
    } catch (error) {
      const providerError = error instanceof ProviderError
        ? error
        : new ProviderError("INTEGRATION_FAILED", "Die Integrationsaktion ist fehlgeschlagen.")
      await ctx.runMutation(internal.integrations.failIntegrationRun, {
        runId: claimed.run._id, leaseToken, errorCode: providerError.code, errorMessage: providerError.message,
        responseStatus: providerError.status, retryable: providerError.retryable,
        unknown: claimed.run.kind === "gmail_draft" ? providerError.unknown : false,
        retryAfterMs: providerError.retryAfterMs,
      })
      return { status: claimed.run.kind === "gmail_draft" && providerError.unknown ? "unknown" : providerError.retryable ? "retryable_failed" : "permanent_failed" }
    }
  },
})

export const confirmGmailDraft = action({
  args: { intentId: v.id("gmailDraftIntents") },
  handler: async (ctx, args): Promise<{ runId: Id<"integrationRuns">; status: string; draftId?: string }> => {
    const prepared: { runId: Id<"integrationRuns"> } = await ctx.runMutation(internal.integrations.confirmGmailIntent, args)
    const result: { status: string; remoteObjectId?: string } | null = await ctx.runAction(internal.integration_actions.processIntegrationRun, { runId: prepared.runId })
    return { runId: prepared.runId, status: result?.status ?? "queued", draftId: result?.remoteObjectId }
  },
})

function spreadsheetIdFromUrl(input: string) {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    fail("VALIDATION_ERROR", "Bitte gib eine gültige Google-Sheets-URL ein.")
  }
  if (url.protocol !== "https:" || (url.hostname !== "docs.google.com" && url.hostname !== "sheets.google.com")) {
    fail("VALIDATION_ERROR", "Bitte verwende eine Google-Sheets-URL.")
  }
  const match = url.pathname.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/)
  if (!match) fail("VALIDATION_ERROR", "Spreadsheet-ID konnte nicht gelesen werden.")
  return match[1]
}

function quotedSheetName(name: string) {
  const value = name.trim()
  if (!value || value.length > 100 || /[\[\]*?/\\:]/.test(value)) fail("VALIDATION_ERROR", "Bitte gib einen gültigen Tab-Namen ein.")
  return `'${value.replace(/'/g, "''")}'`
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value)
  return /[,"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function valuesToRows(values: unknown[][]): CampaignImportRow[] {
  const csv = values.map((row) => row.map(csvCell).join(",")).join("\r\n")
  if (new TextEncoder().encode(csv).byteLength > CAMPAIGN_CSV_MAX_BYTES) fail("SHEET_TOO_LARGE", "Der gelesene Bereich ist größer als 1 MB.")
  return parseCampaignCsv(csv).rows
}

async function readSheet(token: string, spreadsheetId: string, sheetName: string) {
  const range = `${quotedSheetName(sheetName)}!A1:Z102`
  const { body } = await fetchJson(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS`, {
    headers: bearer(token),
  })
  const values = Array.isArray(body.values)
    ? body.values.map((row) => Array.isArray(row) ? row.slice(0, 26) : [])
    : []
  if (values.length === 0) fail("SHEET_EMPTY", "Der ausgewählte Tab ist leer.")
  if (values.length > 101) fail("SHEET_TOO_LARGE", "Maximal 100 Datenzeilen sind erlaubt.")
  const encoded = JSON.stringify(values)
  if (new TextEncoder().encode(encoded).byteLength > CAMPAIGN_CSV_MAX_BYTES) fail("SHEET_TOO_LARGE", "Der gelesene Bereich ist größer als 1 MB.")
  return { values, digest: await sha256Base64Url(encoded), rows: valuesToRows(values) }
}

export const previewSheetImport = action({
  args: { campaignId: v.id("campaigns"), spreadsheetUrl: v.string(), sheetName: v.string() },
  handler: async (ctx, args) => {
    const spreadsheetId = spreadsheetIdFromUrl(args.spreadsheetUrl)
    const context: CredentialContext = await ctx.runQuery(internal.integrations.getConnectedProviderContext, { provider: "google_sheets" })
    const credential = await refreshAccessToken(ctx, context, await decodeCredential(context))
    if (!credential.accessToken) fail("NOT_CONNECTED", "Google Sheets muss erneut verbunden werden.")
    const sheet = await readSheet(credential.accessToken, spreadsheetId, args.sheetName)
    const preview: { items: Array<Record<string, unknown>> } = await ctx.runQuery(api.campaign_imports.previewLeadImport, { campaignId: args.campaignId, rows: sheet.rows })
    const stored: { snapshotId: Id<"sheetImportSnapshots">; accountLabel: string | null; expiresAt: number } = await ctx.runMutation(internal.integrations.storeSheetSnapshot, {
      campaignId: args.campaignId, integrationId: context.integration._id, spreadsheetId,
      sheetName: args.sheetName.trim(), digest: sheet.digest, rows: sheet.rows,
    })
    return { ...stored, sheetName: args.sheetName.trim(), items: preview.items }
  },
})

export const confirmSheetImport = action({
  args: { snapshotId: v.id("sheetImportSnapshots") },
  handler: async (ctx, args): Promise<{ created: number; reused: number; attached: number; skipped: number }> => {
    const context: { snapshot: Doc<"sheetImportSnapshots">; integration: Doc<"workspaceIntegrations">; credential: Doc<"integrationCredentials"> } =
      await ctx.runQuery(internal.integrations.getSheetSnapshotContext, args)
    const credentialContext: CredentialContext = { integration: context.integration, credential: context.credential }
    const credential = await refreshAccessToken(ctx, credentialContext, await decodeCredential(credentialContext))
    if (!credential.accessToken) fail("NOT_CONNECTED", "Google Sheets muss erneut verbunden werden.")
    const started: { runId: Id<"integrationRuns">; leaseToken: string | null; existing: Doc<"integrationRuns"> | null } = await ctx.runMutation(internal.integrations.beginSheetRun, {
      integrationId: context.integration._id, kind: "sheet_import", idempotencyKey: `sheet_import:${context.integration._id}:${context.integration.connectionGeneration}:${context.snapshot._id}`, payloadHash: context.snapshot.digest,
    })
    if (!started.leaseToken && started.existing?.remoteObjectId) {
      try { return JSON.parse(started.existing.remoteObjectId) as { created: number; reused: number; attached: number; skipped: number } } catch { return { created: 0, reused: 0, attached: 0, skipped: 0 } }
    }
    try {
      const current = await readSheet(credential.accessToken, context.snapshot.spreadsheetId, context.snapshot.sheetName)
      if (current.digest !== context.snapshot.digest) fail("SHEET_CHANGED", "Das Google Sheet hat sich seit der Vorschau geändert. Bitte lade die Vorschau erneut.")
      const importId = `sheets_${context.snapshot.digest.slice(0, 40)}`
      const totals = { created: 0, reused: 0, attached: 0, skipped: 0 }
      for (let offset = 0; offset < context.snapshot.rows.length; offset += 25) {
        const result: { created: number; reused: number; attached: number; skipped: number } = await ctx.runMutation(api.campaign_imports.importLeadBatch, {
          campaignId: context.snapshot.campaignId, importId, sourceProvider: "google_sheets", rows: context.snapshot.rows.slice(offset, offset + 25),
        })
        totals.created += result.created
        totals.reused += result.reused
        totals.attached += result.attached
        totals.skipped += result.skipped
      }
      await ctx.runMutation(internal.integrations.consumeSheetSnapshot, args)
      await ctx.runMutation(internal.integrations.completeIntegrationRun, { runId: started.runId, leaseToken: started.leaseToken!, remoteObjectType: "sheet_import", remoteObjectId: JSON.stringify(totals), responseStatus: 200 })
      return totals
    } catch (error) {
      const providerError = error instanceof ProviderError ? error : new ProviderError("SHEET_IMPORT_FAILED", "Google-Sheets-Import ist fehlgeschlagen.")
      await ctx.runMutation(internal.integrations.failIntegrationRun, { runId: started.runId, leaseToken: started.leaseToken!, errorCode: providerError.code, errorMessage: providerError.message, responseStatus: providerError.status, retryable: false })
      throw error
    }
  },
})

function isoOrEmpty(value: number | null) {
  return value === null ? "" : new Date(value).toISOString()
}

function exportValues(rows: Array<Record<string, unknown>>) {
  const headers = ["Unternehmensname", "Website", "Branche", "Stadt", "Land", "Adresse", "Telefon", "E-Mail", "Status", "Score", "Report geöffnet", "Letzter Kontakt", "Follow-up", "Notiz", "Outcome"]
  return [headers, ...rows.map((row) => [
    row.businessName, row.websiteUrl, row.category, row.city, row.country, row.address, row.phone, row.businessEmail,
    row.status, row.score, row.reportOpened ? "ja" : "nein", isoOrEmpty(row.lastContactedAt as number | null),
    isoOrEmpty(row.followUpAt as number | null), row.note, row.outcomeReason,
  ])].map((row) => row.map((cell) => typeof cell === "string" ? spreadsheetSafeText(cell) : cell))
}

export const exportCampaignLeads = action({
  args: { campaignId: v.id("campaigns"), spreadsheetUrl: v.string(), sheetName: v.string(), campaignLeadIds: v.array(v.id("campaignLeads")) },
  handler: async (ctx, args): Promise<{ tabName: string; rowCount: number; spreadsheetUrl: string }> => {
    const spreadsheetId = spreadsheetIdFromUrl(args.spreadsheetUrl)
    const context: { integration: Doc<"workspaceIntegrations">; credential: Doc<"integrationCredentials">; rows: Array<Record<string, unknown>> } =
      await ctx.runQuery(internal.integrations.getSheetExportContext, { campaignId: args.campaignId, campaignLeadIds: args.campaignLeadIds })
    const credentialContext: CredentialContext = { integration: context.integration, credential: context.credential }
    const credential = await refreshAccessToken(ctx, credentialContext, await decodeCredential(credentialContext))
    if (!credential.accessToken) fail("NOT_CONNECTED", "Google Sheets muss erneut verbunden werden.")
    const payloadHash = await sha256Base64Url(JSON.stringify({ spreadsheetId, sheetName: args.sheetName.trim(), campaignLeadIds: args.campaignLeadIds }))
    const started: { runId: Id<"integrationRuns">; leaseToken: string | null; existing: Doc<"integrationRuns"> | null } = await ctx.runMutation(internal.integrations.beginSheetRun, {
      integrationId: context.integration._id, kind: "sheet_export", idempotencyKey: `sheet_export:${context.integration._id}:${context.integration.connectionGeneration}:${args.campaignId}:${payloadHash}`, payloadHash,
    })
    if (!started.leaseToken && started.existing?.remoteObjectId) {
      return { tabName: started.existing.remoteObjectId, rowCount: context.rows.length, spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` }
    }
    try {
    const headers = bearer(credential.accessToken)
    const { body: metadata } = await fetchJson(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`, { headers })
    const existing = new Set(
      (Array.isArray(metadata.sheets) ? metadata.sheets : []).flatMap((sheet) => {
        if (!sheet || typeof sheet !== "object") return []
        const properties = (sheet as Record<string, unknown>).properties
        return properties && typeof properties === "object" && typeof (properties as Record<string, unknown>).title === "string"
          ? [(properties as Record<string, unknown>).title as string]
          : []
      }),
    )
    const requested = args.sheetName.trim().slice(0, 80) || "Leads"
    const base = requested.toLowerCase().startsWith("sitepitch") ? requested : `SitePitch ${requested}`
    let tabName = base
    for (let suffix = 2; existing.has(tabName); suffix++) tabName = `${base} ${suffix}`
    const { body: created } = await fetchJson(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
      method: "POST", headers, body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tabName } } }] }),
    })
    const replies = Array.isArray(created.replies) ? created.replies : []
    if (replies.length === 0) throw new ProviderError("SHEET_CREATE_FAILED", "Der neue Tabellen-Tab konnte nicht angelegt werden.")
    const values = exportValues(context.rows)
    const range = `${quotedSheetName(tabName)}!A1:O${values.length}`
    await fetchJson(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
      method: "PUT", headers, body: JSON.stringify({ range, majorDimension: "ROWS", values }),
    })
    await ctx.runMutation(internal.integrations.completeIntegrationRun, { runId: started.runId, leaseToken: started.leaseToken!, remoteObjectType: "sheet_export", remoteObjectId: tabName, responseStatus: 200 })
    return { tabName, rowCount: context.rows.length, spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` }
    } catch (error) {
      const providerError = error instanceof ProviderError ? error : new ProviderError("SHEET_EXPORT_FAILED", "Google-Sheets-Export ist fehlgeschlagen.")
      await ctx.runMutation(internal.integrations.failIntegrationRun, { runId: started.runId, leaseToken: started.leaseToken!, errorCode: providerError.code, errorMessage: providerError.message, responseStatus: providerError.status, retryable: false })
      throw error
    }
  },
})
