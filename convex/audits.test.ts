import assert from "node:assert/strict"

import { convexTest } from "convex-test"
import { v } from "convex/values"
import { beforeEach, describe, expect, test, vi } from "vitest"

import schema from "./schema.ts"
import { api, internal } from "./_generated/api"
import { normalizeAuditUrl, toSafeDisplayUrl, validatePublicAuditTarget } from "./lib/audit_url"

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  checkAuditStartLimits: vi.fn(),
  auditWorkpoolEnqueueAction: vi.fn(async (..._args: any[]) => "work-id" as string),
}))

const workspaceState = vi.hoisted(() => ({
  userId: null as any,
  workspaceId: null as any,
}))

vi.stubGlobal("fetch", mocks.fetch)

vi.mock("./lib/audit_rate_limit", () => ({
  checkAuditStartLimits: mocks.checkAuditStartLimits,
}))

vi.mock("./workpools", () => {
  const poolStub = () => ({ enqueueAction: vi.fn(async () => "work-id") })
  return {
    auditWorkpool: { enqueueAction: mocks.auditWorkpoolEnqueueAction },
    providerWorkpool: poolStub(),
    llmWorkpool: poolStub(),
    pdfWorkpool: poolStub(),
  }
})

vi.mock("./audit_pipeline.ts", async () => {
  const { internalAction } = await import("./_generated/server")
  const { v } = await import("convex/values")

  return {
    processAuditPipeline: internalAction({
      args: {
        auditId: v.id("audits"),
      },
      handler: async () => null,
    }),
  }
})

vi.mock("./workspaces.ts", async () => {
  const { mutation, query } = await import("./_generated/server")
  const {
    ensureWorkspaceCreditBalance,
    getWorkspaceCreditBalance,
    getWorkspaceCreditSnapshot,
  } = await import("./lib/credits")

  return {
    ensureCurrentWorkspace: mutation({
      args: {},
      handler: async (ctx) => {
        if (workspaceState.workspaceId) {
          return {
            workspaceId: workspaceState.workspaceId,
            userId: workspaceState.userId,
            credits: getWorkspaceCreditSnapshot(
              await getWorkspaceCreditBalance(ctx, workspaceState.workspaceId as any),
            ),
          }
        }

        const now = Date.now()
        const user = await ctx.db.insert("users", {
          tokenIdentifier: "test-token-identifier",
          betterAuthUserId: "test-better-auth-user",
          email: "alice@example.com",
          name: "Alice",
          createdAt: now,
        })
        workspaceState.userId = user

        workspaceState.workspaceId = await ctx.db.insert("workspaces", {
          name: "Alice",
          ownerUserId: user,
          accentColor: "#5b5bd6",
          contactEmail: "alice@example.com",
          ctaText: "Kostenloses Erstgespräch buchen",
          reportLanguage: "de",
          createdAt: now,
          updatedAt: now,
        })

        await ctx.db.insert("workspaceMembers", {
          workspaceId: workspaceState.workspaceId,
          userId: user,
          role: "owner",
          createdAt: now,
        })

        await ensureWorkspaceCreditBalance(ctx, workspaceState.workspaceId as any, user as any)

        const balance = await getWorkspaceCreditBalance(ctx, workspaceState.workspaceId as any)

        return {
          workspaceId: workspaceState.workspaceId,
          userId: user,
          credits: getWorkspaceCreditSnapshot(balance),
        }
      },
    }),
    getMyWorkspace: query({
      args: {},
      handler: async (ctx) => {
        const workspace: any = workspaceState.workspaceId
          ? await ctx.db.get(workspaceState.workspaceId as any)
          : null
        if (!workspace || !workspaceState.userId) {
          return null
        }
        const balance = await getWorkspaceCreditBalance(ctx, workspace._id as any)
        return {
          userId: workspaceState.userId,
          workspaceId: workspace._id,
          user: {
            email: "alice@example.com",
            name: "Alice",
          },
          workspace: {
            _id: workspace._id,
            name: workspace.name,
            logoStorageId: null,
            logoUrl: null,
            accentColor: workspace.accentColor ?? "#5b5bd6",
            website: "",
            contactEmail: workspace.contactEmail ?? "",
            ctaText: workspace.ctaText ?? "",
            ctaUrl: "",
            reportLanguage: workspace.reportLanguage,
            updatedAt: workspace.updatedAt,
          },
          credits: getWorkspaceCreditSnapshot(balance),
        }
      },
    }),
    getWorkspaceAuditContext: query({
      args: {
        workspaceId: v.id("workspaces"),
      },
      handler: async (ctx, args) => {
        const workspace: any = await ctx.db.get(args.workspaceId as any)
        if (!workspace) {
          return null
        }
        const balance = await getWorkspaceCreditBalance(ctx, workspace._id as any)
        return {
          workspaceId: workspace._id,
          userId: workspace.ownerUserId,
          credits: getWorkspaceCreditSnapshot(balance),
        }
      },
    }),
  }
})

