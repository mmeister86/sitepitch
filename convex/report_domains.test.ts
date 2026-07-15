/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

const modules = import.meta.glob([
  "./auth.ts",
  "./report_domains.ts",
  "./lib/*.ts",
  "./_generated/*.js",
])

function createTest() {
  return convexTest(schema, modules)
}

async function seedWorkspace(
  t: ReturnType<typeof createTest>,
  args: { token: string; email?: string; plan?: "pro" | "agency" },
) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const userId = await ctx.db.insert("users", {
      tokenIdentifier: args.token,
      betterAuthUserId: `${args.token}-auth`,
      email: args.email ?? `${args.token}@example.com`,
      createdAt: now,
    })
    const workspaceId = await ctx.db.insert("workspaces", {
      ownerUserId: userId,
      name: `${args.token} Studio`,
      reportLanguage: "de",
      createdAt: now,
      updatedAt: now,
    })
    if (args.plan) {
      await ctx.db.insert("subscriptions", {
        workspaceId,
        provider: "lemonsqueezy",
        plan: args.plan,
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
    }
    return { userId, workspaceId }
  })
}

beforeEach(() => {
  vi.stubEnv("REPORT_DOMAIN_CNAME_TARGET", "reports.trysitepitch.com")
})

afterEach(() => vi.unstubAllEnvs())

