import { ConvexError, v } from "convex/values"
import { paginationOptsValidator } from "convex/server"

import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import {
  env,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { webhookPresetValidator } from "../src/lib/convex-schema-values"
import { checkIntegrationLimit, checkWebhookRedeliveryLimit } from "./lib/audit_rate_limit"
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  randomBase64Url,
  sha256Base64Url,
} from "./lib/integration_crypto"
import {
  canUseIntegration,
  capabilityForProvider,
  integrationsFeatureEnabled,
  INTEGRATION_LIMITS,
} from "./lib/integration_policy"
import { normalizeWebhookEndpoint } from "./lib/integration_webhook"
import { buildCanonicalReportUrl } from "./lib/report_url"
import { requireOwnerWorkspace, getWorkspacePlan } from "./lib/workspace"
import { webhookWorkpool } from "./workpools"

export type IntegrationProvider = "hubspot" | "pipedrive" | "gmail" | "google_sheets" | "webhook"
type OAuthProvider = Exclude<IntegrationProvider, "webhook">
type DatabaseCtx = QueryCtx | MutationCtx

const oauthProviderValidator = v.union(
  v.literal("hubspot"),
  v.literal("pipedrive"),
  v.literal("gmail"),
  v.literal("google_sheets"),
)
const crmProviderValidator = v.union(v.literal("hubspot"), v.literal("pipedrive"))
const webhookEventValidator = v.union(
  v.literal("audit_started"),
  v.literal("audit_completed"),
  v.literal("audit_failed"),
  v.literal("report_viewed"),
  v.literal("outreach_copied"),
)
const webhookEventFilterValidator = v.union(webhookEventValidator, v.literal("test"))
const integrationRunStatusFilterValidator = v.union(
  v.literal("queued"), v.literal("running"), v.literal("succeeded"),
  v.literal("retryable_failed"), v.literal("permanent_failed"),
  v.literal("unknown"), v.literal("cancelled"),
)
const sheetRowValidator = v.object({
  rowNumber: v.number(),
  businessName: v.string(),
  websiteUrl: v.optional(v.string()),
  category: v.optional(v.string()),
  city: v.optional(v.string()),
  country: v.optional(v.string()),
  address: v.optional(v.string()),
  phone: v.optional(v.string()),
  businessEmail: v.optional(v.string()),
})

function integrationError(code: string, message: string): never {
  throw new ConvexError({ code, message })
}

export function integrationCredentialAad(args: {
  workspaceId: Id<"workspaces">
  integrationId: Id<"workspaceIntegrations">
  provider: IntegrationProvider
}) {
  return `${args.workspaceId}:${args.integrationId}:${args.provider}`
}

export function optionalIntegrationReportUrl(siteUrl: string | undefined, publicSlug: string) {
  if (!siteUrl) return undefined
  try {
    return buildCanonicalReportUrl(siteUrl, publicSlug)
  } catch {
    return undefined
  }
}

async function requireIntegrationWorkspace(ctx: DatabaseCtx, provider?: IntegrationProvider) {
  const { user, workspace } = await requireOwnerWorkspace(ctx)
  if (workspace.deletionRequestedAt) integrationError("WORKSPACE_NOT_READY", "Workspace is being deleted")
  const plan = await getWorkspacePlan(ctx, workspace._id)
  if (!integrationsFeatureEnabled(env.INTEGRATIONS_ENABLED)) {
    integrationError("INTEGRATIONS_DISABLED", "Integrationen sind noch nicht aktiviert.")
  }
  if (provider && !canUseIntegration(plan, capabilityForProvider(provider))) {
    integrationError(
      "PLAN_UPGRADE_REQUIRED",
      provider === "webhook"
        ? "Webhooks sind im Agency-Plan verfügbar."
        : "Diese Integration ist im Agency-Plan verfügbar.",
    )
  }
  return { user, workspace, plan }
}

function connectionDto(integration: Doc<"workspaceIntegrations">, plan: string) {
  const canUse = canUseIntegration(plan as "free" | "starter" | "pro" | "agency" | "scale", capabilityForProvider(integration.provider))
  return {
    _id: integration._id,
    provider: integration.provider,
    status: integration.status,
    accountLabel: integration.accountLabel ?? null,
    label: integration.webhookLabel ?? null,
    configured: integration.configured,
    canUse,
    requiredPlan: "agency" as const,
    lastSuccessAt: integration.lastSuccessAt ?? null,
    lastError: integration.lastErrorMessage ?? null,
    preset: integration.webhookPreset ?? null,
    endpointUrl: integration.webhookEndpointUrl ?? null,
    events: integration.webhookEvents ?? [],
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  }
}

export const listConnections = query({
  args: {},
  handler: async (ctx) => {
    const { workspace } = await requireOwnerWorkspace(ctx)
    const plan = await getWorkspacePlan(ctx, workspace._id)
    const connections = await ctx.db
      .query("workspaceIntegrations")
      .withIndex("by_workspaceId_and_status", (q) => q.eq("workspaceId", workspace._id))
      .order("desc")
      .take(25)
    const recentRuns = await ctx.db
      .query("integrationRuns")
      .withIndex("by_workspaceId_and_createdAt", (q) => q.eq("workspaceId", workspace._id))
      .order("desc")
      .take(30)
    const byId = new Map(connections.map((connection) => [connection._id, connection]))
    const recentFailures = recentRuns
      .filter((run) => run.status === "retryable_failed" || run.status === "permanent_failed" || run.status === "unknown")
      .slice(0, 10)
      .map((run) => ({
        _id: run._id,
        provider: byId.get(run.integrationId)?.provider ?? "webhook",
        operation: run.kind,
        status: run.status,
        safeError: run.errorMessage ?? null,
        attempts: run.attemptCount,
        createdAt: run.createdAt,
      }))
    return {
      featureEnabled: integrationsFeatureEnabled(env.INTEGRATIONS_ENABLED),
      plan,
      canManage: true,
      connections: connections.map((connection) => connectionDto(connection, plan)),
      recentFailures,
    }
  },
})

export const listRuns = query({
  args: {
    campaignId: v.optional(v.id("campaigns")),
    campaignLeadId: v.optional(v.id("campaignLeads")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireOwnerWorkspace(ctx)
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 25), 1), 100)
    const runs = args.campaignLeadId
      ? await ctx.db
          .query("integrationRuns")
          .withIndex("by_campaignLeadId_and_createdAt", (q) => q.eq("campaignLeadId", args.campaignLeadId))
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("integrationRuns")
          .withIndex("by_workspaceId_and_createdAt", (q) => q.eq("workspaceId", workspace._id))
          .order("desc")
          .take(Math.min(limit * 2, 100))
    const items = []
    for (const run of runs) {
      if (run.workspaceId !== workspace._id || (args.campaignId && run.campaignId !== args.campaignId)) continue
      const integration = await ctx.db.get(run.integrationId)
      if (!integration || integration.workspaceId !== workspace._id) continue
      items.push({
        _id: run._id,
        provider: integration.provider,
        operation: run.kind,
        status: run.status,
        campaignLeadId: run.campaignLeadId ?? null,
        remoteObjectId: run.remoteObjectId ?? null,
        safeError: run.errorMessage ?? null,
        attempts: run.attemptCount,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
      })
      if (items.length >= limit) break
    }
    return { items }
  },
})

