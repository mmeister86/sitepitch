import type { Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"

export async function getWorkspaceAuditCounter(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
) {
  return await ctx.db
    .query("workspaceAuditCounters")
    .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
    .unique()
}

export async function ensureWorkspaceAuditCounter(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
) {
  const existing = await getWorkspaceAuditCounter(ctx, workspaceId)
  if (existing) return existing._id
  const now = Date.now()
  return await ctx.db.insert("workspaceAuditCounters", {
    workspaceId,
    total: 0,
    createdAt: now,
    updatedAt: now,
  })
}

export async function incrementWorkspaceAuditTotal(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  delta = 1,
) {
  if (!Number.isSafeInteger(delta)) throw new Error("Workspace audit counter delta must be a safe integer")
  if (delta === 0) return
  const counter = await getWorkspaceAuditCounter(ctx, workspaceId)
  if (!counter) {
    if (delta < 0) throw new Error("Workspace audit counter underflow")
    const now = Date.now()
    await ctx.db.insert("workspaceAuditCounters", {
      workspaceId,
      total: delta,
      createdAt: now,
      updatedAt: now,
    })
    return
  }
  const total = counter.total + delta
  if (total < 0) throw new Error("Workspace audit counter underflow")
  await ctx.db.patch(counter._id, { total, updatedAt: Date.now() })
}
