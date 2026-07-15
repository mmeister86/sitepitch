import { v } from "convex/values"

import type { Doc, Id } from "../_generated/dataModel"
import {
  env,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server"
import { findAppUser, getWorkspaceByOwner, getWorkspacePlan } from "./workspace"
import {
  isAllowedReportRequestHost,
  resolveReportPublicUrl,
} from "./report_domain"
import { buildReportSettingsSnapshotValues } from "../report_settings"

type AccessCtx = QueryCtx | MutationCtx

export type ResolvedPublicReportAccess =
  | { status: "unavailable" }
  | {
      status: "password_required"
      audit: Doc<"audits">
      workspace: Doc<"workspaces">
      settings: Doc<"reportSettings">
    }
  | {
      status: "available"
      audit: Doc<"audits">
      workspace: Doc<"workspaces">
      settings: Doc<"reportSettings"> | null
      plan: Awaited<ReturnType<typeof getWorkspacePlan>>
      publicUrl: string
    }

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function hashReportAccessToken(token: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))
}

export async function resolvePublicReportAccess(
  ctx: AccessCtx,
  args: { slug: string; host?: string; grantToken?: string },
): Promise<ResolvedPublicReportAccess> {
  const audit = await ctx.db
    .query("audits")
    .withIndex("by_publicSlug", (q) => q.eq("publicSlug", args.slug))
    .unique()

  if (
    !audit ||
    !audit.isPublic ||
    audit.status !== "completed" ||
    audit.deletionRequestedAt
  ) {
    return { status: "unavailable" }
  }

  const [workspace, settings, domain] = await Promise.all([
    ctx.db.get(audit.workspaceId),
    ctx.db
      .query("reportSettings")
      .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
      .unique(),
    ctx.db
      .query("reportDomains")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", audit.workspaceId))
      .unique(),
  ])
  if (!workspace || workspace.deletionRequestedAt) return { status: "unavailable" }

  const plan = await getWorkspacePlan(ctx, workspace._id)
  if (
    args.host !== undefined &&
    !isAllowedReportRequestHost({
      host: args.host,
      siteUrl: env.SITE_URL,
      plan,
      domain,
    })
  ) {
    return { status: "unavailable" }
  }

  if (settings?.expiresAt !== undefined && settings.expiresAt <= Date.now()) {
    return { status: "unavailable" }
  }

  if (settings?.passwordHash) {
    if (!args.grantToken) {
      return { status: "password_required", audit, workspace, settings }
    }
    const tokenHash = await hashReportAccessToken(args.grantToken)
    const grant = await ctx.db
      .query("reportAccessGrants")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique()
    if (
      !grant ||
      grant.auditId !== audit._id ||
      grant.workspaceId !== workspace._id ||
      grant.accessVersion !== settings.accessVersion ||
      grant.expiresAt <= Date.now()
    ) {
      return { status: "password_required", audit, workspace, settings }
    }
  }

  return {
    status: "available",
    audit,
    workspace,
    settings,
    plan,
    publicUrl: resolveReportPublicUrl({
      siteUrl: env.SITE_URL,
      publicSlug: audit.publicSlug,
      plan,
      domain,
    }),
  }
}

export const getPasswordContext = internalQuery({
  args: {
    slug: v.string(),
    host: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await resolvePublicReportAccess(ctx, args)
    if (access.status !== "password_required") return null
    const settings = access.settings
    if (!settings.passwordHash || !settings.passwordSalt || !settings.passwordAlgorithm) return null
    return {
      auditId: access.audit._id,
      workspaceId: access.workspace._id,
      passwordHash: settings.passwordHash,
      passwordSalt: settings.passwordSalt,
      passwordAlgorithm: settings.passwordAlgorithm,
      accessVersion: settings.accessVersion,
      expiresAt: settings.expiresAt ?? null,
    }
  },
})

export const getOwnedPasswordContext = internalQuery({
  args: {
    auditId: v.id("audits"),
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await findAppUser(ctx, args.tokenIdentifier)
    if (!user) return null
    const [workspace, audit] = await Promise.all([
      getWorkspaceByOwner(ctx, user._id),
      ctx.db.get(args.auditId),
    ])
    if (
      !workspace ||
      workspace.deletionRequestedAt ||
      !audit ||
      audit.workspaceId !== workspace._id ||
      audit.deletionRequestedAt
    ) {
      return null
    }
    const settings = await ctx.db
      .query("reportSettings")
      .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
      .unique()
    return {
      auditId: audit._id,
      workspaceId: workspace._id,
      plan: await getWorkspacePlan(ctx, workspace._id),
      settings,
    }
  },
})

export const writeReportPassword = internalMutation({
  args: {
    auditId: v.id("audits"),
    workspaceId: v.id("workspaces"),
    passwordHash: v.union(v.string(), v.null()),
    passwordSalt: v.union(v.string(), v.null()),
    passwordAlgorithm: v.union(v.literal("scrypt-v1"), v.null()),
  },
  handler: async (ctx, args) => {
    let settings = await ctx.db
      .query("reportSettings")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .unique()
    if (!settings) {
      const audit = await ctx.db.get(args.auditId)
      if (!audit || audit.workspaceId !== args.workspaceId) return null
      const settingsId = await ctx.db.insert(
        "reportSettings",
        await buildReportSettingsSnapshotValues(ctx, audit),
      )
      settings = await ctx.db.get(settingsId)
    }
    if (!settings || settings.workspaceId !== args.workspaceId) return null
    const now = Date.now()
    await ctx.db.patch(settings._id, {
      passwordHash: args.passwordHash ?? undefined,
      passwordSalt: args.passwordSalt ?? undefined,
      passwordAlgorithm: args.passwordAlgorithm ?? undefined,
      accessVersion: settings.accessVersion + 1,
      settingsVersion: settings.settingsVersion + 1,
      updatedAt: now,
    })
    const artifacts = await ctx.db
      .query("reportPdfArtifacts")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .take(50)
    for (const artifact of artifacts) {
      if (artifact.status !== "stale") {
        await ctx.db.patch(artifact._id, { status: "stale", updatedAt: now })
      }
    }
    return { accessVersion: settings.accessVersion + 1 }
  },
})

export const createAccessGrant = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    auditId: v.id("audits"),
    tokenHash: v.string(),
    accessVersion: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("reportAccessGrants", {
      ...args,
      createdAt: Date.now(),
    })
  },
})

export const purgeExpiredAccessGrants = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("reportAccessGrants")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", Date.now()))
      .take(100)
    for (const grant of expired) await ctx.db.delete(grant._id)
    return expired.length
  },
})

export type ReportAccessOwnerContext = {
  auditId: Id<"audits">
  workspaceId: Id<"workspaces">
}
