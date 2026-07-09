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
  auditStartsFree: { kind: "fixed window", rate: 3, period: HOUR },
  auditStartsPaid: { kind: "fixed window", rate: 10, period: HOUR },
  auditStartsByWorkspace: { kind: "fixed window", rate: 10, period: HOUR },
  demoAuditByIp: { kind: "fixed window", rate: 1, period: DAY },
  leadSearchByWorkspace: { kind: "fixed window", rate: 10, period: HOUR },
  publicReportViewsByViewer: { kind: "fixed window", rate: 30, period: HOUR },
  publicReportCtaByViewer: { kind: "fixed window", rate: 30, period: HOUR },
  screenshotProviderCalls: { kind: "token bucket", rate: 20, period: MINUTE, capacity: 20 },
  pagespeedProviderCalls: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 10 },
  contentProviderCalls: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 60 },
  businessDataProviderCalls: { kind: "token bucket", rate: 20, period: MINUTE, capacity: 20 },
  llmGenerations: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 10 },
  pdfExportsByWorkspace: { kind: "fixed window", rate: 10, period: HOUR },
})

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

export async function checkLeadSearchLimit(
  ctx: AnyCtx,
  args: { workspaceId: string },
): Promise<void> {
  const result = await auditRateLimiter.limit(ctx, "leadSearchByWorkspace", { key: args.workspaceId })
  if (!result.ok) throwRateLimited(result.retryAfter)
}

export async function checkProviderLimit(
  ctx: AnyCtx,
  args: { kind: ProviderLimitKind; provider: string },
): Promise<void> {
  const limitName =
    args.kind === "screenshot" ? "screenshotProviderCalls"
      : args.kind === "pagespeed" ? "pagespeedProviderCalls"
      : args.kind === "businessData" ? "businessDataProviderCalls"
      : args.kind === "llm" ? "llmGenerations"
      : args.kind === "pdf" ? "pdfExportsByWorkspace"
      : "contentProviderCalls"
  const result = await auditRateLimiter.limit(ctx, limitName, { key: args.provider })
  if (!result.ok) throwRateLimited(result.retryAfter)
}
