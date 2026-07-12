import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"

export const LEGACY_VIEW_COUNT_CAP = 100
export const WORKSPACE_VIEW_ROW_CAP = 500

export type ReportViewCount = {
  count: number
  capped: boolean
  pending: boolean
}

type StatsLike = Pick<Doc<"reportViewStats">, "totalViews" | "viewAggregationState" | "firstViewedAt" | "lastViewedAt">
type WorkspaceStatsLike = StatsLike & { auditId: string }
type WorkspaceViewLike = { auditId: string }

/**
 * Rows written before the aggregation-state rollout can still be trusted when
 * they contain evidence of an already maintained view aggregate. A zero-only
 * row is intentionally not trusted because CTA/PDF actions used to create it.
 */
export function hasAccurateViewAggregate(stats: Doc<"reportViewStats"> | null | undefined) {
  if (!stats) return false
  if (stats.viewAggregationState === "accurate") return true
  if (stats.viewAggregationState === "pending") return false
  return stats.totalViews > 0 || stats.firstViewedAt !== undefined || stats.lastViewedAt !== undefined
}

export function resolveReportViewCount(
  stats: StatsLike | null | undefined,
  rawRowCount: number,
  cap = LEGACY_VIEW_COUNT_CAP,
): ReportViewCount {
  if (hasAccurateViewAggregate(stats as Doc<"reportViewStats"> | null | undefined)) {
    return { count: stats!.totalViews, capped: false, pending: false }
  }
  return {
    count: Math.min(rawRowCount, cap),
    capped: rawRowCount > cap,
    pending: (stats !== null && stats !== undefined) || rawRowCount > 0,
  }
}

export async function loadReportViewCount(
  ctx: QueryCtx,
  auditId: Id<"audits">,
  cap = LEGACY_VIEW_COUNT_CAP,
): Promise<ReportViewCount> {
  const stats = await ctx.db
    .query("reportViewStats")
    .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
    .unique()
  if (hasAccurateViewAggregate(stats)) {
    return { count: stats!.totalViews, capped: false, pending: false }
  }
  const rawRows = await ctx.db
    .query("reportViews")
    .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
    .take(cap + 1)
  return resolveReportViewCount(stats, rawRows.length, cap)
}

export function resolveWorkspaceReportViewCount(
  statsRows: WorkspaceStatsLike[],
  rawRows: WorkspaceViewLike[],
  statsCapped: boolean,
  rawCapped: boolean,
): ReportViewCount {
  const rawCounts = new Map<string, number>()
  for (const row of rawRows) rawCounts.set(row.auditId, (rawCounts.get(row.auditId) ?? 0) + 1)

  let count = 0
  let pending = false
  const countedAudits = new Set<string>()
  for (const stats of statsRows) {
    countedAudits.add(stats.auditId)
    if (hasAccurateViewAggregate(stats as Doc<"reportViewStats">)) {
      count += stats.totalViews
    } else {
      count += rawCounts.get(stats.auditId) ?? 0
      pending = true
    }
  }
  for (const [auditId, rawCount] of rawCounts) {
    if (countedAudits.has(auditId)) continue
    count += rawCount
    pending = true
  }
  return { count, capped: statsCapped || rawCapped, pending }
}

export async function loadWorkspaceReportViewCount(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
): Promise<ReportViewCount> {
  const [statsRows, rawRows] = await Promise.all([
    ctx.db
      .query("reportViewStats")
      .withIndex("by_workspaceId_and_auditId", (q) => q.eq("workspaceId", workspaceId))
      .take(WORKSPACE_VIEW_ROW_CAP + 1),
    ctx.db
      .query("reportViews")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
      .take(WORKSPACE_VIEW_ROW_CAP + 1),
  ])
  return resolveWorkspaceReportViewCount(
    statsRows.slice(0, WORKSPACE_VIEW_ROW_CAP),
    rawRows.slice(0, WORKSPACE_VIEW_ROW_CAP),
    statsRows.length > WORKSPACE_VIEW_ROW_CAP,
    rawRows.length > WORKSPACE_VIEW_ROW_CAP,
  )
}
