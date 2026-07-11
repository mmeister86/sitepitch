import { PROVIDER_COST_RATE_VERSION, providerCostRates } from "./provider_cost_rates"

export type CostSource = "provider_response" | "generation_lookup" | "estimated" | "zero_cost"

export interface ProviderCostInput {
  workspaceId: string
  auditId?: string
  providerCallId?: string
  costKey: string
  provider: string
  operation: string
  model?: string
  providerRequestId?: string
  actualCostUsd?: number
  tokensIn?: number
  tokensOut?: number
  requestCount?: number
}

export interface ProviderCostRecord extends ProviderCostInput {
  source: CostSource
  pricingVersion?: string
  estimatedCostUsd?: number
}

export function buildZeroCost(input: ProviderCostInput): ProviderCostRecord {
  return {
    ...input,
    source: "zero_cost",
    actualCostUsd: 0,
  }
}

export function buildEstimatedCost(
  input: ProviderCostInput,
  rateUsd: number,
): ProviderCostRecord {
  return {
    ...input,
    source: "estimated",
    estimatedCostUsd: rateUsd,
    pricingVersion: PROVIDER_COST_RATE_VERSION,
  }
}

export function buildProviderResponseCost(
  input: ProviderCostInput,
  actualCostUsd: number,
): ProviderCostRecord {
  return {
    ...input,
    source: "provider_response",
    actualCostUsd,
  }
}

export function buildGenerationLookupCost(
  input: ProviderCostInput,
  actualCostUsd: number,
  providerRequestId: string,
): ProviderCostRecord {
  return {
    ...input,
    source: "generation_lookup",
    actualCostUsd,
    providerRequestId,
  }
}

export function estimateFirecrawlCost(
  input: ProviderCostInput,
  operation: string,
): ProviderCostRecord {
  const rates = providerCostRates.firecrawl
  let rateUsd: number

  if (operation.includes("screenshot")) {
    rateUsd = rates.screenshotUsd
  } else if (operation.includes("map")) {
    rateUsd = rates.mapSiteUsd
  } else if (operation.includes("priority_page") || operation.includes("fetch_priority")) {
    rateUsd = rates.scrapePriorityPageUsd
  } else {
    rateUsd = rates.scrapeHomepageUsd
  }

  return buildEstimatedCost(input, rateUsd)
}

export function estimatePageSpeedCost(
  input: ProviderCostInput,
): ProviderCostRecord {
  return buildZeroCost(input)
}

export function estimateDirectHtmlCost(
  input: ProviderCostInput,
): ProviderCostRecord {
  return buildZeroCost(input)
}