export const listWebhookDeliveries = query({
  args: {
    paginationOpts: paginationOptsValidator,
    integrationId: v.optional(v.id("workspaceIntegrations")),
    event: v.optional(webhookEventFilterValidator),
    status: v.optional(integrationRunStatusFilterValidator),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireOwnerWorkspace(ctx)
    if (args.paginationOpts.numItems < 1 || args.paginationOpts.numItems > 100) {
      integrationError("VALIDATION_ERROR", "Pro Seite sind 1 bis 100 Zustellungen erlaubt.")
    }
    if (args.integrationId) {
      const integration = await ctx.db.get(args.integrationId)
      if (!integration || integration.workspaceId !== workspace._id || integration.provider !== "webhook") {
        integrationError("NOT_FOUND", "Webhook nicht gefunden.")
      }
    }
    const result = args.integrationId
      ? await ctx.db
          .query("integrationRuns")
          .withIndex("by_integrationId_and_createdAt", (q) => q.eq("integrationId", args.integrationId!))
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("integrationRuns")
          .withIndex("by_workspaceId_and_createdAt", (q) => q.eq("workspaceId", workspace._id))
          .order("desc")
          .paginate(args.paginationOpts)
    const page = []
    for (const run of result.page) {
      if (run.workspaceId !== workspace._id || run.kind !== "webhook_delivery") continue
      if (args.status && run.status !== args.status) continue
      const [integration, event] = await Promise.all([
        ctx.db.get(run.integrationId),
        run.integrationEventId ? ctx.db.get(run.integrationEventId) : Promise.resolve(null),
      ])
      if (!integration || integration.workspaceId !== workspace._id || integration.provider !== "webhook" || !event) continue
      if (args.event && event.event !== args.event) continue
      page.push({
        _id: run._id,
        eventId: event.publicEventId,
        deliveryId: run.publicRunId,
        endpoint: integration.webhookEndpointUrl ?? null,
        event: event.event,
        status: run.status,
        attempts: run.attemptCount,
        responseStatus: run.responseStatus ?? null,
        safeError: run.errorMessage ?? null,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        canRedeliver: run.status === "permanent_failed" || run.status === "unknown",
      })
    }
    return { ...result, page }
  },
})

export const redeliverWebhook = mutation({
  args: { runId: v.id("integrationRuns"), reason: v.string() },
  handler: async (ctx, args) => {
    const { workspace } = await requireIntegrationWorkspace(ctx, "webhook")
    const reason = args.reason.trim()
    if (!reason || reason.length > 240) {
      integrationError("VALIDATION_ERROR", "Ein protokollierter Grund mit maximal 240 Zeichen ist erforderlich.")
    }
    await checkWebhookRedeliveryLimit(ctx, { workspaceId: workspace._id })
    const previous = await ctx.db.get(args.runId)
    if (
      !previous ||
      previous.workspaceId !== workspace._id ||
      previous.kind !== "webhook_delivery" ||
      !previous.integrationEventId ||
      (previous.status !== "permanent_failed" && previous.status !== "unknown")
    ) {
      integrationError("INVALID_RUN_STATE", "Nur terminal fehlgeschlagene Webhook-Zustellungen können erneut gesendet werden.")
    }
    const integration = await ctx.db.get(previous.integrationId)
    const event = await ctx.db.get(previous.integrationEventId)
    if (!integration || integration.workspaceId !== workspace._id || integration.provider !== "webhook" || integration.status !== "connected" || !event) {
      integrationError("NOT_CONNECTED", "Webhook ist nicht verbunden.")
    }
    const runId = await createIntegrationRun(ctx, {
      workspaceId: workspace._id,
      integrationId: integration._id,
      kind: "webhook_delivery",
      idempotencyKey: `webhook_redelivery:${previous._id}:${randomBase64Url(18)}`,
      auditId: previous.auditId,
      integrationEventId: event._id,
      redeliveryOfRunId: previous._id,
      redeliveryReason: reason,
      maxAttempts: 4,
    })
    await webhookWorkpool.enqueueAction(ctx, internal.integration_actions.processIntegrationRun, { runId }, { retry: false })
    return { runId, status: "queued" as const }
  },
})

