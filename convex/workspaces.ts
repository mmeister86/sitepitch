import { ConvexError, v } from "convex/values"

import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { authComponent } from "./auth"
import { parseBrandingInput } from "../src/lib/branding-validation"

const DEFAULT_ACCENT = "#5b5bd6"
const DEFAULT_CTA_TEXT = "Kostenloses Erstgespräch buchen"

type AuthenticatedUser = {
  userId: Id<"users">
  tokenIdentifier: string
  email: string
  name?: string
}

async function requireAuthenticatedUser(ctx: QueryCtx | MutationCtx) {
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

async function findAppUser(ctx: QueryCtx | MutationCtx, tokenIdentifier: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique()
}

async function ensureAppUser(ctx: MutationCtx): Promise<AuthenticatedUser> {
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

async function requireExistingAppUser(ctx: QueryCtx): Promise<AuthenticatedUser> {
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

async function getWorkspaceByOwner(ctx: QueryCtx | MutationCtx, ownerUserId: Id<"users">) {
  return await ctx.db
    .query("workspaces")
    .withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", ownerUserId))
    .unique()
}

async function requireOwnerWorkspace(ctx: QueryCtx) {
  const user = await requireExistingAppUser(ctx)
  const workspace = await getWorkspaceByOwner(ctx, user.userId)
  if (!workspace) {
    throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
  }
  return { user, workspace }
}

function defaultWorkspaceName(user: AuthenticatedUser) {
  if (user.name?.trim()) return `${user.name.trim()} Workspace`
  const local = user.email.split("@")[0]
  return `${local || "SitePitch"} Workspace`
}

function optionalStorageId(value: string | null): Id<"_storage"> | undefined {
  return value ? (value as Id<"_storage">) : undefined
}

export const ensureCurrentWorkspace = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await ensureAppUser(ctx)
    const existing = await getWorkspaceByOwner(ctx, user.userId)
    if (existing) {
      return existing._id
    }

    const now = Date.now()
    const workspaceId = await ctx.db.insert("workspaces", {
      name: defaultWorkspaceName(user),
      ownerUserId: user.userId,
      accentColor: DEFAULT_ACCENT,
      contactEmail: user.email,
      ctaText: DEFAULT_CTA_TEXT,
      reportLanguage: "de",
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert("workspaceMembers", {
      workspaceId,
      userId: user.userId,
      role: "owner",
      createdAt: now,
    })

    return workspaceId
  },
})

export const getMyWorkspace = query({
  args: {},
  handler: async (ctx) => {
    const { user, workspace } = await requireOwnerWorkspace(ctx)
    const logoUrl = workspace.logoStorageId
      ? await ctx.storage.getUrl(workspace.logoStorageId)
      : null

    return {
      user: {
        email: user.email,
        name: user.name ?? null,
      },
      workspace: {
        _id: workspace._id,
        name: workspace.name,
        logoStorageId: workspace.logoStorageId ?? null,
        logoUrl,
        accentColor: workspace.accentColor ?? DEFAULT_ACCENT,
        website: workspace.website ?? "",
        contactEmail: workspace.contactEmail ?? "",
        ctaText: workspace.ctaText ?? "",
        ctaUrl: workspace.ctaUrl ?? "",
        reportLanguage: workspace.reportLanguage,
        updatedAt: workspace.updatedAt,
      },
    }
  },
})

export const updateBranding = mutation({
  args: {
    name: v.string(),
    logoStorageId: v.union(v.id("_storage"), v.null()),
    accentColor: v.string(),
    website: v.string(),
    contactEmail: v.string(),
    ctaText: v.string(),
    ctaUrl: v.string(),
    reportLanguage: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ensureAppUser(ctx)
    const workspace = await getWorkspaceByOwner(ctx, user.userId)
    if (!workspace) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }

    const parsed = parseBrandingInput(args)
    if (!parsed.ok) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Invalid branding input",
        fieldErrors: parsed.fieldErrors,
      })
    }

    await ctx.db.patch(workspace._id, {
      name: parsed.value.name,
      logoStorageId: optionalStorageId(parsed.value.logoStorageId),
      accentColor: parsed.value.accentColor,
      website: parsed.value.website ?? undefined,
      contactEmail: parsed.value.contactEmail ?? undefined,
      ctaText: parsed.value.ctaText ?? undefined,
      ctaUrl: parsed.value.ctaUrl ?? undefined,
      reportLanguage: parsed.value.reportLanguage,
      updatedAt: Date.now(),
    })

    return workspace._id
  },
})

export const generateLogoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await ensureAppUser(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

export const clearLogo = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await ensureAppUser(ctx)
    const workspace = await getWorkspaceByOwner(ctx, user.userId)
    if (!workspace) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }
    await ctx.db.patch(workspace._id, {
      logoStorageId: undefined,
      updatedAt: Date.now(),
    })
  },
})

export const getReportBranding = query({
  args: {},
  handler: async (ctx) => {
    const { workspace } = await requireOwnerWorkspace(ctx)
    return {
      name: workspace.name,
      logoUrl: workspace.logoStorageId
        ? await ctx.storage.getUrl(workspace.logoStorageId)
        : null,
      accentColor: workspace.accentColor ?? DEFAULT_ACCENT,
      website: workspace.website ?? null,
      contactEmail: workspace.contactEmail ?? null,
      ctaText: workspace.ctaText ?? null,
      ctaUrl: workspace.ctaUrl ?? null,
      reportLanguage: workspace.reportLanguage,
    }
  },
})
