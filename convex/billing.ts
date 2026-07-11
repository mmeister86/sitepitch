import { ConvexError, v } from "convex/values"

import { internal } from "./_generated/api"
import { env, action, internalMutation, internalQuery, query } from "./_generated/server"
import {
  CREDIT_PACK_SIZE,
  isCreditPackVariant,
  parseTimestamp,
  planForVariant,
  type LemonVariantConfig,
  type PaidPlan,
} from "./lib/lemonsqueezy"
import { getWorkspaceCreditBalance } from "./lib/credits"
import { requireOwnerWorkspace } from "./lib/workspace"

const paidPlanValidator = v.union(v.literal("starter"), v.literal("pro"), v.literal("agency"))
const MONTHLY_CREDITS: Record<PaidPlan, number> = { starter: 25, pro: 100, agency: 300 }

function variants(): LemonVariantConfig {
  return {
    starter: env.LEMONSQUEEZY_STARTER_VARIANT_ID,
    pro: env.LEMONSQUEEZY_PRO_VARIANT_ID,
    agency: env.LEMONSQUEEZY_AGENCY_VARIANT_ID,
    creditPack: env.LEMONSQUEEZY_CREDIT_PACK_VARIANT_ID,
  }
}

function required(value: string | undefined, name: string) {
  if (!value) throw new ConvexError({ code: "BILLING_NOT_CONFIGURED", message: `${name} is not configured` })
  return value
}

export const getBillingContext = internalQuery({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", args.tokenIdentifier)).unique()
    if (!user) return null
    const workspace = await ctx.db.query("workspaces").withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", user._id)).unique()
    if (!workspace) return null
    const subscription = await ctx.db.query("subscriptions").withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspace._id)).order("desc").first()
    return { workspaceId: workspace._id, email: user.email, customerId: subscription?.providerCustomerId }
  },
})

