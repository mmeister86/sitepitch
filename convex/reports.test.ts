/// <reference types="vite/client" />
import assert from "node:assert/strict"

import { convexTest } from "convex-test"
import { beforeEach, describe, test, vi } from "vitest"

import schema from "./schema.ts"
import { api } from "./_generated/api"
import type { Id } from "./_generated/dataModel"

const mocks = vi.hoisted(() => ({
  auditRateLimiter: { limit: vi.fn() },
}))

vi.mock("./lib/audit_rate_limit", () => ({
  auditRateLimiter: mocks.auditRateLimiter,
}))

const modules = import.meta.glob([
  "./auth.ts",
  "./audits.ts",
  "./audit_pipeline.ts",
  "./audit_scoring.ts",
  "./audit_state.ts",
  "./audit_agent.ts",
  "./http.ts",
  "./reports.ts",
  "./workspaces.ts",
  "./lib/*.ts",
  "./_generated/*.js",
])

function createTest() {
  return convexTest(schema, modules)
}

beforeEach(() => {
  mocks.auditRateLimiter.limit.mockReset()
  mocks.auditRateLimiter.limit.mockResolvedValue({ ok: true, retryAfter: null })
})

type SeedIds = {
  userId: Id<"users">
  workspaceId: Id<"workspaces">
  auditId: Id<"audits">
}

function seedCompletedReport(
  t: ReturnType<typeof createTest>,
  overrides?: {
    isPublic?: boolean
    status?: string
    slug?: string
    tokenIdentifier?: string
    withOutreach?: boolean
  },
): Promise<SeedIds> {
  const token = overrides?.tokenIdentifier ?? "report-test-token"
  const slug = overrides?.slug ?? `test-slug-${Date.now()}`
  return t.mutation(async (ctx) => {
    const now = Date.now()

    const userId = await ctx.db.insert("users", {
      tokenIdentifier: token,
      betterAuthUserId: "report-better-auth",
      email: "studio@example.com",
      name: "Test Studio",
      createdAt: now,
    })

    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Test Studio",
      ownerUserId: userId,
      accentColor: "#5b5bd6",
      ctaText: "Kostenloses Erstgespräch",
      ctaUrl: "https://studio.example.com/contact",
      website: "https://studio.example.com",
      contactEmail: "hello@studio.example.com",
      reportLanguage: "de",
      createdAt: now,
      updatedAt: now,
    })

    const auditId = await ctx.db.insert("audits", {
      workspaceId,
      createdByUserId: userId,
      url: "https://acme.com/",
      normalizedUrl: "https://acme.com/",
      domain: "acme.com",
      auditType: "standard",
      reportLanguage: "de",
      idempotencyKey: `report-seed-${now}`,
      status: (overrides?.status ?? "completed") as any,
      statusMessage: "Audit abgeschlossen",
      publicSlug: slug,
      isPublic: overrides?.isPublic ?? true,
      reportVersion: "v1",
      overallScore: 62,
      completedAt: now,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert("auditScores", {
      workspaceId,
      auditId,
      conversionScore: 40,
      seoBasicsScore: 55,
      localSeoScore: 60,
      performanceScore: 70,
      mobileUxScore: 65,
      trustScore: 80,
      overallScore: 62,
      scoringVersion: "2026.07.1",
      createdAt: now,
    })

    await ctx.db.insert("auditSummaries", {
      workspaceId,
      auditId,
      shortSummary: "Solider Eindruck mit Potenzial bei Conversion und lokaler Auffindbarkeit.",
      strengths: ["Gute Grundstruktur"],
      weaknesses: ["CTA fehlt"],
      topOpportunities: ["Kontakt-Bereich optimieren"],
      nextSteps: ["Klareren CTA hinzufügen"],
      createdAt: now,
    })

    await ctx.db.insert("auditFindings", {
      workspaceId,
      auditId,
      category: "conversion",
      severity: "high",
      title: "Klarer CTA fehlt",
      evidence: "Kein Call-to-Action auf der Startseite",
      explanation: "Besucher wissen nicht, welcher Schritt als nächstes folgt.",
      recommendation: "Einen klareren CTA-Button platzieren.",
      salesAngle: "Mehr Anfragen aus bestehendem Traffic.",
      sortOrder: 0,
      createdAt: now,
    })

    if (overrides?.withOutreach) {
      await ctx.db.insert("outreachDrafts", {
        workspaceId,
        auditId,
        type: "email",
        subject: "Kurzer Website-Audit zu acme.com",
        subjectLines: [
          "Kurzer Website-Audit zu acme.com",
          "Ihre Website im Check",
          "Kurze Idee für acme.com",
        ],
        body: "Hallo, ich habe mir acme.com angesehen …",
        createdAt: now,
      })
      await ctx.db.insert("outreachDrafts", {
        workspaceId,
        auditId,
        type: "phone_note",
        body: "Kurznotiz für den Anruf: Conversion-CTA fehlt.",
        createdAt: now,
      })
    }

    return { userId, workspaceId, auditId }
  })
}

