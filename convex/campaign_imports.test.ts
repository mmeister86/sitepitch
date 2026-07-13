/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { api } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

vi.mock("./auth.ts", () => ({
  authComponent: {
    getAuthUser: async (ctx: any) => {
      const identity = await ctx.auth.getUserIdentity()
      return identity
        ? { _id: "mock-auth-user", email: identity.email ?? "alice@example.com", name: "Alice" }
        : null
    },
  },
  createAuth: vi.fn(),
  getAuthUser: vi.fn(),
}))

const modules = import.meta.glob([
  "./auth.ts",
  "./campaign_imports.ts",
  "./lib/*.ts",
  "./_generated/*.js",
])

function createTest() {
  return convexTest(schema, modules)
}

function asAlice(t: ReturnType<typeof createTest>) {
  return t.withIdentity({
    tokenIdentifier: "alice-token",
    email: "alice@example.com",
    name: "Alice",
  })
}

async function seed(t: ReturnType<typeof createTest>) {
  return t.run(async (ctx) => {
    const now = Date.now()
    const userId = await ctx.db.insert("users", {
      tokenIdentifier: "alice-token",
      betterAuthUserId: "mock-auth-user",
      email: "alice@example.com",
      name: "Alice",
      createdAt: now,
    })
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Alice",
      ownerUserId: userId,
      accentColor: "#5b5bd6",
      contactEmail: "alice@example.com",
      ctaText: "Kontakt",
      reportLanguage: "de",
      createdAt: now,
      updatedAt: now,
    })
    const campaignId = await ctx.db.insert("campaigns", {
      workspaceId,
      name: "Berlin",
      targetIndustry: "Agentur",
      targetCity: "Berlin",
      targetCountry: "Deutschland",
      offerType: "relaunch",
      language: "de",
      status: "active",
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    })
    return { userId, workspaceId, campaignId }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("campaign_imports.previewLeadImport", () => {
  test("classifies invalid, in-file, and existing-domain duplicates", async () => {
    const t = createTest()
    const { workspaceId, campaignId } = await seed(t)
    await t.run(async (ctx) => {
      await ctx.db.insert("leads", {
        workspaceId,
        businessName: "Bestehend",
        websiteUrl: "https://example.de",
        normalizedWebsiteUrl: "https://example.de/",
        normalizedDomain: "example.de",
        sourceProvider: "manual",
        status: "new",
        createdAt: 1,
        updatedAt: 1,
      })
    })

    const preview = await asAlice(t).query(api.campaign_imports.previewLeadImport, {
      campaignId,
      rows: [
        { rowNumber: 2, businessName: "Bestehend", websiteUrl: "www.EXAMPLE.de" },
        { rowNumber: 3, businessName: "Neu", websiteUrl: "new.example" },
        { rowNumber: 4, businessName: "Doppelt", websiteUrl: "https://new.example/kontakt" },
        { rowNumber: 5, businessName: "", websiteUrl: "invalid.example" },
        { rowNumber: 6, businessName: "Ohne Website" },
      ],
    })

    expect(preview.items.map((item) => item.classification)).toEqual([
      "duplicate_existing",
      "valid_new",
      "duplicate_in_file",
      "invalid",
      "valid_new",
    ])
    expect(preview.items.at(-1)?.auditReady).toBe(false)
  })

  test("classifies an overlong optional field per row without aborting the preview", async () => {
    const t = createTest()
    const { campaignId } = await seed(t)
    const preview = await asAlice(t).query(api.campaign_imports.previewLeadImport, {
      campaignId,
      rows: [
        { rowNumber: 2, businessName: "Zu lang", address: "x".repeat(501) },
        { rowNumber: 3, businessName: "Gültig" },
      ],
    })

    expect(preview.items.map((item) => item.classification)).toEqual(["invalid", "valid_new"])
    expect(preview.items[0].error).toMatch(/maximal 500/)
  })
})

describe("campaign_imports.importLeadBatch", () => {
  test("imports 50 rows in bounded batches and retries idempotently", async () => {
    const t = createTest()
    const { workspaceId, campaignId } = await seed(t)
    const rows = Array.from({ length: 50 }, (_, index) => ({
      rowNumber: index + 2,
      businessName: `Firma ${index + 1}`,
      websiteUrl: `firma-${index + 1}.example`,
      city: "Berlin",
    }))

    const first = await asAlice(t).mutation(api.campaign_imports.importLeadBatch, {
      campaignId,
      importId: "import_12345678",
      rows: rows.slice(0, 25),
    })
    const second = await asAlice(t).mutation(api.campaign_imports.importLeadBatch, {
      campaignId,
      importId: "import_12345678",
      rows: rows.slice(25),
    })
    const retry = await asAlice(t).mutation(api.campaign_imports.importLeadBatch, {
      campaignId,
      importId: "import_12345678",
      rows: rows.slice(0, 25),
    })

    expect(first).toMatchObject({ created: 25, attached: 25 })
    expect(second).toMatchObject({ created: 25, attached: 25 })
    expect(retry).toMatchObject({ created: 0, reused: 25, attached: 0 })
    expect(first.items).toHaveLength(25)
    expect(first.items.every((item) => item.status === "created" && item.attached)).toBe(true)
    expect(retry.items.every((item) => item.status === "reused" && !item.attached)).toBe(true)

    const counts = await t.run(async (ctx) => ({
      leads: (
        await ctx.db
          .query("leads")
          .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
          .take(100)
      ).length,
      campaignLeads: (
        await ctx.db
          .query("campaignLeads")
          .withIndex("by_campaignId", (q) => q.eq("campaignId", campaignId))
          .take(100)
      ).length,
    }))
    expect(counts).toEqual({ leads: 50, campaignLeads: 50 })
  })

  test("rejects batches larger than 25 rows", async () => {
    const t = createTest()
    const { campaignId } = await seed(t)
    const rows = Array.from({ length: 26 }, (_, index) => ({
      rowNumber: index + 2,
      businessName: `Firma ${index + 1}`,
    }))

    await expect(
      asAlice(t).mutation(api.campaign_imports.importLeadBatch, {
        campaignId,
        importId: "import_12345678",
        rows,
      }),
    ).rejects.toThrow(/1 bis 25/)
  })
})

describe("campaign_imports.createManualLead", () => {
  test("reuses a workspace-domain lead and fills only missing profile fields", async () => {
    const t = createTest()
    const { workspaceId, campaignId } = await seed(t)
    const leadId = await t.run(async (ctx) =>
      ctx.db.insert("leads", {
        workspaceId,
        businessName: "Originalname",
        websiteUrl: "https://example.de",
        normalizedWebsiteUrl: "https://example.de/",
        normalizedDomain: "example.de",
        city: "Hamburg",
        sourceProvider: "manual",
        status: "new",
        createdAt: 1,
        updatedAt: 1,
      }),
    )
    await t.run(async (ctx) =>
      ctx.db.insert("leads", {
        workspaceId,
        businessName: "Spätere Dublette",
        websiteUrl: "https://www.example.de",
        normalizedWebsiteUrl: "https://www.example.de/",
        normalizedDomain: "example.de",
        sourceProvider: "manual",
        status: "new",
        createdAt: 2,
        updatedAt: 2,
      }),
    )

    const result = await asAlice(t).mutation(api.campaign_imports.createManualLead, {
      campaignId,
      businessName: "Neuer Name",
      websiteUrl: "www.example.de/kontakt",
      city: "Berlin",
      phone: "+49 30 123",
    })

    expect(result).toEqual({ leadId, reused: true })
    const lead = await t.run((ctx) => ctx.db.get(leadId as Id<"leads">))
    expect(lead).toMatchObject({ businessName: "Originalname", city: "Hamburg", phone: "+49 30 123" })
  })
})
