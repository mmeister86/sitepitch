"use node"

import { ConvexError, v } from "convex/values"

import { action, internalAction, env, type ActionCtx } from "./_generated/server"
import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import type { AuditAgentContext, AuditAgentContextCheck } from "./audit_agent"
import type { AuditAgentOutput } from "./lib/audit_agent_schemas"
import { auditAgentGenerationSchema, generationToStorage, safeParseAgentOutput } from "./lib/audit_agent_schemas"
import { buildEvidenceRefs, validateOutputEvidence } from "./lib/audit_agent_evidence"
import { reviewClaimSafety, reviewTextsClaimSafety } from "./lib/audit_agent_claim_safety"
import {
  generateDeterministicAgentOutput,
  FALLBACK_MODEL,
  FALLBACK_PROVIDER,
} from "./lib/audit_agent_fallback"
import { buildSystemPrompt, buildUserPrompt } from "./lib/audit_agent_prompt"
import { buildPersonaSystemPrompt, buildPersonaUserPrompt } from "./lib/audit_persona_prompt"
import { generateDeterministicPersonaPanel } from "./lib/audit_persona_fallback"
import {
  personaPanelOutputSchema,
  safeParsePersonaPanel,
  validatePersonaEvidence,
  type PersonaPanelOutput,
  type PersonaReviewOutput,
} from "./lib/audit_persona_schemas"
import { buildCopyReviewSystemPrompt, buildCopyReviewUserPrompt } from "./lib/audit_copy_review_prompt"
import {
  copyReviewOutputSchema,
  safeParseCopyReview,
  validateCopyEvidence,
  type CopyReviewOutput,
} from "./lib/audit_copy_review_schemas"
import {
  buildDesignCritiqueSystemPrompt,
  buildDesignCritiqueUserMessages,
} from "./lib/audit_design_critique_prompt"
import {
  designCritiqueOutputSchema,
  safeParseDesignCritique,
  validateDesignCritiqueEvidence,
  type DesignCritiqueOutput,
} from "./lib/audit_design_critique_schemas"
import { generateDeterministicDesignCritique } from "./lib/audit_design_critique_fallback"
import type { CheckInput, CategoryScores } from "./lib/audit_scoring"
import { checkProviderLimit } from "./lib/audit_rate_limit"
import { sanitizeError } from "./lib/telemetry_safety"
import {
  runEveAudit,
  runEveStructuredTask,
  type EveAuditRuntimeResult,
  type EveStructuredTaskResult,
} from "../src/lib/eve/audit-runtime"
import type { EveAuditContext } from "../src/lib/eve/audit-contract"
import { eveReleaseManifest } from "../src/lib/eve/release-manifest"

const SKILL_VERSIONS = {
  "conversion-audit": "2026.07.1",
  "seo-basics-audit": "2026.07.1",
  "local-seo-audit": "2026.07.1",
  "mobile-ux-audit": "2026.07.1",
  "trust-audit": "2026.07.1",
  "website-copy-audit": "2026.07.1",
  "copy-review": "2026.07.1",
  "persona-review": "2026.07.1",
  "design-critique": "2026.07.1",
  "respectful-outreach": "2026.07.1",
  "claim-safety": "2026.07.1",
}

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
const DEFAULT_MODEL = "openai/gpt-4.1-mini"
const EVE_MAX_ATTEMPTS = 2

function eveRuntimeEnabled(): boolean {
  const value = process.env.EVE_RUNTIME_ENABLED ?? env.EVE_RUNTIME_ENABLED
  return value === "1" || value?.trim().toLowerCase() === "true"
}

function describeError(error: unknown): string {
  const safe = sanitizeError(error)
  const parts: string[] = [safe.message]
  if (safe.responseStatus !== undefined) {
    parts.push(`status=${safe.responseStatus}`)
  }
  return parts.join(" | ")
}

interface LlmRunResult {
  output: AuditAgentOutput
  provider: "openai" | "anthropic" | "other"
  model: string
  tokensIn?: number
  tokensOut?: number
  usedFallback: boolean
  executor: "eve" | "ai_sdk" | "deterministic"
  auditAgentRunId?: Id<"auditAgentRuns">
  releaseVersion: string
  promptVersion: string
  outputSchemaVersion: string
  skillVersions: Record<string, string>
  eveVersion?: string
  eveSessionId?: string
  buildSha?: string
}

function buildEveContext(
  agentContext: AuditAgentContext,
  reportLink: string | undefined,
): EveAuditContext {
  return {
    auditId: agentContext.auditId,
    domain: agentContext.domain,
    reportLanguage: agentContext.reportLanguage,
    overallScore: agentContext.overallScore,
    categoryScores: agentContext.categoryScores,
    checks: agentContext.checks.map((check) => ({
      ref: `${check.category}:${check.key}`,
      category: check.category,
      key: check.key,
      status: check.status,
      label: check.label,
      evidence: check.evidence,
      source: check.source,
      weight: check.weight,
    })),
    signals: {
      title: agentContext.signals.title?.slice(0, 300),
      metaDescription: agentContext.signals.metaDescription?.slice(0, 600),
      openGraphText: [
        agentContext.signals.openGraphTitle,
        agentContext.signals.openGraphDescription,
      ].filter(Boolean).join(" — ").slice(0, 600) || undefined,
      headings: [
        ...(agentContext.signals.h1Texts ?? []),
        ...(agentContext.signals.h2Texts ?? []),
      ].slice(0, 40),
      ctaCandidates: agentContext.signals.ctaCandidates?.slice(0, 20).map((value) => value.slice(0, 200)),
      contactLinks: agentContext.signals.contactLinks?.slice(0, 20).map((value) => value.slice(0, 500)),
      schemaTypes: agentContext.signals.schemaTypes?.slice(0, 30).map((value) => value.slice(0, 120)),
      copyExcerpt: agentContext.signals.copySample?.slice(0, 6_000),
    },
    performance: {
      mobileScore: agentContext.performance.mobile?.performanceScore,
      desktopScore: agentContext.performance.desktop?.performanceScore,
      lcpMs: agentContext.performance.mobile?.lcp,
      cls: agentContext.performance.mobile?.cls,
      fcpMs: agentContext.performance.mobile?.fcp,
    },
    business: {
      name: agentContext.business?.name,
      city: agentContext.business?.city,
      rating: agentContext.business?.rating,
    },
    workspaceBranding: {
      name: agentContext.workspace.name,
      ctaText: agentContext.workspace.ctaText,
    },
    reportUrl: reportLink,
  }
}

