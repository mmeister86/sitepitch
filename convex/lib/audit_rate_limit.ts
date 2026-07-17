import { DAY, HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter"

import { components } from "../_generated/api"
import type { ActionCtx, MutationCtx } from "../_generated/server"
import {
  isPaidPlan,
  providerToLimitKind,
  throwRateLimited,
  type ProviderLimitKind,
  type SubscriptionPlan,
} from "./rate_limit_helpers"

type AnyCtx = MutationCtx | ActionCtx

export { isPaidPlan, providerToLimitKind, throwRateLimited }
export type { ProviderLimitKind, SubscriptionPlan }

export const auditRateLimiter = new RateLimiter(components.rateLimiter, {
  // Pre-billing free tier: aligned with paid limit so test users can run QA.
  // Revisit once Task 4.9 (billing & plan gates) ships; production has no free plan.
  auditStartsFree: { kind: "fixed window", rate: 10, period: HOUR },
  auditStartsPaid: { kind: "fixed window", rate: 10, period: HOUR },
  auditStartsByWorkspace: { kind: "fixed window", rate: 10, period: HOUR },
  batchStartsByWorkspace: { kind: "fixed window", rate: 3, period: HOUR },
  batchStartsByUser: { kind: "fixed window", rate: 3, period: HOUR },
  batchItemsAgency: { kind: "fixed window", rate: 100, period: HOUR },
  batchItemsScale: { kind: "fixed window", rate: 100, period: HOUR },
  demoAuditByIp: { kind: "fixed window", rate: 1, period: DAY },
  leadSearchByWorkspace: { kind: "fixed window", rate: 10, period: HOUR },
  publicReportViewsByViewer: { kind: "fixed window", rate: 30, period: HOUR },
  publicReportViewsBySlug: { kind: "fixed window", rate: 300, period: HOUR },
  publicReportCtaByViewer: { kind: "fixed window", rate: 30, period: HOUR },
  publicReportActionsBySlug: { kind: "fixed window", rate: 120, period: HOUR },
  publicReportUnlocksBySlug: { kind: "fixed window", rate: 10, period: HOUR },
  screenshotProviderCalls: { kind: "token bucket", rate: 20, period: MINUTE, capacity: 20 },
  pagespeedProviderCalls: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 10 },
  contentProviderCalls: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 60 },
  businessDataProviderCalls: { kind: "token bucket", rate: 20, period: MINUTE, capacity: 20 },
  llmGenerations: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 10 },
  pdfExportsByWorkspace: { kind: "fixed window", rate: 10, period: HOUR },
  integrationConnectsByUser: { kind: "fixed window", rate: 10, period: HOUR },
  integrationCrmPushesByWorkspace: { kind: "fixed window", rate: 30, period: HOUR },
  integrationGmailDraftsByUser: { kind: "fixed window", rate: 10, period: HOUR },
  integrationSheetsByWorkspace: { kind: "fixed window", rate: 10, period: HOUR },
  integrationWebhookTestsByWorkspace: { kind: "fixed window", rate: 10, period: HOUR },
  publicApiRequestsByKey: { kind: "fixed window", rate: 120, period: MINUTE },
  publicApiRequestsByWorkspace: { kind: "fixed window", rate: 600, period: MINUTE },
  integrationWebhookRedeliveriesByWorkspace: { kind: "fixed window", rate: 10, period: HOUR },
  auditRecoveryByAdmin: { kind: "fixed window", rate: 10, period: HOUR },
  auditRecoveryByAudit: { kind: "fixed window", rate: 3, period: HOUR },
})

export type IntegrationLimitKind = "connect" | "crm" | "gmail" | "sheets" | "webhook_test"

export async function checkIntegrationLimit(
  ctx: AnyCtx,
  args: { kind: IntegrationLimitKind; workspaceId: string; userId: string },
): Promise<void> {
  const limitName = args.kind === "connect"
    ? "integrationConnectsByUser"
    : args.kind === "crm"
      ? "integrationCrmPushesByWorkspace"
      : args.kind === "gmail"
        ? "integrationGmailDraftsByUser"
        : args.kind === "sheets"
          ? "integrationSheetsByWorkspace"
          : "integrationWebhookTestsByWorkspace"
  const key = args.kind === "connect" || args.kind === "gmail"
    ? `user:${args.userId}`
    : `workspace:${args.workspaceId}`
  const result = await auditRateLimiter.limit(ctx, limitName, { key })
  if (!result.ok) throwRateLimited(result.retryAfter)
}

