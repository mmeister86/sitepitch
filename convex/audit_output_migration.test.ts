/// <reference types="vite/client" />

import { runToCompletion } from "@convex-dev/migrations"
import migrationsComponent from "@convex-dev/migrations/test"
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

import { components, internal } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob(["./migrations.ts", "./_generated/*.js"])

async function seedLegacyAudit(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const createdAt = 1_700_000_000_000
    const userId = await ctx.db.insert("users", {
      tokenIdentifier: "migration-owner",
      betterAuthUserId: "migration-owner",
      email: "migration@example.com",
      createdAt,
    })
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Migration Workspace",
      ownerUserId: userId,
      reportLanguage: "de",
      createdAt,
      updatedAt: createdAt,
    })
    const auditId = await ctx.db.insert("audits", {
      workspaceId,
      createdByUserId: userId,
      url: "https://migration.example",
      normalizedUrl: "https://migration.example/",
      domain: "migration.example",
      auditType: "standard",
      reportLanguage: "de",
      idempotencyKey: "legacy-migration",
      status: "completed",
      publicSlug: "legacy-migration",
      isPublic: true,
      reportVersion: "v1",
      createdAt,
      updatedAt: createdAt,
    })
    await ctx.db.insert("auditChecks", {
      workspaceId,
      auditId,
      category: "conversion",
      key: "clear_cta",
      status: "failed",
      label: "Klarer CTA",
      evidence: "Kein eindeutiger CTA gefunden",
      weight: 1,
      createdAt,
    })
    await ctx.db.insert("auditFindings", {
      workspaceId,
      auditId,
      category: "conversion",
      severity: "medium",
      title: "CTA konkretisieren",
      evidence: "Kein eindeutiger CTA gefunden",
      explanation: "Der nächste Schritt bleibt offen.",
      recommendation: "CTA präzisieren.",
      salesAngle: "Kontaktweg verständlicher machen.",
      sortOrder: 0,
      createdAt,
    })
    await ctx.db.insert("auditSummaries", {
      workspaceId,
      auditId,
      shortSummary: "Der Kontaktweg lässt sich konkretisieren.",
      strengths: ["Grundstruktur vorhanden"],
      weaknesses: ["CTA ist allgemein"],
      topOpportunities: ["CTA präzisieren"],
      nextSteps: ["CTA-Variante prüfen"],
      createdAt,
    })
    await ctx.db.insert("outreachDrafts", {
      workspaceId,
      auditId,
      type: "email",
      subject: "Kurze Idee zum Kontaktweg",
      subjectLines: ["Kurze Idee zum Kontaktweg"],
      body: "Der nächste Schritt könnte noch klarer benannt werden.",
      createdAt,
    })
    return auditId
  })
}

describe("TASK-5.7 audit backfills", () => {
  test("assigns a stable external ID and one immutable legacy output across resumptions", async () => {
    const t = convexTest(schema, modules)
    migrationsComponent.register(t)
    const auditId = await seedLegacyAudit(t)

    await t.run(async (ctx) => {
      await runToCompletion(ctx, components.migrations, internal.migrations.backfillAuditExternalApiIds, {
        name: "test:audit-api-ids:first",
        batchSize: 1,
      })
      await runToCompletion(ctx, components.migrations, internal.migrations.backfillLegacyAuditOutputVersions, {
        name: "test:audit-output:first",
        batchSize: 1,
      })
      await runToCompletion(ctx, components.migrations, internal.migrations.backfillAuditExternalApiIds, {
        name: "test:audit-api-ids:resume",
        cursor: null,
        batchSize: 1,
      })
      await runToCompletion(ctx, components.migrations, internal.migrations.backfillLegacyAuditOutputVersions, {
        name: "test:audit-output:resume",
        cursor: null,
        batchSize: 1,
      })
    })

    const result = await t.run(async (ctx) => {
      const audit = await ctx.db.get(auditId)
      const versions = await ctx.db
        .query("auditOutputVersions")
        .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
        .collect()
      const findings = await ctx.db
        .query("auditFindings")
        .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
        .collect()
      const verification = await ctx.runQuery(internal.migrations.verifyAuditApiAndOutputBackfill, {})
      return { audit, versions, findings, verification }
    })

    expect(result.audit?.externalApiId).toMatch(/^aud_[A-Za-z0-9_-]{22}$/)
    expect(result.audit?.creationChannel).toBe("ui")
    expect(result.versions).toHaveLength(1)
    expect(result.versions[0]).toMatchObject({ status: "active", executor: "legacy", claimSafetyPass: false })
    expect(result.audit?.activeOutputVersionId).toBe(result.versions[0]._id)
    expect(result.findings[0]?.outputVersionId).toBe(result.versions[0]._id)
    expect(result.findings[0]?.evidenceRefs).toEqual(["conversion:clear_cta"])
    expect(result.verification).toEqual({
      complete: true,
      sampleMissingApiAuditId: null,
      sampleMissingOutputAuditId: null,
      duplicateApiId: null,
    })
  })
})