async function runEveGeneration(
  agentContext: AuditAgentContext,
  reportLink: string | undefined,
  requestId: string,
): Promise<{ result: EveAuditRuntimeResult; output: AuditAgentOutput }> {
  const result = await runEveAudit({
    context: buildEveContext(agentContext, reportLink),
    requestId,
    host: process.env.EVE_RUNTIME_URL ?? env.EVE_AGENT_URL,
  })
  return { result, output: result.output }
}

async function runEveSpecializedGeneration<T>(args: {
  purpose: string
  requestId: string
  message: string
  outputSchema: Parameters<typeof runEveStructuredTask<T>>[0]["outputSchema"]
}): Promise<EveStructuredTaskResult<T>> {
  return await runEveStructuredTask({
    purpose: args.purpose,
    requestId: args.requestId,
    message: args.message,
    outputSchema: args.outputSchema,
    host: process.env.EVE_RUNTIME_URL ?? env.EVE_AGENT_URL,
  })
}

function specializedTaskMessage(system: string, prompt: string): string {
  return [
    system,
    "Arbeite ausschließlich mit dem folgenden begrenzten Audit-Kontext und gib nur das per-turn outputSchema zurück.",
    "Lade den fachlich passenden Skill sowie claim-safety. Erfinde keine Fakten oder Evidence-Referenzen.",
    prompt,
  ].join("\n\n")
}

function buildFallbackContext(agentContext: AuditAgentContext, reportLink: string | undefined) {
  const checks: CheckInput[] = agentContext.checks.map((check: AuditAgentContextCheck) => ({
    category: check.category,
    key: check.key,
    label: check.label,
    status: check.status,
    evidence: check.evidence,
    source: check.source,
    weight: check.weight,
  }))

  const categoryScores: CategoryScores = {
    conversion: agentContext.categoryScores.conversion,
    seo: agentContext.categoryScores.seo,
    local_seo: agentContext.categoryScores.local_seo,
    performance: agentContext.categoryScores.performance,
    mobile: agentContext.categoryScores.mobile,
    trust: agentContext.categoryScores.trust,
  }

  return {
    domain: agentContext.domain,
    reportLanguage: agentContext.reportLanguage,
    reportLink,
    workspaceName: agentContext.workspace.name,
    categoryScores,
    overallScore: agentContext.overallScore,
    checks,
  }
}

function validateOutputSafety(
  output: AuditAgentOutput,
  evidenceRefs: ReturnType<typeof buildEvidenceRefs>,
): { ok: true } | { ok: false; reason: string } {
  const evidenceIssues = validateOutputEvidence(output, evidenceRefs)
  if (evidenceIssues.length > 0) {
    return {
      ok: false,
      reason: `evidence reference invalid at ${evidenceIssues[0].path}: ${evidenceIssues[0].reason}`,
    }
  }

  const safety = reviewClaimSafety(output)
  if (!safety.ok) {
    return {
      ok: false,
      reason: `claim safety violation at ${safety.issues[0].path}: "${safety.issues[0].matched}"`,
    }
  }

  return { ok: true }
}

async function runLlmGeneration(
  agentContext: AuditAgentContext,
  reportLink: string | undefined,
): Promise<LlmRunResult> {
  const apiKey = env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured")
  }

  const { createOpenAI } = await import("@ai-sdk/openai")
  const { generateObject } = await import("ai")

  const openrouter = createOpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey,
    name: "openrouter",
  })

  const model = env.OPENROUTER_MODEL ?? DEFAULT_MODEL
  const system = buildSystemPrompt(agentContext.reportLanguage)
  const prompt = buildUserPrompt(agentContext, reportLink)

  const result = await generateObject({
    model: openrouter(model),
    schema: auditAgentGenerationSchema,
    schemaName: "AuditAgentOutput",
    schemaDescription: "Validated audit findings, summary, and outreach drafts.",
    system,
    prompt,
    temperature: 0.4,
    maxRetries: 0,
  })

  return {
    output: generationToStorage(result.object),
    provider: "other",
    model,
    tokensIn: result.usage.inputTokens,
    tokensOut: result.usage.outputTokens,
    usedFallback: false,
    executor: "ai_sdk",
    releaseVersion: eveReleaseManifest.releaseVersion,
    promptVersion: eveReleaseManifest.promptVersion,
    outputSchemaVersion: eveReleaseManifest.outputSchemaVersion,
    skillVersions: SKILL_VERSIONS,
    buildSha: process.env.VERCEL_GIT_COMMIT_SHA,
  }
}

async function runPersonaPanelGeneration(
  agentContext: AuditAgentContext,
): Promise<{ output: PersonaPanelOutput; tokensIn?: number; tokensOut?: number }> {
  const apiKey = env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured")
  }

  const { createOpenAI } = await import("@ai-sdk/openai")
  const { generateObject } = await import("ai")

  const openrouter = createOpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey,
    name: "openrouter",
  })

  const model = env.OPENROUTER_MODEL ?? DEFAULT_MODEL
  const system = buildPersonaSystemPrompt(agentContext.reportLanguage)
  const prompt = buildPersonaUserPrompt(agentContext)

  const result = await generateObject({
    model: openrouter(model),
    schema: personaPanelOutputSchema,
    schemaName: "PersonaPanelOutput",
    schemaDescription: "Persona reviews from multiple reviewer perspectives.",
    system,
    prompt,
    temperature: 0.5,
    maxRetries: 0,
  })

  return {
    output: result.object,
    tokensIn: result.usage.inputTokens,
    tokensOut: result.usage.outputTokens,
  }
}

function validatePersonaSafety(
  output: PersonaPanelOutput,
  evidenceRefs: ReturnType<typeof buildEvidenceRefs>,
): { ok: true } | { ok: false; reason: string } {
  const evidenceIssues = validatePersonaEvidence(output.reviews, evidenceRefs)
  if (evidenceIssues.length > 0) {
    return {
      ok: false,
      reason: `persona evidence reference missing: ${evidenceIssues[0].personaId} (${evidenceIssues[0].reason})`,
    }
  }

  const texts: { text: string; path: string }[] = []
  output.reviews.forEach((review, i) => {
    texts.push({ text: review.personaName, path: `reviews[${i}].personaName` })
    texts.push({ text: review.lens, path: `reviews[${i}].lens` })
    texts.push({ text: review.verdict, path: `reviews[${i}].verdict` })
    texts.push({ text: review.topRecommendation, path: `reviews[${i}].topRecommendation` })
    review.positives.forEach((p, j) => texts.push({ text: p, path: `reviews[${i}].positives[${j}]` }))
    review.frictionPoints.forEach((p, j) => texts.push({ text: p, path: `reviews[${i}].frictionPoints[${j}]` }))
  })

  const safety = reviewTextsClaimSafety(texts)
  if (!safety.ok) {
    return {
      ok: false,
      reason: `persona claim safety violation at ${safety.issues[0].path}: "${safety.issues[0].matched}"`,
    }
  }

  return { ok: true }
}

