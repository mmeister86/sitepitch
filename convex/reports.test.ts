/// <reference types="vite/client" />
import assert from "node:assert/strict"

import { convexTest } from "convex-test"
import { describe, test } from "vitest"

import schema from "./schema.ts"
import { api } from "./_generated/api"
import type { Id } from "./_generated/dataModel"

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

    const events = await t.query((ctx) =>
      ctx.db
        .query("usageEvents")
        .withIndex("by_workspaceId_and_auditId", (q) =>
          q.eq("workspaceId", workspaceId).eq("auditId", auditId),
        )
        .collect(),
    )
    const viewEvent = events.find((e) => e.event === "report_viewed")
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
