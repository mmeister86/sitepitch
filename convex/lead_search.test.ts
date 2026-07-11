import assert from "node:assert/strict"

import { convexTest } from "convex-test"
import { beforeEach, describe, test, vi } from "vitest"

import schema from "./schema.ts"
import type { Doc } from "./_generated/dataModel"
import { api, internal } from "./_generated/api"

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  checkLeadSearchLimit: vi.fn(),
  checkProviderLimit: vi.fn(),
}))

const workspaceState = vi.hoisted(() => ({
  userId: null as any,
  workspaceId: null as any,
}))

vi.stubGlobal("fetch", mocks.fetch)

vi.mock("./auth.ts", () => ({
  authComponent: {
    getAuthUser: async (ctx: any) => {
      const identity = await ctx.auth.getUserIdentity()
      if (!identity) return null
      return { _id: "mock-better-auth-id", email: identity.email ?? "test@example.com", name: identity.name ?? "Test" }
    },
  },
  createAuth: vi.fn(),
  getAuthUser: vi.fn(),
}))

vi.mock("./lib/audit_rate_limit", () => ({
  checkAuditStartLimits: vi.fn(),
  checkLeadSearchLimit: mocks.checkLeadSearchLimit,
  checkProviderLimit: mocks.checkProviderLimit,
  auditRateLimiter: { limit: vi.fn() },
  isPaidPlan: vi.fn(),
  providerToLimitKind: vi.fn(),
  throwRateLimited: vi.fn(),
}))

