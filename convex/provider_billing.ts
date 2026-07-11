"use node"

import { v } from "convex/values"

import { internalAction, env } from "./_generated/server"
import { internal } from "./_generated/api"

const DAY_MS = 86_400_000

function getPeriodStart(): number {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return today.getTime()
}

// ---------------------------------------------------------------------------
// OpenRouter reconciliation
// ---------------------------------------------------------------------------

async function fetchOpenRouterCredits(): Promise<{ credits: number | null }> {
  const apiKey = env.OPENROUTER_API_KEY
  if (!apiKey) return { credits: null }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: { authorization: `Bearer ${apiKey}` },
    })
    if (!response.ok) return { credits: null }
    const data = (await response.json()) as { data?: { total_credits?: number; total_usage?: number } }
    return {
      credits: typeof data.data?.total_credits === "number" ? data.data.total_credits : null,
    }
  } catch {
    return { credits: null }
  }
}

// ---------------------------------------------------------------------------
// Firecrawl reconciliation
// ---------------------------------------------------------------------------

async function fetchFirecrawlCredits(): Promise<{ credits: number | null }> {
  const apiKey = env.FIRECRAWL_API_KEY
  if (!apiKey) return { credits: null }

  try {
    const response = await fetch("https://api.firecrawl.dev/v1/team/credit-usage", {
      headers: { authorization: `Bearer ${apiKey}` },
    })
    if (!response.ok) return { credits: null }
    const data = (await response.json()) as { data?: { remainingCredits?: number } }
    return {
      credits: typeof data.data?.remainingCredits === "number" ? data.data.remainingCredits : null,
    }
  } catch {
    return { credits: null }
  }
}

// ---------------------------------------------------------------------------
// Cron action: reconcile all providers
// ---------------------------------------------------------------------------

export const reconcileProviderCosts = internalAction({
  args: {},
  handler: async (ctx) => {
    const periodEnd = getPeriodStart()
    const periodStart = periodEnd - DAY_MS

    for (const provider of ["openrouter" as const, "firecrawl" as const]) {
      const mappedProvider = provider === "openrouter" ? "other" : "firecrawl"

      const spendResult: { calculatedSpendUsd: number } = await ctx.runMutation(
        internal.provider_billing_state._calculateProviderSpend,
        { provider: mappedProvider, periodStart, periodEnd },
      )

      let creditBalance: number | undefined
      let source: "provider_api" | "unavailable" = "unavailable"

      if (provider === "openrouter") {
        const { credits } = await fetchOpenRouterCredits()
        if (credits !== null) {
          creditBalance = credits
          source = "provider_api"
        }
      } else if (provider === "firecrawl") {
        const { credits } = await fetchFirecrawlCredits()
        if (credits !== null) {
          creditBalance = credits
          source = "provider_api"
        }
      }

      await ctx.runMutation(internal.provider_billing_state._saveBillingSnapshot, {
        provider: mappedProvider,
        periodStart,
        periodEnd,
        calculatedSpendUsd: spendResult.calculatedSpendUsd,
        ...(creditBalance !== undefined ? { creditBalance } : {}),
        source,
      })
    }

    return { reconciled: true }
  },
})
