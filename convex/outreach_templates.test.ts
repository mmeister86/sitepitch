/// <reference types="vite/client" />
import assert from "node:assert/strict"

import { convexTest } from "convex-test"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { api } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

const modules = import.meta.glob(["./auth.ts", "./outreach_templates.ts", "./lib/*.ts", "./_generated/*.js"])

function createTest() {
  return convexTest(schema, modules)
}

beforeEach(() => {
  vi.stubEnv("SITE_URL", "https://trusted.sitepitch.test/base/")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

async function seedWorkspace(t: ReturnType<typeof createTest>, tokenIdentifier: string) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const userId = await ctx.db.insert("users", {
      tokenIdentifier,
      betterAuthUserId: `${tokenIdentifier}-auth`,
      email: `${tokenIdentifier}@example.com`,
      createdAt: now,
    })
    const workspaceId = await ctx.db.insert("workspaces", {
      ownerUserId: userId,
      name: `${tokenIdentifier} Studio`,
      reportLanguage: "de",
      createdAt: now,
      updatedAt: now,
    })
    return { userId, workspaceId }
  })
}

async function seedAudit(
  t: ReturnType<typeof createTest>,
  ids: { userId: Id<"users">; workspaceId: Id<"workspaces"> },
  businessName = "Muster GmbH",
) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const leadId = await ctx.db.insert("leads", {
      workspaceId: ids.workspaceId,
      businessName,
      sourceProvider: "manual",
      status: "new",
      createdAt: now,
      updatedAt: now,
    })
    const auditId = await ctx.db.insert("audits", {
      workspaceId: ids.workspaceId,
      createdByUserId: ids.userId,
      leadId,
      url: "https://muster.example",
      normalizedUrl: "https://muster.example/",
      domain: "muster.example",
      auditType: "standard",
      reportLanguage: "de",
      idempotencyKey: `audit-${now}-${businessName}`,
      status: "completed",
      statusMessage: "Fertig",
      publicSlug: `report-${now}`,
      isPublic: true,
      reportVersion: "v1",
      overallScore: 73,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(leadId, { auditId })
    return { auditId, leadId }
  })
}

