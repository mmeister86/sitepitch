"use node"

import { v } from "convex/values"

import { internalAction, env, type ActionCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import type { AuditAgentContext, AuditAgentContextCheck } from "./audit_agent"
import type { AuditAgentOutput } from "./lib/audit_agent_schemas"
import { auditAgentGenerationSchema, generationToStorage, safeParseAgentOutput } from "./lib/audit_agent_schemas"
import { buildEvidenceRefs, validateFindingEvidence } from "./lib/audit_agent_evidence"
import { reviewClaimSafety, reviewTextsClaimSafety } from "./lib/audit_agent_claim_safety"
import {
  generateDeterministicAgentOutput,
  FALLBACK_MODEL,
  FALLBACK_PROVIDER,
} from "./lib/audit_agent_fallback"
import { buildSystemPrompt, buildUserPrompt } from "./lib/audit_agent_prompt"
import { buildPersonaSystemPrompt, buildPersonaUserPrompt } from "./lib/audit_persona_prompt"
import {
  personaPanelOutputSchema,
  safeParsePersonaPanel,
  validatePersonaEvidence,
  type PersonaPanelOutput,
} from "./lib/audit_persona_schemas"
import { buildCopyReviewSystemPrompt, buildCopyReviewUserPrompt } from "./lib/audit_copy_review_prompt"
import {
  copyReviewOutputSchema,
  safeParseCopyReview,
  validateCopyEvidence,
  type CopyReviewOutput,
} from "./lib/audit_copy_review_schemas"
import type { CheckInput, CategoryScores } from "./lib/audit_scoring"
import { checkProviderLimit } from "./lib/audit_rate_limit"

const SKILL_VERSIONS = {
  "conversion-audit": "2026.07.1",
  "seo-basics-audit": "2026.07.1",
  "local-seo-audit": "2026.07.1",
  "mobile-ux-audit": "2026.07.1",
  "trust-audit": "2026.07.1",
  "website-copy-audit": "2026.07.1",
  "copy-review": "2026.07.1",
  "persona-review": "2026.07.1",
  "respectful-outreach": "2026.07.1",
  "claim-safety": "2026.07.1",
}

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
const DEFAULT_MODEL = "openai/gpt-4.1-mini"
const MAX_RETRIES = 1

function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error)
  }
  const parts: string[] = [error.message]
  const anyErr = error as Error & {
    responseBody?: unknown
    responseStatus?: number
    url?: string
    value?: unknown
    data?: unknown
    isRetryable?: boolean
  }
  if (anyErr.responseStatus !== undefined) {
    parts.push(`status=${anyErr.responseStatus}`)
  }
  if (typeof anyErr.responseBody === "string") {
    parts.push(`body=${anyErr.responseBody.slice(0, 400)}`)
  } else if (anyErr.responseBody !== undefined) {
    try {
      parts.push(`body=${JSON.stringify(anyErr.responseBody).slice(0, 400)}`)
    } catch {
      // ignore non-serializable body
    }
  }
  if (anyErr.url) {
    parts.push(`url=${anyErr.url}`)
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
  const evidenceIssues = validateFindingEvidence(output.findings, evidenceRefs)
  if (evidenceIssues.length > 0) {
    return {
      ok: false,
      reason: `evidence reference missing: ${evidenceIssues[0].title} (${evidenceIssues[0].reason})`,
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

  const runId = await ctx.runMutation(internal.audit_agent.startAuditAgentRun, {
    workspaceId: agentContext.workspaceId as Id<"workspaces">,
    auditId,
    provider: "other",
    model: env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
    purpose: "qa",
    skillVersions: { "persona-review": SKILL_VERSIONS["persona-review"] },
  })

  try {
    await checkProviderLimit(ctx, { kind: "llm", provider: "openrouter" })

    const { output, tokensIn, tokensOut } = await runPersonaPanelGeneration(agentContext)

    const parsed = safeParsePersonaPanel(output)
    if (!parsed.ok) {
      await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
        auditAgentRunId: runId,
        status: "failed",
        errorMessage: parsed.error,
      })
      return
    }

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

    const safety = validatePersonaSafety(parsed.data, evidenceRefs)
    if (!safety.ok) {
      await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
        auditAgentRunId: runId,
        status: "failed",
        errorMessage: safety.reason,
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
    })

    console.log("[audit_agent] persona panel completed", {
      auditId,
      reviewsCount: parsed.data.reviews.length,
    })
  } catch (error) {
    const detail = describeError(error)
    console.warn("[audit_agent] persona panel failed", { auditId, detail })
    await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
      auditAgentRunId: runId,
      status: "failed",
      errorMessage: detail.slice(0, 500),
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

  const runId = await ctx.runMutation(internal.audit_agent.startAuditAgentRun, {
    workspaceId: agentContext.workspaceId as Id<"workspaces">,
    auditId,
    provider: "other",
    model: env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
    purpose: "qa",
    skillVersions: { "copy-review": SKILL_VERSIONS["copy-review"] },
  })

  try {
    await checkProviderLimit(ctx, { kind: "llm", provider: "openrouter" })

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

export const processAuditAgentOutputs = internalAction({
  args: {
    auditId: v.id("audits"),
  },
  handler: async (ctx, args) => {
    console.log("[audit_agent] processAuditAgentOutputs started", { auditId: args.auditId })

    const agentContext = await ctx.runQuery(internal.audit_agent.getAuditAgentContext, {
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

    for (let attempt = 0; attempt <= MAX_RETRIES && !chosen; attempt++) {
      const runId = await ctx.runMutation(internal.audit_agent.startAuditAgentRun, {
        workspaceId: agentContext.workspaceId as Id<"workspaces">,
        auditId: args.auditId,
        provider: "other",
        model: env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
        purpose: "findings",
        skillVersions: SKILL_VERSIONS,
      })

      try {
        await checkProviderLimit(ctx, { kind: "llm", provider: "openrouter" })
        const llmResult = await runLlmGeneration(agentContext, reportLink)

        const parsed = safeParseAgentOutput(llmResult.output)
        if (!parsed.ok) {
          await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
            auditAgentRunId: runId,
            status: "failed",
            errorMessage: parsed.error,
          })
          lastError = parsed.error
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

        await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
          auditAgentRunId: runId,
          status: "completed",
          tokensIn: llmResult.tokensIn,
          tokensOut: llmResult.tokensOut,
        })

        chosen = { ...llmResult, output: parsed.data }
      } catch (error) {
        const detail = describeError(error)
        console.error("[audit_agent] LLM call failed", { auditId: args.auditId, attempt, detail })
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
      const fallbackRunId = await ctx.runMutation(internal.audit_agent.startAuditAgentRun, {
        workspaceId: agentContext.workspaceId as Id<"workspaces">,
        auditId: args.auditId,
        provider: FALLBACK_PROVIDER,
        model: FALLBACK_MODEL,
        purpose: "findings",
        skillVersions: SKILL_VERSIONS,
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
      }
    }

    await ctx.runMutation(internal.audit_agent.setAuditAgentStage, {
      auditId: args.auditId,
      status: "generating_outreach",
      statusMessage: "Outreach-Texte werden erstellt",
    })

    await ctx.runMutation(internal.audit_agent.saveAuditAgentOutput, {
      auditId: args.auditId,
      output: chosen.output,
      reportLink,
    })

    await runPersonaPanel(ctx, agentContext, args.auditId)

    await runCopyReview(ctx, agentContext, args.auditId)

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
