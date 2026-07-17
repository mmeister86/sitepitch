import { ConvexError, v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { env, internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server"
import { checkPublicApiTransportLimits } from "./lib/audit_rate_limit"
import { randomBase64Url, sha256Base64Url } from "./lib/integration_crypto"
import { getWorkspacePlan, getWorkspaceByOwner, requireExistingAppUser } from "./lib/workspace"

export type PublicApiScope = "audits:create" | "audits:read" | "reports:read" | "usage:read"

const apiScopeValidator = v.union(
  v.literal("audits:create"),
  v.literal("audits:read"),
  v.literal("reports:read"),
  v.literal("usage:read"),
)

const MAX_ACTIVE_KEYS = 5
const ROTATION_GRACE_MS = 24 * 60 * 60_000
const LAST_USED_WRITE_INTERVAL_MS = 15 * 60_000

export function publicApiFeatureEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true"
}

export function canUsePublicApi(plan: string): boolean {
  return plan === "agency" || plan === "scale"
}

function fail(code: string, message: string): never {
  throw new ConvexError({ code, message })
}

function normalizeScopes(scopes: PublicApiScope[]): PublicApiScope[] {
  const unique = Array.from(new Set(scopes))
  if (unique.length === 0 || unique.length > 4) {
    fail("VALIDATION_ERROR", "Wähle mindestens einen gültigen API-Scope aus.")
  }
  return unique.sort()
}

function apiKeyDto(key: Doc<"apiKeys">) {
  return {
    _id: key._id,
    label: key.label,
    prefix: key.prefix,
    scopes: key.scopes,
    status: key.status,
    lastUsedAt: key.lastUsedAt ?? null,
    graceExpiresAt: key.graceExpiresAt ?? null,
    createdAt: key.createdAt,
  }
}

async function requireApiKeyAdminWorkspace(ctx: QueryCtx | MutationCtx) {
  const user = await requireExistingAppUser(ctx as QueryCtx)
  let workspace = await getWorkspaceByOwner(ctx, user.userId)
  if (!workspace) {
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .take(10)
    for (const membership of memberships) {
      if (membership.role !== "admin") continue
      const candidate = await ctx.db.get(membership.workspaceId)
      if (candidate && !candidate.deletionRequestedAt) {
        workspace = candidate
        break
      }
    }
  }
  if (!workspace || workspace.deletionRequestedAt) {
    fail("FORBIDDEN", "Workspace access denied")
  }
  const plan = await getWorkspacePlan(ctx as QueryCtx, workspace._id)
  return { user, workspace, plan }
}

async function issueApiKey(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">
    userId: Id<"users">
    label: string
    scopes: PublicApiScope[]
    rotatedFromApiKeyId?: Id<"apiKeys">
  },
) {
  const publicId = randomBase64Url(12)
  const secret = randomBase64Url(32)
  const rawKey = `spk_${publicId}_${secret}`
  const now = Date.now()
  const prefix = `spk_${publicId}_${secret.slice(0, 4)}…`
  const apiKeyId = await ctx.db.insert("apiKeys", {
    workspaceId: args.workspaceId,
    createdByUserId: args.userId,
    label: args.label,
    publicId,
    prefix,
    secretHash: await sha256Base64Url(rawKey),
    scopes: args.scopes,
    status: "active",
    rotatedFromApiKeyId: args.rotatedFromApiKeyId,
    createdAt: now,
    updatedAt: now,
  })
  return { apiKeyId, rawKey, prefix, scopes: args.scopes, createdAt: now }
}

export const listApiKeys = query({
  args: {},
  handler: async (ctx) => {
    const { workspace, plan } = await requireApiKeyAdminWorkspace(ctx)
    const [activeKeys, graceKeys] = await Promise.all([
      ctx.db
        .query("apiKeys")
        .withIndex("by_workspaceId_and_status", (q) => q.eq("workspaceId", workspace._id).eq("status", "active"))
        .order("desc")
        .take(50),
      ctx.db
        .query("apiKeys")
        .withIndex("by_workspaceId_and_status", (q) => q.eq("workspaceId", workspace._id).eq("status", "grace"))
        .order("desc")
        .take(50),
    ])
    const visibleKeys = [...activeKeys, ...graceKeys]
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, 50)
    return {
      featureEnabled: publicApiFeatureEnabled(env.PUBLIC_API_ENABLED),
      plan,
      canManage: canUsePublicApi(plan),
      maxActiveKeys: MAX_ACTIVE_KEYS,
      keys: visibleKeys.map(apiKeyDto),
    }
  },
})

