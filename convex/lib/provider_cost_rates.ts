export const PROVIDER_COST_RATE_VERSION = "2026-07-11"

export type BatchCostAuditType = "quick" | "standard" | "local"

// One-pass budgets across findings, persona, copy, and design generation.
// Retries are deliberately excluded from preflight and are shown as an
// operational risk rather than silently inflating the expected cost.
export const batchAuditTokenBudgets: Record<
  BatchCostAuditType,
  { inputTokens: number; outputTokens: number }
> = {
  quick: { inputTokens: 30_000, outputTokens: 8_000 },
  standard: { inputTokens: 40_000, outputTokens: 10_000 },
  local: { inputTokens: 42_000, outputTokens: 10_000 },
}

export const providerCostRates = {
  firecrawl: {
    scrapeHomepageUsd: 0.0,
    scrapePriorityPageUsd: 0.0,
    mapSiteUsd: 0.0,
    screenshotUsd: 0.0,
  },
  rapidapi: {
    businessLookupUsd: 0.0,
    leadSearchUsd: 0.0,
  },
  google_places: {
    businessLookupUsd: 0.0,
    leadSearchUsd: 0.0,
  },
  pagespeed: {
    analysisUsd: 0.0,
  },
  direct_html: {
    fetchUsd: 0.0,
  },
  openrouter: {
    perMillionInputTokensUsd: 0.15,
    perMillionOutputTokensUsd: 0.60,
  },
} as const

export type ProviderCostRates = typeof providerCostRates

export function estimateLlmCostUsd(
  model: string,
  tokensIn: number,
  tokensOut: number,
): number {
  const rates = providerCostRates.openrouter
  const inputCost = (tokensIn / 1_000_000) * rates.perMillionInputTokensUsd
  const outputCost = (tokensOut / 1_000_000) * rates.perMillionOutputTokensUsd
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000
}

export function estimateBatchAuditCostUsd(
  auditType: BatchCostAuditType,
  itemCount: number,
): number {
  if (!Number.isFinite(itemCount) || itemCount <= 0) return 0
  const budget = batchAuditTokenBudgets[auditType]
  const perItem = estimateLlmCostUsd(
    "openrouter-default",
    budget.inputTokens,
    budget.outputTokens,
  )
  return Math.round(perItem * Math.floor(itemCount) * 1_000_000) / 1_000_000
}
