import { ConvexError } from "convex/values"

import type { Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { authComponent } from "../auth"
import type { SubscriptionPlan } from "./rate_limit_helpers"

export const DEFAULT_WORKSPACE_ACCENT = "#5b5bd6"
export const DEFAULT_WORKSPACE_CTA_TEXT = "Kostenloses Erstgespräch buchen"

export type AuthenticatedUser = {
  userId: Id<"users">
  tokenIdentifier: string
  email: string
  name?: string
}

export async function requireAuthenticatedUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" })
  }

  const authUser = await authComponent.getAuthUser(ctx)
  if (!authUser?.email) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" })
  }

  return {
    identity,
    authUser,
    email: authUser.email,
    name: authUser.name ?? identity.name ?? undefined,
    betterAuthUserId: authUser._id,
    tokenIdentifier: identity.tokenIdentifier,
  }
}

export async function findAppUser(ctx: QueryCtx | MutationCtx, tokenIdentifier: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique()
}

export async function ensureAppUser(ctx: MutationCtx): Promise<AuthenticatedUser> {
  const auth = await requireAuthenticatedUser(ctx)
  const now = Date.now()
  const existing = await findAppUser(ctx, auth.tokenIdentifier)

  if (existing) {
    await ctx.db.patch(existing._id, {
      betterAuthUserId: auth.betterAuthUserId,
      email: auth.email,
      name: auth.name,
      lastSeenAt: now,
    })
    return {
      userId: existing._id,
      tokenIdentifier: auth.tokenIdentifier,
      email: auth.email,
      name: auth.name,
    }
  }

  const userId = await ctx.db.insert("users", {
    tokenIdentifier: auth.tokenIdentifier,
    betterAuthUserId: auth.betterAuthUserId,
    email: auth.email,
    name: auth.name,
    createdAt: now,
    lastSeenAt: now,
  })

  return {
    userId,
    tokenIdentifier: auth.tokenIdentifier,
    email: auth.email,
    name: auth.name,
  }
}

export async function requireExistingAppUser(ctx: QueryCtx): Promise<AuthenticatedUser> {
  const auth = await requireAuthenticatedUser(ctx)
  const user = await findAppUser(ctx, auth.tokenIdentifier)
  if (!user) {
    throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
  }
  return {
    userId: user._id,
    tokenIdentifier: auth.tokenIdentifier,
    email: auth.email,
    name: auth.name,
  }
}

export async function getWorkspaceByOwner(ctx: QueryCtx | MutationCtx, ownerUserId: Id<"users">) {
  return await ctx.db
    .query("workspaces")
    .withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", ownerUserId))
    .unique()
}

export async function getWorkspacePlan(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
): Promise<SubscriptionPlan> {
  const active = await ctx.db
    .query("subscriptions")
    .withIndex("by_workspaceId_and_status", (q) =>
      q.eq("workspaceId", workspaceId).eq("status", "active"),
    )
    .first()
  if (active) return active.plan

  const trialing = await ctx.db
    .query("subscriptions")
    .withIndex("by_workspaceId_and_status", (q) =>
      q.eq("workspaceId", workspaceId).eq("status", "trialing"),
    )
    .first()
  return (trialing?.plan ?? "free") as SubscriptionPlan
}

export async function requireOwnerWorkspace(ctx: QueryCtx) {
  const user = await requireExistingAppUser(ctx)
  const workspace = await getWorkspaceByOwner(ctx, user.userId)
  if (!workspace) {
    throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
  }
  return { user, workspace }
}

export function defaultWorkspaceName(user: AuthenticatedUser) {
  if (user.name?.trim()) return `${user.name.trim()} Workspace`
  const local = user.email.split("@")[0]
  return `${local || "SitePitch"} Workspace`
}