export const createApiKey = mutation({
  args: { label: v.string(), scopes: v.array(apiScopeValidator) },
  handler: async (ctx, args) => {
    const { user, workspace, plan } = await requireApiKeyAdminWorkspace(ctx)
    if (!publicApiFeatureEnabled(env.PUBLIC_API_ENABLED)) fail("PUBLIC_API_DISABLED", "Die Public API ist deaktiviert.")
    if (!canUsePublicApi(plan)) fail("PLAN_UPGRADE_REQUIRED", "API-Keys sind im Agency-Plan verfügbar.")
    const label = args.label.trim()
    if (!label || label.length > 80) fail("VALIDATION_ERROR", "Der Name muss 1 bis 80 Zeichen lang sein.")
    const active = await ctx.db
      .query("apiKeys")
      .withIndex("by_workspaceId_and_status", (q) => q.eq("workspaceId", workspace._id).eq("status", "active"))
      .take(MAX_ACTIVE_KEYS + 1)
    if (active.length >= MAX_ACTIVE_KEYS) fail("API_KEY_LIMIT_REACHED", "Maximal fünf aktive API-Keys sind erlaubt.")
    return await issueApiKey(ctx, {
      workspaceId: workspace._id,
      userId: user.userId,
      label,
      scopes: normalizeScopes(args.scopes),
    })
  },
})

export const rotateApiKey = mutation({
  args: { apiKeyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const { user, workspace, plan } = await requireApiKeyAdminWorkspace(ctx)
    if (!publicApiFeatureEnabled(env.PUBLIC_API_ENABLED)) fail("PUBLIC_API_DISABLED", "Die Public API ist deaktiviert.")
    if (!canUsePublicApi(plan)) fail("PLAN_UPGRADE_REQUIRED", "API-Keys sind im Agency-Plan verfügbar.")
    const previous = await ctx.db.get(args.apiKeyId)
    if (!previous || previous.workspaceId !== workspace._id || previous.status === "revoked") {
      fail("NOT_FOUND", "API-Key nicht gefunden.")
    }
    if (previous.status === "grace") fail("INVALID_KEY_STATE", "Dieser API-Key wurde bereits rotiert.")
    const issued = await issueApiKey(ctx, {
      workspaceId: workspace._id,
      userId: user.userId,
      label: previous.label,
      scopes: previous.scopes,
      rotatedFromApiKeyId: previous._id,
    })
    const graceExpiresAt = Date.now() + ROTATION_GRACE_MS
    await ctx.db.patch(previous._id, {
      status: "grace",
      rotatedToApiKeyId: issued.apiKeyId,
      graceExpiresAt,
      updatedAt: Date.now(),
    })
    return { ...issued, previousKeyGraceExpiresAt: graceExpiresAt }
  },
})

export const revokeApiKey = mutation({
  args: { apiKeyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const { workspace } = await requireApiKeyAdminWorkspace(ctx)
    const key = await ctx.db.get(args.apiKeyId)
    if (!key || key.workspaceId !== workspace._id) fail("NOT_FOUND", "API-Key nicht gefunden.")
    if (key.status !== "revoked") {
      const now = Date.now()
      await ctx.db.patch(key._id, { status: "revoked", revokedAt: now, graceExpiresAt: undefined, updatedAt: now })
    }
    return { revoked: true }
  },
})

export const authenticateApiKey = internalMutation({
  args: { rawKey: v.string(), requiredScope: apiScopeValidator },
  handler: async (ctx, args) => {
    if (!publicApiFeatureEnabled(env.PUBLIC_API_ENABLED)) fail("PUBLIC_API_DISABLED", "The public API is disabled")
    const match = /^spk_([A-Za-z0-9_-]{16})_([A-Za-z0-9_-]{43})$/.exec(args.rawKey)
    if (!match) fail("INVALID_API_KEY", "Invalid API key")
    const key = await ctx.db.query("apiKeys").withIndex("by_publicId", (q) => q.eq("publicId", match[1])).unique()
    const now = Date.now()
    if (!key || key.status === "revoked" || (key.status === "grace" && (!key.graceExpiresAt || key.graceExpiresAt <= now))) {
      fail("INVALID_API_KEY", "Invalid API key")
    }
    if (await sha256Base64Url(args.rawKey) !== key.secretHash) fail("INVALID_API_KEY", "Invalid API key")
    const workspace = await ctx.db.get(key.workspaceId)
    if (!workspace || workspace.deletionRequestedAt) fail("INVALID_API_KEY", "Invalid API key")
    await checkPublicApiTransportLimits(ctx, { apiKeyId: key._id, workspaceId: workspace._id })
    const plan = await getWorkspacePlan(ctx as QueryCtx, workspace._id)
    if (!canUsePublicApi(plan)) fail("PLAN_UPGRADE_REQUIRED", "The Agency plan is required")
    if (!key.scopes.includes(args.requiredScope)) fail("INSUFFICIENT_SCOPE", "API key scope is missing")
    if (!key.lastUsedAt || key.lastUsedAt <= now - LAST_USED_WRITE_INTERVAL_MS) {
      await ctx.db.patch(key._id, { lastUsedAt: now, updatedAt: now })
    }
    return {
      kind: "api_key" as const,
      apiKeyId: key._id,
      workspaceId: workspace._id,
      userId: workspace.ownerUserId,
      scopes: key.scopes,
      plan,
    }
  },
})