describe("outreach templates", () => {
  test("supports bounded newest-first CRUD with workspace isolation and DTOs", async () => {
    const t = createTest()
    const ownerIds = await seedWorkspace(t, "owner-token")
    await seedWorkspace(t, "other-token")
    const owner = t.withIdentity({ tokenIdentifier: "owner-token" })
    const other = t.withIdentity({ tokenIdentifier: "other-token" })

    const first = await owner.mutation(api.outreach_templates.create, {
      name: " Erstkontakt ",
      type: "email",
      language: "de",
      subject: "Hallo {{business_name}}",
      body: "Kurzer Hinweis zu {{domain}}.",
    })
    await new Promise((resolve) => setTimeout(resolve, 2))
    const second = await owner.mutation(api.outreach_templates.create, {
      name: "Follow-up",
      type: "follow_up",
      language: "en",
      body: "Your score: {{score}} — {{report_url}}",
    })

    const list = await owner.query(api.outreach_templates.listMyTemplates, {})
    assert.equal(list?.length, 2)
    assert.equal(list?.[0]?._id, second)
    assert.deepEqual(Object.keys(list![0]!).sort(), [
      "_id", "body", "language", "name", "type", "updatedAt",
    ])
    assert.deepEqual(await other.query(api.outreach_templates.listMyTemplates, {}), [])
    await expect(t.query(api.outreach_templates.listMyTemplates, {}))
      .rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } })

    await expect(other.mutation(api.outreach_templates.update, {
      templateId: first,
      name: "Fremd",
      type: "email",
      language: "de",
      body: "Hallo",
    })).rejects.toMatchObject({ data: { code: "NOT_FOUND" } })

    await owner.mutation(api.outreach_templates.update, {
      templateId: first,
      name: "Neuer Name",
      type: "email",
      language: "de",
      subject: "Hallo",
      body: "Sachlicher Text.",
    })
    assert.equal((await owner.query(api.outreach_templates.listMyTemplates, {}))?.[0]?.name, "Neuer Name")
    await expect(owner.mutation(api.outreach_templates.update, {
      templateId: first,
      name: "Unsicher",
      type: "email",
      language: "de",
      body: "Ihre Website ist schlecht.",
    })).rejects.toMatchObject({ data: { code: "VALIDATION_ERROR", issues: expect.any(Array) } })
    assert.equal((await t.run((ctx) => ctx.db.get(first)))?.name, "Neuer Name")

    await expect(other.mutation(api.outreach_templates.deleteTemplate, { templateId: first }))
      .rejects.toMatchObject({ data: { code: "NOT_FOUND" } })
    assert.ok(await t.run((ctx) => ctx.db.get(first)))

    await owner.mutation(api.outreach_templates.deleteTemplate, { templateId: first })
    assert.equal(await t.run((ctx) => ctx.db.get(first)), null)

    await t.run(async (ctx) => {
      for (let i = 0; i < 55; i++) {
        await ctx.db.insert("outreachTemplates", {
          workspaceId: ownerIds.workspaceId,
          createdByUserId: ownerIds.userId,
          name: `Template ${i}`,
          type: "email",
          language: "de",
          body: "Hallo",
          createdAt: Date.now() + i,
          updatedAt: Date.now() + i,
        })
      }
    })
    assert.equal((await owner.query(api.outreach_templates.listMyTemplates, {}))?.length, 50)
  })

  test("validates limits, placeholders, and unsafe raw content", async () => {
    const t = createTest()
    await seedWorkspace(t, "owner-token")
    const owner = t.withIdentity({ tokenIdentifier: "owner-token" })

    for (const body of [
      "Hallo {{unknown}}",
      "Hallo {{ business_name }}",
      "Hallo {{business_name}",
      "Hallo business_name}}",
      "Hallo {{business_name}}}",
    ]) {
      await expect(owner.mutation(api.outreach_templates.create, {
        name: "Ungültig",
        type: "email",
        language: "de",
        body,
      })).rejects.toMatchObject({ data: { code: "VALIDATION_ERROR" } })
    }

    await expect(owner.mutation(api.outreach_templates.create, {
      name: "x".repeat(81),
      type: "email",
      language: "de",
      body: "Hallo",
    })).rejects.toMatchObject({ data: { code: "VALIDATION_ERROR" } })
    await expect(owner.mutation(api.outreach_templates.create, {
      name: "Literal braces",
      type: "email",
      language: "de",
      body: "JSON-Beispiel: {\"ok\": true}",
    })).resolves.toBeTruthy()
    await expect(owner.mutation(api.outreach_templates.create, {
      name: "Zu lang",
      type: "email",
      language: "de",
      subject: "x".repeat(201),
      body: "Hallo",
    })).rejects.toMatchObject({ data: { code: "VALIDATION_ERROR" } })
    await expect(owner.mutation(api.outreach_templates.create, {
      name: "Zu lang",
      type: "email",
      language: "de",
      body: "x".repeat(5001),
    })).rejects.toMatchObject({ data: { code: "VALIDATION_ERROR" } })
    await expect(owner.mutation(api.outreach_templates.create, {
      name: "Leer",
      type: "email",
      language: "de",
      body: "   ",
    })).rejects.toMatchObject({ data: { code: "VALIDATION_ERROR" } })
    await expect(owner.mutation(api.outreach_templates.create, {
      name: "Unsicher",
      type: "email",
      language: "de",
      body: "Ihre Website ist schlecht.",
    })).rejects.toMatchObject({
      data: { code: "VALIDATION_ERROR", issues: expect.any(Array) },
    })
  })

  test("renders the exact context and rejects unsafe rendered lead content", async () => {
    const t = createTest()
    const ids = await seedWorkspace(t, "owner-token")
    const { auditId } = await seedAudit(t, ids)
    const otherIds = await seedWorkspace(t, "other-token")
    const otherAudit = await seedAudit(t, otherIds)
    const owner = t.withIdentity({ tokenIdentifier: "owner-token" })
    const templateId = await owner.mutation(api.outreach_templates.create, {
      name: "Report",
      type: "email",
      language: "de",
      subject: "Report für {{business_name}}",
      body: "{{domain}} erreicht {{score}} Punkte: {{report_url}}",
    })

    const audit = await t.run((ctx) => ctx.db.get(auditId))
    await expect(owner.query(api.outreach_templates.renderForAudit, {
      templateId,
      auditId: otherAudit.auditId,
    })).rejects.toMatchObject({ data: { code: "NOT_FOUND" } })
    await expect(owner.query(api.outreach_templates.renderForAudit, {
      templateId,
      auditId,
    })).resolves.toBeTruthy()
    const rendered = await owner.query(api.outreach_templates.renderForAudit, {
      templateId,
      auditId,
    })
    assert.equal(rendered.subject, "Report für Muster GmbH")
    assert.equal(
      rendered.body,
      `muster.example erreicht 73 Punkte: https://trusted.sitepitch.test/base/r/${audit!.publicSlug}`,
    )
    assert.equal(rendered.context.businessName, "Muster GmbH")
    assert.equal(rendered.context.domain, "muster.example")
    assert.equal(rendered.context.score, "73")

    await t.run((ctx) => ctx.db.patch(auditId, { isPublic: false }))
    await expect(owner.query(api.outreach_templates.renderForAudit, {
      templateId,
      auditId,
    })).rejects.toMatchObject({ data: { code: "VALIDATION_ERROR" } })

    const unsafe = await seedAudit(t, ids, "Ihre Website ist schlecht")
    await expect(owner.query(api.outreach_templates.renderForAudit, {
      templateId,
      auditId: unsafe.auditId,
    })).rejects.toMatchObject({
      data: { code: "VALIDATION_ERROR", issues: expect.any(Array) },
    })
  })

  test("rejects missing or unsafe canonical SITE_URL configuration", async () => {
    const t = createTest()
    const ids = await seedWorkspace(t, "owner-token")
    const { auditId } = await seedAudit(t, ids)
    const owner = t.withIdentity({ tokenIdentifier: "owner-token" })
    const templateId = await owner.mutation(api.outreach_templates.create, {
      name: "Report",
      type: "email",
      language: "de",
      body: "{{report_url}}",
    })

    for (const siteUrl of ["", "javascript:alert(1)", "https://user:secret@example.com"]) {
      vi.stubEnv("SITE_URL", siteUrl)
      await expect(owner.query(api.outreach_templates.renderForAudit, { templateId, auditId }))
        .rejects.toMatchObject({ data: { code: "CONFIGURATION_ERROR" } })
    }
  })
})
