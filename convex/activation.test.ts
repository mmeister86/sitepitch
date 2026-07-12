/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { afterEach, describe, expect, test, vi } from "vitest"

import { api } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

const modules = import.meta.glob(["./activation.ts", "./lib/*.ts", "./_generated/*.js"])
const DAY = 86_400_000

async function seedWorkspace(
  t: ReturnType<typeof convexTest>,
  tokenIdentifier: string,
  email: string,
  createdAt: number,
) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      tokenIdentifier,
      betterAuthUserId: `${tokenIdentifier}-auth`,
      email,
      createdAt,
    })
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Test Workspace",
      ownerUserId: userId,
      reportLanguage: "de",
      createdAt,
      updatedAt: createdAt,
    })
    return { userId, workspaceId }
  })
}

async function event(
  t: ReturnType<typeof convexTest>,
  workspaceId: Id<"workspaces">,
  name: "signed_up" | "branding_completed" | "audit_completed" | "outreach_copied" | "first_shared_report" | "public_link_copied",
  createdAt: number,
  auditId?: Id<"audits">,
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("usageEvents", { workspaceId, auditId, event: name, createdAt })
  })
}

afterEach(() => vi.unstubAllEnvs())

describe("activation status", () => {
  test("returns first milestone timestamps and independent next step", async () => {
    const t = convexTest(schema, modules)
    const { workspaceId } = await seedWorkspace(t, "owner", "owner@example.com", 100)
    await event(t, workspaceId, "signed_up", 100)
    await event(t, workspaceId, "branding_completed", 300)
    await event(t, workspaceId, "branding_completed", 200)
    await event(t, workspaceId, "audit_completed", 400)
    await event(t, workspaceId, "first_shared_report", 450)

    const result = await t.withIdentity({ tokenIdentifier: "owner" }).query(api.activation.getMyActivationStatus, {})

    expect(result.milestones).toEqual({
      signedUpAt: 100,
      brandingCompletedAt: 200,
      firstAuditCompletedAt: 400,
      outreachCopiedAt: null,
      firstSharedReportAt: 450,
    })
    expect(result.completedCount).toBe(3)
    expect(result.nextStep).toBe("outreach")
  })

  test("rejects unauthenticated access", async () => {
    const t = convexTest(schema, modules)
    await expect(t.query(api.activation.getMyActivationStatus, {})).rejects.toThrow()
  })
})

describe("admin activation funnel", () => {
  test("enforces admin access", async () => {
    const t = convexTest(schema, modules)
    await seedWorkspace(t, "owner", "owner@example.com", 100)
    await expect(
      t.withIdentity({ tokenIdentifier: "owner" }).query(api.activation.getActivationFunnel, { from: 0, to: DAY }),
    ).rejects.toThrow()
  })

  test("counts sequential progression, 24h boundary, distinct opens and zero-safe rates", async () => {
    vi.stubEnv("SUPPORT_ADMIN_EMAILS", "admin@example.com")
    const t = convexTest(schema, modules)
    const admin = await seedWorkspace(t, "admin", "admin@example.com", 0)
    const second = await seedWorkspace(t, "second", "second@example.com", 1_000)
    const thirdSignup = 2 * DAY - 1_000
    const third = await seedWorkspace(t, "third", "third@example.com", thirdSignup)

    await event(t, admin.workspaceId, "signed_up", 100)
    await event(t, admin.workspaceId, "branding_completed", 200)
    await event(t, admin.workspaceId, "audit_completed", 300)
    await event(t, admin.workspaceId, "outreach_copied", 400)
    await event(t, admin.workspaceId, "first_shared_report", 100 + DAY)

    await event(t, second.workspaceId, "signed_up", 1_000)
    await event(t, second.workspaceId, "first_shared_report", 1_100)
    await event(t, second.workspaceId, "branding_completed", 1_200)
    await event(t, second.workspaceId, "audit_completed", 1_300)
    await event(t, second.workspaceId, "outreach_copied", 1_400)

    await event(t, third.workspaceId, "signed_up", thirdSignup)
    await event(t, third.workspaceId, "first_shared_report", thirdSignup + DAY)

    const auditIds = await t.run(async (ctx) => {
      const makeAudit = async (workspaceId: Id<"workspaces">, userId: Id<"users">, suffix: string) =>
        await ctx.db.insert("audits", {
          workspaceId,
          createdByUserId: userId,
          url: `https://${suffix}.example.com/`,
          normalizedUrl: `https://${suffix}.example.com/`,
          domain: `${suffix}.example.com`,
          auditType: "standard",
          reportLanguage: "de",
          idempotencyKey: suffix,
          status: "completed",
          publicSlug: suffix,
          isPublic: true,
          reportVersion: "v1",
          createdAt: 500,
          updatedAt: 500,
        })
      const viewed = await makeAudit(admin.workspaceId, admin.userId, "viewed")
      const unopened = await makeAudit(admin.workspaceId, admin.userId, "unopened")
      await ctx.db.insert("reportViewStats", { workspaceId: admin.workspaceId, auditId: viewed, totalViews: 2 })
      return { viewed, unopened }
    })
    await event(t, admin.workspaceId, "public_link_copied", 500, auditIds.viewed)
    await event(t, admin.workspaceId, "public_link_copied", 510, auditIds.viewed)
    await event(t, admin.workspaceId, "public_link_copied", 520, auditIds.unopened)

    const result = await t.withIdentity({ tokenIdentifier: "admin" }).query(api.activation.getActivationFunnel, { from: 0, to: 2 * DAY })
    expect(result.funnel.map((step) => step.count)).toEqual([3, 2, 2, 2, 1])
    expect(result.firstShareWithin24h).toEqual({ numerator: 3, denominator: 3, rate: 1 })
    expect(result.sharedReportOpenRate).toEqual({ numerator: 1, denominator: 2, rate: 0.5 })
    expect(result.truncated).toBe(false)

    const empty = await t.withIdentity({ tokenIdentifier: "admin" }).query(api.activation.getActivationFunnel, { from: 3 * DAY, to: 4 * DAY })
    expect(empty.firstShareWithin24h.rate).toBeNull()
    expect(empty.sharedReportOpenRate.rate).toBeNull()
  })

  test("validates the window and reports truncation", async () => {
    vi.stubEnv("SUPPORT_ADMIN_EMAILS", "admin@example.com")
    const t = convexTest(schema, modules)
    const admin = await seedWorkspace(t, "admin", "admin@example.com", 0)
    for (let index = 0; index < 1_001; index += 1) {
      await event(t, admin.workspaceId, "signed_up", index)
    }
    const result = await t.withIdentity({ tokenIdentifier: "admin" }).query(api.activation.getActivationFunnel, { from: 0, to: DAY })
    expect(result.truncated).toBe(true)
    await expect(
      t.withIdentity({ tokenIdentifier: "admin" }).query(api.activation.getActivationFunnel, { from: 0, to: 91 * DAY }),
    ).rejects.toThrow()
  })
})
