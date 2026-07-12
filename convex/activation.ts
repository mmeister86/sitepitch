import { ConvexError, v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { query, type QueryCtx } from "./_generated/server"
import { requireSupportAdmin } from "./lib/support"
import { findAppUser, getWorkspaceByOwner } from "./lib/workspace"
import { hasAccurateViewAggregate } from "./lib/report_view_stats"

const DAY_MS = 86_400_000
const MAX_WINDOW_MS = 90 * DAY_MS
const EVENT_ROW_CAP = 1_000

type MilestoneEvent =
  | "signed_up"
  | "branding_completed"
  | "audit_completed"
  | "outreach_copied"
  | "first_shared_report"

type NextStep = "branding" | "firstAudit" | "outreach" | "firstShare" | "complete"

async function firstMilestoneAt(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  event: MilestoneEvent,
): Promise<number | null> {
  const rows = await ctx.db
    .query("usageEvents")
    .withIndex("by_workspaceId_and_event_and_createdAt", (q) =>
      q.eq("workspaceId", workspaceId).eq("event", event),
    )
    .order("asc")
    .take(1)
  return rows[0]?.createdAt ?? null
}

export function activationNextStep(status: {
  branding: boolean
  firstAudit: boolean
  outreach: boolean
  firstShare: boolean
}): NextStep {
  if (!status.branding) return "branding"
  if (!status.firstAudit) return "firstAudit"
  if (!status.outreach) return "outreach"
  if (!status.firstShare) return "firstShare"
  return "complete"
}

export const getMyActivationStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" })
    }
    const user = await findAppUser(ctx, identity.tokenIdentifier)
    if (!user) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" })
    }
    const workspace = await getWorkspaceByOwner(ctx, user._id)
    if (!workspace || workspace.deletionRequestedAt) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }
    const [signedUpAt, brandingCompletedAt, firstAuditCompletedAt, outreachCopiedAt, firstSharedReportAt] =
      await Promise.all([
        firstMilestoneAt(ctx, workspace._id, "signed_up"),
        firstMilestoneAt(ctx, workspace._id, "branding_completed"),
        firstMilestoneAt(ctx, workspace._id, "audit_completed"),
        firstMilestoneAt(ctx, workspace._id, "outreach_copied"),
        firstMilestoneAt(ctx, workspace._id, "first_shared_report"),
      ])

    const completed = {
      branding: brandingCompletedAt !== null,
      firstAudit: firstAuditCompletedAt !== null,
      outreach: outreachCopiedAt !== null,
      firstShare: firstSharedReportAt !== null,
    }

    return {
      milestones: {
        signedUpAt,
        brandingCompletedAt,
        firstAuditCompletedAt,
        outreachCopiedAt,
        firstSharedReportAt,
      },
      completed,
      completedCount:
        Number(completed.branding) +
        Number(completed.firstAudit) +
        Number(completed.outreach) +
        Number(completed.firstShare),
      nextStep: activationNextStep(completed),
    }
  },
})

function validateWindow(from: number, to: number) {
  if (
    !Number.isSafeInteger(from) ||
    !Number.isSafeInteger(to) ||
    from < 0 ||
    to < from ||
    to > Number.MAX_SAFE_INTEGER - DAY_MS
  ) {
    throw new ConvexError({ code: "INVALID_WINDOW", message: "from/to must be valid timestamps" })
  }
  if (to - from > MAX_WINDOW_MS) {
    throw new ConvexError({ code: "WINDOW_TOO_LARGE", message: "Activation window is limited to 90 days" })
  }
}

async function eventsInWindow(
  ctx: QueryCtx,
  event: Doc<"usageEvents">["event"],
  from: number,
  to: number,
) {
  const rows = await ctx.db
    .query("usageEvents")
    .withIndex("by_event_and_createdAt", (q) =>
      q.eq("event", event).gte("createdAt", from).lte("createdAt", to),
    )
    .order("asc")
    .take(EVENT_ROW_CAP + 1)
  return { rows: rows.slice(0, EVENT_ROW_CAP), truncated: rows.length > EVENT_ROW_CAP }
}

function firstByWorkspace(rows: Doc<"usageEvents">[]) {
  const result = new Map<Id<"workspaces">, number>()
  for (const row of rows) {
    if (!result.has(row.workspaceId)) result.set(row.workspaceId, row.createdAt)
  }
  return result
}

