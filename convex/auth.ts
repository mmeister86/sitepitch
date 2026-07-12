import { createClient, type GenericCtx } from "@convex-dev/better-auth"
import { convex } from "@convex-dev/better-auth/plugins"
import { betterAuth } from "better-auth"
import { APIError } from "better-auth/api"

import { components, internal } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"
import { env, query } from "./_generated/server"
import authConfig from "./auth.config"

export const authComponent = createClient<DataModel>(components.betterAuth)

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          if (!("runQuery" in ctx)) {
            throw new APIError("INTERNAL_SERVER_ERROR", { message: "Account deletion is unavailable" })
          }
          const result: { allowed: boolean; reason?: "ACTIVE_SUBSCRIPTION" } = await ctx.runQuery(
            internal.deletion.checkAccountDeletionAllowed,
            { betterAuthUserId: user.id },
          )
          if (!result.allowed) {
            throw new APIError("BAD_REQUEST", {
              message: "Cancel the active subscription before deleting this account",
            })
          }
          if (!("runMutation" in ctx)) {
            throw new APIError("INTERNAL_SERVER_ERROR", { message: "Account deletion is unavailable" })
          }
          await ctx.runMutation(internal.deletion.prepareWorkspaceDeletionForAuthUser, {
            betterAuthUserId: user.id,
          })
        },
        afterDelete: async (user) => {
          if (!("runMutation" in ctx)) {
            console.error("Account cleanup could not be started: mutation context unavailable")
            return
          }
          try {
            await ctx.runMutation(internal.deletion.startWorkspaceDeletionForAuthUser, {
              betterAuthUserId: user.id,
            })
          } catch (error) {
            // beforeDelete persisted a pending job; the retry cron is the durable backstop.
            console.error("Account cleanup scheduling failed", error)
          }
        },
      },
    },
    plugins: [convex({ authConfig })],
  })

export const getAuthUser = query({
  args: {},
  handler: async (ctx) => {
    return await authComponent.getAuthUser(ctx)
  },
})