async function runPersonaPanel(
  ctx: ActionCtx,
  agentContext: AuditAgentContext,
  auditId: Id<"audits">,
): Promise<void> {
  console.log("[audit_agent] persona panel started", { auditId })

  await ctx.runMutation(internal.audit_agent.setAuditAgentStage, {
    auditId,
    status: "generating_outreach",
    statusMessage: "Persona-Reviews werden erstellt",
  })

  const evidenceRefs = buildEvidenceRefs(
    agentContext.checks.map((check) => ({
      category: check.category,
      key: check.key,
      label: check.label,
      status: check.status,
      evidence: check.evidence,
      source: check.source,
      weight: check.weight,
    })),
  )

  const saveWithFallback = async (reviews: PersonaReviewOutput[], usedFallback: boolean) => {
    await ctx.runMutation(internal.audit_agent.saveAuditPersonaReviews, {
      auditId,
      reviews,
    })

    if (usedFallback) {
      const fallbackRunId = await ctx.runMutation(internal.audit_agent.startAuditAgentRun, {
        workspaceId: agentContext.workspaceId as Id<"workspaces">,
        auditId,
        provider: FALLBACK_PROVIDER,
        model: FALLBACK_MODEL,
        purpose: "qa",
        skillVersions: { "persona-review": SKILL_VERSIONS["persona-review"] },
        executor: "deterministic",
        releaseVersion: eveReleaseManifest.releaseVersion,
        promptVersion: eveReleaseManifest.promptVersion,
        outputSchemaVersion: eveReleaseManifest.outputSchemaVersion,
      })
      await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
        auditAgentRunId: fallbackRunId,
        status: "completed",
        schemaPass: true,
        evidencePass: true,
        claimSafetyPass: true,
      })
    }
  }

  if (eveRuntimeEnabled()) {
    const message = specializedTaskMessage(
      buildPersonaSystemPrompt(agentContext.reportLanguage),
      buildPersonaUserPrompt(agentContext),
    )
    for (let attempt = 1; attempt <= EVE_MAX_ATTEMPTS; attempt++) {
      const eveRunId = await ctx.runMutation(internal.audit_agent.startAuditAgentRun, {
        workspaceId: agentContext.workspaceId as Id<"workspaces">,
        auditId,
        provider: "other",
        model: "eve/runtime",
        purpose: "qa",
        skillVersions: { "persona-review": SKILL_VERSIONS["persona-review"] },
        executor: "eve",
        releaseVersion: eveReleaseManifest.releaseVersion,
        promptVersion: eveReleaseManifest.promptVersion,
        outputSchemaVersion: eveReleaseManifest.outputSchemaVersion,
        eveVersion: eveReleaseManifest.eveVersion,
      })
      try {
        await checkProviderLimit(ctx, {
          kind: "llm", provider: "eve",
          workspaceId: agentContext.workspaceId, apiKeyId: agentContext.apiKeyId,
        })
        const result = await runEveSpecializedGeneration({
          purpose: "sitepitch_persona_review",
          requestId: `audit:${auditId}:persona:${attempt}`,
          message,
          outputSchema: personaPanelOutputSchema,
        })
        const parsed = safeParsePersonaPanel(result.output)
        if (!parsed.ok) throw new Error(parsed.error)
        const safety = validatePersonaSafety(parsed.data, evidenceRefs)
        if (!safety.ok) throw new Error(safety.reason)
        await ctx.runMutation(internal.audit_agent.saveAuditPersonaReviews, { auditId, reviews: parsed.data.reviews })
        await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
          auditAgentRunId: eveRunId,
          status: "completed",
          tokensIn: result.usage.inputTokens,
          tokensOut: result.usage.outputTokens,
          actualCostUsd: result.usage.costUsd,
          model: result.runtime.modelId,
          eveSessionId: result.sessionId,
          eveVersion: result.runtime.eveVersion ?? result.versions.eve,
          buildSha: result.runtime.buildSha,
          loadedSkillVersions: Object.fromEntries(result.loadedSkills.map((skill) => [skill.id, skill.version])),
          schemaPass: true,
          evidencePass: true,
          claimSafetyPass: true,
        })
        console.log("[audit_agent] persona panel completed (eve)", { auditId, attempt })
        return
      } catch (error) {
        await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
          auditAgentRunId: eveRunId,
          status: "failed",
          errorMessage: describeError(error).slice(0, 500),
        })
      }
    }
  }

  const runId = await ctx.runMutation(internal.audit_agent.startAuditAgentRun, {
    workspaceId: agentContext.workspaceId as Id<"workspaces">,
    auditId,
    provider: "other",
    model: env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
    purpose: "qa",
    skillVersions: { "persona-review": SKILL_VERSIONS["persona-review"] },
    executor: "ai_sdk",
    releaseVersion: eveReleaseManifest.releaseVersion,
    promptVersion: eveReleaseManifest.promptVersion,
    outputSchemaVersion: eveReleaseManifest.outputSchemaVersion,
  })

  try {
    await checkProviderLimit(ctx, {
      kind: "llm", provider: "openrouter",
      workspaceId: agentContext.workspaceId, apiKeyId: agentContext.apiKeyId,
    })

    const { output, tokensIn, tokensOut } = await runPersonaPanelGeneration(agentContext)

    const parsed = safeParsePersonaPanel(output)
    if (!parsed.ok) {
      console.warn("[audit_agent] persona panel parse failed, using deterministic fallback", {
        auditId,
        reason: parsed.error,
      })
      await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
        auditAgentRunId: runId,
        status: "failed",
        errorMessage: parsed.error,
      })
      const fallbackOutput = generateDeterministicPersonaPanel(agentContext)
      await saveWithFallback(fallbackOutput.reviews, true)
      console.log("[audit_agent] persona panel completed (deterministic fallback)", {
        auditId,
        reviewsCount: fallbackOutput.reviews.length,
      })
      return
    }

    const safety = validatePersonaSafety(parsed.data, evidenceRefs)
    if (!safety.ok) {
      console.warn("[audit_agent] persona panel safety check failed, using deterministic fallback", {
        auditId,
        reason: safety.reason,
      })
      await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
        auditAgentRunId: runId,
        status: "failed",
        errorMessage: safety.reason,
      })
      const fallbackOutput = generateDeterministicPersonaPanel(agentContext)
      await saveWithFallback(fallbackOutput.reviews, true)
      console.log("[audit_agent] persona panel completed (deterministic fallback)", {
        auditId,
        reviewsCount: fallbackOutput.reviews.length,
      })
      return
    }

    await ctx.runMutation(internal.audit_agent.saveAuditPersonaReviews, {
      auditId,
      reviews: parsed.data.reviews,
    })

    await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
      auditAgentRunId: runId,
      status: "completed",
      tokensIn,
      tokensOut,
      schemaPass: true,
      evidencePass: true,
      claimSafetyPass: true,
    })

    console.log("[audit_agent] persona panel completed", {
      auditId,
      reviewsCount: parsed.data.reviews.length,
    })
  } catch (error) {
    const detail = describeError(error)
    console.warn("[audit_agent] persona panel failed, using deterministic fallback", {
      auditId,
      detail,
    })
    await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
      auditAgentRunId: runId,
      status: "failed",
      errorMessage: detail.slice(0, 500),
    })

    const fallbackOutput = generateDeterministicPersonaPanel(agentContext)
    await saveWithFallback(fallbackOutput.reviews, true)

    console.log("[audit_agent] persona panel completed (deterministic fallback)", {
      auditId,
      reviewsCount: fallbackOutput.reviews.length,
    })
  }
}