export const createWebhook = mutation({
  args: {
    label: v.string(),
    preset: webhookPresetValidator,
    endpointUrl: v.string(),
    secret: v.string(),
    events: v.array(webhookEventValidator),
  },
  handler: async (ctx, args) => {
    const { user, workspace } = await requireIntegrationWorkspace(ctx, "webhook")
    const label = args.label.trim()
    if (!label || label.length > 80) integrationError("VALIDATION_ERROR", "Der Name muss 1 bis 80 Zeichen lang sein.")
    if (args.secret.length < 32 || args.secret.length > 256) {
      integrationError("VALIDATION_ERROR", "Das Signatur-Secret muss 32 bis 256 Zeichen lang sein.")
    }
    const events = Array.from(new Set(args.events))
    if (events.length === 0 || events.length > 5) integrationError("VALIDATION_ERROR", "Wähle mindestens ein Event aus.")
    const endpoint = normalizeWebhookEndpoint(args.endpointUrl)
    const existing = await ctx.db
      .query("workspaceIntegrations")
      .withIndex("by_workspaceId_and_provider", (q) =>
        q.eq("workspaceId", workspace._id).eq("provider", "webhook"),
      )
      .take(INTEGRATION_LIMITS.webhookEndpointsPerWorkspace + 1)
    if (existing.filter((item) => item.status !== "revoked").length >= INTEGRATION_LIMITS.webhookEndpointsPerWorkspace) {
      integrationError("WEBHOOK_LIMIT_REACHED", "Maximal fünf aktive Webhook-Endpunkte sind erlaubt.")
    }
    const now = Date.now()
    const integrationId = await ctx.db.insert("workspaceIntegrations", {
      workspaceId: workspace._id,
      provider: "webhook",
      status: "connecting",
      connectionGeneration: 1,
      configured: true,
      webhookLabel: label,
      webhookPreset: args.preset,
      webhookEndpointUrl: endpoint.display,
      webhookEvents: events,
      connectedByUserId: user.userId,
      createdAt: now,
      updatedAt: now,
    })
    const aad = integrationCredentialAad({ workspaceId: workspace._id, integrationId, provider: "webhook" })
    const encrypted = await encryptIntegrationSecret(
      JSON.stringify({ endpointUrl: endpoint.url, secret: args.secret }),
      env.INTEGRATION_CREDENTIAL_KEYRING,
      aad,
    )
    await ctx.db.insert("integrationCredentials", {
      workspaceId: workspace._id,
      integrationId,
      ...encrypted,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.scheduler.runAfter(0, internal.integration_actions.validateWebhookEndpoint, { integrationId })
    return { integrationId, status: "connecting" as const }
  },
})

export const disableWebhook = mutation({
  args: { integrationId: v.id("workspaceIntegrations") },
  handler: async (ctx, args) => {
    const { workspace } = await requireIntegrationWorkspace(ctx, "webhook")
    const integration = await ctx.db.get(args.integrationId)
    if (!integration || integration.workspaceId !== workspace._id || integration.provider !== "webhook") {
      integrationError("NOT_FOUND", "Webhook nicht gefunden.")
    }
    const now = Date.now()
    await ctx.db.patch(integration._id, { status: "revoked", revokedAt: now, updatedAt: now })
    const credential = await ctx.db
      .query("integrationCredentials")
      .withIndex("by_integrationId", (q) => q.eq("integrationId", integration._id))
      .unique()
    if (credential) await ctx.db.delete(credential._id)
    const pending = await ctx.db
      .query("integrationRuns")
      .withIndex("by_integrationId_and_createdAt", (q) => q.eq("integrationId", integration._id))
      .order("desc")
      .take(100)
    for (const run of pending) {
      if (["queued", "retryable_failed"].includes(run.status)) {
        await ctx.db.patch(run._id, { status: "cancelled", completedAt: now, updatedAt: now })
      }
    }
    return { status: "revoked" as const }
  },
})

export const updateWebhook = mutation({
  args: {
    integrationId: v.id("workspaceIntegrations"), label: v.string(), preset: webhookPresetValidator,
    endpointUrl: v.string(), secret: v.optional(v.string()), events: v.array(webhookEventValidator),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireIntegrationWorkspace(ctx, "webhook")
    const integration = await ctx.db.get(args.integrationId)
    if (!integration || integration.workspaceId !== workspace._id || integration.provider !== "webhook" || integration.status === "revoked") integrationError("NOT_FOUND", "Webhook nicht gefunden.")
    const label = args.label.trim()
    if (!label || label.length > 80) integrationError("VALIDATION_ERROR", "Der Name muss 1 bis 80 Zeichen lang sein.")
    const endpoint = normalizeWebhookEndpoint(args.endpointUrl)
    const events = Array.from(new Set(args.events))
    if (events.length === 0 || events.length > 5) integrationError("VALIDATION_ERROR", "Wähle mindestens ein Event aus.")
    if (args.secret !== undefined && (args.secret.length < 32 || args.secret.length > 256)) integrationError("VALIDATION_ERROR", "Das neue Signatur-Secret muss 32 bis 256 Zeichen lang sein.")
    const credential = await ctx.db.query("integrationCredentials").withIndex("by_integrationId", (q) => q.eq("integrationId", integration._id)).unique()
    if (!credential) integrationError("NOT_CONNECTED", "Webhook muss neu angelegt werden.")
    const aad = integrationCredentialAad({ workspaceId: workspace._id, integrationId: integration._id, provider: "webhook" })
    const decrypted = await decryptIntegrationSecret(credential, env.INTEGRATION_CREDENTIAL_KEYRING, aad)
    let stored: { secret?: unknown }
    try {
      stored = JSON.parse(decrypted.plaintext) as { secret?: unknown }
    } catch {
      integrationError("NOT_CONNECTED", "Webhook muss neu angelegt werden.")
    }
    const secret = args.secret ?? (typeof stored.secret === "string" ? stored.secret : undefined)
    if (!secret) integrationError("NOT_CONNECTED", "Webhook muss neu angelegt werden.")
    const encrypted = await encryptIntegrationSecret(JSON.stringify({ endpointUrl: endpoint.url, secret }), env.INTEGRATION_CREDENTIAL_KEYRING, aad)
    const now = Date.now()
    await ctx.db.patch(credential._id, { ...encrypted, updatedAt: now })
    await ctx.db.patch(integration._id, {
      status: "connecting", connectionGeneration: integration.connectionGeneration + 1, webhookLabel: label,
      webhookPreset: args.preset, webhookEndpointUrl: endpoint.display, webhookEvents: events,
      lastErrorCode: undefined, lastErrorMessage: undefined, updatedAt: now,
    })
    const runs = await ctx.db.query("integrationRuns").withIndex("by_integrationId_and_createdAt", (q) => q.eq("integrationId", integration._id)).take(200)
    for (const run of runs) if (["queued", "running", "retryable_failed"].includes(run.status)) {
      await ctx.db.patch(run._id, { status: "cancelled", leaseToken: undefined, leaseExpiresAt: undefined, completedAt: now, updatedAt: now })
    }
    await ctx.scheduler.runAfter(0, internal.integration_actions.validateWebhookEndpoint, { integrationId: integration._id })
    return { status: "connecting" as const }
  },
})

export const testWebhook = mutation({
  args: { integrationId: v.id("workspaceIntegrations") },
  handler: async (ctx, args) => {
    const { user, workspace } = await requireIntegrationWorkspace(ctx, "webhook")
    await checkIntegrationLimit(ctx, { kind: "webhook_test", workspaceId: workspace._id, userId: user.userId })
    const integration = await ctx.db.get(args.integrationId)
    if (!integration || integration.workspaceId !== workspace._id || integration.provider !== "webhook" || integration.status !== "connected") {
      integrationError("NOT_CONNECTED", "Webhook ist nicht verbunden.")
    }
    const now = Date.now()
    const integrationEventId = await ctx.db.insert("integrationEvents", {
      workspaceId: workspace._id,
      publicEventId: `evt_${randomBase64Url(18)}`,
      event: "test",
      idempotencyKey: `webhook_test:${randomBase64Url(18)}`,
      occurredAt: now,
      createdAt: now,
    })
    const runId = await createIntegrationRun(ctx, {
      workspaceId: workspace._id,
      integrationId: integration._id,
      kind: "webhook_delivery",
      idempotencyKey: `webhook_test:${integrationEventId}`,
      integrationEventId,
      maxAttempts: 1,
    })
    await webhookWorkpool.enqueueAction(ctx, internal.integration_actions.processIntegrationRun, { runId }, { retry: false })
    return { runId }
  },
})

export const retryRun = mutation({
  args: { runId: v.id("integrationRuns") },
  handler: async (ctx, args) => {
    const { workspace } = await requireIntegrationWorkspace(ctx)
    const run = await ctx.db.get(args.runId)
    if (!run || run.workspaceId !== workspace._id) integrationError("NOT_FOUND", "Integrationslauf nicht gefunden.")
    if (!["retryable_failed", "permanent_failed", "unknown"].includes(run.status)) {
      integrationError("INVALID_RUN_STATE", "Dieser Lauf kann nicht erneut gestartet werden.")
    }
    const integration = await ctx.db.get(run.integrationId)
    if (!integration || integration.workspaceId !== workspace._id || integration.status !== "connected") {
      integrationError("NOT_CONNECTED", "Integration ist nicht verbunden.")
    }
    if (run.kind === "webhook_delivery") {
      integrationError("USE_WEBHOOK_REDELIVERY", "Webhook-Zustellungen werden als neue Delivery erneut gesendet.")
    }
    const now = Date.now()
    await ctx.db.patch(run._id, {
      status: "queued",
      attemptCount: 0,
      nextAttemptAt: undefined,
      leaseToken: undefined,
      leaseExpiresAt: undefined,
      errorCode: undefined,
      errorMessage: undefined,
      responseStatus: undefined,
      completedAt: undefined,
      updatedAt: now,
    })
    await ctx.scheduler.runAfter(0, internal.integration_actions.processIntegrationRun, { runId: run._id })
    return { runId: run._id, status: "queued" as const }
  },
})

async function connectedIntegration(
  ctx: DatabaseCtx,
  workspaceId: Id<"workspaces">,
  provider: OAuthProvider,
) {
  const candidates = await ctx.db
    .query("workspaceIntegrations")
    .withIndex("by_workspaceId_and_provider", (q) => q.eq("workspaceId", workspaceId).eq("provider", provider))
    .order("desc")
    .take(10)
  return candidates.find((item) => item.status === "connected") ?? null
}

async function loadLeadPushContext(
  ctx: DatabaseCtx,
  args: { campaignLeadId: Id<"campaignLeads">; provider?: "hubspot" | "pipedrive"; integrationId?: Id<"workspaceIntegrations"> },
) {
  const { workspace } = await requireIntegrationWorkspace(ctx, args.provider ?? "hubspot")
  const campaignLead = await ctx.db.get(args.campaignLeadId)
  if (!campaignLead || campaignLead.workspaceId !== workspace._id) integrationError("NOT_FOUND", "Lead nicht gefunden.")
  const lead = await ctx.db.get(campaignLead.leadId)
  if (!lead || lead.workspaceId !== workspace._id || !lead.normalizedDomain) {
    integrationError("LEAD_NOT_AUDIT_READY", "Der Lead benötigt eine gültige Website-Domain.")
  }
  const audit = await ctx.db
    .query("audits")
    .withIndex("by_campaignLeadId_and_createdAt", (q) => q.eq("campaignLeadId", campaignLead._id))
    .order("desc")
    .first()
  if (!audit || audit.workspaceId !== workspace._id || audit.status !== "completed") {
    integrationError("AUDIT_NOT_READY", "Der Lead benötigt einen abgeschlossenen Audit.")
  }
  const integration = args.integrationId
    ? await ctx.db.get(args.integrationId)
    : await connectedIntegration(ctx, workspace._id, args.provider!)
  if (
    !integration ||
    integration.workspaceId !== workspace._id ||
    (integration.provider !== "hubspot" && integration.provider !== "pipedrive") ||
    integration.status !== "connected"
  ) integrationError("NOT_CONNECTED", "CRM-Integration ist nicht verbunden.")
  if (!integration.configured || !integration.crmFieldMapping) {
    integrationError("CRM_FIELDS_NOT_CONFIGURED", "Richte zuerst die SitePitch-Felder der CRM-Verbindung ein.")
  }
  if (args.provider && integration.provider !== args.provider) integrationError("NOT_FOUND", "CRM-Integration nicht gefunden.")
  const outcome = ["interested", "won", "lost"].includes(campaignLead.status) ? campaignLead.status : null
  const reportUrl = audit.isPublic ? optionalIntegrationReportUrl(env.SITE_URL, audit.publicSlug) ?? null : null
  const fields = {
    businessName: lead.businessName,
    domain: lead.normalizedDomain,
    website: lead.normalizedWebsiteUrl ?? lead.websiteUrl ?? null,
    city: lead.city ?? null,
    country: lead.country ?? null,
    score: audit.overallScore ?? null,
    reportUrl,
    outcome,
  }
  return { workspace, campaignLead, lead, audit, integration, fields }
}

export const previewLeadPush = query({
  args: { campaignLeadId: v.id("campaignLeads"), provider: crmProviderValidator },
  handler: async (ctx, args) => {
    const context = await loadLeadPushContext(ctx, args)
    const link = await ctx.db
      .query("integrationEntityLinks")
      .withIndex("by_integrationId_and_leadId", (q) =>
        q.eq("integrationId", context.integration._id).eq("leadId", context.lead._id),
      )
      .first()
    return {
      integrationId: context.integration._id,
      provider: context.integration.provider,
      accountLabel: context.integration.accountLabel ?? null,
      fields: context.fields,
      existingRemoteEntity: Boolean(link && link.connectionGeneration === context.integration.connectionGeneration),
    }
  },
})

export const enqueueLeadPush = mutation({
  args: { campaignLeadId: v.id("campaignLeads"), integrationId: v.id("workspaceIntegrations") },
  handler: async (ctx, args) => {
    const context = await loadLeadPushContext(ctx, args)
    const { user } = await requireIntegrationWorkspace(ctx, context.integration.provider)
    await checkIntegrationLimit(ctx, { kind: "crm", workspaceId: context.workspace._id, userId: user.userId })
    const payloadHash = await sha256Base64Url(JSON.stringify(context.fields))
    const idempotencyKey = `crm:${context.integration._id}:${context.integration.connectionGeneration}:${context.lead._id}:${payloadHash}`
    const existing = await ctx.db
      .query("integrationRuns")
      .withIndex("by_workspaceId_and_idempotencyKey", (q) =>
        q.eq("workspaceId", context.workspace._id).eq("idempotencyKey", idempotencyKey),
      )
      .unique()
    if (existing) return { runId: existing._id }
    const runId = await createIntegrationRun(ctx, {
      workspaceId: context.workspace._id,
      integrationId: context.integration._id,
      kind: "crm_push",
      idempotencyKey,
      payloadHash,
      leadId: context.lead._id,
      campaignId: context.campaignLead.campaignId,
      campaignLeadId: context.campaignLead._id,
      auditId: context.audit._id,
      maxAttempts: 4,
    })
    await ctx.scheduler.runAfter(0, internal.integration_actions.processIntegrationRun, { runId })
    return { runId }
  },
})

export const prepareGmailDraft = mutation({
  args: {
    auditId: v.id("audits"),
    recipient: v.string(),
    subject: v.string(),
    body: v.string(),
    includedReportLink: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { user, workspace } = await requireIntegrationWorkspace(ctx, "gmail")
    await checkIntegrationLimit(ctx, { kind: "gmail", workspaceId: workspace._id, userId: user.userId })
    const integration = await connectedIntegration(ctx, workspace._id, "gmail")
    if (!integration) integrationError("NOT_CONNECTED", "Gmail ist nicht verbunden.")
    const audit = await ctx.db.get(args.auditId)
    if (!audit || audit.workspaceId !== workspace._id || audit.status !== "completed") {
      integrationError("AUDIT_NOT_READY", "Der Audit ist noch nicht abgeschlossen.")
    }
    const recipient = args.recipient.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || recipient.length > 254) {
      integrationError("VALIDATION_ERROR", "Bitte gib eine gültige Empfängeradresse ein.")
    }
    const subject = args.subject.trim()
    const body = args.body.trim()
    if (!subject || subject.length > 200) integrationError("VALIDATION_ERROR", "Der Betreff muss 1 bis 200 Zeichen lang sein.")
    if (!body || body.length > 20_000) integrationError("VALIDATION_ERROR", "Der Entwurf muss 1 bis 20.000 Zeichen lang sein.")
    const now = Date.now()
    const intentId = await ctx.db.insert("gmailDraftIntents", {
      workspaceId: workspace._id,
      integrationId: integration._id,
      auditId: audit._id,
      userId: user.userId,
      recipient,
      subject,
      body,
      includedReportLink: args.includedReportLink,
      messageId: `<sitepitch-${randomBase64Url(18)}@trysitepitch.local>`,
      expiresAt: now + 15 * 60_000,
      createdAt: now,
    })
    return {
      intentId,
      accountLabel: integration.accountLabel ?? "Gmail",
      recipient,
      subject,
      body,
      includedReportLink: args.includedReportLink,
      expiresAt: now + 15 * 60_000,
    }
  },
})

type CreateRunArgs = {
  workspaceId: Id<"workspaces">
  integrationId: Id<"workspaceIntegrations">
  kind: Doc<"integrationRuns">["kind"]
  idempotencyKey: string
  maxAttempts: number
  payloadHash?: string
  leadId?: Id<"leads">
  campaignId?: Id<"campaigns">
  campaignLeadId?: Id<"campaignLeads">
  auditId?: Id<"audits">
  integrationEventId?: Id<"integrationEvents">
  redeliveryOfRunId?: Id<"integrationRuns">
  redeliveryReason?: string
}

export async function createIntegrationRun(ctx: MutationCtx, args: CreateRunArgs) {
  const now = Date.now()
  return await ctx.db.insert("integrationRuns", {
    workspaceId: args.workspaceId,
    integrationId: args.integrationId,
    kind: args.kind,
    status: "queued",
    idempotencyKey: args.idempotencyKey,
    publicRunId: `run_${randomBase64Url(18)}`,
    payloadHash: args.payloadHash,
    leadId: args.leadId,
    campaignId: args.campaignId,
    campaignLeadId: args.campaignLeadId,
    auditId: args.auditId,
    integrationEventId: args.integrationEventId,
    redeliveryOfRunId: args.redeliveryOfRunId,
    redeliveryReason: args.redeliveryReason,
    attemptCount: 0,
    maxAttempts: args.maxAttempts,
    createdAt: now,
    updatedAt: now,
  })
}

export async function recordIntegrationEvent(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">
    auditId?: Id<"audits">
    event: "audit_started" | "audit_completed" | "audit_failed" | "report_viewed" | "outreach_copied"
    idempotencyKey: string
    occurredAt: number
    domain?: string
    score?: number
    reportUrl?: string
    draftType?: Doc<"outreachDrafts">["type"]
    includedReportLink?: boolean
  },
) {
  const existing = await ctx.db.query("integrationEvents").withIndex("by_workspaceId_and_idempotencyKey", (q) => q.eq("workspaceId", args.workspaceId).eq("idempotencyKey", args.idempotencyKey)).unique()
  if (existing) return existing._id
  const audit = args.auditId ? await ctx.db.get(args.auditId) : null
  const externalAuditId = audit?.externalApiId
  const apiReportUrl = externalAuditId && env.PUBLIC_API_BASE_URL
    ? new URL(`/api/v1/audits/${externalAuditId}/report`, env.PUBLIC_API_BASE_URL).toString()
    : undefined
  const reportStatus = args.event === "audit_failed"
    ? "failed" as const
    : audit?.isPublic
      ? "published" as const
      : args.event === "audit_completed"
        ? "private" as const
        : "pending" as const
  const eventId = await ctx.db.insert("integrationEvents", {
    workspaceId: args.workspaceId, auditId: args.auditId, publicEventId: `evt_${randomBase64Url(18)}`,
    event: args.event, idempotencyKey: args.idempotencyKey, occurredAt: args.occurredAt,
    externalAuditId, auditStatus: audit?.status, apiReportUrl, reportStatus,
    domain: args.domain, score: args.score, reportUrl: args.reportUrl, draftType: args.draftType,
    includedReportLink: args.includedReportLink, createdAt: Date.now(),
  })
  if (!integrationsFeatureEnabled(env.INTEGRATIONS_ENABLED)) return eventId
  const webhooks = await ctx.db.query("workspaceIntegrations").withIndex("by_workspaceId_and_provider", (q) => q.eq("workspaceId", args.workspaceId).eq("provider", "webhook")).take(INTEGRATION_LIMITS.webhookEndpointsPerWorkspace + 5)
  let queued = false
  for (const webhook of webhooks) {
    if (webhook.status !== "connected" || !webhook.webhookEvents?.includes(args.event)) continue
    const runId = await createIntegrationRun(ctx, {
      workspaceId: args.workspaceId, integrationId: webhook._id, kind: "webhook_delivery",
      idempotencyKey: `webhook:${webhook._id}:${webhook.connectionGeneration}:${eventId}`, integrationEventId: eventId, maxAttempts: 4,
    })
    await webhookWorkpool.enqueueAction(ctx, internal.integration_actions.processIntegrationRun, { runId }, { retry: false })
    queued = true
  }
  if (queued) await ctx.db.patch(eventId, { dispatchedAt: Date.now() })
  return eventId
}

