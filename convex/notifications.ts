import { ConvexError, v } from "convex/values"

import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server"
import { findAppUser, getWorkspaceByOwner } from "./lib/workspace"

const LIST_LIMIT = 20
const UNREAD_COUNT_LIMIT = 1_000
const MARK_ALL_BATCH_SIZE = 100

async function requireOwner(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" })
  }
  const user = await findAppUser(ctx, identity.tokenIdentifier)
  if (!user) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" })
  }
  const workspace = await getWorkspaceByOwner(ctx, user._id)
  if (!workspace) {
    throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
  }
  return { user, workspace }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { user, workspace } = await requireOwner(ctx)
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_workspaceId_and_recipientUserId_and_createdAt", (q) =>
        q.eq("workspaceId", workspace._id).eq("recipientUserId", user._id),
      )
      .order("desc")
      .take(LIST_LIMIT)

    return await Promise.all(
      notifications.map(async (notification) => {
        const audit = await ctx.db.get(notification.auditId)
        return {
          _id: notification._id,
          auditId: notification.auditId,
          type: notification.type,
          readAt: notification.readAt ?? null,
          createdAt: notification.createdAt,
          domain: audit?.workspaceId === workspace._id ? audit.domain : null,
        }
      }),
    )
  },
})

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const { user, workspace } = await requireOwner(ctx)
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_workspaceId_and_recipientUserId_and_readAt", (q) =>
        q.eq("workspaceId", workspace._id).eq("recipientUserId", user._id).eq("readAt", undefined),
      )
      .take(UNREAD_COUNT_LIMIT + 1)
    return {
      count: Math.min(notifications.length, UNREAD_COUNT_LIMIT),
      capped: notifications.length > UNREAD_COUNT_LIMIT,
    }
  },
})

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const { user, workspace } = await requireOwner(ctx)
    const notification = await ctx.db.get(args.notificationId)
    if (
      !notification ||
      notification.recipientUserId !== user._id ||
      notification.workspaceId !== workspace._id
    ) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Notification not found" })
    }
    if (!notification.readAt) {
      await ctx.db.patch(notification._id, { readAt: Date.now() })
    }
    return { read: true }
  },
})

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const { user, workspace } = await requireOwner(ctx)
    const updated = await markUnreadBatch(ctx, workspace._id, user._id)
    if (updated === MARK_ALL_BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.notifications.markAllReadBatch, {
        workspaceId: workspace._id,
        recipientUserId: user._id,
      })
    }
    return { updated }
  },
})

async function markUnreadBatch(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  recipientUserId: Id<"users">,
) {
  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_workspaceId_and_recipientUserId_and_readAt", (q) =>
      q.eq("workspaceId", workspaceId).eq("recipientUserId", recipientUserId).eq("readAt", undefined),
    )
    .order("desc")
    .take(MARK_ALL_BATCH_SIZE)
  const now = Date.now()
  await Promise.all(notifications.map((notification) => ctx.db.patch(notification._id, { readAt: now })))
  return notifications.length
}

export const markAllReadBatch = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    recipientUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const updated = await markUnreadBatch(ctx, args.workspaceId, args.recipientUserId)
    if (updated === MARK_ALL_BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.notifications.markAllReadBatch, args)
    }
    return null
  },
})