async function runCopyReviewGeneration(
  agentContext: AuditAgentContext,
): Promise<{ output: CopyReviewOutput; tokensIn?: number; tokensOut?: number }> {
  const apiKey = env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured")
  }

  const { createOpenAI } = await import("@ai-sdk/openai")
  const { generateObject } = await import("ai")

  const openrouter = createOpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey,
    name: "openrouter",
  })

  const model = env.OPENROUTER_MODEL ?? DEFAULT_MODEL
  const system = buildCopyReviewSystemPrompt(agentContext.reportLanguage)
  const prompt = buildCopyReviewUserPrompt(agentContext)

  const result = await generateObject({
    model: openrouter(model),
    schema: copyReviewOutputSchema,
    schemaName: "CopyReviewOutput",
    schemaDescription: "Structured website copy review.",
    system,
    prompt,
    temperature: 0.5,
    maxRetries: 0,
  })

  return {
    output: result.object,
    tokensIn: result.usage.inputTokens,
    tokensOut: result.usage.outputTokens,
  }
}

function validateCopyReviewSafety(
  output: CopyReviewOutput,
  evidenceRefs: ReturnType<typeof buildEvidenceRefs>,
): { ok: true } | { ok: false; reason: string } {
  const evidenceIssues = validateCopyEvidence(output, evidenceRefs)
  if (evidenceIssues.length > 0) {
    return {
      ok: false,
      reason: `copy review evidence reference missing (${evidenceIssues[0].reason})`,
    }
  }

  const texts: { text: string; path: string }[] = [
    { text: output.heroClarity, path: "heroClarity" },
    { text: output.valueProposition, path: "valueProposition" },
    { text: output.offerClarity, path: "offerClarity" },
    { text: output.ctaClarity, path: "ctaClarity" },
    { text: output.snippetClarity, path: "snippetClarity" },
    { text: output.overallVerdict, path: "overallVerdict" },
  ]
  output.recommendations.forEach((r, j) => texts.push({ text: r, path: `recommendations[${j}]` }))

  const safety = reviewTextsClaimSafety(texts)
  if (!safety.ok) {
    return {
      ok: false,
      reason: `copy review claim safety violation at ${safety.issues[0].path}: "${safety.issues[0].matched}"`,
    }
  }

  return { ok: true }
}

async function runCopyReview(
  ctx: ActionCtx,
  agentContext: AuditAgentContext,
  auditId: Id<"audits">,
): Promise<void> {
  console.log("[audit_agent] copy review started", { auditId })

  await ctx.runMutation(internal.audit_agent.setAuditAgentStage, {
    auditId,
    status: "generating_outreach",
    statusMessage: "Website-Copy wird analysiert",
  })

  const evidenceRefs = buildEvidenceRefs(
    agentContext.checks.map((check) => ({
      category: check.category,
      key: check.key,
      label: check.label,
      status: check.status,
      evidence: check.evidence,
      source: check.source,
      weight: check.weight,
    })),
  )

  if (eveRuntimeEnabled()) {
    const message = specializedTaskMessage(
      buildCopyReviewSystemPrompt(agentContext.reportLanguage),
      buildCopyReviewUserPrompt(agentContext),
    )
    for (let attempt = 1; attempt <= EVE_MAX_ATTEMPTS; attempt++) {
      const eveRunId = await ctx.runMutation(internal.audit_agent.startAuditAgentRun, {
        workspaceId: agentContext.workspaceId as Id<"workspaces">,
        auditId,
        provider: "other",
        model: "eve/runtime",
        purpose: "qa",
        skillVersions: { "copy-review": SKILL_VERSIONS["copy-review"] },
        executor: "eve",
        releaseVersion: eveReleaseManifest.releaseVersion,
        promptVersion: eveReleaseManifest.promptVersion,
        outputSchemaVersion: eveReleaseManifest.outputSchemaVersion,
        eveVersion: eveReleaseManifest.eveVersion,
      })
      try {
        await checkProviderLimit(ctx, {
          kind: "llm", provider: "eve",
          workspaceId: agentContext.workspaceId, apiKeyId: agentContext.apiKeyId,
        })
        const result = await runEveSpecializedGeneration({
          purpose: "sitepitch_copy_review",
          requestId: `audit:${auditId}:copy:${attempt}`,
          message,
          outputSchema: copyReviewOutputSchema,
        })
        const parsed = safeParseCopyReview(result.output)
        if (!parsed.ok) throw new Error(parsed.error)
        const safety = validateCopyReviewSafety(parsed.data, evidenceRefs)
        if (!safety.ok) throw new Error(safety.reason)
        await ctx.runMutation(internal.audit_agent.saveAuditCopyReview, { auditId, review: parsed.data })
        await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
          auditAgentRunId: eveRunId,
          status: "completed",
          tokensIn: result.usage.inputTokens,
          tokensOut: result.usage.outputTokens,
          actualCostUsd: result.usage.costUsd,
          model: result.runtime.modelId,
          eveSessionId: result.sessionId,
          eveVersion: result.runtime.eveVersion ?? result.versions.eve,
          buildSha: result.runtime.buildSha,
          loadedSkillVersions: Object.fromEntries(result.loadedSkills.map((skill) => [skill.id, skill.version])),
          schemaPass: true,
          evidencePass: true,
          claimSafetyPass: true,
        })
        console.log("[audit_agent] copy review completed (eve)", { auditId, attempt })
        return
      } catch (error) {
        await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
          auditAgentRunId: eveRunId,
          status: "failed",
          errorMessage: describeError(error).slice(0, 500),
        })
      }
    }
  }

  const runId = await ctx.runMutation(internal.audit_agent.startAuditAgentRun, {
    workspaceId: agentContext.workspaceId as Id<"workspaces">,
    auditId,
    provider: "other",
    model: env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
    purpose: "qa",
    skillVersions: { "copy-review": SKILL_VERSIONS["copy-review"] },
    executor: "ai_sdk",
    releaseVersion: eveReleaseManifest.releaseVersion,
    promptVersion: eveReleaseManifest.promptVersion,
    outputSchemaVersion: eveReleaseManifest.outputSchemaVersion,
  })

  try {
    await checkProviderLimit(ctx, {
      kind: "llm", provider: "openrouter",
      workspaceId: agentContext.workspaceId, apiKeyId: agentContext.apiKeyId,
    })

    const { output, tokensIn, tokensOut } = await runCopyReviewGeneration(agentContext)

    const parsed = safeParseCopyReview(output)
    if (!parsed.ok) {
      await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
        auditAgentRunId: runId,
        status: "failed",
        errorMessage: parsed.error,
      })
      return
    }

    const safety = validateCopyReviewSafety(parsed.data, evidenceRefs)
    if (!safety.ok) {
      await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
        auditAgentRunId: runId,
        status: "failed",
        errorMessage: safety.reason,
      })
      return
    }

    await ctx.runMutation(internal.audit_agent.saveAuditCopyReview, {
      auditId,
      review: parsed.data,
    })

    await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
      auditAgentRunId: runId,
      status: "completed",
      tokensIn,
      tokensOut,
      schemaPass: true,
      evidencePass: true,
      claimSafetyPass: true,
    })

    console.log("[audit_agent] copy review completed", { auditId })
  } catch (error) {
    const detail = describeError(error)
    console.warn("[audit_agent] copy review failed", { auditId, detail })
    await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
      auditAgentRunId: runId,
      status: "failed",
      errorMessage: detail.slice(0, 500),
    })
  }
}

