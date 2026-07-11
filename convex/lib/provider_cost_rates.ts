export const PROVIDER_COST_RATE_VERSION = "2026-07-11"

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
