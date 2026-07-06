import { ConvexError, v } from "convex/values"

import { internalQuery, mutation, query } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { parseBrandingInput } from "../src/lib/branding-validation"
import {
  DEFAULT_WORKSPACE_ACCENT,
  DEFAULT_WORKSPACE_CTA_TEXT,
  defaultWorkspaceName,
  ensureAppUser,
  getWorkspaceByOwner,
  requireOwnerWorkspace,
} from "./lib/workspace"
import {
  ensureWorkspaceCreditBalance,
  getWorkspaceCreditBalance,
  getWorkspaceCreditSnapshot,
} from "./lib/credits"

function optionalStorageId(value: string | null): Id<"_storage"> | undefined {
  return value ? (value as Id<"_storage">) : undefined
}

export const ensureCurrentWorkspace = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await ensureAppUser(ctx)
    const existing = await getWorkspaceByOwner(ctx, user.userId)
    if (existing) {
      await ensureWorkspaceCreditBalance(ctx, existing._id, user.userId)
      return {
        workspaceId: existing._id,
        userId: user.userId,
        credits: getWorkspaceCreditSnapshot(
          await getWorkspaceCreditBalance(ctx, existing._id),
        ),
      }
    }

    const now = Date.now()
    const workspaceId = await ctx.db.insert("workspaces", {
      name: defaultWorkspaceName(user),
      ownerUserId: user.userId,
      accentColor: DEFAULT_WORKSPACE_ACCENT,
      contactEmail: user.email,
      ctaText: DEFAULT_WORKSPACE_CTA_TEXT,
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

    await ensureWorkspaceCreditBalance(ctx, workspaceId, user.userId)

    return {
      workspaceId,
      userId: user.userId,
      credits: getWorkspaceCreditSnapshot(
        await getWorkspaceCreditBalance(ctx, workspaceId),
      ),
    }
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
      userId: user.userId,
      workspaceId: workspace._id,
      user: {
        email: user.email,
        name: user.name ?? null,
      },
      workspace: {
        _id: workspace._id,
        name: workspace.name,
        logoStorageId: workspace.logoStorageId ?? null,
        logoUrl,
        accentColor: workspace.accentColor ?? DEFAULT_WORKSPACE_ACCENT,
        website: workspace.website ?? "",
        contactEmail: workspace.contactEmail ?? "",
        ctaText: workspace.ctaText ?? "",
        ctaUrl: workspace.ctaUrl ?? "",
        reportLanguage: workspace.reportLanguage,
        updatedAt: workspace.updatedAt,
      },
      credits: getWorkspaceCreditSnapshot(await getWorkspaceCreditBalance(ctx, workspace._id)),
    }
  },
})

export const getWorkspaceAuditContext = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId)
    if (!workspace) {
      return null
    }

    return {
      workspaceId: workspace._id,
      userId: workspace.ownerUserId,
      credits: getWorkspaceCreditSnapshot(
        await getWorkspaceCreditBalance(ctx, workspace._id),
      ),
    }
  },
})

export const getWorkspaceAuditContextByOwner = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", args.userId))
      .unique()
    if (!workspace) {
      return null
    }

    return {
      workspaceId: workspace._id,
      userId: args.userId,
      credits: getWorkspaceCreditSnapshot(
        await getWorkspaceCreditBalance(ctx, workspace._id),
      ),
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
      accentColor: workspace.accentColor ?? DEFAULT_WORKSPACE_ACCENT,
      website: workspace.website ?? null,
      contactEmail: workspace.contactEmail ?? null,
      ctaText: workspace.ctaText ?? null,
      ctaUrl: workspace.ctaUrl ?? null,
      reportLanguage: workspace.reportLanguage,
    }
  },
})
