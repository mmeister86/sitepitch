import assert from "node:assert/strict"

import { convexTest } from "convex-test"
import { v } from "convex/values"
import { beforeEach, describe, expect, test, vi } from "vitest"

import schema from "./schema.ts"
import { api } from "./_generated/api"
import { normalizeAuditUrl, validatePublicAuditTarget } from "./lib/audit_url"

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  limit: vi.fn(),
}))

const workspaceState = vi.hoisted(() => ({
  userId: null as any,
  workspaceId: null as any,
}))

vi.stubGlobal("fetch", mocks.fetch)

vi.mock("./lib/audit_rate_limit", () => ({
  auditRateLimiter: {
    limit: mocks.limit,
  },
}))

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
  mocks.limit.mockReset()
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

  test("rejects unsafe protocols and whitespace", () => {
    const invalid = normalizeAuditUrl("javascript:alert(1)")
    assert.equal("code" in invalid, true)
    if ("code" in invalid) {
      assert.equal(invalid.code, "INVALID_URL")
    }

    const whitespace = normalizeAuditUrl("exa mple.com")
    assert.equal("code" in whitespace, true)
  })

  test("treats direct public IPs as safe and rejects private ones", async () => {
    const safe = await validatePublicAuditTarget("93.184.216.34")
    assert.equal("ok" in safe, true)

    const unsafe = await validatePublicAuditTarget("10.0.0.5")
    assert.equal("code" in unsafe, true)
    if ("code" in unsafe) {
      assert.equal(unsafe.code, "UNSAFE_URL")
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
})

describe("audit start flow", () => {
  test("creates a queued audit, reserves one credit, and stores metadata", async () => {
    mocks.limit.mockResolvedValue({ ok: true, retryAfter: null })
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
    assert.equal(mocks.limit.mock.calls.length, 1)
    assert.equal(mocks.fetch.mock.calls.length, 2)

    const audit = await t.query(api.audits.getById, { auditId: result.auditId })
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
    assert.equal(workspace.credits.total, 20)
    assert.equal(workspace.credits.used, 0)
    assert.equal(workspace.credits.reserved, 1)
    assert.equal(workspace.credits.remaining, 19)
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

    assert.equal(mocks.limit.mock.calls.length, 0)
    assert.equal(mocks.fetch.mock.calls.length, 0)

    const audits = await t.query((ctx) => ctx.db.query("audits").collect())
    assert.equal(audits.length, 0)
  })

  test("refuses unsafe targets after rate preflight but before reserving credits", async () => {
    mocks.limit.mockResolvedValue({ ok: true, retryAfter: null })
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

    assert.equal(mocks.limit.mock.calls.length, 1)
    assert.equal(mocks.fetch.mock.calls.length, 2)

    const audits = await t.query((ctx) => ctx.db.query("audits").collect())
    const creditBalances = await t.query((ctx) => ctx.db.query("creditBalances").collect())
    assert.equal(audits.length, 0)
    assert.equal(creditBalances[0]?.reservedCredits ?? 0, 0)
  })

  test("returns rate limit failures before DNS lookups", async () => {
    mocks.limit.mockResolvedValue({ ok: false, retryAfter: Date.now() + 60_000 })

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

    assert.equal(mocks.limit.mock.calls.length, 1)
    assert.equal(mocks.fetch.mock.calls.length, 0)
  })

  test("deduplicates repeated submissions through the idempotency key", async () => {
    mocks.limit.mockResolvedValue({ ok: true, retryAfter: null })
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

    mocks.limit.mockClear()
    mocks.fetch.mockClear()

    const second = await t.action(api.audits.startAudit, {
      url: "example.com",
      auditType: "standard",
      reportLanguage: "de",
      idempotencyKey: "idem-repeat-1",
    })

    assert.equal(second.auditId, first.auditId)
    assert.equal(mocks.limit.mock.calls.length, 0)
    assert.equal(mocks.fetch.mock.calls.length, 0)

    const audits = await t.query((ctx) => ctx.db.query("audits").collect())
    assert.equal(audits.length, 1)
  })

  test("updates the live detail query when the audit status changes", async () => {
    mocks.limit.mockResolvedValue({ ok: true, retryAfter: null })
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

    const audit = await t.query(api.audits.getById, { auditId: result.auditId })
    assert.ok(audit)
    if (audit) {
      assert.equal(audit.status, "validating_url")
      assert.equal(audit.statusMessage, "URL wird geprüft")
    }
  })
})