// ---------------------------------------------------------------------------
// getPublicReportBySlug
// ---------------------------------------------------------------------------

describe("getPublicReportBySlug", () => {
  test("returns null for a non-existent slug", async () => {
    const t = createTest()
    const result = await t.query(api.reports.getPublicReportBySlug, {
      slug: "does-not-exist",
    })
    assert.equal(result, null)
  })

  test("returns null when the report is disabled", async () => {
    const t = createTest()
    const { auditId } = await seedCompletedReport(t, {
      isPublic: false,
      slug: "disabled-slug",
    })

    const result = await t.query(api.reports.getPublicReportBySlug, {
      slug: "disabled-slug",
    })
    assert.equal(result, null)

    const audit = await t.query((ctx) => ctx.db.get(auditId))
    assert.ok(audit)
  })

  test("returns null when the audit is not completed", async () => {
    const t = createTest()
    await seedCompletedReport(t, {
      status: "generating_findings",
      isPublic: true,
      slug: "running-slug",
    })

    const result = await t.query(api.reports.getPublicReportBySlug, {
      slug: "running-slug",
    })
    assert.equal(result, null)
  })

  test("returns a sanitized DTO for an enabled completed report", async () => {
    const t = createTest()
    await seedCompletedReport(t, {
      isPublic: true,
      slug: "public-slug",
    })

    const result = await t.query(api.reports.getPublicReportBySlug, {
      slug: "public-slug",
    })

    assert.ok(result)
    assert.equal(result!.domain, "acme.com")
    assert.equal(result!.overallScore, 62)
    assert.equal(result!.findings.length, 1)
    assert.equal(result!.findings[0]!.title, "Klarer CTA fehlt")
    assert.equal(result!.nextSteps.length, 1)

    // Sanitised: no internal IDs or sales-only fields
    const json = JSON.stringify(result)
    assert.equal(json.includes("_id"), false, "must not leak _id")
    assert.equal(json.includes("workspaceId"), false, "must not leak workspaceId")
    assert.equal(json.includes("storageId"), false, "must not leak storageId")
    assert.equal(json.includes("salesAngle"), false, "must not leak salesAngle")
    assert.equal(json.includes("idempotencyKey"), false, "must not leak idempotencyKey")

    // Branding is present
    assert.equal(result!.branding.name, "Test Studio")
    assert.equal(result!.branding.accentColor, "#5b5bd6")

    // Category scores have percentage weights
    assert.ok(result!.categoryScores)
    assert.equal(result!.categoryScores!.length, 6)
    const conversion = result!.categoryScores!.find((c) => c.key === "conversion")
    assert.ok(conversion)
    assert.equal(conversion!.weight, 25)
  })

  test("strips URL query data and never exposes provider screenshot URLs", async () => {
    const t = createTest()
    const { auditId, workspaceId } = await seedCompletedReport(t, {
      isPublic: true,
      slug: "safe-url-slug",
    })
    await t.mutation(async (ctx) => {
      await ctx.db.patch(auditId, {
        normalizedUrl: "https://acme.com/path?token=canary-secret#private",
      })
      await ctx.db.insert("auditAssets", {
        workspaceId,
        auditId,
        type: "desktop_screenshot",
        storageProvider: "external",
        url: "https://provider.example/screenshot?signature=canary-secret",
        createdAt: Date.now(),
      })
    })

    const result = await t.query(api.reports.getPublicReportBySlug, { slug: "safe-url-slug" })
    assert.ok(result)
    assert.equal(result.normalizedUrl, "https://acme.com/path")
    assert.equal(result.screenshots.desktop, null)
    assert.equal(JSON.stringify(result).includes("canary-secret"), false)
  })

  test("hides every public report as soon as workspace deletion starts", async () => {
    const t = createTest()
    const { workspaceId } = await seedCompletedReport(t, {
      isPublic: true,
      slug: "workspace-deletion-slug",
    })
    await t.mutation((ctx) =>
      ctx.db.patch(workspaceId, { deletionRequestedAt: Date.now(), updatedAt: Date.now() }),
    )

    const result = await t.query(api.reports.getPublicReportBySlug, {
      slug: "workspace-deletion-slug",
    })
    assert.equal(result, null)
  })
})

// ---------------------------------------------------------------------------
// getInternalReportById
// ---------------------------------------------------------------------------

