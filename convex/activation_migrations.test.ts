/// <reference types="vite/client" />
import { describe, expect, test } from "vitest"
import { convexTest } from "convex-test"
import { runToCompletion } from "@convex-dev/migrations"
import migrationsComponent from "@convex-dev/migrations/test"

import { components, internal } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob(["./migrations.ts", "./_generated/*.js"])

describe("activation migrations", () => {
  test("maps legacy values and backfills activity discriminators idempotently", async () => {
    const t = convexTest(schema, modules)
    migrationsComponent.register(t)
    const seeded = await t.run(async (ctx) => {
      const createdAt = 1_700_000_000_000
      const userId = await ctx.db.insert("users", { tokenIdentifier: "migration-user", betterAuthUserId: "migration-user", email: "migration@example.com", createdAt })
      const workspaceId = await ctx.db.insert("workspaces", { name: "Legacy", ownerUserId: userId, reportLanguage: "de", createdAt, updatedAt: createdAt })
      const leadId = await ctx.db.insert("leads", { workspaceId, businessName: "Legacy lead", sourceProvider: "manual", status: "not_interested", createdAt, updatedAt: createdAt })
      const visibleEventId = await ctx.db.insert("usageEvents", { workspaceId, event: "report_opened", createdAt })
      const hiddenEventId = await ctx.db.insert("usageEvents", { workspaceId, event: "audit_started", createdAt })
      return { createdAt, userId, workspaceId, leadId, visibleEventId, hiddenEventId }
    })

    await t.run(async (ctx) => {
      await runToCompletion(ctx, components.migrations, internal.migrations.canonicalizeLeadStatuses)
      await runToCompletion(ctx, components.migrations, internal.migrations.backfillSignedUpEvents)
      await runToCompletion(ctx, components.migrations, internal.migrations.backfillSignedUpEvents)
      await runToCompletion(ctx, components.migrations, internal.migrations.backfillFeedActivityDiscriminator)
      await runToCompletion(ctx, components.migrations, internal.migrations.backfillFeedActivityDiscriminator)
    })

    const result = await t.run(async (ctx) => ({
      lead: await ctx.db.get(seeded.leadId),
      events: await ctx.db.query("usageEvents").withIndex("by_workspaceId_and_event", (q) => q.eq("workspaceId", seeded.workspaceId).eq("event", "signed_up")).take(10),
      visibleEvent: await ctx.db.get(seeded.visibleEventId),
      hiddenEvent: await ctx.db.get(seeded.hiddenEventId),
    }))
    expect(result.lead?.status).toBe("lost")
    expect(result.events).toHaveLength(1)
    expect(result.events[0]?.userId).toBe(seeded.userId)
    expect(result.events[0]?.createdAt).toBe(seeded.createdAt)
    expect(result.visibleEvent?.isFeedActivity).toBe(true)
    expect(result.hiddenEvent?.isFeedActivity).toBeUndefined()
  })
})
