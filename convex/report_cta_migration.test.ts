/// <reference types="vite/client" />
import { runToCompletion } from "@convex-dev/migrations"
import migrationsComponent from "@convex-dev/migrations/test"
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

import { components, internal } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob(["./migrations.ts", "./lib/report_cta.ts", "./_generated/*.js"])

describe("public report CTA snapshot migration", () => {
  test("backfills only legacy public reports with a strictly normalized effective target", async () => {
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
        ownerUserId: userId,
        name: "Legacy",
        reportLanguage: "de",
        ctaText: "Legacy CTA",
        ctaUrl: "https://user:secret@unsafe.example.com",
        website: "https://safe.example.com/contact",
        contactEmail: "hello%0d%0abcc@example.com",
        createdAt: now,
        updatedAt: now,
      })
      const base = {
        workspaceId,
        createdByUserId: userId,
        url: "https://lead.example",
        normalizedUrl: "https://lead.example/",
        domain: "lead.example",
        auditType: "standard" as const,
        reportLanguage: "de" as const,
        status: "completed" as const,
        statusMessage: "Fertig",
        reportVersion: "v1",
        createdAt: now,
        updatedAt: now,
      }
      const legacyPublicId = await ctx.db.insert("audits", {
        ...base,
        idempotencyKey: "legacy-public",
        publicSlug: "legacy-public",
        isPublic: true,
      })
      const privateId = await ctx.db.insert("audits", {
        ...base,
        idempotencyKey: "private",
        publicSlug: "private",
        isPublic: false,
      })
      const existingSnapshotId = await ctx.db.insert("audits", {
        ...base,
        idempotencyKey: "existing-snapshot",
        publicSlug: "existing-snapshot",
        isPublic: true,
        reportCtaText: "Existing",
        reportCtaUrl: "https://existing.example.com",
        reportCtaSnapshottedAt: now - 1,
      })
      return { legacyPublicId, privateId, existingSnapshotId }
    })

    await t.run(async (ctx) => {
      await runToCompletion(
        ctx,
        components.migrations,
        internal.migrations.backfillPublicReportCtaSnapshots,
      )
      await runToCompletion(
        ctx,
        components.migrations,
        internal.migrations.backfillPublicReportCtaSnapshots,
      )
    })

    const result = await t.run(async (ctx) => ({
      legacy: await ctx.db.get(seeded.legacyPublicId),
      privateAudit: await ctx.db.get(seeded.privateId),
      existing: await ctx.db.get(seeded.existingSnapshotId),
    }))
    expect(result.legacy?.reportCtaText).toBe("Legacy CTA")
    expect(result.legacy?.reportCtaUrl).toBe("https://safe.example.com/contact")
    expect(result.legacy?.reportCtaSnapshottedAt).toBeTypeOf("number")
    expect(result.privateAudit?.reportCtaSnapshottedAt).toBeUndefined()
    expect(result.existing?.reportCtaText).toBe("Existing")
    expect(result.existing?.reportCtaUrl).toBe("https://existing.example.com")
    expect(result.existing?.reportCtaSnapshottedAt).toBe(1_699_999_999_999)
  })
})
