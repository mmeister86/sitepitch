/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { describe, expect, test, vi } from "vitest"

import { api } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

vi.mock("./auth.ts", () => ({
  authComponent: {
    getAuthUser: async (ctx: any) => {
      const identity = await ctx.auth.getUserIdentity()
      return identity
        ? { _id: "better-auth-user", email: identity.email, name: identity.name }
        : null
    },
  },
  createAuth: vi.fn(),
  getAuthUser: vi.fn(),
}))

vi.mock("./lib/report_pdf_queue.ts", () => ({
  queueReportPdfArtifact: vi.fn(async () => null),
}))

const modules = import.meta.glob([
  "./auth.ts",
  "./report_settings.ts",
  "./lib/*.ts",
  "./_generated/*.js",
])

function createTest() {
  return convexTest(schema, modules)
}

function asOwner(t: ReturnType<typeof createTest>) {
  return t.withIdentity({
    tokenIdentifier: "report-settings-owner",
    email: "owner@example.com",
    name: "Owner",
  })
}

async function seed(t: ReturnType<typeof createTest>, plan: "free" | "pro" | "agency" = "free") {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const userId = await ctx.db.insert("users", {
      tokenIdentifier: "report-settings-owner",
      betterAuthUserId: "better-auth-user",
      email: "owner@example.com",
      name: "Owner",
      createdAt: now,
    })
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Owner Studio",
      ownerUserId: userId,
      accentColor: "#123456",
      website: "https://studio.example.com",
      ctaText: "Workspace CTA",
      ctaUrl: "https://studio.example.com/contact",
      reportLanguage: "de",
      createdAt: now,
      updatedAt: now,
    })
    if (plan !== "free") {
      await ctx.db.insert("subscriptions", {
        workspaceId,
        provider: "lemonsqueezy",
        plan,
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
    }
    const campaignId = await ctx.db.insert("campaigns", {
      workspaceId,
      name: "Leipzig",
      targetIndustry: "Zahnarzt",
      targetCity: "Leipzig",
      targetCountry: "Deutschland",
      offerType: "relaunch",
      language: "de",
      reportIntro: "Campaign Intro",
      reportCtaText: "Campaign CTA",
      reportCtaUrl: "https://campaign.example.com",
      status: "active",
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    })
    const leadId = await ctx.db.insert("leads", {
      workspaceId,
      businessName: "Praxis",
      sourceProvider: "manual",
      status: "new",
      reportCtaText: "Lead CTA",
      reportCtaUrl: "https://lead.example.com",
      createdAt: now,
      updatedAt: now,
    })
    const auditId = await ctx.db.insert("audits", {
      workspaceId,
      campaignId,
      leadId,
      createdByUserId: userId,
      url: "https://example.com",
      normalizedUrl: "https://example.com/",
      domain: "example.com",
      auditType: "standard",
      reportLanguage: "de",
      idempotencyKey: `settings-${plan}-${now}`,
      status: "completed",
      publicSlug: `settings-${plan}-${now}`,
      isPublic: false,
      reportVersion: "v1",
      completedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    return { auditId, workspaceId, campaignId, leadId } satisfies {
      auditId: Id<"audits">
      workspaceId: Id<"workspaces">
      campaignId: Id<"campaigns">
      leadId: Id<"leads">
    }
  })
}

describe("report settings snapshots", () => {
  test("returns safe legacy defaults with lead-over-campaign-over-workspace precedence", async () => {
    const t = createTest()
    const { auditId } = await seed(t)

    const result = await asOwner(t).query(api.report_settings.getReportSettings, { auditId })

    expect(result.settings).toMatchObject({
      brandName: "Owner Studio",
      theme: "classic",
      primaryColor: "#123456",
      backgroundColor: "#ffffff",
      textColor: "#18181b",
      introText: "Campaign Intro",
      introSource: "campaign",
      ctaText: "Lead CTA",
      ctaTextSource: "lead",
      ctaUrl: "https://lead.example.com",
      ctaUrlSource: "lead",
      effectiveShowPoweredBy: true,
      isLegacyFallback: true,
    })
    expect(result.capabilities.pdfExport).toBe(false)
  })

  test("blocks premium changes on the free plan", async () => {
    const t = createTest()
    const { auditId } = await seed(t)

    await expect(asOwner(t).mutation(api.report_settings.saveReportSettings, {
      auditId,
      theme: "minimal",
      primaryColor: "#123456",
      backgroundColor: "#ffffff",
      textColor: "#18181b",
      hiddenSections: [],
      introText: null,
      ctaText: null,
      ctaUrl: null,
      showPoweredByPreference: true,
      expiresAt: null,
    })).rejects.toThrow(/PLAN_UPGRADE_REQUIRED/)
  })

  test("persists pro customization while continuing to enforce powered-by", async () => {
    const t = createTest()
    const { auditId } = await seed(t, "pro")

    await asOwner(t).mutation(api.report_settings.saveReportSettings, {
      auditId,
      theme: "editorial",
      primaryColor: "#abcdef",
      backgroundColor: "#fefefe",
      textColor: "#111111",
      hiddenSections: ["screenshots", "cta"],
      introText: "Individuelles Intro",
      ctaText: "Termin buchen",
      ctaUrl: "https://owner.example.com/book",
      showPoweredByPreference: true,
      expiresAt: Date.now() + 86_400_000,
    })

    const result = await asOwner(t).query(api.report_settings.getReportSettings, { auditId })
    expect(result.settings).toMatchObject({
      theme: "editorial",
      primaryColor: "#abcdef",
      hiddenSections: ["screenshots", "cta"],
      introSource: "report",
      ctaTextSource: "report",
      ctaUrl: "https://owner.example.com/book",
      effectiveShowPoweredBy: true,
      isLegacyFallback: false,
    })
    expect(result.capabilities.pdfExport).toBe(true)
    expect(result.capabilities.poweredByToggle).toBe(false)
  })

  test("lets agency reports hide the powered-by footer", async () => {
    const t = createTest()
    const { auditId } = await seed(t, "agency")

    await asOwner(t).mutation(api.report_settings.saveReportSettings, {
      auditId,
      theme: "classic",
      primaryColor: "#123456",
      backgroundColor: "#ffffff",
      textColor: "#18181b",
      hiddenSections: [],
      introText: null,
      ctaText: null,
      ctaUrl: null,
      showPoweredByPreference: false,
      expiresAt: null,
    })

    const result = await asOwner(t).query(api.report_settings.getReportSettings, { auditId })
    expect(result.settings.effectiveShowPoweredBy).toBe(false)
    expect(result.capabilities.customDomain).toBe(true)
  })
})
