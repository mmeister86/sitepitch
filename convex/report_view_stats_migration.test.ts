/// <reference types="vite/client" />
import { describe, expect, test } from "vitest"
import { convexTest } from "convex-test"
import { runToCompletion } from "@convex-dev/migrations"
import migrationsComponent from "@convex-dev/migrations/test"

import { components, internal } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob(["./migrations.ts", "./_generated/*.js"])

async function seedAudit(t: ReturnType<typeof convexTest>, slug: string) {
  return await t.run(async (ctx) => {
    const createdAt = 1_700_000_000_000
    const userId = await ctx.db.insert("users", {
      tokenIdentifier: `${slug}-user`,
      betterAuthUserId: `${slug}-user`,
      email: `${slug}@example.com`,
      createdAt,
    })
    const workspaceId = await ctx.db.insert("workspaces", {
      name: slug,
      ownerUserId: userId,
      reportLanguage: "de",
      createdAt,
      updatedAt: createdAt,
    })
    const auditId = await ctx.db.insert("audits", {
      workspaceId,
      createdByUserId: userId,
      url: `https://${slug}.example`,
      normalizedUrl: `https://${slug}.example/`,
      domain: `${slug}.example`,
      auditType: "standard",
      reportLanguage: "de",
      idempotencyKey: slug,
      status: "completed",
      publicSlug: slug,
      isPublic: true,
      reportVersion: "v1",
      createdAt,
      updatedAt: createdAt,
    })
    return { workspaceId, auditId }
  })
}

describe("legacy report view stats migrations", () => {
  test("builds exact view aggregates, preserves actions, finalizes, and remains idempotent after restart", async () => {
    const t = convexTest(schema, modules)
    migrationsComponent.register(t)
    const { workspaceId, auditId } = await seedAudit(t, "legacy-stats")
    await t.run(async (ctx) => {
      for (const viewedAt of [300, 100, 200]) {
        await ctx.db.insert("reportViews", { workspaceId, auditId, viewedAt })
      }
      await ctx.db.insert("reportViewStats", {
        workspaceId,
        auditId,
        totalViews: 0,
        reopenCount: 0,
        ctaClicks: 4,
        pdfDownloads: 2,
        viewAggregationState: "pending",
      })
    })

    await t.run(async (ctx) => {
      await runToCompletion(ctx, components.migrations, internal.migrations.backfillLegacyReportViewStats, {
        name: "test:legacy-report-views:first",
        batchSize: 1,
      })
      await runToCompletion(ctx, components.migrations, internal.migrations.finalizeLegacyReportViewStats, {
        name: "test:legacy-report-views:finalize-first",
        batchSize: 1,
      })
      // A reset/re-run traverses the table again under a fresh component run;
      // per-row markers must make it a no-op for totals.
      await runToCompletion(ctx, components.migrations, internal.migrations.backfillLegacyReportViewStats, {
        name: "test:legacy-report-views:reset",
        cursor: null,
        batchSize: 1,
      })
      await runToCompletion(ctx, components.migrations, internal.migrations.finalizeLegacyReportViewStats, {
        name: "test:legacy-report-views:finalize-reset",
        cursor: null,
        batchSize: 1,
      })
    })

    const result = await t.run(async (ctx) => ({
      stats: await ctx.db.query("reportViewStats").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).unique(),
      views: await ctx.db.query("reportViews").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).collect(),
      verification: await ctx.runQuery(internal.migrations.verifyLegacyReportViewStats, {}),
    }))
    expect(result.stats).toMatchObject({
      totalViews: 3,
      firstViewedAt: 100,
      lastViewedAt: 300,
      reopenCount: 2,
      ctaClicks: 4,
      pdfDownloads: 2,
      viewAggregationState: "accurate",
    })
    expect(result.views.every((view) => view.includedInStats === true)).toBe(true)
    expect(result.verification).toEqual({
      complete: true,
      sampleUnaggregatedViewId: null,
      samplePendingAuditId: null,
    })
  })

  test("does not double an existing accurate pre-rollout aggregate", async () => {
    const t = convexTest(schema, modules)
    migrationsComponent.register(t)
    const { workspaceId, auditId } = await seedAudit(t, "accurate-stats")
    await t.run(async (ctx) => {
      await ctx.db.insert("reportViews", { workspaceId, auditId, viewedAt: 100 })
      await ctx.db.insert("reportViews", { workspaceId, auditId, viewedAt: 200 })
      await ctx.db.insert("reportViewStats", {
        workspaceId,
        auditId,
        totalViews: 2,
        firstViewedAt: 100,
        lastViewedAt: 200,
        reopenCount: 1,
        ctaClicks: 3,
        pdfDownloads: 1,
      })
    })

    await t.run(async (ctx) => {
      await runToCompletion(ctx, components.migrations, internal.migrations.backfillLegacyReportViewStats, {
        name: "test:accurate-report-views",
        batchSize: 1,
      })
    })
    const stats = await t.run((ctx) =>
      ctx.db.query("reportViewStats").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).unique(),
    )
    expect(stats).toMatchObject({
      totalViews: 2,
      firstViewedAt: 100,
      lastViewedAt: 200,
      reopenCount: 1,
      ctaClicks: 3,
      pdfDownloads: 1,
      viewAggregationState: "accurate",
    })
  })
})
