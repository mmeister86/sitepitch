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

describe("getAuditAgentContext copy signals", () => {
  test("includes bounded website copy signals (h2, OG, copySample)", async () => {
    const t = createTest()
    const { workspaceId, auditId } = await seedAuditWithScores(t, "generating_findings")
    const longCopy = "Hero Nutzen Angebot ".repeat(500)

    await t.mutation(async (ctx) => {
      await ctx.db.insert("auditRawData", {
        workspaceId,
        auditId,
        title: "Webdesign für lokale Betriebe in Berlin",
        metaDescription: "Klare Websites für lokale Dienstleister mit Fokus auf Anfragen.",
        openGraphTitle: "Webdesign Berlin",
        openGraphDescription: "Websites, die Angebote klar erklären.",
        h1Texts: ["Websites für lokale Dienstleister"],
        h2Texts: ["Leistungen", "Referenzen", "Kontakt", "Ablauf", "Preise", "FAQ", "Team", "Standort", "Extra"],
        ctaCandidates: ["Kostenloses Erstgespräch buchen"],
        extractedMarkdown: longCopy,
        createdAt: Date.now(),
      })
    })

    const context = await t.query(internal.audit_agent.getAuditAgentContext, { auditId })

    assert.ok(context)
    assert.equal(context!.signals.openGraphTitle, "Webdesign Berlin")
    assert.equal(context!.signals.openGraphDescription, "Websites, die Angebote klar erklären.")
    assert.deepEqual(context!.signals.h2Texts, [
      "Leistungen",
      "Referenzen",
      "Kontakt",
      "Ablauf",
      "Preise",
      "FAQ",
      "Team",
      "Standort",
    ])
    assert.ok(context!.signals.copySample)
    assert.ok(context!.signals.copySample!.length <= 4000)
    assert.match(context!.signals.copySample!, /Hero Nutzen Angebot/)
  })

  test("omits copySample when no markdown is stored", async () => {
    const t = createTest()
    const { auditId } = await seedAuditWithScores(t, "generating_findings")

    const context = await t.query(internal.audit_agent.getAuditAgentContext, { auditId })

    assert.ok(context)
    assert.equal(context!.signals.copySample, undefined)
    assert.equal(context!.signals.h2Texts, undefined)
  })
})

describe("saveAuditPersonaReviews", () => {
  function sampleReviews() {
    return [
      {
        personaId: "busy_owner",
        personaName: "Vielbeschäftigte:r Geschäftsinhaber:in",
        lens: "Hat wenig Zeit und entscheidet schnell.",
        verdict: "Das Angebot wird schnell klar, der Kontaktweg könnte aber prominenter sein.",
        positives: ["Leistungen sind klar benannt."],
        frictionPoints: ["Kontaktbereich ist unter dem Fold."],
        topRecommendation: "Kontakt oben fixieren.",
        evidenceRefs: ["conversion:primary_cta"],
        confidence: "medium",
      },
      {
        personaId: "mobile_customer",
        personaName: "Smartphone-Nutzer:in",
        lens: "Möchte schnell handeln.",
        verdict: "Mobile gut strukturiert, CTA aber schwer erreichbar.",
        positives: ["Seite lädt schnell."],
        frictionPoints: ["CTA nicht sofort sichtbar."],
        topRecommendation: "Sticky CTA prüfen.",
        evidenceRefs: ["conversion:primary_cta"],
        confidence: "high",
      },
    ]
  }

  test("writes persona reviews and is idempotent", async () => {
    const t = createTest()
    const { auditId } = await seedAuditWithScores(t, "generating_findings")
    const reviews = sampleReviews()

    await t.mutation(internal.audit_agent.saveAuditPersonaReviews, { auditId, reviews })
    await t.mutation(internal.audit_agent.saveAuditPersonaReviews, { auditId, reviews })

    const stored = await t.query((ctx) =>
      ctx.db.query("auditPersonaReviews").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).collect(),
    )
    assert.equal(stored.length, 2)
    assert.equal(stored[0]!.personaId, "busy_owner")
    assert.equal(stored[0]!.sortOrder, 0)
    assert.equal(stored[1]!.personaId, "mobile_customer")
    assert.equal(stored[1]!.sortOrder, 1)
  })

  test("rejects invalid persona output", async () => {
    const t = createTest()
    const { auditId } = await seedAuditWithScores(t, "generating_findings")

    await assert.rejects(
      () =>
        t.mutation(internal.audit_agent.saveAuditPersonaReviews, {
          auditId,
          reviews: [{ personaId: "busy_owner" }],
        }),
      /INVALID_PERSONA_OUTPUT|validation/i,
    )
  })

  test("rejects unknown personaId", async () => {
    const t = createTest()
    const { auditId } = await seedAuditWithScores(t, "generating_findings")

    await assert.rejects(
      () =>
        t.mutation(internal.audit_agent.saveAuditPersonaReviews, {
          auditId,
          reviews: [
            {
              personaId: "unknown_persona",
              personaName: "X",
              lens: "Y",
              verdict: "V",
              positives: [],
              frictionPoints: ["F"],
              topRecommendation: "R",
              evidenceRefs: ["conversion:primary_cta"],
              confidence: "low",
            },
          ],
        }),
      /INVALID_PERSONA_OUTPUT|validation/i,
    )
  })
})

