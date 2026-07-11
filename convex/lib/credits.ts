import { ConvexError } from "convex/values"

import type { Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"

export const STARTER_MONTHLY_CREDITS = 3

export type CreditSnapshot = {
  total: number
  used: number
  reserved: number
  remaining: number
  monthly: { total: number; used: number; remaining: number }
  extra: { total: number; used: number; remaining: number }
}

function toSnapshot(balance?: {
  monthlyCredits: number
  extraCredits: number
  usedMonthlyCredits: number
  usedExtraCredits: number
  reservedCredits: number
} | null): CreditSnapshot {
  const monthlyCredits = balance?.monthlyCredits ?? STARTER_MONTHLY_CREDITS
  const extraCredits = balance?.extraCredits ?? 0
  const usedMonthlyCredits = balance?.usedMonthlyCredits ?? 0
  const usedExtraCredits = balance?.usedExtraCredits ?? 0
  const reservedCredits = balance?.reservedCredits ?? 0
  const total = monthlyCredits + extraCredits
  const used = usedMonthlyCredits + usedExtraCredits
  const remaining = Math.max(0, total - used - reservedCredits)

  return {
    total,
    used,
    reserved: reservedCredits,
    remaining,
    monthly: {
      total: monthlyCredits,
      used: usedMonthlyCredits,
      remaining: Math.max(0, monthlyCredits - usedMonthlyCredits),
    },
    extra: {
      total: extraCredits,
      used: usedExtraCredits,
      remaining: Math.max(0, extraCredits - usedExtraCredits),
    },
  }
}

async function getAuditLedgerEntries(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  auditId: Id<"audits">,
) {
  return await ctx.db
    .query("creditLedger")
    .withIndex("by_workspaceId_and_auditId", (q) =>
      q.eq("workspaceId", workspaceId).eq("auditId", auditId),
    )
    .take(10)
}

export async function getWorkspaceCreditBalance(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  return await ctx.db
    .query("creditBalances")
    .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
    .unique()
}

export function getWorkspaceCreditSnapshot(balance?: {
  monthlyCredits: number
  extraCredits: number
  usedMonthlyCredits: number
  usedExtraCredits: number
  reservedCredits: number
} | null): CreditSnapshot {
  return toSnapshot(balance)
}

export async function ensureWorkspaceCreditBalance(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  createdByUserId?: Id<"users">,
) {
  const existing = await ctx.db
    .query("creditBalances")
    .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
    .unique()

  if (existing) return existing

  const now = Date.now()
  const inserted = await ctx.db.insert("creditBalances", {
    workspaceId,
    periodStart: now,
    periodEnd: 0,
    monthlyCredits: STARTER_MONTHLY_CREDITS,
    extraCredits: 0,
    usedMonthlyCredits: 0,
    usedExtraCredits: 0,
    reservedCredits: 0,
    updatedAt: now,
  })

  await ctx.db.insert("creditLedger", {
    workspaceId,
    type: "grant",
    amount: STARTER_MONTHLY_CREDITS,
    balanceScope: "monthly",
    idempotencyKey: `trial_grant:${workspaceId}`,
    reason: "one_time_trial_credits",
    createdByUserId,
    createdAt: now,
  })

  return await ctx.db.get(inserted)
}

export async function reserveWorkspaceCredit(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  createdByUserId: Id<"users">,
  auditId: Id<"audits">,
  idempotencyKey: string,
) {
  const ledger = await getAuditLedgerEntries(ctx, workspaceId, auditId)
  if (ledger.some((entry) => entry.type === "reserve")) {
    return getWorkspaceCreditSnapshot(await getWorkspaceCreditBalance(ctx, workspaceId))
  }

  const balance = await ensureWorkspaceCreditBalance(ctx, workspaceId, createdByUserId)
  if (!balance) {
    throw new ConvexError({ code: "INSUFFICIENT_CREDITS", message: "No credits available" })
  }

  const snapshot = toSnapshot(balance)
  if (snapshot.remaining < 1) {
    throw new ConvexError({ code: "INSUFFICIENT_CREDITS", message: "No credits available" })
  }

  const now = Date.now()
  await ctx.db.patch(balance._id, {
    reservedCredits: balance.reservedCredits + 1,
    updatedAt: now,
  })

  await ctx.db.insert("creditLedger", {
    workspaceId,
    auditId,
    type: "reserve",
    amount: 1,
    balanceScope: "mixed",
    idempotencyKey,
    reason: "audit_start",
    createdByUserId,
    createdAt: now,
  })

  return { ...snapshot, reserved: snapshot.reserved + 1, remaining: snapshot.remaining - 1 }
}

export async function consumeWorkspaceCreditReservation(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  auditId: Id<"audits">,
  idempotencyKey?: string,
) {
  const ledger = await getAuditLedgerEntries(ctx, workspaceId, auditId)
  if (
    !ledger.some((entry) => entry.type === "reserve") ||
    ledger.some((entry) => entry.type === "consume" || entry.type === "refund")
  ) {
    return getWorkspaceCreditSnapshot(await getWorkspaceCreditBalance(ctx, workspaceId))
  }

  const balance = await getWorkspaceCreditBalance(ctx, workspaceId)
  if (!balance || balance.reservedCredits <= 0) return getWorkspaceCreditSnapshot(balance)

  const useMonthly = balance.usedMonthlyCredits < balance.monthlyCredits
  const now = Date.now()
  const next = {
    ...balance,
    reservedCredits: balance.reservedCredits - 1,
    usedMonthlyCredits: balance.usedMonthlyCredits + (useMonthly ? 1 : 0),
    usedExtraCredits: balance.usedExtraCredits + (useMonthly ? 0 : 1),
  }
  await ctx.db.patch(balance._id, {
    reservedCredits: next.reservedCredits,
    usedMonthlyCredits: next.usedMonthlyCredits,
    usedExtraCredits: next.usedExtraCredits,
    updatedAt: now,
  })
  await ctx.db.insert("creditLedger", {
    workspaceId,
    auditId,
    type: "consume",
    amount: 1,
    balanceScope: useMonthly ? "monthly" : "extra",
    idempotencyKey: idempotencyKey ?? `consume:${auditId}`,
    reason: "audit_completed",
    createdAt: now,
  })
  return getWorkspaceCreditSnapshot(next)
}

export async function releaseWorkspaceCreditReservation(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  auditId: Id<"audits">,
  idempotencyKey?: string,
  reason = "audit_failed",
) {
  const ledger = await getAuditLedgerEntries(ctx, workspaceId, auditId)
  if (
    !ledger.some((entry) => entry.type === "reserve") ||
    ledger.some((entry) => entry.type === "consume" || entry.type === "refund")
  ) {
    return getWorkspaceCreditSnapshot(await getWorkspaceCreditBalance(ctx, workspaceId))
  }

  const balance = await getWorkspaceCreditBalance(ctx, workspaceId)
  if (!balance || balance.reservedCredits <= 0) {
    return getWorkspaceCreditSnapshot(balance)
  }

  const now = Date.now()
  await ctx.db.patch(balance._id, {
    reservedCredits: Math.max(0, balance.reservedCredits - 1),
    updatedAt: now,
  })

  await ctx.db.insert("creditLedger", {
    workspaceId,
    auditId,
    type: "refund",
    amount: 1,
    balanceScope: "mixed",
    idempotencyKey: idempotencyKey ?? `refund:${auditId}`,
    reason,
    createdAt: now,
  })

  return getWorkspaceCreditSnapshot({
    ...balance,
    reservedCredits: Math.max(0, balance.reservedCredits - 1),
  })
}