function oauthConfiguration(provider: OAuthProvider) {
  const redirectUri = env.INTEGRATION_OAUTH_REDIRECT_URL
  if (!redirectUri) integrationError("OAUTH_NOT_CONFIGURED", "OAuth ist noch nicht konfiguriert.")
  if (provider === "hubspot") {
    if (!env.HUBSPOT_CLIENT_ID || !env.HUBSPOT_CLIENT_SECRET) {
      integrationError("OAUTH_NOT_CONFIGURED", "HubSpot OAuth ist noch nicht konfiguriert.")
    }
    return {
      clientId: env.HUBSPOT_CLIENT_ID,
      redirectUri,
      authorizeUrl: "https://app.hubspot.com/oauth/authorize",
      scopes: ["crm.objects.companies.read", "crm.objects.companies.write", "crm.schemas.companies.read", "crm.schemas.companies.write"],
    }
  }
  if (provider === "pipedrive") {
    if (!env.PIPEDRIVE_CLIENT_ID || !env.PIPEDRIVE_CLIENT_SECRET) {
      integrationError("OAUTH_NOT_CONFIGURED", "Pipedrive OAuth ist noch nicht konfiguriert.")
    }
    return {
      clientId: env.PIPEDRIVE_CLIENT_ID,
      redirectUri,
      authorizeUrl: "https://oauth.pipedrive.com/oauth/authorize",
      scopes: [] as string[],
    }
  }
  const clientId = provider === "gmail" ? env.GOOGLE_GMAIL_CLIENT_ID : env.GOOGLE_SHEETS_CLIENT_ID
  const clientSecret = provider === "gmail" ? env.GOOGLE_GMAIL_CLIENT_SECRET : env.GOOGLE_SHEETS_CLIENT_SECRET
  if (!clientId || !clientSecret) integrationError("OAUTH_NOT_CONFIGURED", "Google OAuth ist noch nicht konfiguriert.")
  return {
    clientId,
    redirectUri,
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scopes: provider === "gmail"
      ? ["https://www.googleapis.com/auth/gmail.compose"]
      : ["https://www.googleapis.com/auth/spreadsheets"],
  }
}