async function runDesignCritiqueGeneration(
  agentContext: AuditAgentContext,
): Promise<{ output: DesignCritiqueOutput; tokensIn?: number; tokensOut?: number }> {
  const apiKey = env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured")
  }

  const { createOpenAI } = await import("@ai-sdk/openai")
  const { generateObject } = await import("ai")

  const openrouter = createOpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey,
    name: "openrouter",
  })

  const model = env.OPENROUTER_MODEL ?? DEFAULT_MODEL
  const system = buildDesignCritiqueSystemPrompt(agentContext.reportLanguage)
  const messages = buildDesignCritiqueUserMessages(agentContext)

  const result = await generateObject({
    model: openrouter(model),
    schema: designCritiqueOutputSchema,
    schemaName: "DesignCritiqueOutput",
    schemaDescription: "Structured UX and design critique grounded in audit checks, signals, and screenshots.",
    system,
    messages,
    temperature: 0.5,
    maxRetries: 0,
  })

  return {
    output: result.object,
    tokensIn: result.usage.inputTokens,
    tokensOut: result.usage.outputTokens,
  }
}

function validateDesignCritiqueSafety(
  output: DesignCritiqueOutput,
  evidenceRefs: ReturnType<typeof buildEvidenceRefs>,
): { ok: true } | { ok: false; reason: string } {
  const evidenceIssues = validateDesignCritiqueEvidence(output, evidenceRefs)
  if (evidenceIssues.length > 0) {
    return {
      ok: false,
      reason: `design critique evidence reference missing (${evidenceIssues[0].reason})`,
    }
  }

  const texts: { text: string; path: string }[] = [
    { text: output.ratingBand, path: "ratingBand" },
    { text: output.overallImpression, path: "overallImpression" },
    { text: output.cognitiveLoad.notes, path: "cognitiveLoad.notes" },
    { text: output.antiPatternVerdict, path: "antiPatternVerdict" },
  ]
  output.heuristicScores.forEach((h, i) => {
    texts.push({ text: h.keyIssue, path: `heuristicScores[${i}].keyIssue` })
  })
  output.whatsWorking.forEach((w, i) => texts.push({ text: w, path: `whatsWorking[${i}]` }))
  output.priorityIssues.forEach((issue, i) => {
    texts.push({ text: issue.title, path: `priorityIssues[${i}].title` })
    texts.push({ text: issue.whyItMatters, path: `priorityIssues[${i}].whyItMatters` })
    texts.push({ text: issue.fix, path: `priorityIssues[${i}].fix` })
  })
  output.recommendations.forEach((r, j) => texts.push({ text: r, path: `recommendations[${j}]` }))

  const safety = reviewTextsClaimSafety(texts)
  if (!safety.ok) {
    return {
      ok: false,
      reason: `design critique claim safety violation at ${safety.issues[0].path}: "${safety.issues[0].matched}"`,
    }
  }

  return { ok: true }
}

