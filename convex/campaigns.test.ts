import assert from "node:assert/strict"

import { convexTest } from "convex-test"
import { v } from "convex/values"
import { beforeEach, describe, expect, test, vi } from "vitest"

import schema from "./schema.ts"
import { api, internal } from "./_generated/api"

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  checkAuditStartLimits: vi.fn(),
  checkLeadSearchLimit: vi.fn(),
  auditWorkpoolEnqueueAction: vi.fn(async (..._args: any[]) => "work-id" as string),
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
  checkAuditStartLimits: mocks.checkAuditStartLimits,
  checkLeadSearchLimit: mocks.checkLeadSearchLimit,
  checkProviderLimit: vi.fn(),
  auditRateLimiter: { limit: vi.fn() },
  isPaidPlan: vi.fn(),
  providerToLimitKind: vi.fn(),
  throwRateLimited: vi.fn(),
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
      args: { auditId: v.id("audits") },
      handler: async () => null,
    }),
  }
})

vi.mock("./workspaces.ts", async () => {
  const { mutation, query } = await import("./_generated/server")
  const { ensureWorkspaceCreditBalance, getWorkspaceCreditBalance, getWorkspaceCreditSnapshot } = await import("./lib/credits")

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
        const workspace: any = workspaceState.workspaceId
          ? await ctx.db.get(workspaceState.workspaceId as any)
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
    getWorkspaceAuditContext: query({
      args: { workspaceId: v.id("workspaces") },
      handler: async (ctx, args) => {
        const workspace: any = await ctx.db.get(args.workspaceId as any)
        if (!workspace) return null
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
  "./campaigns.ts",
  "./leads.ts",
  "./lead_search.ts",
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

function withBob(t: ReturnType<typeof createTest>) {
  return t.withIdentity({
    tokenIdentifier: "bob-token-identifier",
    email: "bob@example.com",
    name: "Bob",
  })
}

beforeEach(() => {
  mocks.fetch.mockReset()
  mocks.checkAuditStartLimits.mockReset()
  mocks.checkLeadSearchLimit.mockReset()
  mocks.auditWorkpoolEnqueueAction.mockReset()
  mocks.auditWorkpoolEnqueueAction.mockResolvedValue("work-id")
  workspaceState.userId = null
  workspaceState.workspaceId = null
})

async function createCampaign(
  t: ReturnType<typeof createTest>,
  status: "draft" | "active" | "archived" = "active",
) {
  await withAlice(t).mutation(api.workspaces.ensureCurrentWorkspace, {})
  const result = await withAlice(t).mutation(api.campaigns.create, {
    name: "Zahnärzte Leipzig",
    targetIndustry: "Zahnarzt",
    targetCity: "Leipzig",
    targetCountry: "Deutschland",
    offerType: "relaunch",
    language: "de",
    status: status === "archived" ? "active" : status,
  })
  const campaignId = result.campaignId
  if (status === "archived") {
    await withAlice(t).mutation(api.campaigns.setStatus, { campaignId, status: "archived" })
  }
  return campaignId
}

async function saveLead(
  t: ReturnType<typeof createTest>,
  opts: { campaignId?: string; businessName?: string; websiteUrl?: string; sourceId?: string } = {},
) {
  return withAlice(t).mutation(api.leads.saveLeadFromSearch, {
    businessName: opts.businessName ?? "Zahnarztpraxis Dr. Weber",
    websiteUrl: opts.websiteUrl ?? "zahnarzt-weber-leipzig.de",
    category: "Zahnarzt",
    city: "Leipzig",
    country: "Deutschland",
    sourceProvider: "manual",
    sourceId: opts.sourceId ?? undefined,
    campaignId: opts.campaignId as any,
  })
}

describe("campaigns.create", () => {
  test("creates an active campaign", async () => {
    const t = createTest()
    const campaignId = await createCampaign(t)

    const result = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    assert.ok(result)
    assert.equal(result.campaign.name, "Zahnärzte Leipzig")
    assert.equal(result.campaign.status, "active")
  })

  test("rejects empty campaign name", async () => {
    const t = createTest()
    await withAlice(t).mutation(api.workspaces.ensureCurrentWorkspace, {})
    await expect(
      withAlice(t).mutation(api.campaigns.create, {
        name: "  ",
        targetIndustry: "Zahnarzt",
        targetCity: "Leipzig",
        targetCountry: "Deutschland",
        offerType: "relaunch",
        language: "de",
        status: "active",
      }),
    ).rejects.toThrow(/VALIDATION_ERROR/)
  })

  test("unauthenticated users cannot create campaigns", async () => {
    const t = createTest()
    await expect(
      t.mutation(api.campaigns.create, {
        name: "Zahnärzte Leipzig",
        targetIndustry: "Zahnarzt",
        targetCity: "Leipzig",
        targetCountry: "Deutschland",
        offerType: "relaunch",
        language: "de",
        status: "active",
      }),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })
})

describe("campaigns.getMyCampaign", () => {
  test("returns null for other workspaces", async () => {
    const t = createTest()
    const campaignId = await createCampaign(t)

    const result = await withBob(t).query(api.campaigns.getMyCampaign, { campaignId })
    assert.equal(result, null)
  })
})

describe("campaigns.attachExistingLead", () => {
  test("adds a lead to a campaign and records activity", async () => {
    const t = createTest()
    const campaignId = await createCampaign(t)
    const leadId = await saveLead(t)

    const result = await withAlice(t).mutation(api.campaigns.attachExistingLead, {
      campaignId,
      leadId: leadId as any,
    })
    assert.equal(result.alreadyAttached, false)

    const detail = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    assert.equal(detail?.leads.length, 1)
    assert.equal(detail?.leads[0].status, "new")
    assert.equal(detail?.activity.length, 1)
  })

  test("prevents duplicate lead assignment", async () => {
    const t = createTest()
    const campaignId = await createCampaign(t)
    const leadId = await saveLead(t)

    await withAlice(t).mutation(api.campaigns.attachExistingLead, {
      campaignId,
      leadId: leadId as any,
    })
    const result = await withAlice(t).mutation(api.campaigns.attachExistingLead, {
      campaignId,
      leadId: leadId as any,
    })
    assert.equal(result.alreadyAttached, true)

    const detail = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    assert.equal(detail?.leads.length, 1)
  })

  test("rejects archived campaigns", async () => {
    const t = createTest()
    const campaignId = await createCampaign(t, "archived")
    const leadId = await saveLead(t)

    await expect(
      withAlice(t).mutation(api.campaigns.attachExistingLead, {
        campaignId,
        leadId: leadId as any,
      }),
    ).rejects.toThrow(/VALIDATION_ERROR/)
  })
})

describe("campaigns.saveLeadFromSearch with campaignId", () => {
  test("saves a lead directly into a campaign", async () => {
    const t = createTest()
    const campaignId = await createCampaign(t)
    await saveLead(t, { campaignId })

    const detail = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    assert.equal(detail?.leads.length, 1)
  })

  test("does not duplicate existing leads in campaign", async () => {
    const t = createTest()
    const campaignId = await createCampaign(t)
    const leadId = await saveLead(t, { sourceId: "duplicate" })
    await saveLead(t, { campaignId, sourceId: "duplicate" })
    await saveLead(t, { campaignId, sourceId: "duplicate" })

    const detail = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    assert.equal(detail?.leads.length, 1)
    assert.equal(detail?.leads[0].leadId, leadId)
  })
})

describe("campaigns.updateLeadStatus", () => {
  test("sets contacted and records lastContactedAt", async () => {
    const t = createTest()
    const campaignId = await createCampaign(t)
    await saveLead(t, { campaignId })

    const detailBefore = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    const campaignLeadId = detailBefore!.leads[0].campaignLeadId

    const before = Date.now()
    await withAlice(t).mutation(api.campaigns.updateLeadStatus, {
      campaignLeadId: campaignLeadId as any,
      status: "contacted",
    })
    const after = Date.now()

    const detail = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    assert.equal(detail?.leads[0].status, "contacted")
    assert.ok(detail?.leads[0].lastContactedAt)
    assert.ok(detail!.leads[0].lastContactedAt! >= before)
    assert.ok(detail!.leads[0].lastContactedAt! <= after)
  })

  test("terminal statuses remove follow-up", async () => {
    const t = createTest()
    const campaignId = await createCampaign(t)
    await saveLead(t, { campaignId })

    const detail = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    const campaignLeadId = detail!.leads[0].campaignLeadId

    await withAlice(t).mutation(api.campaigns.setFollowUp, {
      campaignLeadId: campaignLeadId as any,
      followUpAt: Date.now() + 24 * 60 * 60 * 1000,
    })

    await withAlice(t).mutation(api.campaigns.updateLeadStatus, {
      campaignLeadId: campaignLeadId as any,
      status: "won",
    })

    const detailAfter = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    assert.equal(detailAfter?.leads[0].status, "won")
    assert.equal(detailAfter?.leads[0].followUpAt, undefined)
  })
})

describe("campaigns.saveLeadNote", () => {
  test("saves and truncates empty notes", async () => {
    const t = createTest()
    const campaignId = await createCampaign(t)
    await saveLead(t, { campaignId })

    const detail = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    const campaignLeadId = detail!.leads[0].campaignLeadId

    await withAlice(t).mutation(api.campaigns.saveLeadNote, {
      campaignLeadId: campaignLeadId as any,
      note: "  ",
    })

    const detailAfter = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    assert.equal(detailAfter?.leads[0].note, undefined)
  })

  test("enforces maximum length", async () => {
    const t = createTest()
    const campaignId = await createCampaign(t)
    await saveLead(t, { campaignId })

    const detail = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    const campaignLeadId = detail!.leads[0].campaignLeadId

    await expect(
      withAlice(t).mutation(api.campaigns.saveLeadNote, {
        campaignLeadId: campaignLeadId as any,
        note: "a".repeat(2001),
      }),
    ).rejects.toThrow(/VALIDATION_ERROR/)
  })
})

describe("campaigns.setFollowUp", () => {
  test("sets follow-up and status", async () => {
    const t = createTest()
    const campaignId = await createCampaign(t)
    await saveLead(t, { campaignId })

    const detail = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    const campaignLeadId = detail!.leads[0].campaignLeadId
    const tomorrow = Date.now() + 24 * 60 * 60 * 1000

    await withAlice(t).mutation(api.campaigns.setFollowUp, {
      campaignLeadId: campaignLeadId as any,
      followUpAt: tomorrow,
    })

    const detailAfter = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    assert.equal(detailAfter?.leads[0].status, "follow_up")
    assert.equal(detailAfter?.leads[0].followUpAt, tomorrow)
  })

  test("clears follow-up and resets status", async () => {
    const t = createTest()
    const campaignId = await createCampaign(t)
    await saveLead(t, { campaignId })

    const detail = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    const campaignLeadId = detail!.leads[0].campaignLeadId

    await withAlice(t).mutation(api.campaigns.setFollowUp, {
      campaignLeadId: campaignLeadId as any,
      followUpAt: Date.now() + 24 * 60 * 60 * 1000,
    })
    await withAlice(t).mutation(api.campaigns.setFollowUp, {
      campaignLeadId: campaignLeadId as any,
      followUpAt: null,
    })

    const detailAfter = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    assert.equal(detailAfter?.leads[0].status, "audited")
  })

  test("rejects follow-up for won leads", async () => {
    const t = createTest()
    const campaignId = await createCampaign(t)
    await saveLead(t, { campaignId })

    const detail = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    const campaignLeadId = detail!.leads[0].campaignLeadId

    await withAlice(t).mutation(api.campaigns.updateLeadStatus, {
      campaignLeadId: campaignLeadId as any,
      status: "won",
    })

    await expect(
      withAlice(t).mutation(api.campaigns.setFollowUp, {
        campaignLeadId: campaignLeadId as any,
        followUpAt: Date.now() + 24 * 60 * 60 * 1000,
      }),
    ).rejects.toThrow(/VALIDATION_ERROR/)
  })
})

describe("campaigns.setStatus", () => {
  test("allows active -> paused -> active -> archived", async () => {
    const t = createTest()
    const campaignId = await createCampaign(t)

    await withAlice(t).mutation(api.campaigns.setStatus, { campaignId, status: "paused" })
    let detail = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    assert.equal(detail?.campaign.status, "paused")

    await withAlice(t).mutation(api.campaigns.setStatus, { campaignId, status: "active" })
    detail = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    assert.equal(detail?.campaign.status, "active")

    await withAlice(t).mutation(api.campaigns.setStatus, { campaignId, status: "archived" })
    detail = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    assert.equal(detail?.campaign.status, "archived")
  })

  test("rejects invalid transitions", async () => {
    const t = createTest()
    const campaignId = await createCampaign(t)
    await withAlice(t).mutation(api.campaigns.setStatus, { campaignId, status: "archived" })

    await expect(
      withAlice(t).mutation(api.campaigns.setStatus, { campaignId, status: "active" }),
    ).rejects.toThrow(/VALIDATION_ERROR/)
  })
})

describe("campaigns.removeLead", () => {
  test("removes lead from campaign without deleting global lead", async () => {
    const t = createTest()
    const campaignId = await createCampaign(t)
    const leadId = await saveLead(t, { campaignId })

    const detailBefore = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    await withAlice(t).mutation(api.campaigns.removeLead, {
      campaignLeadId: detailBefore!.leads[0].campaignLeadId as any,
    })

    const detailAfter = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    assert.equal(detailAfter?.leads.length, 0)

    const lead = await withAlice(t).query(api.leads.listMyLeads, {})
    assert.equal(lead?.total, 1)
    assert.equal(lead?.items[0]._id, leadId)
  })
})

describe("campaigns.deleteCampaign", () => {
  test("deletes draft campaign and associations without deleting leads", async () => {
    const t = createTest()
    const campaignId = await createCampaign(t, "draft")
    const leadId = await saveLead(t, { campaignId })

    await withAlice(t).mutation(api.campaigns.deleteCampaign, { campaignId })

    const detail = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    assert.equal(detail, null)

    const lead = await withAlice(t).query(api.leads.listMyLeads, {})
    assert.equal(lead?.total, 1)
    assert.equal(lead?.items[0]._id, leadId)
  })

  test("rejects deletion of active campaign", async () => {
    const t = createTest()
    const campaignId = await createCampaign(t)

    await expect(
      withAlice(t).mutation(api.campaigns.deleteCampaign, { campaignId }),
    ).rejects.toThrow(/VALIDATION_ERROR/)
  })
})

describe("campaigns.metrics", () => {
  test("counts leads, audits, views and outreach", async () => {
    const t = createTest()
    const campaignId = await createCampaign(t)
    const leadId = await saveLead(t, { campaignId, websiteUrl: "zahnarzt-weber-leipzig.de" })

    const workspace = await withAlice(t).query(api.workspaces.getMyWorkspace, {})
    const workspaceId = workspace!.workspaceId
    const now = Date.now()

    const auditId = await withAlice(t).run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", "test-token-identifier"))
        .unique()
      return await ctx.db.insert("audits", {
        workspaceId: workspaceId as any,
        leadId: leadId as any,
        createdByUserId: user!._id,
        url: "https://zahnarzt-weber-leipzig.de",
        normalizedUrl: "https://zahnarzt-weber-leipzig.de/",
        domain: "zahnarzt-weber-leipzig.de",
        auditType: "local",
        reportLanguage: "de",
        idempotencyKey: "test-key-1",
        status: "completed",
        publicSlug: "test-slug",
        isPublic: true,
        reportVersion: "v1",
        overallScore: 45,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      })
    })

    await withAlice(t).run(async (ctx) => {
      await ctx.db.patch(leadId as any, { auditId: auditId as any, updatedAt: Date.now() })
      await ctx.db.insert("auditScores", {
        workspaceId: workspaceId as any,
        auditId: auditId as any,
        conversionScore: 40,
        seoBasicsScore: 50,
        localSeoScore: 40,
        performanceScore: 50,
        mobileUxScore: 45,
        trustScore: 50,
        overallScore: 45,
        scoringVersion: "v1",
        createdAt: now,
      })
      await ctx.db.insert("reportViews", {
        workspaceId: workspaceId as any,
        auditId: auditId as any,
        viewedAt: now,
      })
      await ctx.db.insert("usageEvents", {
        workspaceId: workspaceId as any,
        userId: (await ctx.db
          .query("users")
          .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", "test-token-identifier"))
          .unique())!._id,
        auditId: auditId as any,
        event: "outreach_copied",
        metadata: { draftType: "email" },
        createdAt: now,
      })
    })

    await withAlice(t).mutation(api.campaigns.updateLeadStatus, {
      campaignLeadId: (await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId }))!.leads[0].campaignLeadId as any,
      status: "won",
    })

    const detail = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    assert.equal(detail?.metrics.leads, 1)
    assert.equal(detail?.metrics.audits, 1)
    assert.equal(detail?.metrics.reportViews, 1)
    assert.equal(detail?.metrics.outreachCopied, 1)
    assert.equal(detail?.metrics.won, 1)
    assert.equal(detail?.metrics.lost, 0)
    assert.equal(detail?.leads[0].audit?.overallScore, 45)
  })
})

describe("campaigns.leads.deleteLead cleanup", () => {
  test("deleting a lead removes campaign associations", async () => {
    const t = createTest()
    const campaignId = await createCampaign(t)
    const leadId = await saveLead(t, { campaignId })

    await withAlice(t).mutation(api.leads.deleteLead, { leadId: leadId as any })

    const detail = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    assert.equal(detail?.leads.length, 0)

    const activities = await withAlice(t).query(api.campaigns.getMyCampaign, { campaignId })
    assert.equal(activities?.activity.length, 0)
  })
})
