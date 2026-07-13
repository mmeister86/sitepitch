/// <reference types="vite/client" />
import { runToCompletion } from "@convex-dev/migrations"
import migrationsComponent from "@convex-dev/migrations/test"
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

import { components, internal } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob(["./migrations.ts", "./lib/lead_search.ts", "./_generated/*.js"])

describe("campaign identity migrations", () => {
  test("backfills domains and only unambiguous campaign audit attribution", async () => {
    const t = convexTest(schema, modules)
    migrationsComponent.register(t)
    const seeded = await t.run(async (ctx) => {
      const now = 1_700_000_000_000
      const userId = await ctx.db.insert("users", {
        tokenIdentifier: "migration-owner",
        betterAuthUserId: "migration-owner",
        email: "owner@example.com",
        createdAt: now,
      })
      const workspaceId = await ctx.db.insert("workspaces", {
        name: "Legacy",
        ownerUserId: userId,
        reportLanguage: "de",
        createdAt: now,
        updatedAt: now,
      })
      const createCampaign = (name: string) => ctx.db.insert("campaigns", {
        workspaceId,
        name,
        targetIndustry: "Agency",
        targetCity: "Berlin",
        targetCountry: "Germany",
        offerType: "relaunch",
        language: "de",
        status: "active",
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
      })
      const [campaignId, secondCampaignId] = await Promise.all([
        createCampaign("One"),
        createCampaign("Two"),
      ])
      const uniqueLeadId = await ctx.db.insert("leads", {
        workspaceId,
        businessName: "Unique",
        websiteUrl: "https://WWW.Example.COM./path",
        sourceProvider: "manual",
        status: "new",
        createdAt: now,
        updatedAt: now,
      })
      const ambiguousLeadId = await ctx.db.insert("leads", {
        workspaceId,
        businessName: "Ambiguous",
        websiteUrl: "https://shop.example.com",
        sourceProvider: "manual",
        status: "new",
        createdAt: now,
        updatedAt: now,
      })
      const uniqueCampaignLeadId = await ctx.db.insert("campaignLeads", {
        workspaceId,
        campaignId,
        leadId: uniqueLeadId,
        status: "new",
        createdAt: now,
        updatedAt: now,
      })
      for (const id of [campaignId, secondCampaignId]) {
        await ctx.db.insert("campaignLeads", {
          workspaceId,
          campaignId: id,
          leadId: ambiguousLeadId,
          status: "new",
          createdAt: now,
          updatedAt: now,
        })
      }
      const baseAudit = {
        workspaceId,
        createdByUserId: userId,
        url: "https://example.com",
        normalizedUrl: "https://example.com/",
        domain: "example.com",
        auditType: "standard" as const,
        reportLanguage: "de" as const,
        status: "completed" as const,
        publicSlug: "slug",
        isPublic: true,
        reportVersion: "v1",
        createdAt: now,
        updatedAt: now,
      }
      const uniqueAuditId = await ctx.db.insert("audits", {
        ...baseAudit,
        leadId: uniqueLeadId,
        idempotencyKey: "unique",
      })
      const ambiguousAuditId = await ctx.db.insert("audits", {
        ...baseAudit,
        leadId: ambiguousLeadId,
        idempotencyKey: "ambiguous",
        publicSlug: "ambiguous",
      })
      return { uniqueLeadId, ambiguousLeadId, uniqueAuditId, ambiguousAuditId, campaignId, uniqueCampaignLeadId }
    })

    await t.run(async (ctx) => {
      await runToCompletion(ctx, components.migrations, internal.migrations.backfillNormalizedLeadDomains)
      await runToCompletion(ctx, components.migrations, internal.migrations.backfillUnambiguousCampaignAuditAttribution)
    })

    const result = await t.run(async (ctx) => ({
      uniqueLead: await ctx.db.get(seeded.uniqueLeadId),
      ambiguousLead: await ctx.db.get(seeded.ambiguousLeadId),
      uniqueAudit: await ctx.db.get(seeded.uniqueAuditId),
      ambiguousAudit: await ctx.db.get(seeded.ambiguousAuditId),
    }))
    expect(result.uniqueLead?.normalizedDomain).toBe("example.com")
    expect(result.ambiguousLead?.normalizedDomain).toBe("shop.example.com")
    expect(result.uniqueAudit?.campaignId).toBe(seeded.campaignId)
    expect(result.uniqueAudit?.campaignLeadId).toBe(seeded.uniqueCampaignLeadId)
    expect(result.ambiguousAudit?.campaignId).toBeUndefined()
    expect(result.ambiguousAudit?.campaignLeadId).toBeUndefined()
  })
})