async function runDesignCritique(
  ctx: ActionCtx,
  agentContext: AuditAgentContext,
  auditId: Id<"audits">,
): Promise<{ saved: boolean; usedFallback: boolean }> {
  console.log("[audit_agent] design critique started", { auditId })

  await ctx.runMutation(internal.audit_agent.setAuditAgentStage, {
    auditId,
    status: "generating_outreach",
    statusMessage: "Design-Kritik wird erstellt",
  })

  const evidenceRefs = buildEvidenceRefs(
    agentContext.checks.map((check) => ({
      category: check.category,
      key: check.key,
      label: check.label,
      status: check.status,
      evidence: check.evidence,
      source: check.source,
      weight: check.weight,
    })),
  )

  const saveIfValid = async (
    runId: Id<"auditAgentRuns">,
    output: DesignCritiqueOutput,
    tokensIn?: number,
    tokensOut?: number,
  ): Promise<{ saved: boolean; reason?: string }> => {
    const parsed = safeParseDesignCritique(output)
    if (!parsed.ok) {
      return { saved: false, reason: parsed.error }
    }
    const safety = validateDesignCritiqueSafety(parsed.data, evidenceRefs)
    if (!safety.ok) {
      return { saved: false, reason: safety.reason }
    }
    await ctx.runMutation(internal.audit_agent.saveAuditDesignCritique, {
      auditId,
      critique: parsed.data,
    })
    await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
      auditAgentRunId: runId,
      status: "completed",
      tokensIn,
      tokensOut,
      schemaPass: true,
      evidencePass: true,
      claimSafetyPass: true,
    })
    return { saved: true }
  }

  const startLlmRun = async () =>
    ctx.runMutation(internal.audit_agent.startAuditAgentRun, {
      workspaceId: agentContext.workspaceId as Id<"workspaces">,
      auditId,
      provider: "other",
      model: env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
      purpose: "critique",
      skillVersions: { "design-critique": SKILL_VERSIONS["design-critique"] },
      executor: "ai_sdk",
      releaseVersion: eveReleaseManifest.releaseVersion,
      promptVersion: eveReleaseManifest.promptVersion,
      outputSchemaVersion: eveReleaseManifest.outputSchemaVersion,
    })

  const finishFailed = (runId: Id<"auditAgentRuns">, reason?: string) =>
    ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
      auditAgentRunId: runId,
      status: "failed",
      errorMessage: reason ? reason.slice(0, 500) : "design critique failed",
    })

  if (eveRuntimeEnabled()) {
    const textContext = buildEveContext(agentContext, undefined)
    const message = specializedTaskMessage(
      buildDesignCritiqueSystemPrompt(agentContext.reportLanguage),
      `Erzeuge eine strukturierte Design-Kritik aus diesem begrenzten Textkontext.\n\n${JSON.stringify(textContext)}`,
    )
    for (let attempt = 1; attempt <= EVE_MAX_ATTEMPTS; attempt++) {
      const eveRunId = await ctx.runMutation(internal.audit_agent.startAuditAgentRun, {
        workspaceId: agentContext.workspaceId as Id<"workspaces">,
        auditId,
        provider: "other",
        model: "eve/runtime",
        purpose: "critique",
        skillVersions: { "design-critique": SKILL_VERSIONS["design-critique"] },
        executor: "eve",
        releaseVersion: eveReleaseManifest.releaseVersion,
        promptVersion: eveReleaseManifest.promptVersion,
        outputSchemaVersion: eveReleaseManifest.outputSchemaVersion,
        eveVersion: eveReleaseManifest.eveVersion,
      })
      try {
        await checkProviderLimit(ctx, {
          kind: "llm", provider: "eve",
          workspaceId: agentContext.workspaceId, apiKeyId: agentContext.apiKeyId,
        })
        const result = await runEveSpecializedGeneration({
          purpose: "sitepitch_design_critique",
          requestId: `audit:${auditId}:design:${attempt}`,
          message,
          outputSchema: designCritiqueOutputSchema,
        })
        const parsed = safeParseDesignCritique(result.output)
        if (!parsed.ok) throw new Error(parsed.error)
        const safety = validateDesignCritiqueSafety(parsed.data, evidenceRefs)
        if (!safety.ok) throw new Error(safety.reason)
        await ctx.runMutation(internal.audit_agent.saveAuditDesignCritique, { auditId, critique: parsed.data })
        await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
          auditAgentRunId: eveRunId,
          status: "completed",
          tokensIn: result.usage.inputTokens,
          tokensOut: result.usage.outputTokens,
          actualCostUsd: result.usage.costUsd,
          model: result.runtime.modelId,
          eveSessionId: result.sessionId,
          eveVersion: result.runtime.eveVersion ?? result.versions.eve,
          buildSha: result.runtime.buildSha,
          loadedSkillVersions: Object.fromEntries(result.loadedSkills.map((skill) => [skill.id, skill.version])),
          schemaPass: true,
          evidencePass: true,
          claimSafetyPass: true,
        })
        console.log("[audit_agent] design critique completed (eve)", { auditId, attempt })
        return { saved: true, usedFallback: false }
      } catch (error) {
        await finishFailed(eveRunId, describeError(error))
      }
    }
  }

  // Recovery: one direct AI SDK attempt with screenshots.
  const runId = await startLlmRun()
  try {
    await checkProviderLimit(ctx, {
      kind: "llm", provider: "openrouter",
      workspaceId: agentContext.workspaceId, apiKeyId: agentContext.apiKeyId,
    })
    const { output, tokensIn, tokensOut } = await runDesignCritiqueGeneration(agentContext)
    const result = await saveIfValid(runId, output, tokensIn, tokensOut)
    if (result.saved) {
      console.log("[audit_agent] design critique completed (llm + screenshots)", { auditId })
      return { saved: true, usedFallback: false }
    }
    console.warn("[audit_agent] design critique llm attempt failed", { auditId, reason: result.reason })
    await finishFailed(runId, result.reason)
  } catch (error) {
    const detail = describeError(error)
    console.warn("[audit_agent] design critique llm call failed", { auditId, detail })
    await finishFailed(runId, detail)
  }

  // Deterministic fallback — always saves so the Design tab is never empty.
  const fallbackRunId = await ctx.runMutation(internal.audit_agent.startAuditAgentRun, {
    workspaceId: agentContext.workspaceId as Id<"workspaces">,
    auditId,
    provider: FALLBACK_PROVIDER,
    model: FALLBACK_MODEL,
    purpose: "critique",
    skillVersions: { "design-critique": SKILL_VERSIONS["design-critique"] },
    executor: "deterministic",
    releaseVersion: eveReleaseManifest.releaseVersion,
    promptVersion: eveReleaseManifest.promptVersion,
    outputSchemaVersion: eveReleaseManifest.outputSchemaVersion,
  })

  const fallbackOutput = generateDeterministicDesignCritique({
    domain: agentContext.domain,
    reportLanguage: agentContext.reportLanguage,
    categoryScores: {
      conversion: agentContext.categoryScores.conversion,
      seo: agentContext.categoryScores.seo,
      local_seo: agentContext.categoryScores.local_seo,
      performance: agentContext.categoryScores.performance,
      mobile: agentContext.categoryScores.mobile,
      trust: agentContext.categoryScores.trust,
    },
    overallScore: agentContext.overallScore,
    checks: agentContext.checks.map((check) => ({
      category: check.category,
      key: check.key,
      label: check.label,
      status: check.status,
      evidence: check.evidence,
      source: check.source,
      weight: check.weight,
    })),
  })

  await ctx.runMutation(internal.audit_agent.saveAuditDesignCritique, {
    auditId,
    critique: fallbackOutput,
  })

  await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
    auditAgentRunId: fallbackRunId,
    status: "completed",
    schemaPass: true,
    evidencePass: true,
    claimSafetyPass: true,
  })

  console.log("[audit_agent] design critique completed (deterministic fallback)", { auditId })
  return { saved: true, usedFallback: true }
}

