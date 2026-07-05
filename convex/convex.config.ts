import { defineApp } from "convex/server"
import { v } from "convex/values"
import betterAuth from "@convex-dev/better-auth/convex.config"

const app = defineApp({
  env: {
    BETTER_AUTH_SECRET: v.string(),
    BETTER_AUTH_URL: v.string(),
    SITE_URL: v.optional(v.string()),
  },
})

app.use(betterAuth)

export default app
