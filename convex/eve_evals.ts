import { v } from "convex/values"

import { internalMutation, internalQuery, query } from "./_generated/server"
import { isSupportAdmin, requireSupportAdmin } from "./lib/support"

const DIMENSIONS = ["summary", "findings", "outreach", "evidence", "claim_safety"] as const
const TREND_WINDOW_MS = 180 * 86_400_000

function boundedLimit(limit: number | undefined): number {
  return Math.max(1, Math.min(limit ?? 20, 100))
}

function score(record: Record<string, number>, key: string): number {
  return Math.max(0, Math.min(100, record[key] ?? 0))
}

function encodeCursor(createdAt: number): string {
  return String(createdAt)
}

function decodeCursor(cursor: string | undefined): number | undefined {
  if (!cursor) return undefined
  const value = Number(cursor)
  return Number.isFinite(value) ? value : undefined
}

export const getAccess = query({
  args: {},
  handler: async (ctx) => ({ allowed: await isSupportAdmin(ctx) }),
})

export const getReleasedBaseline = internalQuery({
  args: {},
  handler: async (ctx) => {
    const runs = await ctx.db
      .query("eveEvalRuns")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "passed"))
      .order("desc")
      .take(100)
    const baseline = runs.find((run) => run.trigger === "main")
    if (!baseline) return null
    return {
      releaseVersion: baseline.candidateReleaseVersion,
      suiteVersion: baseline.suiteVersion,
      eveVersion: baseline.eveVersion ?? null,
      dimensions: {
        summary: score(baseline.dimensionScores, "summary") / 100,
        findings: score(baseline.dimensionScores, "findings") / 100,
        outreach: score(baseline.dimensionScores, "outreach") / 100,
        evidence: score(baseline.dimensionScores, "evidence") / 100,
        claimSafety: score(baseline.dimensionScores, "claim_safety") / 100,
      },
    }
  },
})

export const getOverview = query({
  args: {
    dimension: v.union(
      v.literal("summary"),
      v.literal("findings"),
      v.literal("outreach"),
      v.literal("evidence"),
      v.literal("claim_safety"),
    ),
  },
  handler: async (ctx, args) => {
    await requireSupportAdmin(ctx)
    const recent = await ctx.db.query("eveEvalRuns").withIndex("by_createdAt").order("desc").take(200)
    const candidate = recent[0] ?? null
    const baseline = recent.find((run) => run.trigger === "main" && run.status === "passed") ?? null
    const trends = recent
      .filter((run) => run.createdAt >= Date.now() - TREND_WINDOW_MS && (run.trigger === "main" || run.trigger === "nightly"))
      .slice(0, 180)
      .reverse()
      .map((run) => ({
        runId: run.publicRunId,
        timestamp: run.completedAt ?? run.startedAt,
        score: score(run.dimensionScores, args.dimension),
      }))

    return {
      gateStatus: candidate?.status ?? "empty",
      candidateRunId: candidate?.publicRunId ?? null,
      baselineRunId: baseline?.publicRunId ?? null,
      dimensions: DIMENSIONS.map((key) => {
        const value = candidate ? score(candidate.dimensionScores, key) : 0
        const hardGate = key === "evidence" || key === "claim_safety"
        return { key, score: value, passed: hardGate ? value === 100 : value >= 80 }
      }),
      trends,
    }
  },
})

export const listRuns = query({
  args: { cursor: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireSupportAdmin(ctx)
    const limit = boundedLimit(args.limit)
    const cursor = decodeCursor(args.cursor)
    const page = await ctx.db
      .query("eveEvalRuns")
      .withIndex("by_createdAt", (q) => cursor === undefined ? q : q.lt("createdAt", cursor))
      .order("desc")
      .take(limit + 1)
    const visible = page.slice(0, limit)
    return {
      page: visible.map((run) => ({
        runId: run.publicRunId,
        releaseVersion: run.candidateReleaseVersion,
        baselineReleaseVersion: run.baselineReleaseVersion,
        suiteVersion: run.suiteVersion,
        fixtureVersion: run.fixtureVersion,
        status: run.status,
        trigger: run.trigger,
        buildSha: run.buildSha ?? null,
        dimensions: run.dimensionScores,
        gates: run.gates,
        caseCount: run.caseCount,
        passedCaseCount: run.passedCaseCount,
        failedCaseCount: run.failedCaseCount,
        errorCode: run.errorCode ?? null,
        startedAt: run.startedAt,
        completedAt: run.completedAt ?? null,
      })),
      isDone: page.length <= limit,
      continueCursor: page.length > limit && visible.length > 0
        ? encodeCursor(visible[visible.length - 1].createdAt)
        : null,
    }
  },
})

