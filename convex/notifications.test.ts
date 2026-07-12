/// <reference types="vite/client" />
import assert from "node:assert/strict"

import { convexTest } from "convex-test"
import { describe, test } from "vitest"

import schema from "./schema.ts"
import { api } from "./_generated/api"

const modules = import.meta.glob([
  "./notifications.ts",
  "./auth.ts",
  "./lib/workspace.ts",
  "./_generated/*.js",
])

function createTest() {
  return convexTest(schema, modules)
}

async function seedNotifications(t: ReturnType<typeof createTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const ownerUserId = await ctx.db.insert("users", {
      tokenIdentifier: "notifications-owner-token",
      betterAuthUserId: "notifications-owner-auth",
      email: "owner@example.com",
      createdAt: now,
    })
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Owner Workspace",
      ownerUserId,
      reportLanguage: "de",
      createdAt: now,
      updatedAt: now,
    })
    const auditId = await ctx.db.insert("audits", {
      workspaceId,
      createdByUserId: ownerUserId,
      url: "https://owner.example.com",
      normalizedUrl: "https://owner.example.com/",
      domain: "owner.example.com",
      auditType: "standard",
      reportLanguage: "de",
      idempotencyKey: "notifications-owner-audit",
      status: "completed",
      statusMessage: "Done",
      publicSlug: "notifications-owner",
      isPublic: true,
      reportVersion: "v1",
      createdAt: now,
      updatedAt: now,
    })
    const firstOpenId = await ctx.db.insert("notifications", {
      workspaceId,
      auditId,
      recipientUserId: ownerUserId,
      type: "first_open",
      idempotencyKey: `first_open:${auditId}`,
      createdAt: now - 100,
    })
    const firstReopenId = await ctx.db.insert("notifications", {
      workspaceId,
      auditId,
      recipientUserId: ownerUserId,
      type: "first_reopen",
      idempotencyKey: `first_reopen:${auditId}`,
      createdAt: now,
    })

    const otherUserId = await ctx.db.insert("users", {
      tokenIdentifier: "notifications-other-token",
      betterAuthUserId: "notifications-other-auth",
      email: "other@example.com",
      createdAt: now,
    })
    const otherWorkspaceId = await ctx.db.insert("workspaces", {
      name: "Other Workspace",
      ownerUserId: otherUserId,
      reportLanguage: "de",
      createdAt: now,
      updatedAt: now,
    })
    const otherAuditId = await ctx.db.insert("audits", {
      workspaceId: otherWorkspaceId,
      createdByUserId: otherUserId,
      url: "https://other.example.com",
      normalizedUrl: "https://other.example.com/",
      domain: "other.example.com",
      auditType: "standard",
      reportLanguage: "de",
      idempotencyKey: "notifications-other-audit",
      status: "completed",
      statusMessage: "Done",
      publicSlug: "notifications-other",
      isPublic: true,
      reportVersion: "v1",
      createdAt: now,
      updatedAt: now,
    })
    const otherNotificationId = await ctx.db.insert("notifications", {
      workspaceId: otherWorkspaceId,
      auditId: otherAuditId,
      recipientUserId: otherUserId,
      type: "first_open",
      idempotencyKey: `first_open:${otherAuditId}`,
      createdAt: now + 100,
    })

    return {
      ownerUserId,
      workspaceId,
      auditId,
      firstOpenId,
      firstReopenId,
      otherWorkspaceId,
      otherAuditId,
      otherNotificationId,
    }
  })
}