describe("getInternalReportById", () => {
  test("returns null without authentication", async () => {
    const t = createTest()
    const { auditId } = await seedCompletedReport(t)

    const result = await t.query(api.reports.getInternalReportById, { auditId })
    assert.equal(result, null)
  })

  test("returns the full report for the workspace owner", async () => {
    const t = createTest()
    const { auditId } = await seedCompletedReport(t)

    const result = await t
      .withIdentity({ tokenIdentifier: "report-test-token", email: "studio@example.com" })
      .query(api.reports.getInternalReportById, { auditId })

    assert.ok(result)
    assert.equal(result!.auditId, auditId)
    assert.equal(result!.status, "completed")
    assert.equal(result!.isPublic, true)
    assert.equal(result!.overallScore, 62)
    assert.equal(result!.findings.length, 1)
    assert.equal(result!.findings[0]!.salesAngle, "Mehr Anfragen aus bestehendem Traffic.")
    assert.equal(result!.checks.length, 0)
    assert.equal(result!.outreachDrafts.length, 0)
    assert.equal(result!.viewCount, 0)
    assert.equal(result!.warnings.includes("outreach_missing"), true)
  })

  test("returns only safe provider status fields to the browser", async () => {
    const t = createTest()
    const { auditId, workspaceId } = await seedCompletedReport(t)
    await t.mutation(async (ctx) => {
      await ctx.db.insert("providerCalls", {
        workspaceId,
        auditId,
        provider: "firecrawl",
        operation: "scrape_homepage",
        status: "failed",
        attempt: 1,
        requestEvidence: "Authorization: Bearer canary-secret",
        errorCode: "HTTP_401",
        errorMessage: "Bearer canary-secret",
        responseStatus: 401,
        retryCount: 0,
        startedAt: Date.now(),
        completedAt: Date.now(),
        createdAt: Date.now(),
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: "report-test-token", email: "studio@example.com" })
      .query(api.reports.getInternalReportById, { auditId })

    assert.ok(result)
    assert.equal(result.providerCalls.items.length, 1)
    assert.equal(result.providerCalls.items[0]?.errorCode, "HTTP_401")
    const json = JSON.stringify(result.providerCalls)
    assert.equal(json.includes("providerCallId"), false)
    assert.equal(json.includes("errorMessage"), false)
    assert.equal(json.includes("responseStatus"), false)
    assert.equal(json.includes("requestEvidence"), false)
    assert.equal(json.includes("canary-secret"), false)
  })

  test("returns null when a different workspace owner tries to access", async () => {
    const t = createTest()
    const { auditId } = await seedCompletedReport(t)

    const result = await t
      .withIdentity({ tokenIdentifier: "other-token", email: "other@example.com" })
      .query(api.reports.getInternalReportById, { auditId })

    assert.equal(result, null)
  })
})

// ---------------------------------------------------------------------------
// setPublicReportEnabled
// ---------------------------------------------------------------------------

describe("setPublicReportEnabled", () => {
  test("records first_shared_report once and snapshots the CTA on first publish", async () => {
    const t = createTest()
    const { auditId, workspaceId } = await seedCompletedReport(t, { isPublic: false })

    const authed = t.withIdentity({ tokenIdentifier: "report-test-token", email: "studio@example.com" })
    await authed.mutation(api.reports.setPublicReportEnabled, { auditId, enabled: true })
    await authed.mutation(api.reports.setPublicReportEnabled, { auditId, enabled: false })
    await authed.mutation(api.reports.setPublicReportEnabled, { auditId, enabled: true })

    const result = await t.run(async (ctx) => ({
      audit: await ctx.db.get(auditId),
      events: await ctx.db
        .query("usageEvents")
        .withIndex("by_workspaceId_and_event", (q) =>
          q.eq("workspaceId", workspaceId).eq("event", "first_shared_report"),
        )
        .take(10),
    }))
    assert.equal(result.events.length, 1)
    assert.equal(result.audit?.reportCtaText, "Kostenloses Erstgespräch")
    assert.equal(result.audit?.reportCtaUrl, "https://studio.example.com/contact")
    assert.ok(result.audit?.reportCtaSnapshottedAt)
  })

  test("toggles isPublic for the workspace owner", async () => {
    const t = createTest()
    const { auditId } = await seedCompletedReport(t, { isPublic: true })

    const disabled = await t
      .withIdentity({ tokenIdentifier: "report-test-token", email: "studio@example.com" })
      .mutation(api.reports.setPublicReportEnabled, { auditId, enabled: false })

    assert.equal(disabled.isPublic, false)

    const reenabled = await t
      .withIdentity({ tokenIdentifier: "report-test-token", email: "studio@example.com" })
      .mutation(api.reports.setPublicReportEnabled, { auditId, enabled: true })

    assert.equal(reenabled.isPublic, true)
  })

  test("rejects non-owners", async () => {
    const t = createTest()
    const { auditId } = await seedCompletedReport(t)

    // Seed a second user who is authenticated but owns a different workspace
    await t.mutation(async (ctx) => {
      const now = Date.now()
      const otherUserId = await ctx.db.insert("users", {
        tokenIdentifier: "other-token",
        betterAuthUserId: "other-better-auth",
        email: "other@example.com",
        createdAt: now,
      })
      await ctx.db.insert("workspaces", {
        name: "Other Studio",
        ownerUserId: otherUserId,
        reportLanguage: "de",
        createdAt: now,
        updatedAt: now,
      })
    })

    await assert.rejects(
      () =>
        t
          .withIdentity({ tokenIdentifier: "other-token", email: "other@example.com" })
          .mutation(api.reports.setPublicReportEnabled, { auditId, enabled: false }),
      /FORBIDDEN|Workspace access denied/i,
    )
  })

  test("rejects enabling a non-completed audit", async () => {
    const t = createTest()
    const { auditId } = await seedCompletedReport(t, {
      status: "generating_findings",
      isPublic: false,
    })

    await assert.rejects(
      () =>
        t
          .withIdentity({ tokenIdentifier: "report-test-token", email: "studio@example.com" })
          .mutation(api.reports.setPublicReportEnabled, { auditId, enabled: true }),
      /REPORT_NOT_READY/i,
    )
  })
})

// ---------------------------------------------------------------------------
// recordPublicReportView
// ---------------------------------------------------------------------------

describe("recordPublicReportView", () => {
  test("tracks first view and reopen aggregates", async () => {
    const t = createTest()
    const { auditId, workspaceId } = await seedCompletedReport(t, {
      slug: "aggregate-view-slug",
      isPublic: true,
    })

    await t.mutation(api.reports.recordPublicReportView, { slug: "aggregate-view-slug" })
    await t.mutation(api.reports.recordPublicReportView, { slug: "aggregate-view-slug" })

    const result = await t.run(async (ctx) => ({
      stats: await ctx.db.query("reportViewStats").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).unique(),
      reopenEvents: await ctx.db.query("usageEvents").withIndex("by_workspaceId_and_event", (q) => q.eq("workspaceId", workspaceId).eq("event", "report_reopened")).take(10),
    }))
    assert.ok(result.stats?.firstViewedAt)
    assert.equal(result.stats?.reopenCount, 1)
    assert.equal(result.reopenEvents.length, 1)
  })

  test("records a view and usage event for an enabled report", async () => {
    const t = createTest()
    const { auditId, workspaceId } = await seedCompletedReport(t, {
      slug: "view-test-slug",
      isPublic: true,
    })

    const result = await t.mutation(api.reports.recordPublicReportView, {
      slug: "view-test-slug",
      referrer: "https://google.com/search?q=webdesign",
    })

    assert.deepEqual(result, { recorded: true })

    const views = await t.query((ctx) =>
      ctx.db
        .query("reportViews")
        .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
        .collect(),
    )
    assert.equal(views.length, 1)
    assert.equal(views[0]!.workspaceId, workspaceId)
    assert.equal(views[0]!.referrer, "https://google.com/search?q=webdesign")

    const aggregate = await t.query((ctx) =>
      ctx.db
        .query("reportViewStats")
        .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
        .unique(),
    )
    assert.equal(aggregate?.totalViews, 1)
    assert.equal(aggregate?.workspaceId, workspaceId)

    const events = await t.query((ctx) =>
      ctx.db
        .query("usageEvents")
        .withIndex("by_workspaceId_and_auditId", (q) =>
          q.eq("workspaceId", workspaceId).eq("auditId", auditId),
        )
        .collect(),
    )
    const viewEvent = events.find((e) => e.event === "report_opened")
    assert.ok(viewEvent)
  })

  test("returns null and writes nothing for a disabled report", async () => {
    const t = createTest()
    const { auditId } = await seedCompletedReport(t, {
      slug: "disabled-view-slug",
      isPublic: false,
    })

    const result = await t.mutation(api.reports.recordPublicReportView, {
      slug: "disabled-view-slug",
    })

    assert.equal(result, null)

    const views = await t.query((ctx) =>
      ctx.db
        .query("reportViews")
        .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
        .collect(),
    )
    assert.equal(views.length, 0)
  })

  test("records a public report view when under the limit", async () => {
    const t = createTest()
    const { auditId, workspaceId } = await seedCompletedReport(t, {
      slug: "under-limit-slug",
      isPublic: true,
    })

    mocks.auditRateLimiter.limit.mockResolvedValue({ ok: true, retryAfter: null })

    const result = await t.mutation(api.reports.recordPublicReportView, {
      slug: "under-limit-slug",
    })

    assert.ok(result)
    assert.equal((result as { recorded: boolean }).recorded, true)

    const views = await t.query((ctx) =>
      ctx.db
        .query("reportViews")
        .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
        .collect(),
    )
    assert.equal(views.length, 1)

    const events = await t.query((ctx) =>
      ctx.db
        .query("usageEvents")
        .withIndex("by_workspaceId_and_auditId", (q) =>
          q.eq("workspaceId", workspaceId).eq("auditId", auditId),
        )
        .collect(),
    )
    assert.equal(events.length, 1)

    assert.equal(mocks.auditRateLimiter.limit.mock.calls.length, 2)
    const limits = mocks.auditRateLimiter.limit.mock.calls.map((call) => call.slice(1)) as Array<[
      string,
      { key: string },
    ]>
    assert.deepEqual(limits.map(([name]) => name), [
      "publicReportViewsBySlug",
      "publicReportViewsByViewer",
    ])
    assert.equal(limits[0]?.[1].key, "under-limit-slug")
    assert.ok(limits[1]?.[1].key)
  })

  test("skips recording and returns rate_limited when over the limit", async () => {
    const t = createTest()
    const { auditId, workspaceId } = await seedCompletedReport(t, {
      slug: "over-limit-slug",
      isPublic: true,
    })

    mocks.auditRateLimiter.limit.mockResolvedValue({ ok: false, retryAfter: 1234 })

    let result: any
    await assert.doesNotReject(async () => {
      result = await t.mutation(api.reports.recordPublicReportView, {
        slug: "over-limit-slug",
      })
    })

    assert.deepEqual(result, { recorded: false, reason: "rate_limited" })

    const views = await t.query((ctx) =>
      ctx.db
        .query("reportViews")
        .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
        .collect(),
    )
    assert.equal(views.length, 0)

    const events = await t.query((ctx) =>
      ctx.db
        .query("usageEvents")
        .withIndex("by_workspaceId_and_auditId", (q) =>
          q.eq("workspaceId", workspaceId).eq("auditId", auditId),
        )
        .collect(),
    )
    assert.equal(events.length, 0)
  })
})

// ---------------------------------------------------------------------------
// recordReportCopyEvent
// ---------------------------------------------------------------------------

describe("recordReportCopyEvent", () => {
  test("writes an outreach_copied event with draftType metadata for the owner", async () => {
    const t = createTest()
    const { auditId, workspaceId } = await seedCompletedReport(t, {
      withOutreach: true,
    })

    const result = await t
      .withIdentity({ tokenIdentifier: "report-test-token", email: "studio@example.com" })
      .mutation(api.reports.recordReportCopyEvent, {
        auditId,
        kind: "outreach" as const,
        draftType: "email" as const,
        edited: true,
        includedReportLink: true,
      })

    assert.equal(result.recorded, true)

    const events = await t.query((ctx) =>
      ctx.db
        .query("usageEvents")
        .withIndex("by_workspaceId_and_auditId", (q) =>
          q.eq("workspaceId", workspaceId).eq("auditId", auditId),
        )
        .collect(),
    )
    const copyEvent = events.find((e) => e.event === "outreach_copied")
    assert.ok(copyEvent)
    assert.equal(copyEvent!.metadata?.draftType, "email")
    assert.equal(copyEvent!.metadata?.edited, true)
    assert.equal(copyEvent!.metadata?.includedReportLink, true)
  })

  test("writes a public_link_copied event for a public report", async () => {
    const t = createTest()
    const { auditId, workspaceId } = await seedCompletedReport(t, {
      isPublic: true,
    })

    const result = await t
      .withIdentity({ tokenIdentifier: "report-test-token", email: "studio@example.com" })
      .mutation(api.reports.recordReportCopyEvent, {
        auditId,
        kind: "public_link" as const,
      })

    assert.equal(result.recorded, true)

    const events = await t.query((ctx) =>
      ctx.db
        .query("usageEvents")
        .withIndex("by_workspaceId_and_auditId", (q) =>
          q.eq("workspaceId", workspaceId).eq("auditId", auditId),
        )
        .collect(),
    )
    const linkEvent = events.find((e) => e.event === "public_link_copied")
    assert.ok(linkEvent)
  })

  test("rejects public_link_copied for a non-public report", async () => {
    const t = createTest()
    const { auditId } = await seedCompletedReport(t, {
      isPublic: false,
    })

    await assert.rejects(
      () =>
        t
          .withIdentity({ tokenIdentifier: "report-test-token", email: "studio@example.com" })
          .mutation(api.reports.recordReportCopyEvent, {
            auditId,
            kind: "public_link" as const,
          }),
      /REPORT_NOT_PUBLIC|not public/i,
    )
  })

  test("rejects outreach copy without a draftType", async () => {
    const t = createTest()
    const { auditId } = await seedCompletedReport(t, {
      withOutreach: true,
    })

    await assert.rejects(
      () =>
        t
          .withIdentity({ tokenIdentifier: "report-test-token", email: "studio@example.com" })
          .mutation(api.reports.recordReportCopyEvent, {
            auditId,
            kind: "outreach" as const,
          }),
      /draftType|DRAFT_TYPE/i,
    )
  })

  test("rejects unauthenticated requests", async () => {
    const t = createTest()
    const { auditId } = await seedCompletedReport(t, { withOutreach: true })

    await assert.rejects(
      () =>
        t.mutation(api.reports.recordReportCopyEvent, {
          auditId,
          kind: "outreach" as const,
          draftType: "email" as const,
        }),
      /UNAUTHENTICATED/i,
    )
  })

  test("rejects access from a different workspace owner", async () => {
    const t = createTest()
    const { auditId } = await seedCompletedReport(t, { withOutreach: true })

    // Seed a second user who is authenticated but owns a different workspace
    await t.mutation(async (ctx) => {
      const now = Date.now()
      const otherUserId = await ctx.db.insert("users", {
        tokenIdentifier: "other-token",
        betterAuthUserId: "other-better-auth",
        email: "other@example.com",
        createdAt: now,
      })
      await ctx.db.insert("workspaces", {
        name: "Other Studio",
        ownerUserId: otherUserId,
        reportLanguage: "de",
        createdAt: now,
        updatedAt: now,
      })
    })

    await assert.rejects(
      () =>
        t
          .withIdentity({ tokenIdentifier: "other-token", email: "other@example.com" })
          .mutation(api.reports.recordReportCopyEvent, {
            auditId,
            kind: "outreach" as const,
            draftType: "email" as const,
          }),
      /FORBIDDEN/i,
    )
  })
})

// ---------------------------------------------------------------------------
// recordPublicReportCtaClick
// ---------------------------------------------------------------------------

describe("recordPublicReportCtaClick", () => {
  test("records a cta click event for an enabled report", async () => {
    const t = createTest()
    const { auditId, workspaceId } = await seedCompletedReport(t, {
      slug: "cta-test-slug",
      isPublic: true,
    })

    await t.mutation(api.reports.recordPublicReportView, { slug: "cta-test-slug" })

    const result = await t.mutation(api.reports.recordPublicReportCtaClick, {
      slug: "cta-test-slug",
    })

    assert.deepEqual(result, { recorded: true })

    const events = await t.query((ctx) =>
      ctx.db
        .query("usageEvents")
        .withIndex("by_workspaceId_and_auditId", (q) =>
          q.eq("workspaceId", workspaceId).eq("auditId", auditId),
        )
        .collect(),
    )
    const ctaEvent = events.find((e) => e.event === "report_cta_clicked")
    assert.ok(ctaEvent)
    const stats = await t.run((ctx) =>
      ctx.db.query("reportViewStats").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).unique(),
    )
    assert.equal(stats?.ctaClicks, 1)
  })

  test("returns null for a disabled report", async () => {
    const t = createTest()
    await seedCompletedReport(t, {
      slug: "cta-disabled-slug",
      isPublic: false,
    })

    const result = await t.mutation(api.reports.recordPublicReportCtaClick, {
      slug: "cta-disabled-slug",
    })

    assert.equal(result, null)
  })

  test("returns rate_limited when over the limit", async () => {
    const t = createTest()
    await seedCompletedReport(t, {
      slug: "cta-over-limit-slug",
      isPublic: true,
    })

    mocks.auditRateLimiter.limit.mockResolvedValue({ ok: false, retryAfter: 1234 })

    const result = await t.mutation(api.reports.recordPublicReportCtaClick, {
      slug: "cta-over-limit-slug",
    })

    assert.deepEqual(result, { recorded: false, reason: "rate_limited" })
  })
})