export const beginOAuth = mutation({
  args: { provider: oauthProviderValidator },
  handler: async (ctx, args) => {
    const { user, workspace } = await requireIntegrationWorkspace(ctx, args.provider)
    await checkIntegrationLimit(ctx, { kind: "connect", workspaceId: workspace._id, userId: user.userId })
    const config = oauthConfiguration(args.provider)
    const previous = await ctx.db
      .query("workspaceIntegrations")
      .withIndex("by_workspaceId_and_provider", (q) => q.eq("workspaceId", workspace._id).eq("provider", args.provider))
      .order("desc")
      .first()
    const now = Date.now()
    let integrationId: Id<"workspaceIntegrations">
    if (previous && previous.status !== "revoked") {
      integrationId = previous._id
      await ctx.db.patch(previous._id, {
        status: "connecting",
        connectionGeneration: previous.connectionGeneration + 1,
        lastErrorCode: undefined,
        lastErrorMessage: undefined,
        updatedAt: now,
      })
    } else {
      integrationId = await ctx.db.insert("workspaceIntegrations", {
        workspaceId: workspace._id,
        provider: args.provider,
        status: "connecting",
        connectionGeneration: (previous?.connectionGeneration ?? 0) + 1,
        configured: false,
        connectedByUserId: user.userId,
        createdAt: now,
        updatedAt: now,
      })
    }
    const state = randomBase64Url(32)
    const stateHash = await sha256Base64Url(state)
    await ctx.db.insert("integrationOAuthStates", {
      workspaceId: workspace._id,
      integrationId,
      userId: user.userId,
      provider: args.provider,
      stateHash,
      expiresAt: now + 10 * 60_000,
      createdAt: now,
    })
    const url = new URL(config.authorizeUrl)
    url.searchParams.set("client_id", config.clientId)
    url.searchParams.set("redirect_uri", config.redirectUri)
    url.searchParams.set("response_type", "code")
    url.searchParams.set("state", state)
    if (config.scopes.length) url.searchParams.set("scope", config.scopes.join(" "))
    if (args.provider === "gmail" || args.provider === "google_sheets") {
      // Gmail and Sheets deliberately use different OAuth clients so revoking one
      // grant cannot revoke the other product's consent.
      url.searchParams.set("access_type", "offline")
      url.searchParams.set("prompt", "consent")
      url.searchParams.set("include_granted_scopes", "false")
    }
    return { authorizationUrl: url.toString(), expiresAt: now + 10 * 60_000 }
  },
})

export const claimOAuthState = internalMutation({
  args: { stateHash: v.string() },
  handler: async (ctx, args) => {
    const state = await ctx.db.query("integrationOAuthStates").withIndex("by_stateHash", (q) => q.eq("stateHash", args.stateHash)).unique()
    const now = Date.now()
    if (!state || state.claimedAt || state.expiresAt <= now) return null
    const [integration, workspace] = await Promise.all([ctx.db.get(state.integrationId), ctx.db.get(state.workspaceId)])
    if (!integration || !workspace || workspace.deletionRequestedAt || integration.status !== "connecting") return null
    await ctx.db.patch(state._id, { claimedAt: now })
    return {
      workspaceId: state.workspaceId,
      integrationId: state.integrationId,
      provider: state.provider as OAuthProvider,
      connectionGeneration: integration.connectionGeneration,
    }
  },
})