export const generateDesignCritique = action({
  args: {
    auditId: v.id("audits"),
  },
  handler: async (ctx, args) => {
    const report = await ctx.runQuery(api.reports.getInternalReportById, {
      auditId: args.auditId,
    })
    if (!report) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Audit not found or access denied" })
    }
    if (report.status !== "completed") {
      throw new ConvexError({ code: "AUDIT_NOT_READY", message: "Design critique can only be generated for completed audits" })
    }

    const agentContext = await ctx.runQuery(internal.audit_agent.getAuditAgentContext, {
      auditId: args.auditId,
    })
    if (!agentContext) {
      throw new ConvexError({ code: "AGENT_CONTEXT_MISSING", message: "Audit context could not be loaded" })
    }

    const result = await runDesignCritique(ctx, agentContext, args.auditId)
    if (!result.saved) {
      throw new ConvexError({ code: "DESIGN_CRITIQUE_FAILED", message: "Design critique generation failed" })
    }

    return { saved: true, usedFallback: result.usedFallback }
  },
})

export const processAuditAgentOutputs = internalAction({
  args: {
    auditId: v.id("audits"),
  },
  handler: async (ctx, args): Promise<{
    auditId: Id<"audits">
    usedFallback: boolean
    provider: "openai" | "anthropic" | "other"
    model: string
    rejected?: boolean
  } | null> => {
    console.log("[audit_agent] processAuditAgentOutputs started", { auditId: args.auditId })

    const agentContext: AuditAgentContext | null = await ctx.runQuery(internal.audit_agent.getAuditAgentContext, {
      auditId: args.auditId,
    })

    if (!agentContext) {
      console.warn("[audit_agent] context not found", { auditId: args.auditId })
      await ctx.runMutation(internal.audit_agent.markAuditAgentFailed, {
        auditId: args.auditId,
        errorCode: "AGENT_CONTEXT_MISSING",
        errorMessage: "Audit-Kontext konnte nicht geladen werden.",
      })
      return null
    }

    const siteUrl = env.SITE_URL
    const reportLink = agentContext.isPublic && siteUrl
      ? `${siteUrl.replace(/\/$/, "")}/r/${agentContext.publicSlug}`
      : undefined

    await ctx.runMutation(internal.audit_agent.setAuditAgentStage, {
      auditId: args.auditId,
      status: "generating_findings",
      statusMessage: "Findings und Summary werden erstellt",
    })

    const evidenceRefs = buildEvidenceRefs(
      agentContext.checks.map((check) => ({
        category: check.category,
        key: check.key,
        label: check.label,
        status: check.status,
        evidence: check.evidence,
        source: check.source,
        weight: check.weight,
      })),
    )

    let chosen: LlmRunResult | null = null
    let lastError: string | undefined

    const eveEnabled = env.EVE_RUNTIME_ENABLED === "true" || env.EVE_RUNTIME_ENABLED === "1"
    for (let attempt = 0; attempt < (eveEnabled ? EVE_MAX_ATTEMPTS : 0) && !chosen; attempt++) {
      const runId: Id<"auditAgentRuns"> = await ctx.runMutation(internal.audit_agent.startAuditAgentRun, {
        workspaceId: agentContext.workspaceId as Id<"workspaces">,
        auditId: args.auditId,
        provider: "other",
        model: env.EVE_AGENT_MODEL ?? "eve/runtime",
        purpose: "findings",
        skillVersions: eveReleaseManifest.skills,
        executor: "eve",
        releaseVersion: eveReleaseManifest.releaseVersion,
        promptVersion: eveReleaseManifest.promptVersion,
        outputSchemaVersion: eveReleaseManifest.outputSchemaVersion,
        eveVersion: eveReleaseManifest.eveVersion,
        buildSha: process.env.VERCEL_GIT_COMMIT_SHA,
      })

      try {
        await checkProviderLimit(ctx, {
          kind: "llm",
          provider: "eve",
          workspaceId: agentContext.workspaceId,
          apiKeyId: agentContext.apiKeyId,
        })
        const eve = await runEveGeneration(
          agentContext,
          reportLink,
          `audit:${args.auditId}:eve:${attempt + 1}`,
        )

        const parsed = safeParseAgentOutput(eve.output)
        if (!parsed.ok) {
          await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
            auditAgentRunId: runId,
            status: "failed",
            errorMessage: parsed.error,
          })
          lastError = parsed.error
          continue
        }

        if (
          !eve.result.validation.schemaPassed ||
          !eve.result.validation.evidencePassed ||
          !eve.result.validation.claimSafetyPassed
        ) {
          const validationError = `Eve candidate validation failed: ${[
            ...eve.result.validation.invalidEvidenceRefs,
            ...eve.result.validation.unsafeClaimCodes,
          ].join(", ") || "unknown"}`
          await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
            auditAgentRunId: runId,
            status: "failed",
            errorMessage: validationError.slice(0, 500),
          })
          lastError = validationError
          continue
        }

        const safety = validateOutputSafety(parsed.data, evidenceRefs)
        if (!safety.ok) {
          await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
            auditAgentRunId: runId,
            status: "failed",
            errorMessage: safety.reason,
          })
          lastError = safety.reason
          continue
        }

        const loadedSkills = Object.fromEntries(
          eve.result.loadedSkills.map((skill) => [skill.id, skill.version]),
        )
        const runtimeModel = eve.result.runtime.modelId ?? env.EVE_AGENT_MODEL ?? "eve/runtime"
        const runtimeEveVersion = eve.result.runtime.eveVersion ?? eve.result.versions.eve
        const runtimeBuildSha = eve.result.runtime.buildSha ?? process.env.VERCEL_GIT_COMMIT_SHA
        await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
          auditAgentRunId: runId,
          status: "completed",
          tokensIn: eve.result.usage.inputTokens,
          tokensOut: eve.result.usage.outputTokens,
          model: runtimeModel,
          actualCostUsd: eve.result.usage.costUsd,
          eveSessionId: eve.result.sessionId,
          eveVersion: runtimeEveVersion,
          buildSha: runtimeBuildSha,
          loadedSkillVersions: loadedSkills,
          schemaPass: true,
          evidencePass: true,
          claimSafetyPass: true,
        })

        chosen = {
          output: parsed.data,
          provider: "other",
          model: runtimeModel,
          usedFallback: false,
          executor: "eve",
          auditAgentRunId: runId,
          releaseVersion: eve.result.versions.release,
          promptVersion: eve.result.versions.prompt,
          outputSchemaVersion: eve.result.versions.outputSchema,
          skillVersions: loadedSkills,
          eveVersion: runtimeEveVersion,
          eveSessionId: eve.result.sessionId,
          buildSha: runtimeBuildSha,
        }
      } catch (error) {
        const detail = describeError(error)
        console.warn("[audit_agent] Eve call failed", { auditId: args.auditId, attempt, detail })
        await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
          auditAgentRunId: runId,
          status: "failed",
          errorMessage: detail.slice(0, 500),
        })
        lastError = detail
      }
    }

    if (!chosen) {
      const runId: Id<"auditAgentRuns"> = await ctx.runMutation(internal.audit_agent.startAuditAgentRun, {
        workspaceId: agentContext.workspaceId as Id<"workspaces">,
        auditId: args.auditId,
        provider: "other",
        model: env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
        purpose: "findings",
        skillVersions: SKILL_VERSIONS,
        executor: "ai_sdk",
        releaseVersion: eveReleaseManifest.releaseVersion,
        promptVersion: eveReleaseManifest.promptVersion,
        outputSchemaVersion: eveReleaseManifest.outputSchemaVersion,
        buildSha: process.env.VERCEL_GIT_COMMIT_SHA,
      })

      try {
        await checkProviderLimit(ctx, {
          kind: "llm",
          provider: "openrouter",
          workspaceId: agentContext.workspaceId,
          apiKeyId: agentContext.apiKeyId,
        })
        const llmResult = await runLlmGeneration(agentContext, reportLink)
        const parsed = safeParseAgentOutput(llmResult.output)
        if (!parsed.ok) throw new Error(parsed.error)
        const safety = validateOutputSafety(parsed.data, evidenceRefs)
        if (!safety.ok) throw new Error(safety.reason)
        await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
          auditAgentRunId: runId,
          status: "completed",
          tokensIn: llmResult.tokensIn,
          tokensOut: llmResult.tokensOut,
        })
        chosen = { ...llmResult, output: parsed.data, auditAgentRunId: runId }
      } catch (error) {
        const detail = describeError(error)
        console.warn("[audit_agent] AI SDK recovery failed", { auditId: args.auditId, detail })
        await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
          auditAgentRunId: runId,
          status: "failed",
          errorMessage: detail.slice(0, 500),
        })
        lastError = detail
      }
    }

    if (!chosen) {
      console.warn("[audit_agent] using deterministic fallback", { auditId: args.auditId, lastError })
      const fallbackRunId: Id<"auditAgentRuns"> = await ctx.runMutation(internal.audit_agent.startAuditAgentRun, {
        workspaceId: agentContext.workspaceId as Id<"workspaces">,
        auditId: args.auditId,
        provider: FALLBACK_PROVIDER,
        model: FALLBACK_MODEL,
        purpose: "findings",
        skillVersions: SKILL_VERSIONS,
        executor: "deterministic",
        releaseVersion: eveReleaseManifest.releaseVersion,
        promptVersion: eveReleaseManifest.promptVersion,
        outputSchemaVersion: eveReleaseManifest.outputSchemaVersion,
        buildSha: process.env.VERCEL_GIT_COMMIT_SHA,
      })

      const fallbackOutput = generateDeterministicAgentOutput(
        buildFallbackContext(agentContext, reportLink),
      )

      await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
        auditAgentRunId: fallbackRunId,
        status: "completed",
      })

      chosen = {
        output: fallbackOutput,
        provider: FALLBACK_PROVIDER,
        model: FALLBACK_MODEL,
        usedFallback: true,
        executor: "deterministic",
        auditAgentRunId: fallbackRunId,
        releaseVersion: eveReleaseManifest.releaseVersion,
        promptVersion: eveReleaseManifest.promptVersion,
        outputSchemaVersion: eveReleaseManifest.outputSchemaVersion,
        skillVersions: SKILL_VERSIONS,
        buildSha: process.env.VERCEL_GIT_COMMIT_SHA,
      }
    }

    await ctx.runMutation(internal.audit_agent.setAuditAgentStage, {
      auditId: args.auditId,
      status: "generating_outreach",
      statusMessage: "Outreach-Texte werden erstellt",
    })

    const saveResult = await ctx.runMutation(internal.audit_agent.saveAuditAgentOutput, {
      auditId: args.auditId,
      auditAgentRunId: chosen.auditAgentRunId,
      output: chosen.output,
      reportLink,
      metadata: {
        executor: chosen.executor,
        provider: chosen.provider,
        model: chosen.model,
        releaseVersion: chosen.releaseVersion,
        promptVersion: chosen.promptVersion,
        outputSchemaVersion: chosen.outputSchemaVersion,
        skillVersions: chosen.skillVersions,
        eveVersion: chosen.eveVersion,
        eveSessionId: chosen.eveSessionId,
        buildSha: chosen.buildSha,
      },
    })
    if (!saveResult.activated) {
      await ctx.runMutation(internal.audit_agent.markAuditAgentFailed, {
        auditId: args.auditId,
        errorCode: "AGENT_CANDIDATE_REJECTED",
        errorMessage: `Agent candidate was rejected: ${saveResult.rejectionCode}`,
      })
      return {
        auditId: args.auditId,
        usedFallback: chosen.usedFallback,
        provider: chosen.provider,
        model: chosen.model,
        rejected: true,
      }
    }

    await runPersonaPanel(ctx, agentContext, args.auditId)

    await runCopyReview(ctx, agentContext, args.auditId)

    await runDesignCritique(ctx, agentContext, args.auditId)

    await ctx.runMutation(internal.audit_scoring.finalizeAuditScoresWithAnalyses, {
      auditId: args.auditId,
    })

    await ctx.runMutation(internal.audit_agent.completeAuditFromAgent, {
      auditId: args.auditId,
    })

    console.log("[audit_agent] completed", {
      auditId: args.auditId,
      usedFallback: chosen.usedFallback,
      findingsCount: chosen.output.findings.length,
    })

    return {
      auditId: args.auditId,
      usedFallback: chosen.usedFallback,
      provider: chosen.provider,
      model: chosen.model,
    }
  },
})