// ---------------------------------------------------------------------------
// recordPublicReportPdfExport
// ---------------------------------------------------------------------------

describe("recordPublicReportPdfExport", () => {
  test("records a pdf_exported event for an enabled report", async () => {
    const t = createTest()
    const { auditId, workspaceId } = await seedCompletedReport(t, {
      slug: "pdf-test-slug",
      isPublic: true,
    })

    await t.mutation(api.reports.recordPublicReportView, { slug: "pdf-test-slug" })

    mocks.auditRateLimiter.limit.mockResolvedValue({ ok: true, retryAfter: null })

    const result = await t.mutation(api.reports.recordPublicReportPdfExport, {
      slug: "pdf-test-slug",
    })

    assert.deepEqual(result, { recorded: true })

    const events = await t.query((ctx) =>
      ctx.db
        .query("usageEvents")
        .withIndex("by_workspaceId_and_auditId", (q) =>
          q.eq("workspaceId", workspaceId).eq("auditId", auditId),
        )
        .collect(),
    )
    const pdfEvent = events.find((e) => e.event === "pdf_exported")
    assert.ok(pdfEvent)
    const stats = await t.run((ctx) =>
      ctx.db.query("reportViewStats").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).unique(),
    )
    assert.equal(stats?.pdfDownloads, 1)
  })

  test("returns null for a disabled report", async () => {
    const t = createTest()
    await seedCompletedReport(t, {
      slug: "pdf-disabled-slug",
      isPublic: false,
    })

    const result = await t.mutation(api.reports.recordPublicReportPdfExport, {
      slug: "pdf-disabled-slug",
    })

    assert.equal(result, null)
  })
})