export const completeOAuth = internalMutation({
  args: {
    integrationId: v.id("workspaceIntegrations"), connectionGeneration: v.number(), accountLabel: v.string(),
    providerAccountId: v.optional(v.string()), scopes: v.array(v.string()), keyVersion: v.string(), ciphertext: v.string(), nonce: v.string(), expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId)
    if (!integration || integration.connectionGeneration !== args.connectionGeneration || integration.status !== "connecting") return false
    const existing = await ctx.db.query("integrationCredentials").withIndex("by_integrationId", (q) => q.eq("integrationId", integration._id)).unique()
    const now = Date.now()
    const credential = { keyVersion: args.keyVersion, ciphertext: args.ciphertext, nonce: args.nonce, expiresAt: args.expiresAt, updatedAt: now }
    if (existing) await ctx.db.patch(existing._id, credential)
    else await ctx.db.insert("integrationCredentials", { workspaceId: integration.workspaceId, integrationId: integration._id, ...credential, createdAt: now })
    await ctx.db.patch(integration._id, {
      status: "connected", configured: integration.provider !== "hubspot" && integration.provider !== "pipedrive", accountLabel: args.accountLabel.slice(0, 160), providerAccountId: args.providerAccountId?.slice(0, 200),
      scopes: args.scopes, connectedAt: now, revokedAt: undefined, lastErrorCode: undefined, lastErrorMessage: undefined, updatedAt: now,
    })
    return true
  },
})

export const failOAuth = internalMutation({
  args: { integrationId: v.id("workspaceIntegrations"), connectionGeneration: v.number(), errorCode: v.string() },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId)
    if (!integration || integration.connectionGeneration !== args.connectionGeneration) return null
    await ctx.db.patch(integration._id, { status: "error", lastErrorCode: args.errorCode.slice(0, 80), lastErrorMessage: "Die Verbindung konnte nicht hergestellt werden.", updatedAt: Date.now() })
    return null
  },
})

export const getCredentialContext = internalQuery({
  args: { integrationId: v.id("workspaceIntegrations") },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId)
    if (!integration) return null
    const credential = await ctx.db.query("integrationCredentials").withIndex("by_integrationId", (q) => q.eq("integrationId", integration._id)).unique()
    return credential ? { integration, credential } : null
  },
})

export const getConnectedProviderContext = internalQuery({
  args: { provider: oauthProviderValidator },
  handler: async (ctx, args) => {
    const { workspace } = await requireIntegrationWorkspace(ctx, args.provider)
    const integration = await connectedIntegration(ctx, workspace._id, args.provider)
    if (!integration) integrationError("NOT_CONNECTED", "Integration ist nicht verbunden.")
    const credential = await ctx.db.query("integrationCredentials").withIndex("by_integrationId", (q) => q.eq("integrationId", integration._id)).unique()
    if (!credential) integrationError("NOT_CONNECTED", "Integration muss erneut verbunden werden.")
    return { integration, credential }
  },
})

export const replaceCredential = internalMutation({
  args: { integrationId: v.id("workspaceIntegrations"), keyVersion: v.string(), ciphertext: v.string(), nonce: v.string(), expiresAt: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId)
    if (!integration || integration.status !== "connected") return false
    const credential = await ctx.db.query("integrationCredentials").withIndex("by_integrationId", (q) => q.eq("integrationId", integration._id)).unique()
    if (!credential) return false
    await ctx.db.patch(credential._id, { keyVersion: args.keyVersion, ciphertext: args.ciphertext, nonce: args.nonce, expiresAt: args.expiresAt, updatedAt: Date.now() })
    return true
  },
})

export const saveCrmConfiguration = internalMutation({
  args: { integrationId: v.id("workspaceIntegrations"), fieldMapping: v.record(v.string(), v.string()) },
  handler: async (ctx, args) => {
    const { workspace } = await requireIntegrationWorkspace(ctx)
    const integration = await ctx.db.get(args.integrationId)
    if (!integration || integration.workspaceId !== workspace._id || (integration.provider !== "hubspot" && integration.provider !== "pipedrive") || integration.status !== "connected") {
      integrationError("NOT_FOUND", "CRM-Verbindung nicht gefunden.")
    }
    for (const key of ["domain", "score", "reportUrl", "outcome"]) {
      if (!args.fieldMapping[key]?.trim()) integrationError("VALIDATION_ERROR", "CRM-Feldzuordnung ist unvollständig.")
    }
    await ctx.db.patch(integration._id, { configured: true, crmFieldMapping: args.fieldMapping, lastErrorCode: undefined, lastErrorMessage: undefined, updatedAt: Date.now() })
    return { configured: true as const }
  },
})

export const prepareDisconnect = internalQuery({
  args: { integrationId: v.id("workspaceIntegrations") },
  handler: async (ctx, args) => {
    const { workspace } = await requireIntegrationWorkspace(ctx)
    const integration = await ctx.db.get(args.integrationId)
    if (!integration || integration.workspaceId !== workspace._id) integrationError("NOT_FOUND", "Integration nicht gefunden.")
    const credential = await ctx.db.query("integrationCredentials").withIndex("by_integrationId", (q) => q.eq("integrationId", integration._id)).unique()
    return { integration, credential }
  },
})

export const finalizeDisconnect = internalMutation({
  args: { integrationId: v.id("workspaceIntegrations") },
  handler: async (ctx, args) => {
    const { workspace } = await requireIntegrationWorkspace(ctx)
    const integration = await ctx.db.get(args.integrationId)
    if (!integration || integration.workspaceId !== workspace._id) integrationError("NOT_FOUND", "Integration nicht gefunden.")
    const now = Date.now()
    const credential = await ctx.db.query("integrationCredentials").withIndex("by_integrationId", (q) => q.eq("integrationId", integration._id)).unique()
    if (credential) await ctx.db.delete(credential._id)
    const states = await ctx.db.query("integrationOAuthStates").withIndex("by_integrationId", (q) => q.eq("integrationId", integration._id)).collect()
    for (const state of states) await ctx.db.delete(state._id)
    const pending = await ctx.db.query("integrationRuns").withIndex("by_integrationId_and_createdAt", (q) => q.eq("integrationId", integration._id)).take(200)
    for (const run of pending) if (["queued", "running", "retryable_failed"].includes(run.status)) {
      await ctx.db.patch(run._id, { status: "cancelled", leaseToken: undefined, leaseExpiresAt: undefined, completedAt: now, updatedAt: now })
    }
    await ctx.db.patch(integration._id, { status: "revoked", revokedAt: now, updatedAt: now })
    return { status: "revoked" as const }
  },
})

export const confirmGmailIntent = internalMutation({
  args: { intentId: v.id("gmailDraftIntents") },
  handler: async (ctx, args) => {
    const { workspace } = await requireIntegrationWorkspace(ctx, "gmail")
    const intent = await ctx.db.get(args.intentId)
    const now = Date.now()
    if (!intent || intent.workspaceId !== workspace._id) integrationError("NOT_FOUND", "Bestätigung nicht gefunden.")
    if (intent.expiresAt <= now) integrationError("INTENT_EXPIRED", "Die Vorschau ist abgelaufen. Bitte erstelle sie erneut.")
    if (intent.runId) return { runId: intent.runId }
    const integration = await ctx.db.get(intent.integrationId)
    if (!integration || integration.status !== "connected") integrationError("NOT_CONNECTED", "Gmail ist nicht verbunden.")
    const payloadHash = await sha256Base64Url(`${intent.recipient}\n${intent.subject}\n${intent.body}\n${intent.messageId}`)
    const runId = await createIntegrationRun(ctx, {
      workspaceId: workspace._id, integrationId: integration._id, kind: "gmail_draft",
      idempotencyKey: `gmail:${integration._id}:${integration.connectionGeneration}:${intent._id}:${payloadHash}`,
      payloadHash, auditId: intent.auditId, maxAttempts: 1,
    })
    await ctx.db.patch(intent._id, { confirmedAt: now, runId })
    return { runId }
  },
})

