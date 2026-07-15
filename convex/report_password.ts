"use node"

import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto"
import { ConvexError, v } from "convex/values"

import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import { action, env, type ActionCtx } from "./_generated/server"
import { auditRateLimiter } from "./lib/audit_rate_limit"
import { reportFeaturePolicy } from "./lib/report_policy"
import { verifyTurnstileToken } from "./lib/turnstile"
import type { SubscriptionPlan } from "./lib/rate_limit_helpers"

const PASSWORD_MIN_LENGTH = 10
const PASSWORD_MAX_LENGTH = 128
const GRANT_TTL_MS = 12 * 60 * 60_000
const SCRYPT_KEY_LENGTH = 64
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }

function scryptAsync(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_OPTIONS, (error, derivedKey) => {
      if (error) reject(error)
      else resolve(derivedKey)
    })
  })
}

function passwordError(code: string, message: string): never {
  throw new ConvexError({ code, message })
}

function validatePassword(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    passwordError(
      "INVALID_PASSWORD",
      `Das Passwort muss zwischen ${PASSWORD_MIN_LENGTH} und ${PASSWORD_MAX_LENGTH} Zeichen lang sein.`,
    )
  }
}

async function requireOwnerContext(
  ctx: ActionCtx,
  auditId: Id<"audits">,
): Promise<{
  auditId: Id<"audits">
  workspaceId: Id<"workspaces">
  plan: SubscriptionPlan
  settings: Doc<"reportSettings"> | null
}> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) passwordError("UNAUTHENTICATED", "Not authenticated")
  const context = await ctx.runQuery(internal.lib.report_access.getOwnedPasswordContext, {
    auditId,
    tokenIdentifier: identity.tokenIdentifier,
  })
  if (!context) passwordError("NOT_FOUND", "Report not found")
  return context
}

export const setReportPassword = action({
  args: {
    auditId: v.id("audits"),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{ passwordProtected: true }> => {
    validatePassword(args.password)
    if (!env.TURNSTILE_SECRET_KEY) {
      passwordError(
        "TURNSTILE_NOT_CONFIGURED",
        "Passwortschutz ist erst nach Konfiguration von Turnstile verfügbar.",
      )
    }
    const context = await requireOwnerContext(ctx, args.auditId)
    if (!reportFeaturePolicy(context.plan).passwordProtection) {
      passwordError("PLAN_UPGRADE_REQUIRED", "Passwortschutz ist ab dem Pro-Plan verfügbar.")
    }

    const salt = randomBytes(24).toString("base64url")
    const passwordHash = (await scryptAsync(args.password, salt)).toString("hex")
    await ctx.runMutation(internal.lib.report_access.writeReportPassword, {
      auditId: context.auditId,
      workspaceId: context.workspaceId,
      passwordHash,
      passwordSalt: salt,
      passwordAlgorithm: "scrypt-v1",
    })
    return { passwordProtected: true }
  },
})

export const clearReportPassword = action({
  args: { auditId: v.id("audits") },
  handler: async (ctx, args): Promise<{ passwordProtected: false }> => {
    const context = await requireOwnerContext(ctx, args.auditId)
    await ctx.runMutation(internal.lib.report_access.writeReportPassword, {
      auditId: context.auditId,
      workspaceId: context.workspaceId,
      passwordHash: null,
      passwordSalt: null,
      passwordAlgorithm: null,
    })
    return { passwordProtected: false }
  },
})

export const unlockPublicReport = action({
  args: {
    slug: v.string(),
    host: v.optional(v.string()),
    password: v.string(),
    turnstileToken: v.string(),
  },
  handler: async (ctx, args): Promise<{ grantToken: string; expiresAt: number }> => {
    const limit = await auditRateLimiter.limit(ctx, "publicReportUnlocksBySlug", {
      key: args.slug,
    })
    if (!limit.ok) {
      passwordError("RATE_LIMITED", "Zu viele Versuche. Bitte warte und versuche es erneut.")
    }
    const turnstile = await verifyTurnstileToken(args.turnstileToken)
    if (!turnstile.ok) {
      passwordError(turnstile.reason, "Die Sicherheitsprüfung ist fehlgeschlagen.")
    }

    const context: {
      auditId: Id<"audits">
      workspaceId: Id<"workspaces">
      passwordHash: string
      passwordSalt: string
      passwordAlgorithm: "scrypt-v1"
      accessVersion: number
      expiresAt: number | null
    } | null = await ctx.runQuery(internal.lib.report_access.getPasswordContext, {
      slug: args.slug,
      host: args.host,
    })
    if (!context || context.passwordAlgorithm !== "scrypt-v1") {
      passwordError("INVALID_ACCESS", "Report nicht verfügbar oder Passwort ungültig.")
    }

    validatePassword(args.password)
    const actual = await scryptAsync(args.password, context.passwordSalt)
    const expected = Buffer.from(context.passwordHash, "hex")
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      passwordError("INVALID_ACCESS", "Report nicht verfügbar oder Passwort ungültig.")
    }

    const grantToken = randomBytes(32).toString("base64url")
    const tokenHash = createHash("sha256").update(grantToken).digest("hex")
    const ttl = Date.now() + GRANT_TTL_MS
    const expiresAt = context.expiresAt === null ? ttl : Math.min(ttl, context.expiresAt)
    await ctx.runMutation(internal.lib.report_access.createAccessGrant, {
      workspaceId: context.workspaceId,
      auditId: context.auditId,
      tokenHash,
      accessVersion: context.accessVersion,
      expiresAt,
    })
    return { grantToken, expiresAt }
  },
})