describe("notifications", () => {
  test("returns a bounded newest-first owner list and unread count", async () => {
    const t = createTest()
    await seedNotifications(t)
    const authed = t.withIdentity({ tokenIdentifier: "notifications-owner-token" })

    const [items, unreadCount] = await Promise.all([
      authed.query(api.notifications.list, {}),
      authed.query(api.notifications.unreadCount, {}),
    ])

    assert.equal(items.length, 2)
    assert.equal(items[0]?.type, "first_reopen")
    assert.equal(items[0]?.domain, "owner.example.com")
    assert.deepEqual(unreadCount, { count: 2, capped: false })
  })

  test("binds workspace and recipient before limiting list and unread count", async () => {
    const t = createTest()
    const { ownerUserId, workspaceId, auditId, otherWorkspaceId, otherAuditId } =
      await seedNotifications(t)
    const base = Date.now()
    await t.run(async (ctx) => {
      for (let index = 0; index < 20; index += 1) {
        await ctx.db.insert("notifications", {
          workspaceId,
          auditId,
          recipientUserId: ownerUserId,
          type: "first_reopen",
          idempotencyKey: `owner-extra:${index}`,
          createdAt: base + index,
        })
      }
      for (let index = 0; index < 25; index += 1) {
        await ctx.db.insert("notifications", {
          workspaceId: otherWorkspaceId,
          auditId: otherAuditId,
          recipientUserId: ownerUserId,
          type: "first_reopen",
          idempotencyKey: `foreign-newer:${index}`,
          createdAt: base + 1_000 + index,
        })
      }
    })
    const authed = t.withIdentity({ tokenIdentifier: "notifications-owner-token" })

    const [items, unreadCount] = await Promise.all([
      authed.query(api.notifications.list, {}),
      authed.query(api.notifications.unreadCount, {}),
    ])

    assert.equal(items.length, 20)
    assert.equal(items.every((item) => item.domain === "owner.example.com"), true)
    assert.equal(items[0]!.createdAt > items[19]!.createdAt, true)
    assert.deepEqual(unreadCount, { count: 22, capped: false })
  })

  test("distinguishes exactly 1000 unread notifications from a capped 1001 and isolates workspaces", async () => {
    const t = createTest()
    const { ownerUserId, workspaceId, auditId, otherWorkspaceId, otherAuditId } =
      await seedNotifications(t)
    await t.run(async (ctx) => {
      for (let index = 0; index < 998; index += 1) {
        await ctx.db.insert("notifications", {
          workspaceId,
          auditId,
          recipientUserId: ownerUserId,
          type: "first_reopen",
          idempotencyKey: `count-owner:${index}`,
          createdAt: index,
        })
      }
      for (let index = 0; index < 20; index += 1) {
        await ctx.db.insert("notifications", {
          workspaceId: otherWorkspaceId,
          auditId: otherAuditId,
          recipientUserId: ownerUserId,
          type: "first_reopen",
          idempotencyKey: `count-foreign:${index}`,
          createdAt: index,
        })
      }
    })
    const authed = t.withIdentity({ tokenIdentifier: "notifications-owner-token" })
    assert.deepEqual(await authed.query(api.notifications.unreadCount, {}), {
      count: 1_000,
      capped: false,
    })

    await t.run(async (ctx) => {
      await ctx.db.insert("notifications", {
        workspaceId,
        auditId,
        recipientUserId: ownerUserId,
        type: "first_reopen",
        idempotencyKey: "count-owner:1001",
        createdAt: 2_000,
      })
    })
    assert.deepEqual(await authed.query(api.notifications.unreadCount, {}), {
      count: 1_000,
      capped: true,
    })
  })

  test("does not expose notifications without authentication", async () => {
    const t = createTest()
    await seedNotifications(t)
    await assert.rejects(() => t.query(api.notifications.list, {}), /UNAUTHENTICATED/i)
    await assert.rejects(() => t.query(api.notifications.unreadCount, {}), /UNAUTHENTICATED/i)
  })

  test("marks owned notifications read and rejects foreign IDs", async () => {
    const t = createTest()
    const { firstOpenId, otherNotificationId } = await seedNotifications(t)
    const authed = t.withIdentity({ tokenIdentifier: "notifications-owner-token" })

    await authed.mutation(api.notifications.markRead, { notificationId: firstOpenId })
    assert.deepEqual(await authed.query(api.notifications.unreadCount, {}), { count: 1, capped: false })
    await assert.rejects(
      () => authed.mutation(api.notifications.markRead, { notificationId: otherNotificationId }),
      /NOT_FOUND|FORBIDDEN/i,
    )
  })

  test("marks all owner notifications read without touching another workspace", async () => {
    const t = createTest()
    const { otherNotificationId } = await seedNotifications(t)
    const authed = t.withIdentity({ tokenIdentifier: "notifications-owner-token" })

    const result = await authed.mutation(api.notifications.markAllRead, {})
    assert.equal(result.updated, 2)
    assert.deepEqual(await authed.query(api.notifications.unreadCount, {}), { count: 0, capped: false })

    const foreign = await t.run((ctx) => ctx.db.get(otherNotificationId))
    assert.equal(foreign?.readAt, undefined)
  })
})
