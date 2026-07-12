import type { Doc } from "../_generated/dataModel"

export const LEGACY_VIEW_COUNT_CAP = 100

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
