import { ConvexError, v } from "convex/values"

import { internalQuery, mutation, query } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { parseBrandingInput } from "../src/lib/branding-validation"
import {
  DEFAULT_WORKSPACE_ACCENT,
  DEFAULT_WORKSPACE_CTA_TEXT,
  defaultWorkspaceName,
  ensureAppUser,
  getWorkspaceByOwner,
  getWorkspacePlan,
  requireOwnerWorkspace,
} from "./lib/workspace"
import {
  ensureWorkspaceCreditBalance,
  getWorkspaceCreditBalance,
  getWorkspaceCreditSnapshot,
} from "./lib/credits"

const ALLOWED_LOGO_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])
const MAX_LOGO_BYTES = 2 * 1024 * 1024
export const RETENTION_POLICY_VERSION = "2026-07-11"

async function ensureSignedUpEvent(
  ctx: MutationCtx,
  workspace: { _id: Id<"workspaces">; ownerUserId: Id<"users">; createdAt: number },
) {
  const idempotencyKey = `signed_up:${workspace._id}`
  const existing = await ctx.db
    .query("usageEvents")
    .withIndex("by_workspaceId_and_idempotencyKey", (q) =>
      q.eq("workspaceId", workspace._id).eq("idempotencyKey", idempotencyKey),
    )
    .unique()
  if (existing) return existing._id
  return await ctx.db.insert("usageEvents", {
    workspaceId: workspace._id,
    userId: workspace.ownerUserId,
    event: "signed_up",
    idempotencyKey,
    createdAt: workspace.createdAt,
  })
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
      await ensureSignedUpEvent(ctx, existing)
      await ensureWorkspaceCreditBalance(ctx, existing._id, user.userId)
      return {
        workspaceId: existing._id,
        userId: user.userId,
        plan: await getWorkspacePlan(ctx, existing._id),
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
      retentionMode: "standard",
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

    await ensureSignedUpEvent(ctx, {
      _id: workspaceId,
      ownerUserId: user.userId,
      createdAt: now,
    })

    await ctx.db.insert("usageEvents", {
      workspaceId,
      userId: user.userId,
      event: "workspace_created",
      idempotencyKey: `workspace_created:${workspaceId}`,
      createdAt: now,
    })

    return {
      workspaceId,
      userId: user.userId,
      plan: await getWorkspacePlan(ctx, workspaceId),
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
    const plan = await getWorkspacePlan(ctx, workspace._id)
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspace._id))
      .order("desc")
      .first()
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
        retentionMode: workspace.retentionMode ?? "standard",
        retentionConsentAt: workspace.retentionConsentAt ?? null,
        retentionPolicyVersion: workspace.retentionPolicyVersion ?? null,
        updatedAt: workspace.updatedAt,
        createdAt: workspace.createdAt,
      },
      credits: getWorkspaceCreditSnapshot(await getWorkspaceCreditBalance(ctx, workspace._id)),
      plan,
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd ?? null,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
          }
        : null,
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
      plan: await getWorkspacePlan(ctx, workspace._id),
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
      plan: await getWorkspacePlan(ctx, workspace._id),
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

    const nextLogoStorageId = optionalStorageId(parsed.value.logoStorageId)
    if (nextLogoStorageId && nextLogoStorageId !== workspace.logoStorageId) {
      const confirmed = await ctx.db
        .query("logoUploads")
        .withIndex("by_storageId", (q) => q.eq("storageId", nextLogoStorageId))
        .unique()
      if (!confirmed || confirmed.workspaceId !== workspace._id) {
        throw new ConvexError({
          code: "INVALID_LOGO_UPLOAD",
          message: "Logo upload is not owned by this workspace",
        })
      }
    }

    await ctx.db.patch(workspace._id, {
      name: parsed.value.name,
      logoStorageId: nextLogoStorageId,
      accentColor: parsed.value.accentColor,
      website: parsed.value.website ?? undefined,
      contactEmail: parsed.value.contactEmail ?? undefined,
      ctaText: parsed.value.ctaText ?? undefined,
      ctaUrl: parsed.value.ctaUrl ?? undefined,
      reportLanguage: parsed.value.reportLanguage,
      brandingCompletedAt: workspace.brandingCompletedAt ?? Date.now(),
      updatedAt: Date.now(),
    })

    if (workspace.logoStorageId && workspace.logoStorageId !== nextLogoStorageId) {
      await ctx.storage.delete(workspace.logoStorageId)
      const previousUpload = await ctx.db
        .query("logoUploads")
        .withIndex("by_storageId", (q) => q.eq("storageId", workspace.logoStorageId!))
        .unique()
      if (previousUpload) await ctx.db.delete(previousUpload._id)
    }

    if (!workspace.brandingCompletedAt) {
      await ctx.db.insert("usageEvents", {
        workspaceId: workspace._id,
        userId: user.userId,
        event: "branding_completed",
        idempotencyKey: `branding_completed:${workspace._id}`,
        metadata: { report_language: parsed.value.reportLanguage },
        createdAt: Date.now(),
      })
    }

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

export const confirmLogoUpload = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const { workspace } = await requireOwnerWorkspace(ctx)
    const metadata = await ctx.db.system.get("_storage", args.storageId)
    if (!metadata) {
      throw new ConvexError({ code: "UPLOAD_NOT_FOUND", message: "Logo upload not found" })
    }
    const contentType = metadata.contentType ?? ""
    if (!ALLOWED_LOGO_CONTENT_TYPES.has(contentType) || metadata.size > MAX_LOGO_BYTES) {
      await ctx.storage.delete(args.storageId)
      return { storageId: null, error: "INVALID_LOGO_UPLOAD" as const }
    }
    const existing = await ctx.db
      .query("logoUploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .unique()
    if (existing && existing.workspaceId !== workspace._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Logo upload belongs to another workspace" })
    }
    if (!existing) {
      await ctx.db.insert("logoUploads", {
        workspaceId: workspace._id,
        storageId: args.storageId,
        contentType,
        size: metadata.size,
        createdAt: Date.now(),
      })
    }
    return { storageId: args.storageId, error: null }
  },
})

export const setRetentionPreference = mutation({
  args: {
    mode: v.union(v.literal("standard"), v.literal("extended")),
    policyVersion: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, workspace } = await requireOwnerWorkspace(ctx)
    const policyVersion = args.policyVersion.trim()
    if (policyVersion !== RETENTION_POLICY_VERSION) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Invalid retention policy version" })
    }
    const now = Date.now()
    await ctx.db.patch(workspace._id, {
      retentionMode: args.mode,
      retentionConsentAt: args.mode === "extended" ? now : undefined,
      retentionPolicyVersion: policyVersion,
      updatedAt: now,
    })
    await ctx.db.insert("retentionPreferenceEvents", {
      workspaceId: workspace._id,
      userId: user.userId,
      mode: args.mode,
      policyVersion,
      createdAt: now,
    })
    return {
      mode: args.mode,
      consentAt: args.mode === "extended" ? now : null,
      policyVersion,
    }
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
    if (workspace.logoStorageId) {
      await ctx.storage.delete(workspace.logoStorageId)
      const upload = await ctx.db
        .query("logoUploads")
        .withIndex("by_storageId", (q) => q.eq("storageId", workspace.logoStorageId!))
        .unique()
      if (upload) await ctx.db.delete(upload._id)
    }
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
