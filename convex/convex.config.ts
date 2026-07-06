import { defineApp } from "convex/server"
import { v } from "convex/values"
import betterAuth from "@convex-dev/better-auth/convex.config"
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js"

const app = defineApp({
  env: {
    BETTER_AUTH_SECRET: v.string(),
    BETTER_AUTH_URL: v.string(),
    JINA_API_KEY: v.optional(v.string()),
    SCREENSHOTONE_API_KEY: v.optional(v.string()),
    PAGESPEED_API_KEY: v.optional(v.string()),
    PAGESPEED_TIMEOUT_MS: v.optional(v.string()),
    LOCAL_BUSINESS_DATA_API_KEY: v.optional(v.string()),
    GOOGLE_PLACES_API_KEY: v.optional(v.string()),
    OPENROUTER_API_KEY: v.optional(v.string()),
    SITE_URL: v.optional(v.string()),
    EVE_AGENT_URL: v.optional(v.string()),
    EVE_AGENT_MODEL: v.optional(v.string()),
  },
})

app.use(betterAuth)
app.use(rateLimiter)

export default app