export const claimIntegrationRun = internalMutation({
  args: { runId: v.id("integrationRuns"), leaseToken: v.string() },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId)
    const now = Date.now()
    if (!run || !["queued", "retryable_failed"].includes(run.status) || (run.nextAttemptAt ?? 0) > now) return null
    const [integration, workspace] = await Promise.all([ctx.db.get(run.integrationId), ctx.db.get(run.workspaceId)])
    if (!integration || !workspace || workspace.deletionRequestedAt || integration.status !== "connected" || !integrationsFeatureEnabled(env.INTEGRATIONS_ENABLED)) {
      await ctx.db.patch(run._id, { status: "cancelled", completedAt: now, updatedAt: now })
      return null
    }
    const plan = await getWorkspacePlan(ctx, workspace._id)
    const disabled = new Set((env.INTEGRATIONS_DISABLED_PROVIDERS ?? "").split(",").map((item) => item.trim()).filter(Boolean))
    if (!canUseIntegration(plan, capabilityForProvider(integration.provider)) || disabled.has(integration.provider)) {
      await ctx.db.patch(run._id, { status: "cancelled", errorCode: "PROVIDER_DISABLED", errorMessage: "Provider vorübergehend deaktiviert.", completedAt: now, updatedAt: now })
      return null
    }
    const credential = await ctx.db.query("integrationCredentials").withIndex("by_integrationId", (q) => q.eq("integrationId", integration._id)).unique()
    if (!credential) {
      await ctx.db.patch(run._id, { status: "permanent_failed", errorCode: "CREDENTIAL_MISSING", errorMessage: "Verbindung muss erneut hergestellt werden.", completedAt: now, updatedAt: now })
      return null
    }
    const attemptCount = run.attemptCount + 1
    await ctx.db.patch(run._id, { status: "running", attemptCount, leaseToken: args.leaseToken, leaseExpiresAt: now + 2 * 60_000, startedAt: run.startedAt ?? now, nextAttemptAt: undefined, updatedAt: now })
    const lead = run.leadId ? await ctx.db.get(run.leadId) : null
    const campaignLead = run.campaignLeadId ? await ctx.db.get(run.campaignLeadId) : null
    const audit = run.auditId ? await ctx.db.get(run.auditId) : null
    const event = run.integrationEventId ? await ctx.db.get(run.integrationEventId) : null
    const gmailIntent = run.kind === "gmail_draft"
      ? await ctx.db.query("gmailDraftIntents").withIndex("by_runId", (q) => q.eq("runId", run._id)).unique()
      : null
    const entityLink = run.leadId
      ? await ctx.db.query("integrationEntityLinks").withIndex("by_integrationId_and_leadId", (q) => q.eq("integrationId", integration._id).eq("leadId", run.leadId!)).first()
      : null
    return { run: { ...run, attemptCount }, integration, credential, lead, campaignLead, audit, event, gmailIntent, entityLink }
  },
})

export const completeIntegrationRun = internalMutation({
  args: { runId: v.id("integrationRuns"), leaseToken: v.string(), remoteObjectType: v.optional(v.string()), remoteObjectId: v.optional(v.string()), responseStatus: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId)
    if (!run || run.status !== "running" || run.leaseToken !== args.leaseToken) return false
    const now = Date.now()
    await ctx.db.patch(run._id, { status: "succeeded", remoteObjectType: args.remoteObjectType, remoteObjectId: args.remoteObjectId, responseStatus: args.responseStatus, leaseToken: undefined, leaseExpiresAt: undefined, completedAt: now, updatedAt: now })
    const integration = await ctx.db.get(run.integrationId)
    if (integration) await ctx.db.patch(integration._id, { lastSuccessAt: now, lastErrorCode: undefined, lastErrorMessage: undefined, updatedAt: now })
    if (run.kind === "gmail_draft") {
      const intent = await ctx.db.query("gmailDraftIntents").withIndex("by_runId", (q) => q.eq("runId", run._id)).unique()
      if (intent) await ctx.db.patch(intent._id, { consumedAt: now })
    }
    if (run.kind === "crm_push" && run.leadId && args.remoteObjectId && integration) {
      const lead = await ctx.db.get(run.leadId)
      if (lead?.normalizedDomain) {
        const existing = await ctx.db.query("integrationEntityLinks").withIndex("by_integrationId_and_leadId", (q) => q.eq("integrationId", integration._id).eq("leadId", lead._id)).first()
        const value = { connectionGeneration: integration.connectionGeneration, remoteObjectType: args.remoteObjectType ?? "organization", remoteObjectId: args.remoteObjectId, normalizedDomain: lead.normalizedDomain, lastSyncedAt: now, updatedAt: now }
        if (existing) await ctx.db.patch(existing._id, value)
        else await ctx.db.insert("integrationEntityLinks", { workspaceId: run.workspaceId, integrationId: integration._id, leadId: lead._id, ...value, createdAt: now })
      }
      if (run.campaignLeadId) {
        const campaignLead = await ctx.db.get(run.campaignLeadId)
        if (campaignLead) await ctx.db.insert("leadActivities", { workspaceId: run.workspaceId, campaignId: campaignLead.campaignId, campaignLeadId: campaignLead._id, leadId: campaignLead.leadId, type: "crm_synced", message: `Manuell mit ${integration.provider === "hubspot" ? "HubSpot" : "Pipedrive"} synchronisiert`, createdByUserId: integration.connectedByUserId, createdAt: now })
      }
    }
    return true
  },
})

export const failIntegrationRun = internalMutation({
  args: { runId: v.id("integrationRuns"), leaseToken: v.string(), errorCode: v.string(), errorMessage: v.string(), responseStatus: v.optional(v.number()), retryable: v.boolean(), unknown: v.optional(v.boolean()), retryAfterMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId)
    if (!run || run.status !== "running" || run.leaseToken !== args.leaseToken) return null
    const now = Date.now()
    const retryDelays = [0, 60_000, 5 * 60_000, 30 * 60_000]
    const canRetry = args.retryable && !args.unknown && run.attemptCount < run.maxAttempts
    const delay = canRetry ? Math.min(Math.max(retryDelays[run.attemptCount] ?? 30 * 60_000, args.retryAfterMs ?? 0), 30 * 60_000) : undefined
    const status = args.unknown ? "unknown" : canRetry ? "retryable_failed" : "permanent_failed"
    await ctx.db.patch(run._id, { status, errorCode: args.errorCode.slice(0, 80), errorMessage: args.errorMessage.slice(0, 300), responseStatus: args.responseStatus, nextAttemptAt: delay === undefined ? undefined : now + delay, leaseToken: undefined, leaseExpiresAt: undefined, completedAt: canRetry ? undefined : now, updatedAt: now })
    const integration = await ctx.db.get(run.integrationId)
    if (integration) await ctx.db.patch(integration._id, { lastErrorCode: args.errorCode.slice(0, 80), lastErrorMessage: args.errorMessage.slice(0, 300), updatedAt: now })
    if (canRetry && delay !== undefined) {
      if (run.kind === "webhook_delivery") {
        await webhookWorkpool.enqueueAction(
          ctx,
          internal.integration_actions.processIntegrationRun,
          { runId: run._id },
          { retry: false, runAfter: delay },
        )
      } else {
        await ctx.scheduler.runAfter(delay, internal.integration_actions.processIntegrationRun, { runId: run._id })
      }
    }
    return { status }
  },
})

export const setWebhookValidation = internalMutation({
  args: { integrationId: v.id("workspaceIntegrations"), ok: v.boolean(), errorCode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId)
    if (!integration || integration.provider !== "webhook" || integration.status === "revoked") return null
    const now = Date.now()
    await ctx.db.patch(integration._id, args.ok
      ? { status: "connected", connectedAt: now, lastErrorCode: undefined, lastErrorMessage: undefined, updatedAt: now }
      : { status: "error", lastErrorCode: args.errorCode ?? "UNSAFE_ENDPOINT", lastErrorMessage: "Webhook-Ziel konnte nicht sicher validiert werden.", updatedAt: now })
    return null
  },
})