// ---------------------------------------------------------------------------
// getDashboardEngagement
// ---------------------------------------------------------------------------

describe("getDashboardEngagement", () => {
  test("returns null without authentication", async () => {
    const t = createTest()
    const { auditId } = await seedCompletedReport(t)

    const result = await t.query(api.reports.getDashboardEngagement, {
      tzOffsetMinutes: 0,
    })

    assert.equal(result, null)
    void auditId
  })

  test("returns empty state for a workspace without activity", async () => {
    const t = createTest()
    await seedCompletedReport(t)

    const result = await t
      .withIdentity({ tokenIdentifier: "report-test-token", email: "studio@example.com" })
      .query(api.reports.getDashboardEngagement, { tzOffsetMinutes: 0 })

    assert.ok(result)
    assert.equal(result!.hasData, false)
    assert.equal(result!.activity.length, 0)
    assert.equal(result!.series.length, 14)
    assert.equal(result!.totals.views, 0)
  })

  test("aggregates views into the series and surfaces activity", async () => {
    const t = createTest()
    const { auditId, workspaceId } = await seedCompletedReport(t, {
      slug: "dash-slug",
      isPublic: true,
    })

    await t.mutation(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert("reportViews", {
        workspaceId,
        auditId,
        viewedAt: now,
      })
      await ctx.db.insert("reportViews", {
        workspaceId,
        auditId,
        viewedAt: now - 1000,
      })
      await ctx.db.insert("usageEvents", {
        workspaceId,
        auditId,
        event: "report_cta_clicked",
        createdAt: now,
      })
      await ctx.db.insert("usageEvents", {
        workspaceId,
        auditId,
        event: "audit_completed",
        createdAt: now - 2000,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: "report-test-token", email: "studio@example.com" })
      .query(api.reports.getDashboardEngagement, { tzOffsetMinutes: 0 })

    assert.ok(result)
    assert.equal(result!.hasData, true)
    assert.equal(result!.totals.views, 2)
    assert.equal(result!.totals.ctaClicks, 1)

    const today = result!.series[result!.series.length - 1]!
    assert.ok(today!.views >= 2, "today bucket should contain both views")

    assert.ok(result!.activity.length >= 1)
    const ctaActivity = result!.activity.find((a) => a.event === "report_cta_clicked")
    assert.ok(ctaActivity)
    assert.equal(ctaActivity!.domain, "acme.com")
    assert.equal(ctaActivity!.detail, "CTA geklickt")
  })

  test("enriches activity with lead business name", async () => {
    const t = createTest()
    const { auditId, workspaceId } = await seedCompletedReport(t, {
      isPublic: true,
    })

    await t.mutation(async (ctx) => {
      const now = Date.now()
      const leadId = await ctx.db.insert("leads", {
        workspaceId,
        businessName: "Acme Bakery",
        websiteUrl: "https://acme.com",
        sourceProvider: "manual",
        status: "new",
        auditId,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.patch(auditId, { leadId })
      await ctx.db.insert("usageEvents", {
        workspaceId,
        auditId,
        event: "report_opened",
        createdAt: now,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: "report-test-token", email: "studio@example.com" })
      .query(api.reports.getDashboardEngagement, { tzOffsetMinutes: 0 })

    assert.ok(result)
    const viewed = result!.activity.find((a) => a.event === "report_opened")
    assert.ok(viewed)
    assert.equal(viewed!.businessName, "Acme Bakery")
  })
})

// ---------------------------------------------------------------------------
// getDashboardSummary
// ---------------------------------------------------------------------------

describe("getDashboardSummary", () => {
  test("returns null without authentication", async () => {
    const t = createTest()
    await seedCompletedReport(t)

    const result = await t.query(api.reports.getDashboardSummary, {
      tzOffsetMinutes: 0,
    })

    assert.equal(result, null)
  })

  test("returns empty state for a fresh workspace", async () => {
    const t = createTest()
    await seedCompletedReport(t)

    const result = await t
      .withIdentity({ tokenIdentifier: "report-test-token", email: "studio@example.com" })
      .query(api.reports.getDashboardSummary, { tzOffsetMinutes: 0 })

    assert.ok(result)
    assert.equal(result!.auditsThisMonth, 1)
    assert.equal(result!.completedAudits, 1)
    assert.equal(result!.reportViews, 0)
    assert.equal(result!.hasPublicReport, true)
    assert.equal(result!.hasOutreachCopy, false)
    assert.equal(result!.recentAudits.length, 1)
  })

  test("counts only completed audits as completed", async () => {
    const t = createTest()
    const { workspaceId } = await seedCompletedReport(t, { status: "queued" })

    await t.mutation(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert("audits", {
        workspaceId,
        createdByUserId: await ctx.db
          .query("users")
          .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", "report-test-token"))
          .unique()
          .then((u) => u!._id),
        url: "https://other.com/",
        normalizedUrl: "https://other.com/",
        domain: "other.com",
        auditType: "standard",
        reportLanguage: "de",
        idempotencyKey: `summary-completed-${now}`,
        status: "completed",
        publicSlug: `summary-completed-${now}`,
        isPublic: true,
        reportVersion: "v1",
        overallScore: 70,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: "report-test-token", email: "studio@example.com" })
      .query(api.reports.getDashboardSummary, { tzOffsetMinutes: 0 })

    assert.ok(result)
    assert.equal(result!.auditsThisMonth, 2)
    assert.equal(result!.completedAudits, 1)
  })

  test("counts report views across all audits", async () => {
    const t = createTest()
    const { workspaceId, auditId } = await seedCompletedReport(t, { isPublic: true })

    await t.mutation(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert("reportViews", { workspaceId, auditId, viewedAt: now })
      await ctx.db.insert("reportViews", { workspaceId, auditId, viewedAt: now - 1_000 })
      await ctx.db.insert("reportViews", { workspaceId, auditId, viewedAt: now - 2_000 })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: "report-test-token", email: "studio@example.com" })
      .query(api.reports.getDashboardSummary, { tzOffsetMinutes: 0 })

    assert.ok(result)
    assert.equal(result!.reportViews, 3)
  })

  test("detects copied outreach via usageEvents", async () => {
    const t = createTest()
    const { workspaceId, auditId } = await seedCompletedReport(t)

    await t.mutation(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert("usageEvents", {
        workspaceId,
        auditId,
        event: "outreach_copied",
        metadata: { draftType: "email" },
        createdAt: now,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: "report-test-token", email: "studio@example.com" })
      .query(api.reports.getDashboardSummary, { tzOffsetMinutes: 0 })

    assert.ok(result)
    assert.equal(result!.hasOutreachCopy, true)
  })

  test("isolates data between workspaces", async () => {
    const t = createTest()
    await seedCompletedReport(t, {
      tokenIdentifier: "owner-a",
      slug: "owner-a-slug",
      isPublic: true,
    })

    await t.mutation(async (ctx) => {
      const now = Date.now()
      const otherUserId = await ctx.db.insert("users", {
        tokenIdentifier: "owner-b",
        betterAuthUserId: "owner-b-better-auth",
        email: "b@example.com",
        createdAt: now,
      })
      await ctx.db.insert("workspaces", {
        name: "Owner B Studio",
        ownerUserId: otherUserId,
        reportLanguage: "de",
        createdAt: now,
        updatedAt: now,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: "owner-b", email: "b@example.com" })
      .query(api.reports.getDashboardSummary, { tzOffsetMinutes: 0 })

    assert.ok(result)
    assert.equal(result!.auditsThisMonth, 0)
    assert.equal(result!.completedAudits, 0)
    assert.equal(result!.reportViews, 0)
    assert.equal(result!.hasPublicReport, false)
  })

  test("respects tzOffsetMinutes for month boundary", async () => {
    const t = createTest()
    const { workspaceId, userId } = await seedCompletedReport(t)

    await t.mutation(async (ctx) => {
      const now = Date.now()
      const prevMonth = now - 32 * 24 * 60 * 60 * 1000
      await ctx.db.insert("audits", {
        workspaceId,
        createdByUserId: userId,
        url: "https://old.com/",
        normalizedUrl: "https://old.com/",
        domain: "old.com",
        auditType: "standard",
        reportLanguage: "de",
        idempotencyKey: `summary-old-${now}`,
        status: "completed",
        publicSlug: `summary-old-${now}`,
        isPublic: true,
        reportVersion: "v1",
        overallScore: 50,
        completedAt: prevMonth,
        createdAt: prevMonth,
        updatedAt: prevMonth,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: "report-test-token", email: "studio@example.com" })
      .query(api.reports.getDashboardSummary, { tzOffsetMinutes: 0 })

    assert.ok(result)
    assert.equal(result!.auditsThisMonth, 1)
    assert.equal(result!.completedAudits, 2)
  })
})