export const createCheckout = action({
  args: { kind: v.union(paidPlanValidator, v.literal("credit_pack")) },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" })
    const context = await ctx.runQuery(internal.billing.getBillingContext, { tokenIdentifier: identity.tokenIdentifier })
    if (!context) throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })

    const selected = args.kind === "credit_pack" ? variants().creditPack : variants()[args.kind]
    const variantId = required(selected, `Lemon Squeezy ${args.kind} variant`)
    const siteUrl = required(env.SITE_URL, "Site URL").replace(/\/$/, "")
    const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${required(env.LEMONSQUEEZY_API_KEY, "Lemon Squeezy API key")}`,
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            checkout_data: {
              email: context.email,
              custom: { workspace_id: context.workspaceId },
            },
            product_options: {
              redirect_url: `${siteUrl}/app/settings/billing?checkout=success`,
              enabled_variants: [Number(variantId)],
            },
          },
          relationships: {
            store: { data: { type: "stores", id: required(env.LEMONSQUEEZY_STORE_ID, "Lemon Squeezy store ID") } },
            variant: { data: { type: "variants", id: variantId } },
          },
        },
      }),
    })
    if (!response.ok) throw new ConvexError({ code: "CHECKOUT_FAILED", message: `Checkout request failed (${response.status})` })
    const payload = (await response.json()) as { data?: { attributes?: { url?: string } } }
    const url = payload.data?.attributes?.url
    if (!url) throw new ConvexError({ code: "CHECKOUT_FAILED", message: "Checkout URL missing" })
    return { url }
  },
})

export const getPortal = query({
  args: {},
  handler: async (ctx) => {
    const { workspace } = await requireOwnerWorkspace(ctx)
    const subscription = await ctx.db.query("subscriptions").withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspace._id)).order("desc").first()
    return { url: subscription?.customerPortalUrl ?? null }
  },
})

type LemonPayload = {
  meta?: { event_name?: string; test_mode?: boolean; custom_data?: { workspace_id?: string } }
  data?: { id?: string; attributes?: Record<string, unknown> }
}

export const processWebhook = internalMutation({
  args: { providerEventId: v.string(), payload: v.string() },
  handler: async (ctx, args) => {
    const duplicate = await ctx.db.query("billingEvents").withIndex("by_provider_and_providerEventId", (q) => q.eq("provider", "lemonsqueezy").eq("providerEventId", args.providerEventId)).unique()
    if (duplicate) return { duplicate: true }

    const payload = JSON.parse(args.payload) as LemonPayload
    const eventName = payload.meta?.event_name ?? "unknown"
    const attributes = payload.data?.attributes ?? {}
    const providerId = payload.data?.id
    const firstOrderItem = typeof attributes.first_order_item === "object" && attributes.first_order_item
      ? attributes.first_order_item as Record<string, unknown>
      : undefined
    const variantId = String(attributes.variant_id ?? firstOrderItem?.variant_id ?? "")
    const workspaceIdValue = payload.meta?.custom_data?.workspace_id
    const workspaceId = workspaceIdValue ? ctx.db.normalizeId("workspaces", workspaceIdValue) : null
    const workspace = workspaceId ? await ctx.db.get("workspaces", workspaceId) : null
    const occurredAt = parseTimestamp(attributes.updated_at ?? attributes.created_at)
    const baseEvent = {
      provider: "lemonsqueezy" as const,
      providerEventId: args.providerEventId,
      eventName,
      workspaceId: workspace?._id,
      providerOrderId: eventName === "order_created" ? providerId : undefined,
      providerSubscriptionId: eventName.startsWith("subscription_") ? providerId : String(attributes.subscription_id ?? "") || undefined,
      providerVariantId: variantId || undefined,
      testMode: payload.meta?.test_mode ?? false,
      occurredAt,
      processedAt: Date.now(),
    }

    const configuredTestMode = env.LEMONSQUEEZY_TEST_MODE === "true"
    if ((payload.meta?.test_mode ?? false) !== configuredTestMode) {
      await ctx.db.insert("billingEvents", { ...baseEvent, status: "ignored", reason: "test_mode_mismatch" })
      return { duplicate: false, processed: false }
    }

    if (!workspace) {
      await ctx.db.insert("billingEvents", { ...baseEvent, status: "ignored", reason: "workspace_not_found" })
      return { duplicate: false, processed: false }
    }

    if (eventName === "order_created") {
      const isPaid = attributes.status === "paid"
      if (!isPaid || !isCreditPackVariant(variantId, variants())) {
        await ctx.db.insert("billingEvents", { ...baseEvent, status: "ignored", reason: isPaid ? "unknown_variant" : "order_not_paid" })
        return { duplicate: false, processed: false }
      }
      const priorOrder = providerId
        ? await ctx.db
            .query("billingEvents")
            .withIndex("by_providerOrderId", (q) => q.eq("providerOrderId", providerId))
            .first()
        : null
      if (priorOrder) {
        await ctx.db.insert("billingEvents", { ...baseEvent, status: "ignored", reason: "duplicate_order" })
        return { duplicate: false, processed: false }
      }
      let balance = await getWorkspaceCreditBalance(ctx, workspace._id)
      const now = Date.now()
      if (!balance) {
        const id = await ctx.db.insert("creditBalances", { workspaceId: workspace._id, periodStart: now, periodEnd: now, monthlyCredits: 0, extraCredits: CREDIT_PACK_SIZE, usedMonthlyCredits: 0, usedExtraCredits: 0, reservedCredits: 0, updatedAt: now })
        balance = await ctx.db.get(id)
      } else {
        await ctx.db.patch(balance._id, { extraCredits: balance.extraCredits + CREDIT_PACK_SIZE, updatedAt: now })
      }
      await ctx.db.insert("creditLedger", { workspaceId: workspace._id, type: "grant", amount: CREDIT_PACK_SIZE, balanceScope: "extra", idempotencyKey: `lemonsqueezy:order:${providerId}`, reason: "credit_pack_purchase", createdAt: now })
      await ctx.db.insert("billingEvents", { ...baseEvent, status: "processed" })
      return { duplicate: false, processed: true }
    }

    if (eventName === "subscription_payment_success" || eventName === "subscription_payment_failed") {
      await ctx.db.insert("billingEvents", {
        ...baseEvent,
        status: "processed",
        reason: eventName === "subscription_payment_failed" ? "payment_failed" : "payment_succeeded",
      })
      return { duplicate: false, processed: true }
    }

    if (eventName.startsWith("subscription_") && providerId) {
      const plan = planForVariant(variantId, variants())
      if (!plan) {
        await ctx.db.insert("billingEvents", { ...baseEvent, status: "ignored", reason: "unknown_variant" })
        return { duplicate: false, processed: false }
      }
      const statusValue = String(attributes.status ?? "expired")
      const status = (["active", "trialing", "past_due", "cancelled", "expired"] as const).find((item) => item === statusValue) ?? "expired"
      const existing = await ctx.db.query("subscriptions").withIndex("by_provider_and_providerSubscriptionId", (q) => q.eq("provider", "lemonsqueezy").eq("providerSubscriptionId", providerId)).unique()
      const providerUpdatedAt = occurredAt ?? Date.now()
      if (existing?.providerUpdatedAt && existing.providerUpdatedAt > providerUpdatedAt) {
        await ctx.db.insert("billingEvents", { ...baseEvent, status: "ignored", reason: "stale_event" })
        return { duplicate: false, processed: false }
      }
      const currentPeriodStart = parseTimestamp(attributes.current_period_start ?? attributes.created_at)
      const currentPeriodEnd = parseTimestamp(attributes.current_period_end ?? attributes.renews_at ?? attributes.ends_at)
      const values = {
        providerCustomerId: String(attributes.customer_id ?? "") || undefined,
        providerSubscriptionId: providerId,
        providerVariantId: variantId,
        customerPortalUrl: typeof attributes.urls === "object" && attributes.urls ? String((attributes.urls as Record<string, unknown>).customer_portal ?? "") || undefined : undefined,
        plan: plan as PaidPlan,
        status,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: Boolean(attributes.cancelled),
        providerUpdatedAt,
        updatedAt: Date.now(),
      }
      let subscriptionId = existing?._id
      if (existing) await ctx.db.patch(existing._id, values)
      else subscriptionId = await ctx.db.insert("subscriptions", { workspaceId: workspace._id, provider: "lemonsqueezy", ...values, createdAt: Date.now() })

      if ((status === "active" || status === "trialing") && currentPeriodEnd) {
        const grantKey = `lemonsqueezy:subscription:${providerId}:period:${currentPeriodEnd}`
        const priorGrant = await ctx.db.query("creditLedger").withIndex("by_workspaceId_and_idempotencyKey", (q) => q.eq("workspaceId", workspace._id).eq("idempotencyKey", grantKey)).unique()
        if (!priorGrant) {
          const amount = MONTHLY_CREDITS[plan]
          const now = Date.now()
          const balance = await getWorkspaceCreditBalance(ctx, workspace._id)
          const periodStart = currentPeriodStart ?? now
          if (balance) {
            const samePeriod = balance.periodEnd === currentPeriodEnd
            await ctx.db.patch(balance._id, {
              periodStart,
              periodEnd: currentPeriodEnd,
              monthlyCredits: amount,
              usedMonthlyCredits: samePeriod ? balance.usedMonthlyCredits : 0,
              updatedAt: now,
            })
          } else {
            await ctx.db.insert("creditBalances", { workspaceId: workspace._id, periodStart, periodEnd: currentPeriodEnd, monthlyCredits: amount, extraCredits: 0, usedMonthlyCredits: 0, usedExtraCredits: 0, reservedCredits: 0, updatedAt: now })
          }
          await ctx.db.insert("creditLedger", { workspaceId: workspace._id, subscriptionId, type: "grant", amount, balanceScope: "monthly", idempotencyKey: grantKey, reason: "subscription_period_grant", createdAt: now })
        }
      }
      await ctx.db.insert("billingEvents", { ...baseEvent, status: "processed" })
      return { duplicate: false, processed: true }
    }

    await ctx.db.insert("billingEvents", { ...baseEvent, status: "ignored", reason: "unsupported_event" })
    return { duplicate: false, processed: false }
  },
})
