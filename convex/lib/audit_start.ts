import { ConvexError } from "convex/values"

import type { Doc, Id } from "../_generated/dataModel"
import { internal } from "../_generated/api"
import type { ActionCtx } from "../_generated/server"
import { checkAuditStartLimits } from "./audit_rate_limit"
import type { SubscriptionPlan } from "./rate_limit_helpers"
import { normalizeAuditUrl, toSafeDisplayUrl, validatePublicAuditTarget } from "./audit_url"

export type AuditPrincipal =
  | {
      kind: "user"
      workspaceId: Id<"workspaces">
      userId: Id<"users">
      plan: SubscriptionPlan
      creditsRemaining: number
    }
  | {
      kind: "api_key"
      workspaceId: Id<"workspaces">
      userId: Id<"users">
      apiKeyId: Id<"apiKeys">
      plan: SubscriptionPlan
      creditsRemaining: number
    }

export type SharedAuditStartArgs = {
  url: string
  auditType: "standard" | "local" | "quick"
  reportLanguage: "de" | "en"
  idempotencyKey: string
  payloadHash?: string
  publishRequested?: boolean
  leadId?: Id<"leads">
  campaignId?: Id<"campaigns">
  campaignLeadId?: Id<"campaignLeads">
}

export type SharedAuditStartResult = {
  auditId: Id<"audits">
  externalAuditId?: string
  status: "queued"
  normalizedUrl: string
  domain: string
  publicSlug: string
}

function existingResult(audit: Doc<"audits">): SharedAuditStartResult {
  return {
    auditId: audit._id,
    externalAuditId: audit.externalApiId,
    status: "queued",
    normalizedUrl: toSafeDisplayUrl(audit.normalizedUrl),
    domain: audit.domain,
    publicSlug: audit.publicSlug,
  }
}

export async function startAuditForPrincipal(
  ctx: ActionCtx,
  principal: AuditPrincipal,
  args: SharedAuditStartArgs,
): Promise<SharedAuditStartResult> {
  const normalized = normalizeAuditUrl(args.url)
  if ("code" in normalized) throw new ConvexError({ code: normalized.code, message: normalized.message })

  const existing: Doc<"audits"> | null = await ctx.runQuery(
    internal.audits.findByWorkspaceAndIdempotencyKey,
    { workspaceId: principal.workspaceId, idempotencyKey: args.idempotencyKey },
  )
  if (existing) {
    if (principal.kind === "api_key" && existing.apiPayloadHash !== args.payloadHash) {
      throw new ConvexError({ code: "IDEMPOTENCY_CONFLICT", message: "Idempotency key belongs to another payload" })
    }
    if (
      args.campaignId !== undefined &&
      (existing.campaignId !== args.campaignId || existing.campaignLeadId !== args.campaignLeadId)
    ) {
      throw new ConvexError({ code: "AUDIT_CONTEXT_MISMATCH", message: "Idempotency key belongs to another campaign context" })
    }
    return existingResult(existing)
  }

  await checkAuditStartLimits(ctx, {
    workspaceId: principal.workspaceId,
    userId: principal.userId,
    plan: principal.plan,
  })
  if (principal.creditsRemaining < 1) {
    await ctx.runMutation(internal.audits.logCreditsExhausted, {
      workspaceId: principal.workspaceId,
      userId: principal.userId,
      idempotencyKey: args.idempotencyKey,
    })
    throw new ConvexError({ code: "INSUFFICIENT_CREDITS", message: "No credits available" })
  }

  const target = await validatePublicAuditTarget(normalized.hostname)
  if ("code" in target) throw new ConvexError({ code: target.code, message: target.message })

  return await ctx.runMutation(internal.audits.createQueuedAudit, {
    workspaceId: principal.workspaceId,
    userId: principal.userId,
    url: args.url.trim(),
    normalizedUrl: normalized.normalizedUrl,
    domain: normalized.hostname,
    auditType: args.auditType,
    reportLanguage: args.reportLanguage,
    idempotencyKey: args.idempotencyKey,
    leadId: args.leadId,
    campaignId: args.campaignId,
    campaignLeadId: args.campaignLeadId,
    creationChannel: principal.kind === "api_key" ? "api" : "ui",
    apiKeyId: principal.kind === "api_key" ? principal.apiKeyId : undefined,
    publishRequested: args.publishRequested,
    apiPayloadHash: args.payloadHash,
  })
}