export const storeSheetSnapshot = internalMutation({
  args: {
    campaignId: v.id("campaigns"), integrationId: v.id("workspaceIntegrations"), spreadsheetId: v.string(),
    sheetName: v.string(), digest: v.string(), rows: v.array(sheetRowValidator),
  },
  handler: async (ctx, args) => {
    const { user, workspace } = await requireIntegrationWorkspace(ctx, "google_sheets")
    if (args.rows.length > INTEGRATION_LIMITS.sheetRows) integrationError("SHEET_TOO_LARGE", "Maximal 100 Datenzeilen sind erlaubt.")
    const campaign = await ctx.db.get(args.campaignId)
    const integration = await ctx.db.get(args.integrationId)
    if (!campaign || campaign.workspaceId !== workspace._id || campaign.status === "paused" || campaign.status === "archived") integrationError("NOT_FOUND", "Kampagne nicht verfügbar.")
    if (!integration || integration.workspaceId !== workspace._id || integration.provider !== "google_sheets" || integration.status !== "connected") integrationError("NOT_CONNECTED", "Google Sheets ist nicht verbunden.")
    const now = Date.now()
    const snapshotId = await ctx.db.insert("sheetImportSnapshots", {
      workspaceId: workspace._id, integrationId: integration._id, campaignId: campaign._id, userId: user.userId,
      spreadsheetId: args.spreadsheetId, sheetName: args.sheetName, digest: args.digest, rows: args.rows,
      expiresAt: now + 15 * 60_000, createdAt: now,
    })
    return { snapshotId, accountLabel: integration.accountLabel ?? null, expiresAt: now + 15 * 60_000 }
  },
})

export const getSheetSnapshotContext = internalQuery({
  args: { snapshotId: v.id("sheetImportSnapshots") },
  handler: async (ctx, args) => {
    const { workspace } = await requireIntegrationWorkspace(ctx, "google_sheets")
    const snapshot = await ctx.db.get(args.snapshotId)
    if (!snapshot || snapshot.workspaceId !== workspace._id || snapshot.consumedAt || snapshot.expiresAt <= Date.now()) integrationError("SNAPSHOT_EXPIRED", "Die Vorschau ist abgelaufen. Bitte lade sie erneut.")
    const integration = await ctx.db.get(snapshot.integrationId)
    if (!integration || integration.status !== "connected") integrationError("NOT_CONNECTED", "Google Sheets ist nicht verbunden.")
    const credential = await ctx.db.query("integrationCredentials").withIndex("by_integrationId", (q) => q.eq("integrationId", integration._id)).unique()
    if (!credential) integrationError("NOT_CONNECTED", "Google Sheets muss erneut verbunden werden.")
    return { snapshot, integration, credential }
  },
})

export const consumeSheetSnapshot = internalMutation({
  args: { snapshotId: v.id("sheetImportSnapshots") },
  handler: async (ctx, args) => {
    const { workspace } = await requireIntegrationWorkspace(ctx, "google_sheets")
    const snapshot = await ctx.db.get(args.snapshotId)
    if (!snapshot || snapshot.workspaceId !== workspace._id || snapshot.consumedAt) integrationError("SNAPSHOT_EXPIRED", "Die Vorschau wurde bereits verwendet.")
    await ctx.db.patch(snapshot._id, { consumedAt: Date.now() })
    return snapshot
  },
})

export const getSheetExportContext = internalQuery({
  args: { campaignId: v.id("campaigns"), campaignLeadIds: v.array(v.id("campaignLeads")) },
  handler: async (ctx, args) => {
    const { workspace } = await requireIntegrationWorkspace(ctx, "google_sheets")
    if (args.campaignLeadIds.length > 100) integrationError("SHEET_TOO_LARGE", "Maximal 100 Leads können exportiert werden.")
    const campaign = await ctx.db.get(args.campaignId)
    if (!campaign || campaign.workspaceId !== workspace._id) integrationError("NOT_FOUND", "Kampagne nicht gefunden.")
    const integration = await connectedIntegration(ctx, workspace._id, "google_sheets")
    if (!integration) integrationError("NOT_CONNECTED", "Google Sheets ist nicht verbunden.")
    const credential = await ctx.db.query("integrationCredentials").withIndex("by_integrationId", (q) => q.eq("integrationId", integration._id)).unique()
    if (!credential) integrationError("NOT_CONNECTED", "Google Sheets muss erneut verbunden werden.")
    const rows = []
    for (const campaignLeadId of args.campaignLeadIds) {
      const campaignLead = await ctx.db.get(campaignLeadId)
      if (!campaignLead || campaignLead.workspaceId !== workspace._id || campaignLead.campaignId !== campaign._id) continue
      const lead = await ctx.db.get(campaignLead.leadId)
      if (!lead) continue
      const audit = await ctx.db.query("audits").withIndex("by_campaignLeadId_and_createdAt", (q) => q.eq("campaignLeadId", campaignLead._id)).order("desc").first()
      rows.push({
        businessName: lead.businessName, websiteUrl: lead.normalizedWebsiteUrl ?? lead.websiteUrl ?? "", category: lead.category ?? "",
        city: lead.city ?? "", country: lead.country ?? "", address: lead.address ?? "", phone: lead.phone ?? "", businessEmail: lead.businessEmail ?? "",
        status: campaignLead.status, score: audit?.overallScore ?? null, reportOpened: false,
        lastContactedAt: campaignLead.lastContactedAt ?? null, followUpAt: campaignLead.followUpAt ?? null, note: campaignLead.note ?? "", outcomeReason: campaignLead.outcomeReason ?? "",
      })
    }
    return { integration, credential, campaign, rows }
  },
})

export const beginSheetRun = internalMutation({
  args: { integrationId: v.id("workspaceIntegrations"), kind: v.union(v.literal("sheet_import"), v.literal("sheet_export")), idempotencyKey: v.string(), payloadHash: v.string() },
  handler: async (ctx, args) => {
    const { workspace } = await requireIntegrationWorkspace(ctx, "google_sheets")
    const integration = await ctx.db.get(args.integrationId)
    if (!integration || integration.workspaceId !== workspace._id || integration.provider !== "google_sheets" || integration.status !== "connected") integrationError("NOT_CONNECTED", "Google Sheets ist nicht verbunden.")
    const existing = await ctx.db.query("integrationRuns").withIndex("by_workspaceId_and_idempotencyKey", (q) => q.eq("workspaceId", workspace._id).eq("idempotencyKey", args.idempotencyKey)).unique()
    if (existing?.status === "succeeded") return { runId: existing._id, leaseToken: null, existing }
    if (existing?.status === "running" && (existing.leaseExpiresAt ?? 0) > Date.now()) integrationError("RUN_IN_PROGRESS", "Diese Aktion wird bereits ausgeführt.")
    if (existing && existing.attemptCount >= existing.maxAttempts) integrationError("RETRY_LIMIT_REACHED", "Maximale Anzahl an Versuchen erreicht.")
    const now = Date.now()
    const leaseToken = randomBase64Url(18)
    const runId = existing?._id ?? await createIntegrationRun(ctx, { workspaceId: workspace._id, integrationId: integration._id, kind: args.kind, idempotencyKey: args.idempotencyKey, payloadHash: args.payloadHash, maxAttempts: 4 })
    const attemptCount = (existing?.attemptCount ?? 0) + 1
    await ctx.db.patch(runId, { status: "running", attemptCount, leaseToken, leaseExpiresAt: now + 2 * 60_000, startedAt: existing?.startedAt ?? now, completedAt: undefined, errorCode: undefined, errorMessage: undefined, updatedAt: now })
    return { runId, leaseToken, existing: null }
  },
})