vi.mock("./workpools", () => {
  const poolStub = () => ({ enqueueAction: vi.fn(async () => "work-id") })
  return {
    auditWorkpool: poolStub(),
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

        const identity = await ctx.auth.getUserIdentity()
        const tokenIdentifier = identity?.tokenIdentifier ?? "test-token-identifier"
        const email = identity?.email ?? "alice@example.com"
        const name = identity?.name ?? "Alice"
        const now = Date.now()
        const user = await ctx.db.insert("users", {
          tokenIdentifier,
          betterAuthUserId: "test-better-auth-user",
          email,
          name,
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
        const workspace = workspaceState.workspaceId
          ? ((await ctx.db.get(workspaceState.workspaceId as any)) as Doc<"workspaces"> | null)
          : null
        if (!workspace || !workspaceState.userId) return null
        const balance = await getWorkspaceCreditBalance(ctx, workspace._id as any)
        return {
          userId: workspaceState.userId,
          workspaceId: workspace._id,
          user: { email: "alice@example.com", name: "Alice" },
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
  }
})

const modules = import.meta.glob([
  "./auth.ts",
  "./audits.ts",
  "./leads.ts",
  "./lead_search.ts",
  "./campaigns.ts",
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

function withAlice(t: ReturnType<typeof createTest>) {
  return t.withIdentity({
    tokenIdentifier: "test-token-identifier",
    email: "alice@example.com",
    name: "Alice",
  })
}

beforeEach(() => {
  mocks.fetch.mockReset()
  mocks.checkLeadSearchLimit.mockReset()
  mocks.checkProviderLimit.mockReset()
  workspaceState.userId = null
  workspaceState.workspaceId = null
})

async function ensureWorkspace(t: ReturnType<typeof createTest>) {
  const workspace = await withAlice(t).mutation(api.workspaces.ensureCurrentWorkspace, {})
  return workspace!.workspaceId
}

function makeItem(overrides: Partial<{
  businessName: string
  sourceProvider: "rapidapi" | "google_places"
  sourceId: string
  sourceLabel: string
  auditReady: boolean
}> = {}) {
  return {
    businessName: overrides.businessName ?? "Unbekanntes Unternehmen",
    sourceProvider: overrides.sourceProvider ?? "rapidapi",
    sourceId: overrides.sourceId,
    sourceLabel: overrides.sourceLabel ?? "Local Business Data",
    auditReady: overrides.auditReady ?? false,
  }
}

async function createCampaign(t: ReturnType<typeof createTest>, workspaceId: string) {
  return await withAlice(t).mutation(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert("campaigns", {
      workspaceId: workspaceId as any,
      name: "Test Campaign",
      targetIndustry: "Zahnarzt",
      targetCity: "Leipzig",
      targetCountry: "Deutschland",
      offerType: "relaunch",
      language: "de",
      status: "draft",
      createdByUserId: workspaceState.userId as any,
      createdAt: now,
      updatedAt: now,
    })
  })
}

function mockRapidApiResponse() {
  mocks.fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({
      status: "OK",
      data: [{
        business_name: "Zahnarzt Leipzig",
        website: "https://example.com",
        category: "Zahnarzt",
        address: "Musterstrasse 1",
        phone_number: "0123456789",
        email: "info@example.com",
        latitude: 51.34,
        longitude: 12.37,
        place_id: "pid1",
      }],
    }),
  } as any)
  mocks.checkLeadSearchLimit.mockResolvedValueOnce({
    allowed: true,
    remaining: 10,
    resetAt: 0,
    kind: "leadSearch",
  } as any)
  mocks.checkProviderLimit.mockResolvedValueOnce({
    allowed: true,
    remaining: 10,
    resetAt: 0,
    kind: "businessData",
  } as any)
  process.env.LOCAL_BUSINESS_DATA_API_KEY = "test-key"
}

describe("searchLocalBusinesses", () => {
  test("persists snapshot after successful workspace search", async () => {
    const t = createTest()
    await ensureWorkspace(t)
    mockRapidApiResponse()
    await withAlice(t).action(api.lead_search.searchLocalBusinesses, {
      industry: "Zahnarzt",
      city: "Leipzig",
      country: "Deutschland",
      keyword: "",
    })
    const result = await withAlice(t).query(api.lead_search.getLatestSnapshot, {})
    assert.equal(result?.industry, "Zahnarzt")
    assert.equal(result?.items.length, 1)
    assert.equal(result?.items[0].businessName, "Zahnarzt Leipzig")
  })

  test("persists snapshot after successful campaign search", async () => {
    const t = createTest()
    const workspaceId = await ensureWorkspace(t)
    const campaignId = await createCampaign(t, workspaceId)
    mockRapidApiResponse()
    await withAlice(t).action(api.lead_search.searchLocalBusinesses, {
      industry: "Zahnarzt",
      city: "Leipzig",
      country: "Deutschland",
      keyword: "",
      campaignId: campaignId as any,
    })
    const result = await withAlice(t).query(api.lead_search.getLatestSnapshot, { campaignId: campaignId as any })
    assert.equal(result?.industry, "Zahnarzt")
    assert.equal(result?.campaignId, campaignId)
  })
})

describe("lead_search snapshots", () => {
  test("getLatestSnapshot returns the saved workspace snapshot", async () => {
    const t = createTest()
    const workspaceId = await ensureWorkspace(t)
    await withAlice(t).mutation(internal.lead_search.saveSnapshot, {
      workspaceId: workspaceId as any,
      industry: "Zahnarzt",
      city: "Leipzig",
      country: "Deutschland",
      provider: "rapidapi",
      sourceLabel: "Local Business Data",
      items: [],
      searchedAt: 1,
    })
    const result = await withAlice(t).query(api.lead_search.getLatestSnapshot, {})
    assert.equal(result?.industry, "Zahnarzt")
    assert.equal(result?.city, "Leipzig")
    assert.equal(result?.savedKeys.length, 0)
  })

  test("getLatestSnapshot returns the saved campaign snapshot", async () => {
    const t = createTest()
    const workspaceId = await ensureWorkspace(t)
    const campaignId = await createCampaign(t, workspaceId)
    await withAlice(t).mutation(internal.lead_search.saveSnapshot, {
      workspaceId: workspaceId as any,
      campaignId: campaignId as any,
      industry: "Zahnarzt",
      city: "Leipzig",
      country: "Deutschland",
      provider: "rapidapi",
      sourceLabel: "Local Business Data",
      items: [],
      searchedAt: 1,
    })
    const result = await withAlice(t).query(api.lead_search.getLatestSnapshot, { campaignId: campaignId as any })
    assert.equal(result?.industry, "Zahnarzt")
  })

  test("savedKeys and campaignLeadKeys are populated", async () => {
    const t = createTest()
    const workspaceId = await ensureWorkspace(t)
    const campaignId = await createCampaign(t, workspaceId)
    const now = Date.now()
    await withAlice(t).mutation(internal.lead_search.saveSnapshot, {
      workspaceId: workspaceId as any,
      campaignId: campaignId as any,
      industry: "Zahnarzt",
      city: "Leipzig",
      country: "Deutschland",
      provider: "rapidapi",
      sourceLabel: "Local Business Data",
      items: [makeItem({ businessName: "A", sourceId: "s1" }), makeItem({ businessName: "B", sourceId: "s2" })],
      searchedAt: 1,
    })
    await withAlice(t).mutation(async (ctx) => {
      const leadId = await ctx.db.insert("leads", {
        workspaceId: workspaceId as any,
        businessName: "A",
        sourceProvider: "rapidapi",
        sourceId: "s1",
        status: "new",
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert("campaignLeads", {
        workspaceId: workspaceId as any,
        campaignId: campaignId as any,
        leadId,
        status: "new",
        createdAt: now,
        updatedAt: now,
      })
    })
    const result = await withAlice(t).query(api.lead_search.getLatestSnapshot, { campaignId: campaignId as any })
    assert.deepEqual(result?.savedKeys, ["rapidapi-s1"])
    assert.deepEqual(result?.campaignLeadKeys, ["rapidapi-s1"])
  })

  test("saveSnapshot replaces previous snapshot for the same workspace scope", async () => {
    const t = createTest()
    const workspaceId = await ensureWorkspace(t)
    await withAlice(t).mutation(internal.lead_search.saveSnapshot, {
      workspaceId: workspaceId as any,
      industry: "Zahnarzt",
      city: "Leipzig",
      country: "Deutschland",
      provider: "rapidapi",
      sourceLabel: "Local Business Data",
      items: [],
      searchedAt: 1,
    })
    await withAlice(t).mutation(internal.lead_search.saveSnapshot, {
      workspaceId: workspaceId as any,
      industry: "Augenarzt",
      city: "Berlin",
      country: "Deutschland",
      provider: "rapidapi",
      sourceLabel: "Local Business Data",
      items: [],
      searchedAt: 2,
    })
    const result = await withAlice(t).query(api.lead_search.getLatestSnapshot, {})
    assert.equal(result?.industry, "Augenarzt")
    const count = await withAlice(t).query(async (ctx) => await ctx.db.query("leadSearchSnapshots").collect())
    assert.equal(count.length, 1)
  })

  test("saveSnapshot replaces previous snapshot for the same campaign scope", async () => {
    const t = createTest()
    const workspaceId = await ensureWorkspace(t)
    const campaignId = await createCampaign(t, workspaceId)
    await withAlice(t).mutation(internal.lead_search.saveSnapshot, {
      workspaceId: workspaceId as any,
      campaignId: campaignId as any,
      industry: "Zahnarzt",
      city: "Leipzig",
      country: "Deutschland",
      provider: "rapidapi",
      sourceLabel: "Local Business Data",
      items: [],
      searchedAt: 1,
    })
    await withAlice(t).mutation(internal.lead_search.saveSnapshot, {
      workspaceId: workspaceId as any,
      campaignId: campaignId as any,
      industry: "Augenarzt",
      city: "Berlin",
      country: "Deutschland",
      provider: "rapidapi",
      sourceLabel: "Local Business Data",
      items: [],
      searchedAt: 2,
    })
    const result = await withAlice(t).query(api.lead_search.getLatestSnapshot, { campaignId: campaignId as any })
    assert.equal(result?.industry, "Augenarzt")
    const count = await withAlice(t).query(async (ctx) => {
      return await ctx.db.query("leadSearchSnapshots").withIndex("by_campaignId", (q) => q.eq("campaignId", campaignId as any)).collect()
    })
    assert.equal(count.length, 1)
  })

  test("deleteSnapshotsForCampaign removes the campaign snapshot", async () => {
    const t = createTest()
    const workspaceId = await ensureWorkspace(t)
    const campaignId = await createCampaign(t, workspaceId)
    await withAlice(t).mutation(internal.lead_search.saveSnapshot, {
      workspaceId: workspaceId as any,
      campaignId: campaignId as any,
      industry: "Zahnarzt",
      city: "Leipzig",
      country: "Deutschland",
      provider: "rapidapi",
      sourceLabel: "Local Business Data",
      items: [],
      searchedAt: 1,
    })
    await withAlice(t).mutation(internal.lead_search.deleteSnapshotsForCampaign, { campaignId: campaignId as any })
    const result = await withAlice(t).query(api.lead_search.getLatestSnapshot, { campaignId: campaignId as any })
    assert.equal(result, null)
  })

  test("saveSnapshot rejects mismatched campaign workspace", async () => {
    const t = createTest()
    const workspaceId = await ensureWorkspace(t)
    const otherWorkspaceId = await withAlice(t).mutation(async (ctx) => {
      return await ctx.db.insert("workspaces", {
        name: "Other",
        ownerUserId: workspaceState.userId as any,
        accentColor: "#000000",
        contactEmail: "other@example.com",
        ctaText: "",
        reportLanguage: "de",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    })
    const campaignId = await withAlice(t).mutation(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert("campaigns", {
        workspaceId: otherWorkspaceId as any,
        name: "Other Campaign",
        targetIndustry: "Zahnarzt",
        targetCity: "Leipzig",
        targetCountry: "Deutschland",
        offerType: "relaunch",
        language: "de",
        status: "draft",
        createdByUserId: workspaceState.userId as any,
        createdAt: now,
        updatedAt: now,
      })
    })
    await assert.rejects(async () => {
      await withAlice(t).mutation(internal.lead_search.saveSnapshot, {
        workspaceId: workspaceId as any,
        campaignId: campaignId as any,
        industry: "Zahnarzt",
        city: "Leipzig",
        country: "Deutschland",
        provider: "rapidapi",
        sourceLabel: "Local Business Data",
        items: [],
        searchedAt: 1,
      })
    })
  })
})
