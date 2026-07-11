import { ConvexError } from "convex/values"

import type { Id } from "../_generated/dataModel"
import { env, type QueryCtx } from "../_generated/server"
import { findAppUser } from "./workspace"

export interface SupportAdminUser {
  userId: Id<"users">
  email: string
}

function getSupportAdminEmails(): Set<string> {
  const raw = env.SUPPORT_ADMIN_EMAILS
  if (!raw) return new Set()
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  )
}

export async function isSupportAdmin(ctx: QueryCtx): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return false

  const user = await findAppUser(ctx, identity.tokenIdentifier)
  if (!user) return false

  const allowlist = getSupportAdminEmails()
  return allowlist.has(user.email.toLowerCase())
}

export async function requireSupportAdmin(ctx: QueryCtx): Promise<SupportAdminUser> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" })
  }

  const user = await findAppUser(ctx, identity.tokenIdentifier)
  if (!user) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" })
  }

  const allowlist = getSupportAdminEmails()
  if (!allowlist.has(user.email.toLowerCase())) {
    throw new ConvexError({ code: "FORBIDDEN", message: "Support access denied" })
  }

  return { userId: user._id, email: user.email }
}
