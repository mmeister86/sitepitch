import { defineApp } from "convex/server"
import { v } from "convex/values"
import betterAuth from "@convex-dev/better-auth/convex.config"
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js"
import workpool from "@convex-dev/workpool/convex.config.js"
import migrations from "@convex-dev/migrations/convex.config.js"

const app = defineApp({
  env: {
    BETTER_AUTH_SECRET: v.string(),
    BETTER_AUTH_URL: v.string(),
    PAGESPEED_API_KEY: v.optional(v.string()),
    PAGESPEED_TIMEOUT_MS: v.optional(v.string()),
    LOCAL_BUSINESS_DATA_API_KEY: v.optional(v.string()),
    GOOGLE_PLACES_API_KEY: v.optional(v.string()),
    FIRECRAWL_API_KEY: v.optional(v.string()),
    FIRECRAWL_API_BASE_URL: v.optional(v.string()),
    OPENROUTER_API_KEY: v.optional(v.string()),
    OPENROUTER_MODEL: v.optional(v.string()),
    SITE_URL: v.optional(v.string()),
    EVE_AGENT_URL: v.optional(v.string()),
    EVE_AGENT_MODEL: v.optional(v.string()),
    TURNSTILE_SECRET_KEY: v.optional(v.string()),
    SUPPORT_ADMIN_EMAILS: v.optional(v.string()),
    PROVIDER_COST_ALERT_USD: v.optional(v.string()),
    PROVIDER_COST_ALERT_PERCENT: v.optional(v.string()),
    LEMONSQUEEZY_API_KEY: v.optional(v.string()),
    LEMONSQUEEZY_STORE_ID: v.optional(v.string()),
    LEMONSQUEEZY_WEBHOOK_SECRET: v.optional(v.string()),
    LEMONSQUEEZY_TEST_MODE: v.optional(v.string()),
    LEMONSQUEEZY_STARTER_VARIANT_ID: v.optional(v.string()),
    LEMONSQUEEZY_PRO_VARIANT_ID: v.optional(v.string()),
    LEMONSQUEEZY_AGENCY_VARIANT_ID: v.optional(v.string()),
    LEMONSQUEEZY_CREDIT_PACK_VARIANT_ID: v.optional(v.string()),
  },
})

app.use(betterAuth)
app.use(migrations)
app.use(rateLimiter)
app.use(workpool, { name: "auditWorkpool" })
app.use(workpool, { name: "batchAuditWorkpool" })
app.use(workpool, { name: "providerWorkpool" })
app.use(workpool, { name: "llmWorkpool" })
app.use(workpool, { name: "pdfWorkpool" })

export default app