const modules = import.meta.glob([
  "./auth.ts",
  "./audits.ts",
  "./audit_pipeline.ts",
  "./audit_scoring.ts",
  "./audit_state.ts",
  "./http.ts",
  "./workspaces.ts",
  "./lib/*.ts",
  "./_generated/*.js",
])

function createTest() {
  return convexTest(schema, modules)
}

beforeEach(() => {
  mocks.fetch.mockReset()
  mocks.checkAuditStartLimits.mockReset()
  mocks.auditWorkpoolEnqueueAction.mockReset()
  mocks.auditWorkpoolEnqueueAction.mockResolvedValue("work-id")
  workspaceState.userId = null
  workspaceState.workspaceId = null
})

function dnsResponse(addresses: string[]) {
  return {
    ok: true,
    json: async () => ({
      Status: 0,
      Answer: addresses.map((address) => ({ data: address })),
    }),
  }
}

function mockDnsAnswers({ a = [], aaaa = [] }: { a?: string[]; aaaa?: string[] }) {
  mocks.fetch.mockImplementation(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    const type = url.searchParams.get("type")
    if (type === "A") {
      return dnsResponse(a)
    }
    if (type === "AAAA") {
      return dnsResponse(aaaa)
    }
    return dnsResponse([])
  })
}

describe("audit URL helpers", () => {
  test("normalizes bare URLs and strips fragments", () => {
    const result = normalizeAuditUrl("  Example.com:443/path?q=1#section  ")

    assert.deepEqual(result, {
      normalizedUrl: "https://example.com/path?q=1",
      hostname: "example.com",
      protocol: "https:",
    })
  })

  test("removes credentials, query secrets, and fragments from browser display URLs", () => {
    assert.equal(
      toSafeDisplayUrl("https://user:pass@example.com/path?token=canary-secret#private"),
      "https://example.com/path",
    )
    assert.equal(toSafeDisplayUrl("https://example.com/?token=secret#private"), "https://example.com/")
    assert.equal(toSafeDisplayUrl("javascript:alert(1)"), "")
    assert.equal(toSafeDisplayUrl("mailto:test@example.com"), "")
    assert.equal(toSafeDisplayUrl("not a url"), "")
    assert.equal(
      toSafeDisplayUrl("https://[2001:db8::1]:443/a%20path?q=secret"),
      "https://[2001:db8::1]/a%20path",
    )
  })

  test("rejects unsafe protocols and whitespace", () => {
    const invalid = normalizeAuditUrl("javascript:alert(1)")
    assert.equal("code" in invalid, true)
    if ("code" in invalid) {
      assert.equal(invalid.code, "INVALID_URL")
    }

    const whitespace = normalizeAuditUrl("exa mple.com")
    assert.equal("code" in whitespace, true)

    const unsafePort = normalizeAuditUrl("https://example.com:8443/path")
    assert.equal("code" in unsafePort, true)
    if ("code" in unsafePort) {
      assert.equal(unsafePort.code, "UNSAFE_URL")
    }
  })

  test("treats direct public IPs as safe and rejects private ones", async () => {
    const safe = await validatePublicAuditTarget("93.184.216.34")
    assert.equal("ok" in safe, true)

    const unsafe = await validatePublicAuditTarget("10.0.0.5")
    assert.equal("code" in unsafe, true)
    if ("code" in unsafe) {
      assert.equal(unsafe.code, "UNSAFE_URL")
    }

    for (const hostname of ["127.0.0.1", "169.254.169.254", "::1", "fe80::1", "::ffff:10.0.0.5"]) {
      const result = await validatePublicAuditTarget(hostname)
      assert.equal("code" in result, true, `${hostname} must be rejected`)
      if ("code" in result) assert.equal(result.code, "UNSAFE_URL")
    }
  })

  test("blocks mixed DNS answers", async () => {
    mockDnsAnswers({ a: ["93.184.216.34", "10.0.0.5"] })

    const result = await validatePublicAuditTarget("example.com")

    assert.equal("code" in result, true)
    if ("code" in result) {
      assert.equal(result.code, "UNSAFE_URL")
    }
  })

  test("tolerates a failed DNS lookup when the other resolves to public addresses", async () => {
    mocks.fetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const type = url.searchParams.get("type")
      if (type === "A") {
        return dnsResponse(["93.184.216.34"])
      }
      throw new Error("DNS_QUERY_FAILED:500")
    })

    const result = await validatePublicAuditTarget("example.com")

    assert.equal("ok" in result, true)
    if ("ok" in result) {
      assert.deepEqual(result.addresses, ["93.184.216.34"])
    }
  })

  test("returns URL_UNRESOLVABLE when both DNS lookups fail", async () => {
    mocks.fetch.mockImplementation(async () => {
      throw new Error("DNS_QUERY_FAILED:500")
    })

    const result = await validatePublicAuditTarget("example.com")

    assert.equal("code" in result, true)
    if ("code" in result) {
      assert.equal(result.code, "URL_UNRESOLVABLE")
    }
  })
})

