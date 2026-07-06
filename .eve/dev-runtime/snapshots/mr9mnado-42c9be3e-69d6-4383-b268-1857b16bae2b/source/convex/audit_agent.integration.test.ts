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

function seedAuditWithScores(t: ReturnType<typeof createTest>, status: string): Promise<SeedIds> {
  return t.mutation(async (ctx) => {
    const now = Date.now()

    const userId = await ctx.db.insert("users", {
      tokenIdentifier: "seed-token",
      betterAuthUserId: "seed-better-auth",
      email: "seed@example.com",
      createdAt: now,
    })

    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Seed Studio",
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
      status: status as any,
      statusMessage: "Findings werden vorbereitet",
      publicSlug: "seed-slug-" + now,
      isPublic: true,
      reportVersion: "v1",
      overallScore: 58,
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
      overallScore: 58,
      scoringVersion: "2026.07.1",
      createdAt: now,
    })

    await ctx.db.insert("auditChecks", {
      workspaceId,
      auditId,
      category: "conversion",
      key: "clear_cta",
      status: "failed",
      label: "Klarer CTA",
      evidence: "Kein CTA gefunden",
      weight: 1.5,
      createdAt: now,
    })

    await ctx.db.insert("auditChecks", {
      workspaceId,
      auditId,
      category: "seo",
      key: "meta_description",
      status: "warning",
      label: "Meta Description",
      evidence: "Meta Description fehlt",
      weight: 1,
      createdAt: now,
    })

    return { workspaceId, auditId }
  })
}

describe("saveAuditAgentOutput", () => {
  beforeEach(() => {})

  test("writes findings, summary, outreach and is idempotent", async () => {
    const t = createTest()
    const { auditId } = await seedAuditWithScores(t, "generating_findings")

    const output = {
      findings: [
        {
          category: "conversion",
          severity: "medium",
          title: "Klarer CTA",
          evidence: "Klarer CTA fehlt",
          explanation: "Der Kontaktbereich lässt sich verbessern.",
          recommendation: "Klareren CTA setzen.",
          salesAngle: "Mehr Anfragen aus bestehendem Traffic.",
        },
      ],
      summary: {
        shortSummary: "Solider Eindruck mit Potenzial.",
        strengths: ["Grundstruktur vorhanden."],
        weaknesses: ["CTA lässt sich verbessern."],
        topOpportunities: ["Kontaktbereich optimieren."],
        nextSteps: ["CTA prüfen."],
      },
      outreach: [
        { type: "email", subject: "Audit", body: "Hallo Team, Audit." },
        { type: "linkedin", body: "Hallo, Audit." },
        { type: "phone_note", body: "Notiz." },
      ],
      subjectLines: ["Audit example.com"],
    }

    await t.mutation(internal.audit_agent.saveAuditAgentOutput, {
      auditId,
      output,
    })

    await t.mutation(internal.audit_agent.saveAuditAgentOutput, {
      auditId,
      output,
    })

    const findings = await t.query((ctx) =>
      ctx.db.query("auditFindings").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).collect(),
    )
    assert.equal(findings.length, 1)

    const summary = await t.query((ctx) =>
      ctx.db.query("auditSummaries").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).unique(),
    )
    assert.ok(summary)
    assert.equal(summary!.shortSummary, "Solider Eindruck mit Potenzial.")

    const drafts = await t.query((ctx) =>
      ctx.db.query("outreachDrafts").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).collect(),
    )
    assert.equal(drafts.length, 3)
    const email = drafts.find((draft) => draft.type === "email")
    assert.ok(email)
    assert.deepEqual(email!.subjectLines, ["Audit example.com"])
  })

  test("rejects invalid output", async () => {
    const t = createTest()
    const { auditId } = await seedAuditWithScores(t, "generating_findings")

    await assert.rejects(
      () =>
        t.mutation(internal.audit_agent.saveAuditAgentOutput, {
          auditId,
          output: { findings: [] },
        }),
      /INVALID_AGENT_OUTPUT|validation/i,
    )
  })
})

describe("startAuditAgentRun / finishAuditAgentRun", () => {
  test("logs started and completed runs", async () => {
    const t = createTest()
    const { workspaceId, auditId } = await seedAuditWithScores(t, "generating_findings")

    const runId = await t.mutation(internal.audit_agent.startAuditAgentRun, {
      workspaceId,
      auditId,
      provider: "other",
      model: "deterministic-fallback",
      purpose: "findings",
    })

    await t.mutation(internal.audit_agent.finishAuditAgentRun, {
      auditAgentRunId: runId,
      status: "completed",
    })

    const run = await t.query((ctx) => ctx.db.get(runId))
    assert.ok(run)
    assert.equal(run!.status, "completed")
    assert.equal(run!.purpose, "findings")
    assert.equal(run!.model, "deterministic-fallback")
    assert.ok(run!.completedAt)
  })
})

describe("setAuditAgentStage", () => {
  test("advances status and respects terminal audits", async () => {
    const t = createTest()
    const { auditId } = await seedAuditWithScores(t, "generating_findings")

    await t.mutation(internal.audit_agent.setAuditAgentStage, {
      auditId,
      status: "generating_outreach",
      statusMessage: "Outreach wird erstellt",
    })

    const after = await t.query((ctx) => ctx.db.get(auditId))
    assert.equal(after!.status, "generating_outreach")

    await t.mutation((ctx) =>
      ctx.db.patch(auditId, { status: "completed", completedAt: Date.now(), updatedAt: Date.now() }),
    )

    await t.mutation(internal.audit_agent.setAuditAgentStage, {
      auditId,
      status: "generating_outreach",
      statusMessage: "should be ignored",
    })

    const terminal = await t.query((ctx) => ctx.db.get(auditId))
    assert.equal(terminal!.status, "completed")
  })
})

describe("completeAuditFromAgent", () => {
  test("sets completed and writes usage event idempotently", async () => {
    const t = createTest()
    const { workspaceId, auditId } = await seedAuditWithScores(t, "generating_outreach")

    await t.mutation(internal.audit_agent.completeAuditFromAgent, { auditId })
    await t.mutation(internal.audit_agent.completeAuditFromAgent, { auditId })

    const audit = await t.query((ctx) => ctx.db.get(auditId))
    assert.equal(audit!.status, "completed")
    assert.ok(audit!.completedAt)

    const events = await t.query((ctx) =>
      ctx.db
        .query("usageEvents")
        .withIndex("by_workspaceId_and_auditId", (q) => q.eq("workspaceId", workspaceId).eq("auditId", auditId))
        .filter((q) => q.eq(q.field("event"), "audit_completed"))
        .collect(),
    )
    assert.equal(events.length, 1)
  })
})