export async function checkAuditStartLimits(
  ctx: AnyCtx,
  args: { workspaceId: string; userId: string; plan: SubscriptionPlan },
): Promise<void> {
  const planLimitName = isPaidPlan(args.plan) ? "auditStartsPaid" : "auditStartsFree"
  const byPlan = await auditRateLimiter.limit(ctx, planLimitName, { key: `${args.plan}:${args.userId}` })
  if (!byPlan.ok) throwRateLimited(byPlan.retryAfter)

  const byWorkspace = await auditRateLimiter.limit(ctx, "auditStartsByWorkspace", { key: args.workspaceId })
  if (!byWorkspace.ok) throwRateLimited(byWorkspace.retryAfter)
}

export async function checkPublicApiTransportLimits(
  ctx: AnyCtx,
  args: { apiKeyId: string; workspaceId: string },
): Promise<void> {
  const byKey = await auditRateLimiter.limit(ctx, "publicApiRequestsByKey", {
    key: args.apiKeyId,
  })
  if (!byKey.ok) throwRateLimited(byKey.retryAfter)

  const byWorkspace = await auditRateLimiter.limit(ctx, "publicApiRequestsByWorkspace", {
    key: args.workspaceId,
  })
  if (!byWorkspace.ok) throwRateLimited(byWorkspace.retryAfter)
}

export async function checkWebhookRedeliveryLimit(
  ctx: AnyCtx,
  args: { workspaceId: string },
): Promise<void> {
  const result = await auditRateLimiter.limit(ctx, "integrationWebhookRedeliveriesByWorkspace", {
    key: args.workspaceId,
  })
  if (!result.ok) throwRateLimited(result.retryAfter)
}

export async function checkAuditRecoveryLimits(
  ctx: AnyCtx,
  args: { actorUserId: string; auditId: string },
): Promise<void> {
  const byAdmin = await auditRateLimiter.limit(ctx, "auditRecoveryByAdmin", { key: args.actorUserId })
  if (!byAdmin.ok) throwRateLimited(byAdmin.retryAfter)
  const byAudit = await auditRateLimiter.limit(ctx, "auditRecoveryByAudit", { key: args.auditId })
  if (!byAudit.ok) throwRateLimited(byAudit.retryAfter)
}

export async function checkLeadSearchLimit(
  ctx: AnyCtx,
  args: { workspaceId: string },
): Promise<void> {
  const result = await auditRateLimiter.limit(ctx, "leadSearchByWorkspace", { key: args.workspaceId })
  if (!result.ok) throwRateLimited(result.retryAfter)
}

export async function checkBatchStartLimits(
  ctx: AnyCtx,
  args: { workspaceId: string; userId: string; plan: SubscriptionPlan; itemCount: number },
): Promise<void> {
  const batchByWorkspace = await auditRateLimiter.limit(ctx, "batchStartsByWorkspace", {
    key: args.workspaceId,
  })
  if (!batchByWorkspace.ok) throwRateLimited(batchByWorkspace.retryAfter)
  const batchByUser = await auditRateLimiter.limit(ctx, "batchStartsByUser", {
    key: args.userId,
  })
  if (!batchByUser.ok) throwRateLimited(batchByUser.retryAfter)

  const itemLimit = args.plan === "scale" ? "batchItemsScale" : "batchItemsAgency"
  for (const key of [`workspace:${args.workspaceId}`, `user:${args.userId}`, `plan:${args.plan}:${args.workspaceId}`]) {
    const result = await auditRateLimiter.limit(ctx, itemLimit, { key, count: args.itemCount })
    if (!result.ok) throwRateLimited(result.retryAfter)
  }
}

export async function checkProviderLimit(
  ctx: AnyCtx,
  args: {
    kind: ProviderLimitKind
    provider: string
    workspaceId?: string
    userId?: string
    plan?: SubscriptionPlan
    apiKeyId?: string
  },
): Promise<void> {
  const limitName =
    args.kind === "screenshot" ? "screenshotProviderCalls"
      : args.kind === "pagespeed" ? "pagespeedProviderCalls"
      : args.kind === "businessData" ? "businessDataProviderCalls"
      : args.kind === "llm" ? "llmGenerations"
      : args.kind === "pdf" ? "pdfExportsByWorkspace"
      : "contentProviderCalls"
  const keys = [
    args.workspaceId || args.userId || args.plan || args.apiKeyId ? `global:${args.provider}` : args.provider,
    args.workspaceId ? `workspace:${args.workspaceId}:${args.provider}` : null,
    args.userId ? `user:${args.userId}:${args.provider}` : null,
    args.plan ? `plan:${args.plan}:${args.provider}` : null,
    args.apiKeyId ? `api_key:${args.apiKeyId}:${args.provider}` : null,
  ].filter((key): key is string => Boolean(key))
  for (const key of keys) {
    const result = await auditRateLimiter.limit(ctx, limitName, { key })
    if (!result.ok) throwRateLimited(result.retryAfter)
  }
}