describe("audit start flow", () => {
  test("creates a queued audit, reserves one credit, and stores metadata", async () => {
    mocks.checkAuditStartLimits.mockResolvedValue(undefined)
    mockDnsAnswers({ a: ["93.184.216.34"] })

    const t = createTest().withIdentity({
      email: "alice@example.com",
      name: "Alice",
    })

    const result = await t.action(api.audits.startAudit, {
      url: "example.com",
      auditType: "standard",
      reportLanguage: "de",
      idempotencyKey: "idem-create-1",
    })

    assert.equal(result.status, "queued")
    assert.ok(result.auditId)
    assert.equal(mocks.checkAuditStartLimits.mock.calls.length, 1)
    assert.equal(mocks.fetch.mock.calls.length, 2)

    assert.equal(mocks.auditWorkpoolEnqueueAction.mock.calls.length, 1)
    const enqueueCall = mocks.auditWorkpoolEnqueueAction.mock.calls[0]
    const [, fnRef, fnArgs] = enqueueCall
    const fnName = (fnRef as any)[Symbol.for("functionName")]
    assert.equal(fnName, "audit_pipeline:processAuditPipeline")
    assert.deepEqual(fnArgs, { auditId: result.auditId })

    const audit = await t.query(internal.audits.getById, { auditId: result.auditId })
    assert.ok(audit)
    if (audit) {
      assert.equal(audit.status, "queued")
      assert.equal(audit.auditType, "standard")
      assert.equal(audit.reportLanguage, "de")
      assert.equal(audit.normalizedUrl, "https://example.com/")
      assert.equal(audit.domain, "example.com")
    }

    const pipelineState = await t.query((ctx) =>
      ctx.db
        .query("auditPipelineStates")
        .withIndex("by_auditId", (q) => q.eq("auditId", result.auditId))
        .unique(),
    )
    assert.ok(pipelineState)
    if (pipelineState) {
      assert.equal(pipelineState.status, "queued")
      assert.equal(pipelineState.phase, "queued")
    }

    const workspace = await t.query(api.workspaces.getMyWorkspace, {})
    assert.ok(workspace)
    assert.equal(workspace.credits.total, 3)
    assert.equal(workspace.credits.used, 0)
    assert.equal(workspace.credits.reserved, 1)
    assert.equal(workspace.credits.remaining, 2)
  })

  test("rejects invalid URLs without touching rate limits or credits", async () => {
    const t = createTest().withIdentity({
      email: "bob@example.com",
      name: "Bob",
    })

    await expect(
      t.action(api.audits.startAudit, {
        url: "javascript:alert(1)",
        auditType: "standard",
        reportLanguage: "de",
        idempotencyKey: "idem-invalid-1",
      }),
    ).rejects.toMatchObject({ data: { code: "INVALID_URL" } })

    assert.equal(mocks.checkAuditStartLimits.mock.calls.length, 0)
    assert.equal(mocks.fetch.mock.calls.length, 0)

    const audits = await t.query((ctx) => ctx.db.query("audits").collect())
    assert.equal(audits.length, 0)
  })

  test("refuses unsafe targets after rate preflight but before reserving credits", async () => {
    mocks.checkAuditStartLimits.mockResolvedValue(undefined)
    mockDnsAnswers({ a: ["10.0.0.5"] })

    const t = createTest().withIdentity({
      email: "carla@example.com",
      name: "Carla",
    })

    await expect(
      t.action(api.audits.startAudit, {
        url: "http://private.example",
        auditType: "local",
        reportLanguage: "en",
        idempotencyKey: "idem-unsafe-1",
      }),
    ).rejects.toMatchObject({ data: { code: "UNSAFE_URL" } })

    assert.equal(mocks.checkAuditStartLimits.mock.calls.length, 1)
    assert.equal(mocks.fetch.mock.calls.length, 2)

    const audits = await t.query((ctx) => ctx.db.query("audits").collect())
    const creditBalances = await t.query((ctx) => ctx.db.query("creditBalances").collect())
    assert.equal(audits.length, 0)
    assert.equal(creditBalances[0]?.reservedCredits ?? 0, 0)
  })

  test("returns rate limit failures before DNS lookups", async () => {
    mocks.checkAuditStartLimits.mockRejectedValue({ data: { code: "RATE_LIMITED" } })

    const t = createTest().withIdentity({
      email: "dina@example.com",
      name: "Dina",
    })

    await expect(
      t.action(api.audits.startAudit, {
        url: "example.com",
        auditType: "quick",
        reportLanguage: "de",
        idempotencyKey: "idem-rate-1",
      }),
    ).rejects.toMatchObject({ data: { code: "RATE_LIMITED" } })

    assert.equal(mocks.checkAuditStartLimits.mock.calls.length, 1)
    assert.equal(mocks.fetch.mock.calls.length, 0)
  })

  test("rate limit fires before the credit check", async () => {
    mocks.checkAuditStartLimits.mockRejectedValue({ data: { code: "RATE_LIMITED" } })
    mockDnsAnswers({ a: ["93.184.216.34"] })

    const t = createTest().withIdentity({
      email: "gina@example.com",
      name: "Gina",
    })

    await expect(
      t.action(api.audits.startAudit, {
        url: "example.com",
        auditType: "standard",
        reportLanguage: "de",
        idempotencyKey: "idem-rate-before-credit",
      }),
    ).rejects.toMatchObject({ data: { code: "RATE_LIMITED" } })

    const audits = await t.query((ctx) => ctx.db.query("audits").collect())
    const creditBalances = await t.query((ctx) => ctx.db.query("creditBalances").collect())
    assert.equal(audits.length, 0)
    assert.equal(creditBalances[0]?.reservedCredits ?? 0, 0)
  })

  test("deduplicates repeated submissions through the idempotency key", async () => {
    mocks.checkAuditStartLimits.mockResolvedValue(undefined)
    mockDnsAnswers({ a: ["93.184.216.34"] })

    const t = createTest().withIdentity({
      email: "eva@example.com",
      name: "Eva",
    })

    const first = await t.action(api.audits.startAudit, {
      url: "example.com",
      auditType: "standard",
      reportLanguage: "de",
      idempotencyKey: "idem-repeat-1",
    })

    mocks.checkAuditStartLimits.mockClear()
    mocks.fetch.mockClear()

    const second = await t.action(api.audits.startAudit, {
      url: "example.com",
      auditType: "standard",
      reportLanguage: "de",
      idempotencyKey: "idem-repeat-1",
    })

    assert.equal(second.auditId, first.auditId)
    assert.equal(mocks.checkAuditStartLimits.mock.calls.length, 0)
    assert.equal(mocks.fetch.mock.calls.length, 0)

    const audits = await t.query((ctx) => ctx.db.query("audits").collect())
    assert.equal(audits.length, 1)
  })

  test("updates the live detail query when the audit status changes", async () => {
    mocks.checkAuditStartLimits.mockResolvedValue(undefined)
    mockDnsAnswers({ a: ["93.184.216.34"] })

    const t = createTest().withIdentity({
      email: "frank@example.com",
      name: "Frank",
    })

    const result = await t.action(api.audits.startAudit, {
      url: "example.com",
      auditType: "standard",
      reportLanguage: "de",
      idempotencyKey: "idem-status-1",
    })

    await t.mutation((ctx) =>
      ctx.db.patch(result.auditId, {
        status: "validating_url",
        statusMessage: "URL wird geprüft",
        updatedAt: Date.now(),
      }),
    )

    const audit = await t.query(internal.audits.getById, { auditId: result.auditId })
    assert.ok(audit)
    if (audit) {
      assert.equal(audit.status, "validating_url")
      assert.equal(audit.statusMessage, "URL wird geprüft")
    }
  })

  test("links a valid workspace lead to the audit and updates the lead", async () => {
    mocks.checkAuditStartLimits.mockResolvedValue(undefined)
    mockDnsAnswers({ a: ["93.184.216.34"] })

    const t = createTest().withIdentity({
      email: "hans@example.com",
      name: "Hans",
    })

    await t.mutation(api.workspaces.ensureCurrentWorkspace, {})

    const leadId = await t.mutation((ctx) =>
      ctx.db.insert("leads", {
        workspaceId: workspaceState.workspaceId as any,
        businessName: "Hans Webdesign",
        websiteUrl: "https://example.com",
        normalizedWebsiteUrl: "https://example.com/",
        sourceProvider: "manual",
        status: "new",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    )

    const result = await t.action(api.audits.startAudit, {
      url: "example.com",
      auditType: "local",
      reportLanguage: "de",
      idempotencyKey: "idem-lead-1",
      leadId: leadId as any,
    })

    const audit = await t.query(internal.audits.getById, { auditId: result.auditId })
    assert.ok(audit)
    if (audit) {
      assert.equal(audit.leadId, leadId)
      assert.equal(audit.auditType, "local")
    }

    const lead = await t.query((ctx) =>
      ctx.db.get(leadId as any),
    ) as unknown as { auditId: any; status: string } | null
    assert.ok(lead)
    if (lead) {
      assert.equal(lead.auditId, result.auditId)
      assert.equal(lead.status, "new")
    }
  })

  test("rejects a leadId from a different workspace", async () => {
    mocks.checkAuditStartLimits.mockResolvedValue(undefined)
    mockDnsAnswers({ a: ["93.184.216.34"] })

    const t = createTest().withIdentity({
      email: "ingo@example.com",
      name: "Ingo",
    })

    await t.mutation(api.workspaces.ensureCurrentWorkspace, {})

    const otherWorkspaceId = await t.mutation((ctx) =>
      ctx.db.insert("workspaces", {
        name: "Other Workspace",
        ownerUserId: workspaceState.userId as any,
        accentColor: "#5b5bd6",
        contactEmail: "other@example.com",
        ctaText: "Kostenloses Erstgespräch buchen",
        reportLanguage: "de",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    )

    const otherLeadId = await t.mutation((ctx) =>
      ctx.db.insert("leads", {
        workspaceId: otherWorkspaceId,
        businessName: "Other Lead",
        websiteUrl: "https://example.com",
        normalizedWebsiteUrl: "https://example.com/",
        sourceProvider: "manual",
        status: "new",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    )

    await expect(
      t.action(api.audits.startAudit, {
        url: "example.com",
        auditType: "standard",
        reportLanguage: "de",
        idempotencyKey: "idem-lead-foreign-1",
        leadId: otherLeadId as any,
      }),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } })

    const audits = await t.query((ctx) => ctx.db.query("audits").collect())
    const creditBalances = await t.query((ctx) => ctx.db.query("creditBalances").collect())
    assert.equal(audits.length, 0)
    assert.equal(creditBalances[0]?.reservedCredits ?? 0, 0)
  })
})

describe("listMyAudits inbox DTO", () => {
  test("derives canonical lead, engagement, and outreach fields with legacy fallbacks", async () => {
    const t = createTest().withIdentity({
      tokenIdentifier: "test-token-identifier",
      email: "inbox@example.com",
      name: "Inbox",
    })
    await t.mutation(api.workspaces.ensureCurrentWorkspace, {})

    const ids = await t.mutation(async (ctx) => {
      const now = Date.now()
      const leadId = await ctx.db.insert("leads", {
        workspaceId: workspaceState.workspaceId as any,
        businessName: "Legacy GmbH",
        sourceProvider: "manual",
        status: "not_interested",
        createdAt: now,
        updatedAt: now,
      })
      const auditId = await ctx.db.insert("audits", {
        workspaceId: workspaceState.workspaceId as any,
        leadId,
        createdByUserId: workspaceState.userId as any,
        url: "https://legacy.example/",
        normalizedUrl: "https://legacy.example/",
        domain: "legacy.example",
        auditType: "standard",
        reportLanguage: "de",
        idempotencyKey: "inbox-dto",
        status: "completed",
        publicSlug: "inbox-dto",
        isPublic: true,
        reportVersion: "v1",
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert("reportViewStats", {
        workspaceId: workspaceState.workspaceId as any,
        auditId,
        totalViews: 7,
        reopenCount: 2,
        ctaClicks: 3,
        pdfDownloads: 1,
        lastViewedAt: now - 1_000,
      })
      await ctx.db.insert("outreachDrafts", {
        workspaceId: workspaceState.workspaceId as any,
        auditId,
        type: "email",
        body: "Hallo",
        createdAt: now,
      })
      await ctx.db.insert("usageEvents", {
        workspaceId: workspaceState.workspaceId as any,
        auditId,
        event: "outreach_copied",
        createdAt: now,
      })

      const legacyAuditId = await ctx.db.insert("audits", {
        workspaceId: workspaceState.workspaceId as any,
        createdByUserId: workspaceState.userId as any,
        url: "https://fallback.example/",
        normalizedUrl: "https://fallback.example/",
        domain: "fallback.example",
        auditType: "standard",
        reportLanguage: "de",
        idempotencyKey: "inbox-fallback",
        status: "completed",
        publicSlug: "inbox-fallback",
        isPublic: false,
        reportVersion: "v1",
        createdAt: now - 1,
        updatedAt: now,
      })
      await ctx.db.insert("reportViews", {
        workspaceId: workspaceState.workspaceId as any,
        auditId: legacyAuditId,
        viewedAt: now,
      })
      return { auditId, leadId, lastViewedAt: now - 1_000, legacyLastViewedAt: now }
    })

    const result = await t.query(api.audits.listMyAudits, {})
    assert.ok(result)
    const item = result.items.find((row) => row._id === ids.auditId)
    assert.ok(item)
    assert.equal(item.leadId, ids.leadId)
    assert.equal(item.businessName, "Legacy GmbH")
    assert.equal(item.leadStatus, "lost")
    assert.equal(item.outreachStatus, "copied")
    assert.equal(item.views, 7)
    assert.equal(item.reopenCount, 2)
    assert.equal(item.ctaClicks, 3)
    assert.equal(item.pdfDownloads, 1)
    assert.equal(item.lastViewedAt, ids.lastViewedAt)

    const fallback = result.items.find((row) => row.domain === "fallback.example")
    assert.ok(fallback)
    assert.equal(fallback.leadId, null)
    assert.equal(fallback.leadStatus, null)
    assert.equal(fallback.outreachStatus, "not_started")
    assert.equal(fallback.views, 1)
    assert.equal(fallback.viewCountCapped, false)
    assert.equal(fallback.reopenCount, 0)
    assert.equal(fallback.ctaClicks, 0)
    assert.equal(fallback.pdfDownloads, 0)
    assert.equal(fallback.lastViewedAt, ids.legacyLastViewedAt)
  })

  test("returns ready when a draft exists without a copy event", async () => {
    const t = createTest().withIdentity({
      tokenIdentifier: "test-token-identifier",
      email: "ready@example.com",
      name: "Ready",
    })
    await t.mutation(api.workspaces.ensureCurrentWorkspace, {})
    const auditId = await t.mutation(async (ctx) => {
      const now = Date.now()
      const id = await ctx.db.insert("audits", {
        workspaceId: workspaceState.workspaceId as any,
        createdByUserId: workspaceState.userId as any,
        url: "https://ready.example/",
        normalizedUrl: "https://ready.example/",
        domain: "ready.example",
        auditType: "standard",
        reportLanguage: "de",
        idempotencyKey: "inbox-ready",
        status: "completed",
        publicSlug: "inbox-ready",
        isPublic: false,
        reportVersion: "v1",
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert("outreachDrafts", {
        workspaceId: workspaceState.workspaceId as any,
        auditId: id,
        type: "email",
        body: "Hallo",
        createdAt: now,
      })
      return id
    })

    const result = await t.query(api.audits.listMyAudits, {})
    assert.equal(result?.items.find((item) => item._id === auditId)?.outreachStatus, "ready")
  })

  test("treats copy evidence as copied even when no current draft exists", async () => {
    const t = createTest().withIdentity({
      tokenIdentifier: "test-token-identifier",
      email: "copied@example.com",
      name: "Copied",
    })
    await t.mutation(api.workspaces.ensureCurrentWorkspace, {})
    const auditId = await t.mutation(async (ctx) => {
      const now = Date.now()
      const id = await ctx.db.insert("audits", {
        workspaceId: workspaceState.workspaceId as any,
        createdByUserId: workspaceState.userId as any,
        url: "https://copied.example/",
        normalizedUrl: "https://copied.example/",
        domain: "copied.example",
        auditType: "standard",
        reportLanguage: "de",
        idempotencyKey: "inbox-copied-no-draft",
        status: "completed",
        publicSlug: "inbox-copied-no-draft",
        isPublic: false,
        reportVersion: "v1",
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert("usageEvents", {
        workspaceId: workspaceState.workspaceId as any,
        auditId: id,
        event: "outreach_copied",
        createdAt: now,
      })
      return id
    })

    const result = await t.query(api.audits.listMyAudits, {})
    assert.equal(result?.items.find((item) => item._id === auditId)?.outreachStatus, "copied")
  })

  test("caps only legacy counts above 100, returns newest legacy view, and prefers exact stats", async () => {
    const t = createTest().withIdentity({
      tokenIdentifier: "test-token-identifier",
      email: "cap@example.com",
      name: "Cap",
    })
    await t.mutation(api.workspaces.ensureCurrentWorkspace, {})
    const ids = await t.mutation(async (ctx) => {
      const base = Date.now() - 10_000
      const createAudit = async (domain: string, offset: number) => await ctx.db.insert("audits", {
        workspaceId: workspaceState.workspaceId as any,
        createdByUserId: workspaceState.userId as any,
        url: `https://${domain}/`,
        normalizedUrl: `https://${domain}/`,
        domain,
        auditType: "standard",
        reportLanguage: "de",
        idempotencyKey: `inbox-${domain}`,
        status: "completed",
        publicSlug: `inbox-${domain}`,
        isPublic: false,
        reportVersion: "v1",
        createdAt: base + offset,
        updatedAt: base + offset,
      })
      const exactAuditId = await createAudit("exact-100.example", 1)
      const cappedAuditId = await createAudit("capped.example", 2)
      const statsAuditId = await createAudit("stats.example", 3)

      for (let index = 0; index < 100; index += 1) {
        await ctx.db.insert("reportViews", {
          workspaceId: workspaceState.workspaceId as any,
          auditId: exactAuditId,
          viewedAt: base + index,
        })
      }
      await ctx.db.insert("reportViews", {
        workspaceId: workspaceState.workspaceId as any,
        auditId: cappedAuditId,
        viewedAt: base + 1_100,
      })
      for (let index = 0; index < 100; index += 1) {
        await ctx.db.insert("reportViews", {
          workspaceId: workspaceState.workspaceId as any,
          auditId: cappedAuditId,
          viewedAt: base + 1_000 + index,
        })
      }
      for (let index = 0; index < 101; index += 1) {
        await ctx.db.insert("reportViews", {
          workspaceId: workspaceState.workspaceId as any,
          auditId: statsAuditId,
          viewedAt: base + 2_000 + index,
        })
      }
      const statsLastViewedAt = base + 9_000
      await ctx.db.insert("reportViewStats", {
        workspaceId: workspaceState.workspaceId as any,
        auditId: statsAuditId,
        totalViews: 245,
        lastViewedAt: statsLastViewedAt,
        reopenCount: 4,
        ctaClicks: 5,
        pdfDownloads: 6,
      })
      return {
        exactAuditId,
        cappedAuditId,
        statsAuditId,
        exactLastViewedAt: base + 99,
        cappedLastViewedAt: base + 1_100,
        statsLastViewedAt,
      }
    })

    const result = await t.query(api.audits.listMyAudits, {})
    assert.ok(result)
    const exact = result.items.find((item) => item._id === ids.exactAuditId)
    const capped = result.items.find((item) => item._id === ids.cappedAuditId)
    const stats = result.items.find((item) => item._id === ids.statsAuditId)
    assert.ok(exact && capped && stats)

    assert.equal(exact.views, 100)
    assert.equal(exact.viewCountCapped, false)
    assert.equal(exact.lastViewedAt, ids.exactLastViewedAt)
    assert.equal(capped.views, 100)
    assert.equal(capped.viewCountCapped, true)
    assert.equal(capped.lastViewedAt, ids.cappedLastViewedAt)
    assert.equal(stats.views, 245)
    assert.equal(stats.viewCountCapped, false)
    assert.equal(stats.lastViewedAt, ids.statsLastViewedAt)
  })
})
