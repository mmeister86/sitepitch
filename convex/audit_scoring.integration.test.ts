/// <reference types="vite/client" />
import assert from "node:assert/strict"

import { convexTest } from "convex-test"
import { beforeEach, describe, test } from "vitest"

import schema from "./schema.ts"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"

const modules = import.meta.glob([
  "./auth.ts",
  "./audits.ts",
  "./audit_pipeline.ts",
  "./audit_scoring.ts",
  "./audit_state.ts",
  "./audit_agent.ts",
  "./audit_agent_action.ts",
  "./http.ts",
  "./workspaces.ts",
  "./lib/*.ts",
  "./_generated/*.js",
])

function createTest() {
  return convexTest(schema, modules)
}

type SeedIds = {
  workspaceId: Id<"workspaces">
  auditId: Id<"audits">
}

function seedBaseAudit(t: ReturnType<typeof createTest>): Promise<SeedIds> {
  return t.mutation(async (ctx) => {
    const now = Date.now()

    const userId = await ctx.db.insert("users", {
      tokenIdentifier: "seed-token",
      betterAuthUserId: "seed-better-auth",
      email: "seed@example.com",
      createdAt: now,
    })

    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Seed Workspace",
      ownerUserId: userId,
      reportLanguage: "de",
      createdAt: now,
      updatedAt: now,
    })

    const auditId = await ctx.db.insert("audits", {
      workspaceId,
      createdByUserId: userId,
      url: "https://example.com/",
      normalizedUrl: "https://example.com/",
      domain: "example.com",
      auditType: "standard",
      reportLanguage: "de",
      idempotencyKey: "seed-idem",
      status: "running_deterministic_checks",
      statusMessage: "Deterministische Checks werden vorbereitet",
      publicSlug: "seed-slug-" + now,
      isPublic: false,
      reportVersion: "v1",
      queuedAt: now,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert("auditRawData", {
      workspaceId,
      auditId,
      httpStatus: 200,
      finalUrl: "https://example.com/",
      title: "Example Studio Berlin",
      metaDescription: "Modern web design for local businesses in Berlin mit klaren Angeboten",
      h1Texts: ["Example Studio"],
      h2Texts: ["Leistungen"],
      canonicalUrl: "https://example.com/",
      robotsFound: true,
      sitemapFound: true,
      schemaTypes: ["Organization"],
      phoneNumbers: ["+49 30 123456"],
      emailAddresses: ["info@example.com"],
      contactLinks: ["https://example.com/kontakt"],
      internalLinks: ["https://example.com/kontakt", "https://example.com/leistungen"],
      externalLinks: [],
      privacyLinkFound: true,
      imprintLinkFound: true,
      ctaCandidates: ["Jetzt Kontakt aufnehmen"],
      extractedMarkdown: "Example Studio in Berlin. Öffnungszeiten: Mo-Fr 9-17 Uhr.",
      imageCount: 4,
      imagesMissingAltCount: 1,
      phoneLinkFound: true,
      contactFormFound: true,
      viewportMetaFound: true,
      createdAt: now,
    })

    await ctx.db.insert("auditPages", {
      workspaceId,
      auditId,
      pageIndex: 1,
      kind: "contact",
      url: "https://example.com/kontakt",
      normalizedUrl: "https://example.com/kontakt",
      createdAt: now,
    })

    await ctx.db.insert("auditAssets", {
      workspaceId,
      auditId,
      type: "mobile_screenshot",
      storageProvider: "convex",
      createdAt: now,
    })

    await ctx.db.insert("auditPerformance", {
      workspaceId,
      auditId,
      strategy: "mobile",
      performanceScore: 72,
      accessibilityScore: 80,
      lcp: 2400,
      cls: 0.05,
      fcp: 1600,
      createdAt: now,
    })

    return { workspaceId, auditId }
  })
}

describe("processDeterministicScoring", () => {
  beforeEach(() => {})

  test("writes checks, scores, overall score and advances status", async () => {
    const t = createTest()
    const { auditId } = await seedBaseAudit(t)

    await t.mutation(internal.audit_scoring.processDeterministicScoring, {
      auditId,
    })

    const checks = await t.query((ctx) =>
      ctx.db
        .query("auditChecks")
        .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
        .collect(),
    )
    const categories = new Set(checks.map((check) => check.category))
    assert.ok(categories.has("technical"))
    assert.ok(categories.has("seo"))
    assert.ok(categories.has("conversion"))
    assert.ok(checks.length > 20)

    const score = await t.query((ctx) =>
      ctx.db
        .query("auditScores")
        .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
        .unique(),
    )
    assert.ok(score)
    assert.ok(score!.overallScore >= 0 && score!.overallScore <= 100)
    assert.equal(score!.scoringVersion, "2026.07.1")

    const audit = await t.query((ctx) => ctx.db.get(auditId))
    assert.ok(audit)
    assert.equal(audit!.status, "generating_findings")
    assert.equal(audit!.overallScore, score!.overallScore)
  })

  test("is idempotent when re-run", async () => {
    const t = createTest()
    const { auditId } = await seedBaseAudit(t)

    await t.mutation(internal.audit_scoring.processDeterministicScoring, {
      auditId,
    })

    await t.mutation((ctx) =>
      ctx.db.patch(auditId, {
        status: "running_deterministic_checks",
        statusMessage: "retry",
        updatedAt: Date.now(),
      }),
    )

    await t.mutation(internal.audit_scoring.processDeterministicScoring, {
      auditId,
    })

    const checks = await t.query((ctx) =>
      ctx.db
        .query("auditChecks")
        .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
        .collect(),
    )
    const uniqueKeys = new Set(checks.map((check) => `${check.category}:${check.key}`))
    assert.equal(checks.length, uniqueKeys.size)

    const scores = await t.query((ctx) =>
      ctx.db
        .query("auditScores")
        .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
        .collect(),
    )
    assert.equal(scores.length, 1)
  })

  test("does nothing for terminal audits", async () => {
    const t = createTest()
    const { auditId } = await seedBaseAudit(t)

    await t.mutation((ctx) =>
      ctx.db.patch(auditId, {
        status: "completed",
        completedAt: Date.now(),
        updatedAt: Date.now(),
      }),
    )

    const result = await t.mutation(internal.audit_scoring.processDeterministicScoring, {
      auditId,
    })
    assert.equal(result, null)

    const checks = await t.query((ctx) =>
      ctx.db
        .query("auditChecks")
        .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
        .collect(),
    )
    assert.equal(checks.length, 0)
  })
})