describe("saveAuditCopyReview", () => {
  function sampleReview() {
    return {
      heroClarity: "Die Hero-Headline nennt keinen klaren Kundennutzen.",
      valueProposition: "Das Nutzenversprechen könnte konkreter sein.",
      offerClarity: "Das Angebot wird nicht sofort erkennbar.",
      ctaClarity: "Der CTA ist generisch.",
      snippetClarity: "Title und Meta Description sind zu kurz.",
      overallVerdict: "Die Copy hat Potenzial bei Hero-Klarheit und CTA-Wording.",
      recommendations: ["Hero-Headline konkreter formulieren.", "CTA handlungsorientierter gestalten."],
      evidenceRefs: ["conversion:hero_value_proposition"],
    }
  }

  test("writes copy review and is idempotent", async () => {
    const t = createTest()
    const { auditId } = await seedAuditWithScores(t, "generating_findings")
    const review = sampleReview()

    await t.mutation(internal.audit_agent.saveAuditCopyReview, { auditId, review })
    await t.mutation(internal.audit_agent.saveAuditCopyReview, { auditId, review })

    const stored = await t.query((ctx) =>
      ctx.db.query("auditCopyReviews").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).collect(),
    )
    assert.equal(stored.length, 1)
    assert.equal(stored[0]!.heroClarity, review.heroClarity)
    assert.equal(stored[0]!.recommendations.length, 2)
  })

  test("rejects invalid copy review", async () => {
    const t = createTest()
    const { auditId } = await seedAuditWithScores(t, "generating_findings")

    await assert.rejects(
      () =>
        t.mutation(internal.audit_agent.saveAuditCopyReview, {
          auditId,
          review: { heroClarity: "ok" },
        }),
      /INVALID_COPY_REVIEW|validation/i,
    )
  })
})

describe("saveAuditDesignCritique", () => {
  const heuristicNames = [
    "Visibility of System Status",
    "Match Between System and Real World",
    "User Control and Freedom",
    "Consistency and Standards",
    "Error Prevention",
    "Recognition Rather Than Recall",
    "Flexibility and Efficiency of Use",
    "Aesthetic and Minimalist Design",
    "Help Users Recognize, Diagnose, and Recover from Errors",
    "Help and Documentation",
  ]

  function sampleCritique() {
    return {
      designHealthScore: 28,
      ratingBand: "Good",
      overallImpression: "Solide Basis mit Potenzial bei der Hero-Klarheit.",
      heuristicScores: heuristicNames.map((name) => ({ name, score: 3, keyIssue: "Konkrete Beobachtung." })),
      cognitiveLoad: { failedCount: 2, level: "moderate" as const, notes: "Einige Entscheidungen könnten gruppiert werden." },
      antiPatternVerdict: "Das Layout wirkt eigenständig.",
      whatsWorking: ["Klare Leistungsnennung."],
      priorityIssues: [
        {
          severity: "P1" as const,
          title: "Hero-Nutzen könnte prominenter sein",
          whyItMatters: "Besucher erkennen das Angebot sonst verzögert.",
          fix: "Nutzenversprechen größer platzieren.",
          evidenceRefs: ["conversion:hero_value_proposition"],
        },
      ],
      recommendations: ["Hero-Headline konkreter formulieren."],
      evidenceRefs: ["conversion:hero_value_proposition"],
    }
  }

  test("writes design critique and is idempotent", async () => {
    const t = createTest()
    const { auditId } = await seedAuditWithScores(t, "generating_findings")
    const critique = sampleCritique()

    await t.mutation(internal.audit_agent.saveAuditDesignCritique, { auditId, critique })
    await t.mutation(internal.audit_agent.saveAuditDesignCritique, { auditId, critique })

    const stored = await t.query((ctx) =>
      ctx.db.query("auditDesignCritiques").withIndex("by_auditId", (q) => q.eq("auditId", auditId)).collect(),
    )
    assert.equal(stored.length, 1)
    assert.equal(stored[0]!.designHealthScore, 28)
    assert.equal(stored[0]!.heuristicScores.length, 10)
    assert.equal(stored[0]!.cognitiveLoadLevel, "moderate")
    assert.equal(stored[0]!.priorityIssues[0]!.severity, "P1")
  })

  test("rejects invalid design critique", async () => {
    const t = createTest()
    const { auditId } = await seedAuditWithScores(t, "generating_findings")

    await assert.rejects(
      () =>
        t.mutation(internal.audit_agent.saveAuditDesignCritique, {
          auditId,
          critique: { ratingBand: "ok" },
        }),
      /INVALID_DESIGN_CRITIQUE|validation/i,
    )
  })
})