function metric(numerator: number, denominator: number) {
  return { numerator, denominator, rate: denominator === 0 ? null : numerator / denominator }
}

export const getActivationFunnel = query({
  args: { from: v.number(), to: v.number() },
  handler: async (ctx, args) => {
    await requireSupportAdmin(ctx)
    validateWindow(args.from, args.to)

    const [signupRows, brandingRows, auditRows, outreachRows, shareRows, linkRows] = await Promise.all([
      eventsInWindow(ctx, "signed_up", args.from, args.to),
      eventsInWindow(ctx, "branding_completed", args.from, args.to),
      eventsInWindow(ctx, "audit_completed", args.from, args.to),
      eventsInWindow(ctx, "outreach_copied", args.from, args.to),
      // Include the full 24h attribution window for signups at the end boundary.
      eventsInWindow(ctx, "first_shared_report", args.from, args.to + DAY_MS),
      eventsInWindow(ctx, "public_link_copied", args.from, args.to),
    ])

    const signups = firstByWorkspace(signupRows.rows)
    const branding = firstByWorkspace(brandingRows.rows)
    const audits = firstByWorkspace(auditRows.rows)
    const outreach = firstByWorkspace(outreachRows.rows)
    const shares = firstByWorkspace(shareRows.rows)
    const funnelShares = new Map<Id<"workspaces">, number>()
    for (const row of shareRows.rows) {
      if (row.createdAt <= args.to && !funnelShares.has(row.workspaceId)) {
        funnelShares.set(row.workspaceId, row.createdAt)
      }
    }

    let brandedCount = 0
    let auditedCount = 0
    let outreachCount = 0
    let sharedCount = 0
    let sharedWithin24h = 0
    for (const [workspaceId, signedUpAt] of signups) {
      const brandedAt = branding.get(workspaceId)
      const auditedAt = audits.get(workspaceId)
      const outreachAt = outreach.get(workspaceId)
      const sharedAt = funnelShares.get(workspaceId)
      const attributedShareAt = shares.get(workspaceId)
      const hasBranding = brandedAt !== undefined && brandedAt >= signedUpAt
      const hasAudit = hasBranding && auditedAt !== undefined && auditedAt >= brandedAt
      const hasOutreach = hasAudit && outreachAt !== undefined && outreachAt >= auditedAt
      const hasShare = hasOutreach && sharedAt !== undefined && sharedAt >= outreachAt
      if (hasBranding) brandedCount += 1
      if (hasAudit) auditedCount += 1
      if (hasOutreach) outreachCount += 1
      if (hasShare) sharedCount += 1
      if (
        attributedShareAt !== undefined &&
        attributedShareAt >= signedUpAt &&
        attributedShareAt <= signedUpAt + DAY_MS
      ) {
        sharedWithin24h += 1
      }
    }

    const copiedAuditIds = new Set<Id<"audits">>()
    for (const row of linkRows.rows) {
      if (row.auditId) copiedAuditIds.add(row.auditId)
    }
    let openedAudits = 0
    for (const auditId of copiedAuditIds) {
      const stats = await ctx.db
        .query("reportViewStats")
        .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
        .first()
      if (hasAccurateViewAggregate(stats)) {
        if (stats!.totalViews > 0) openedAudits += 1
      } else {
        const legacyView = await ctx.db
          .query("reportViews")
          .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
          .first()
        if (legacyView) openedAudits += 1
      }
    }

    return {
      window: { from: args.from, to: args.to, maxDays: 90, rowCapPerEvent: EVENT_ROW_CAP },
      funnel: [
        { key: "signup", label: "Signup", count: signups.size },
        { key: "branding", label: "Branding", count: brandedCount },
        { key: "firstAudit", label: "First Audit", count: auditedCount },
        { key: "outreach", label: "Outreach Copied", count: outreachCount },
        { key: "firstShare", label: "First Shared Report", count: sharedCount },
      ],
      firstShareWithin24h: metric(sharedWithin24h, signups.size),
      sharedReportOpenRate: metric(openedAudits, copiedAuditIds.size),
      truncated: [signupRows, brandingRows, auditRows, outreachRows, shareRows, linkRows].some(
        (result) => result.truncated,
      ),
    }
  },
})
