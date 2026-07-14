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

async function getLedgerEntryByIdempotencyKey(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  idempotencyKey: string,
) {
  return await ctx.db
    .query("creditLedger")
    .withIndex("by_workspaceId_and_idempotencyKey", (q) =>
      q.eq("workspaceId", workspaceId).eq("idempotencyKey", idempotencyKey),
    )
    .unique()
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

export async function reserveWorkspaceBatchCredits(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  createdByUserId: Id<"users">,
  batchAuditJobId: Id<"batchAuditJobs">,
  amount: number,
  idempotencyKey: string,
) {
  if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
    throw new ConvexError({ code: "INVALID_CREDIT_AMOUNT", message: "Invalid batch credit amount" })
  }
  const existing = await getLedgerEntryByIdempotencyKey(ctx, workspaceId, idempotencyKey)
  if (existing) {
    if (existing.batchAuditJobId !== batchAuditJobId || existing.type !== "reserve" || existing.amount !== amount) {
      throw new ConvexError({ code: "IDEMPOTENCY_CONFLICT", message: "Credit reservation key is already in use" })
    }
    return getWorkspaceCreditSnapshot(await getWorkspaceCreditBalance(ctx, workspaceId))
  }

  const balance = await ensureWorkspaceCreditBalance(ctx, workspaceId, createdByUserId)
  if (!balance || toSnapshot(balance).remaining < amount) {
    throw new ConvexError({ code: "INSUFFICIENT_CREDITS", message: "Not enough credits for this batch" })
  }

  const now = Date.now()
  await ctx.db.patch(balance._id, {
    reservedCredits: balance.reservedCredits + amount,
    updatedAt: now,
  })
  await ctx.db.insert("creditLedger", {
    workspaceId,
    batchAuditJobId,
    type: "reserve",
    amount,
    balanceScope: "mixed",
    idempotencyKey,
    reason: "batch_audit_start",
    createdByUserId,
    createdAt: now,
  })

  return getWorkspaceCreditSnapshot({ ...balance, reservedCredits: balance.reservedCredits + amount })
}

export async function reserveWorkspaceBatchItemRetryCredit(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  createdByUserId: Id<"users">,
  batchAuditJobId: Id<"batchAuditJobs">,
  batchAuditItemId: Id<"batchAuditItems">,
  idempotencyKey: string,
) {
  const existing = await getLedgerEntryByIdempotencyKey(ctx, workspaceId, idempotencyKey)
  if (existing) return getWorkspaceCreditSnapshot(await getWorkspaceCreditBalance(ctx, workspaceId))

  const balance = await ensureWorkspaceCreditBalance(ctx, workspaceId, createdByUserId)
  if (!balance || toSnapshot(balance).remaining < 1) {
    throw new ConvexError({ code: "INSUFFICIENT_CREDITS", message: "No credits available for retry" })
  }
  const now = Date.now()
  await ctx.db.patch(balance._id, {
    reservedCredits: balance.reservedCredits + 1,
    updatedAt: now,
  })
  await ctx.db.insert("creditLedger", {
    workspaceId,
    batchAuditJobId,
    batchAuditItemId,
    type: "reserve",
    amount: 1,
    balanceScope: "mixed",
    idempotencyKey,
    reason: "batch_audit_retry",
    createdByUserId,
    createdAt: now,
  })
  return getWorkspaceCreditSnapshot({ ...balance, reservedCredits: balance.reservedCredits + 1 })
}

export async function consumeWorkspaceBatchItemCredit(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">
    batchAuditJobId: Id<"batchAuditJobs">
    batchAuditItemId: Id<"batchAuditItems">
    auditId: Id<"audits">
    idempotencyKey: string
  },
) {
  const existing = await getLedgerEntryByIdempotencyKey(ctx, args.workspaceId, args.idempotencyKey)
  if (existing) return getWorkspaceCreditSnapshot(await getWorkspaceCreditBalance(ctx, args.workspaceId))
  const balance = await getWorkspaceCreditBalance(ctx, args.workspaceId)
  if (!balance || balance.reservedCredits < 1) {
    throw new ConvexError({ code: "CREDIT_INVARIANT_VIOLATION", message: "Missing batch credit reservation" })
  }
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
    workspaceId: args.workspaceId,
    auditId: args.auditId,
    batchAuditJobId: args.batchAuditJobId,
    batchAuditItemId: args.batchAuditItemId,
    type: "consume",
    amount: 1,
    balanceScope: useMonthly ? "monthly" : "extra",
    idempotencyKey: args.idempotencyKey,
    reason: "batch_audit_completed",
    createdAt: now,
  })
  return getWorkspaceCreditSnapshot(next)
}

export async function releaseWorkspaceBatchItemCredit(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">
    batchAuditJobId: Id<"batchAuditJobs">
    batchAuditItemId: Id<"batchAuditItems">
    auditId?: Id<"audits">
    idempotencyKey: string
    reason: string
  },
) {
  const existing = await getLedgerEntryByIdempotencyKey(ctx, args.workspaceId, args.idempotencyKey)
  if (existing) return getWorkspaceCreditSnapshot(await getWorkspaceCreditBalance(ctx, args.workspaceId))
  const balance = await getWorkspaceCreditBalance(ctx, args.workspaceId)
  if (!balance || balance.reservedCredits < 1) {
    throw new ConvexError({ code: "CREDIT_INVARIANT_VIOLATION", message: "Missing batch credit reservation" })
  }
  const now = Date.now()
  const nextReserved = balance.reservedCredits - 1
  await ctx.db.patch(balance._id, { reservedCredits: nextReserved, updatedAt: now })
  await ctx.db.insert("creditLedger", {
    workspaceId: args.workspaceId,
    auditId: args.auditId,
    batchAuditJobId: args.batchAuditJobId,
    batchAuditItemId: args.batchAuditItemId,
    type: "refund",
    amount: 1,
    balanceScope: "mixed",
    idempotencyKey: args.idempotencyKey,
    reason: args.reason,
    createdAt: now,
  })
  return getWorkspaceCreditSnapshot({ ...balance, reservedCredits: nextReserved })
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