export const listCaseResults = query({
  args: { runId: v.string(), cursor: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireSupportAdmin(ctx)
    const run = await ctx.db.query("eveEvalRuns").withIndex("by_publicRunId", (q) => q.eq("publicRunId", args.runId)).unique()
    if (!run) return { page: [], isDone: true, continueCursor: null }
    const limit = boundedLimit(args.limit)
    const cursor = decodeCursor(args.cursor)
    const rows = await ctx.db
      .query("eveEvalCaseResults")
      .withIndex("by_evalRunId", (q) => q.eq("evalRunId", run._id))
      .order("desc")
      .collect()
    const filtered = cursor === undefined ? rows : rows.filter((row) => row.createdAt < cursor)
    const page = filtered.slice(0, limit + 1)
    const visible = page.slice(0, limit)
    return {
      page: visible.map((result) => ({
        caseId: result.caseId,
        label: result.label,
        language: result.locale,
        status: result.passed ? "passed" : "failed",
        scores: {
          summary: score(result.dimensionScores, "summary"),
          findings: score(result.dimensionScores, "findings"),
          outreach: score(result.dimensionScores, "outreach"),
          evidence: score(result.dimensionScores, "evidence"),
          claimSafety: score(result.dimensionScores, "claim_safety"),
        },
        gates: result.gates,
        regressions: Object.entries(result.regressions)
          .filter(([, delta]) => delta < -5)
          .map(([dimension, delta]) => `${dimension}: ${Math.round(delta)} Punkte gegenüber Baseline`),
        errorCode: result.errorCode ?? null,
        durationMs: result.durationMs ?? null,
      })),
      isDone: page.length <= limit,
      continueCursor: page.length > limit && visible.length > 0
        ? encodeCursor(visible[visible.length - 1].createdAt)
        : null,
    }
  },
})

const sanitizedCaseValidator = v.object({
  caseId: v.string(),
  label: v.string(),
  locale: v.union(v.literal("de"), v.literal("en")),
  dimensionScores: v.record(v.string(), v.number()),
  gates: v.record(v.string(), v.boolean()),
  regressions: v.record(v.string(), v.number()),
  passed: v.boolean(),
  errorCode: v.optional(v.string()),
  durationMs: v.optional(v.number()),
})

export const ingestEvalRun = internalMutation({
  args: {
    publicRunId: v.string(),
    candidateReleaseVersion: v.string(),
    baselineReleaseVersion: v.string(),
    suiteVersion: v.string(),
    fixtureVersion: v.string(),
    eveVersion: v.optional(v.string()),
    trigger: v.union(v.literal("pull_request"), v.literal("manual"), v.literal("nightly"), v.literal("main")),
    status: v.union(v.literal("passed"), v.literal("failed")),
    buildSha: v.optional(v.string()),
    dimensionScores: v.record(v.string(), v.number()),
    gates: v.record(v.string(), v.boolean()),
    errorCode: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.number(),
    cases: v.array(sanitizedCaseValidator),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("eveEvalRuns").withIndex("by_publicRunId", (q) => q.eq("publicRunId", args.publicRunId)).unique()
    if (existing) return { evalRunId: existing._id, duplicate: true }
    const current = Date.now()
    const passedCaseCount = args.cases.filter((item) => item.passed).length
    const evalRunId = await ctx.db.insert("eveEvalRuns", {
      publicRunId: args.publicRunId,
      candidateReleaseVersion: args.candidateReleaseVersion,
      baselineReleaseVersion: args.baselineReleaseVersion,
      suiteVersion: args.suiteVersion,
      fixtureVersion: args.fixtureVersion,
      eveVersion: args.eveVersion,
      trigger: args.trigger,
      status: args.status,
      buildSha: args.buildSha,
      dimensionScores: args.dimensionScores,
      gates: args.gates,
      caseCount: args.cases.length,
      passedCaseCount,
      failedCaseCount: args.cases.length - passedCaseCount,
      errorCode: args.errorCode,
      startedAt: args.startedAt,
      completedAt: args.completedAt,
      retentionExpiresAt: current + TREND_WINDOW_MS,
      createdAt: current,
    })
    const baselineRuns = await ctx.db
      .query("eveEvalRuns")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "passed"))
      .order("desc")
      .take(100)
    const baseline = baselineRuns.find((run) => run.trigger === "main" && run._id !== evalRunId)
    for (const item of args.cases) {
      const baselineCase = baseline
        ? await ctx.db
            .query("eveEvalCaseResults")
            .withIndex("by_evalRunId_and_caseId", (q) => q.eq("evalRunId", baseline._id).eq("caseId", item.caseId))
            .unique()
        : null
      const regressions = baselineCase
        ? Object.fromEntries(Object.entries(item.dimensionScores).map(([dimension, value]) => [
            dimension,
            value - (baselineCase.dimensionScores[dimension] ?? value),
          ]))
        : item.regressions
      await ctx.db.insert("eveEvalCaseResults", {
        evalRunId,
        caseId: item.caseId,
        label: item.label,
        locale: item.locale,
        dimensionScores: item.dimensionScores,
        gates: item.gates,
        regressions,
        passed: item.passed,
        errorCode: item.errorCode,
        durationMs: item.durationMs,
        createdAt: current,
      })
    }
    return { evalRunId, duplicate: false }
  },
})

export const deleteExpiredEvalRuns = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db.query("eveEvalRuns").withIndex("by_retentionExpiresAt", (q) => q.lt("retentionExpiresAt", Date.now())).take(25)
    let deletedCases = 0
    for (const run of expired) {
      const cases = await ctx.db.query("eveEvalCaseResults").withIndex("by_evalRunId", (q) => q.eq("evalRunId", run._id)).take(100)
      for (const item of cases) await ctx.db.delete(item._id)
      deletedCases += cases.length
      if (cases.length === 100) continue
      await ctx.db.delete(run._id)
    }
    return { deletedRuns: expired.length, deletedCases }
  },
})
