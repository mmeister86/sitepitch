import { v } from "convex/values"

import { internalMutation } from "./_generated/server"

function now() {
  return Date.now()
}

export const _calculateProviderSpend = internalMutation({
  args: {
    provider: v.string(),
    periodStart: v.number(),
    periodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const costs = await ctx.db
      .query("providerCosts")
      .withIndex("by_createdAt", (q) =>
        q.gte("createdAt", args.periodStart).lt("createdAt", args.periodEnd),
      )
      .take(1000)

    let total = 0
    for (const cost of costs) {
      if (cost.provider !== args.provider) continue
      if (cost.actualCostUsd !== undefined) {
        total += cost.actualCostUsd
      } else if (cost.estimatedCostUsd !== undefined) {
        total += cost.estimatedCostUsd
      }
    }

    return { calculatedSpendUsd: Math.round(total * 1_000_000) / 1_000_000 }
  },
})

export const _saveBillingSnapshot = internalMutation({
  args: {
    provider: v.union(
      v.literal("direct_html"),
      v.literal("jina"),
      v.literal("firecrawl"),
      v.literal("screenshotone"),
      v.literal("pagespeed"),
      v.literal("local_business_data"),
      v.literal("google_places"),
      v.literal("openai"),
      v.literal("anthropic"),
      v.literal("other"),
    ),
    periodStart: v.number(),
    periodEnd: v.number(),
    calculatedSpendUsd: v.number(),
    providerSpendUsd: v.optional(v.number()),
    creditBalance: v.optional(v.number()),
    source: v.union(v.literal("provider_api"), v.literal("unavailable")),
  },
  handler: async (ctx, args) => {
    const idempotencyKey = `billing:${args.provider}:${args.periodStart}`

    const existing = await ctx.db
      .query("providerBillingSnapshots")
      .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
      .first()
    if (existing) return existing._id

    const deltaUsd =
      args.providerSpendUsd !== undefined
        ? Math.round((args.providerSpendUsd - args.calculatedSpendUsd) * 1_000_000) / 1_000_000
        : undefined

    return await ctx.db.insert("providerBillingSnapshots", {
      provider: args.provider,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      providerSpendUsd: args.providerSpendUsd,
      calculatedSpendUsd: args.calculatedSpendUsd,
      deltaUsd,
      creditBalance: args.creditBalance,
      source: args.source,
      idempotencyKey,
      createdAt: now(),
    })
  },
})