describe("report domain lifecycle", () => {
  test("gates connection to Agency and exposes one normalized domain", async () => {
    const t = createTest()
    await seedWorkspace(t, { token: "pro-owner", plan: "pro" })
    const agency = await seedWorkspace(t, { token: "agency-owner", plan: "agency" })

    await expect(
      t.withIdentity({ tokenIdentifier: "pro-owner" }).mutation(
        api.report_domains.connectReportDomain,
        { hostname: "reports.pro-agency.de" },
      ),
    ).rejects.toMatchObject({ data: { code: "PLAN_UPGRADE_REQUIRED" } })

    const owner = t.withIdentity({ tokenIdentifier: "agency-owner" })
    const connected = await owner.mutation(api.report_domains.connectReportDomain, {
      hostname: " Reports.Agentur.DE. ",
    })
    expect(connected).toMatchObject({
      hostname: "reports.agentur.de",
      status: "pending_dns",
      verificationName: "_sitepitch-challenge.reports.agentur.de",
      cnameTarget: "reports.trysitepitch.com",
      canUseCustomDomain: true,
    })
    expect(connected.verificationValue).toMatch(/^sitepitch-verification=[A-Za-z0-9_-]{40,}$/)

    const same = await owner.mutation(api.report_domains.connectReportDomain, {
      hostname: "reports.agentur.de",
    })
    expect(same.domainId).toBe(connected.domainId)
    expect(same.verificationValue).toBe(connected.verificationValue)

    const rows = await t.run((ctx) =>
      ctx.db
        .query("reportDomains")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", agency.workspaceId))
        .take(2),
    )
    expect(rows).toHaveLength(1)
    expect(await owner.query(api.report_domains.getMyReportDomain, {})).toMatchObject({
      domainId: connected.domainId,
    })
  })

  test("prevents a hostname from being claimed by another workspace", async () => {
    const t = createTest()
    await seedWorkspace(t, { token: "first", plan: "agency" })
    await seedWorkspace(t, { token: "second", plan: "agency" })
    await t.withIdentity({ tokenIdentifier: "first" }).mutation(
      api.report_domains.connectReportDomain,
      { hostname: "reports.shared-domain.de" },
    )
    await expect(
      t.withIdentity({ tokenIdentifier: "second" }).mutation(
        api.report_domains.connectReportDomain,
        { hostname: "reports.shared-domain.de" },
      ),
    ).rejects.toMatchObject({ data: { code: "DOMAIN_UNAVAILABLE" } })
  })

  test("moves verified DNS to pending_host and requires a support admin to activate", async () => {
    vi.stubEnv("SUPPORT_ADMIN_EMAILS", "admin@example.com")
    const t = createTest()
    const ownerIds = await seedWorkspace(t, { token: "owner", plan: "agency" })
    await seedWorkspace(t, { token: "admin", email: "admin@example.com" })
    await seedWorkspace(t, { token: "non-admin", email: "person@example.com" })

    const connected = await t.withIdentity({ tokenIdentifier: "owner" }).mutation(
      api.report_domains.connectReportDomain,
      { hostname: "reports.verified-domain.de" },
    )
    const row = await t.run((ctx) => ctx.db.get(connected.domainId))
    expect(row).not.toBeNull()

    const verified = await t.mutation(internal.report_domains._applyDnsCheck, {
      domainId: connected.domainId,
      workspaceId: ownerIds.workspaceId,
      hostname: connected.hostname,
      verificationToken: row!.verificationToken,
      result: { ok: true, txtVerified: true, cnameVerified: true, errorCode: null },
    })
    expect(verified.status).toBe("pending_host")
    expect(verified.verifiedAt).toEqual(expect.any(Number))

    await expect(
      t.withIdentity({ tokenIdentifier: "non-admin" }).mutation(
        api.report_domains.activateReportDomain,
        { domainId: connected.domainId },
      ),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } })

    const active = await t.withIdentity({ tokenIdentifier: "admin" }).mutation(
      api.report_domains.activateReportDomain,
      { domainId: connected.domainId },
    )
    expect(active.status).toBe("active")
    expect(active.activatedAt).toEqual(expect.any(Number))
  })

  test("suspends an active domain after three consecutive failed checks", async () => {
    const t = createTest()
    const { workspaceId } = await seedWorkspace(t, { token: "owner", plan: "agency" })
    const connected = await t.withIdentity({ tokenIdentifier: "owner" }).mutation(
      api.report_domains.connectReportDomain,
      { hostname: "reports.flaky-domain.de" },
    )
    const domain = await t.run((ctx) => ctx.db.get(connected.domainId))
    await t.run((ctx) =>
      ctx.db.patch(connected.domainId, {
        status: "active",
        verifiedAt: Date.now(),
        activatedAt: Date.now(),
      }),
    )

    const applyFailure = () =>
      t.mutation(internal.report_domains._applyDnsCheck, {
        domainId: connected.domainId,
        workspaceId,
        hostname: connected.hostname,
        verificationToken: domain!.verificationToken,
        result: {
          ok: false,
          txtVerified: false,
          cnameVerified: true,
          errorCode: "TXT_MISMATCH",
        },
      })

    expect((await applyFailure()).status).toBe("active")
    expect((await applyFailure()).status).toBe("active")
    const suspended = await applyFailure()
    expect(suspended.status).toBe("suspended")
    expect(suspended.failureCount).toBe(3)
  })

  test("keeps an already active domain active after a successful recheck", async () => {
    const t = createTest()
    const { workspaceId } = await seedWorkspace(t, { token: "owner", plan: "agency" })
    const connected = await t.withIdentity({ tokenIdentifier: "owner" }).mutation(
      api.report_domains.connectReportDomain,
      { hostname: "reports.healthy-domain.de" },
    )
    const domain = await t.run((ctx) => ctx.db.get(connected.domainId))
    await t.run((ctx) =>
      ctx.db.patch(connected.domainId, {
        status: "active",
        verifiedAt: Date.now(),
        activatedAt: Date.now(),
      }),
    )

    const checked = await t.mutation(internal.report_domains._applyDnsCheck, {
      domainId: connected.domainId,
      workspaceId,
      hostname: connected.hostname,
      verificationToken: domain!.verificationToken,
      result: { ok: true, txtVerified: true, cnameVerified: true, errorCode: null },
    })
    expect(checked.status).toBe("active")
    expect(checked.failureCount).toBe(0)
  })

  test("allows an owner to disable after a downgrade and rejects unauthenticated DNS checks", async () => {
    const t = createTest()
    const { workspaceId } = await seedWorkspace(t, { token: "owner", plan: "agency" })
    await t.withIdentity({ tokenIdentifier: "owner" }).mutation(
      api.report_domains.connectReportDomain,
      { hostname: "reports.disabled-domain.de" },
    )
    await t.run(async (ctx) => {
      const subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
        .unique()
      await ctx.db.patch(subscription!._id, { plan: "pro", updatedAt: Date.now() })
    })

    const disabled = await t.withIdentity({ tokenIdentifier: "owner" }).mutation(
      api.report_domains.disableReportDomain,
      {},
    )
    expect(disabled).toMatchObject({ status: "disabled", canUseCustomDomain: false })
    await expect(t.action(api.report_domains.checkReportDomainDns, {})).rejects.toMatchObject({
      data: { code: "UNAUTHENTICATED" },
    })
  })
})
