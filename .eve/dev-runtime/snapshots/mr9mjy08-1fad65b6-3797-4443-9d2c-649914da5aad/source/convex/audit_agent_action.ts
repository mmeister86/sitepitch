"use node"

import { v } from "convex/values"

import { internalAction, env } from "./_generated/server"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import type { AuditAgentContext, AuditAgentContextCheck } from "./audit_agent"
import type { AuditAgentOutput } from "./lib/audit_agent_schemas"
import { safeParseAgentOutput } from "./lib/audit_agent_schemas"
import { buildEvidenceRefs, validateFindingEvidence } from "./lib/audit_agent_evidence"
import { reviewClaimSafety } from "./lib/audit_agent_claim_safety"
import {
  generateDeterministicAgentOutput,
  FALLBACK_MODEL,
  FALLBACK_PROVIDER,
} from "./lib/audit_agent_fallback"
import type { CheckInput, CategoryScores } from "./lib/audit_scoring"

const SKILL_VERSIONS = {
  "conversion-audit": "2026.07.1",
  "seo-basics-audit": "2026.07.1",
  "local-seo-audit": "2026.07.1",
  "mobile-ux-audit": "2026.07.1",
  "trust-audit": "2026.07.1",
  "respectful-outreach": "2026.07.1",
  "claim-safety": "2026.07.1",
}

const MAX_RETRIES = 1

interface EveRunResult {
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

function validateOutputSafety(output: AuditAgentOutput, evidenceRefs: ReturnType<typeof buildEvidenceRefs>):
  | { ok: true }
  | { ok: false; reason: string } {
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

async function runEveAgent(agentContext: AuditAgentContext, reportLink: string | undefined): Promise<EveRunResult | null> {
  const eveUrl = env.EVE_AGENT_URL
  if (!eveUrl) {
    return null
  }

  const { Client } = await import("eve/client")
  const client = new Client({ host: eveUrl })
  const session = client.session()

  const payload = {
    audit: {
      domain: agentContext.domain,
      reportLanguage: agentContext.reportLanguage,
      overallScore: agentContext.overallScore,
      categoryScores: agentContext.categoryScores,
    },
    checks: agentContext.checks,
    signals: agentContext.signals,
    performance: agentContext.performance,
    business: agentContext.business,
    workspace: {
      name: agentContext.workspace.name,
      ctaText: agentContext.workspace.ctaText,
    },
    reportLink,
  }

  const message = `Generate audit findings, summary, and outreach drafts for this website audit. Return strictly structured output matching the configured schema.\n\n${JSON.stringify(payload)}`

  const response = await session.send<AuditAgentOutput>({
    message,
    outputSchema: (await import("./lib/audit_agent_schemas")).auditAgentOutputSchema,
  })

  const result = await response.result()
  if (!result.data) {
    throw new Error("Eve returned no structured data")
  }

  return {
    output: result.data,
    provider: "other",
    model: env.EVE_AGENT_MODEL ?? "eve-default",
    usedFallback: false,
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

    let chosen: EveRunResult | null = null
    let lastError: string | undefined

    for (let attempt = 0; attempt <= MAX_RETRIES && !chosen; attempt++) {
      const runId = await ctx.runMutation(internal.audit_agent.startAuditAgentRun, {
        workspaceId: agentContext.workspaceId as Id<"workspaces">,
        auditId: args.auditId,
        provider: "other",
        model: env.EVE_AGENT_MODEL ?? "eve-default",
        purpose: "findings",
        skillVersions: SKILL_VERSIONS,
      })

      try {
        const eveResult = await runEveAgent(agentContext, reportLink)
        if (!eveResult) {
          await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
            auditAgentRunId: runId,
            status: "failed",
            errorMessage: "EVE_AGENT_URL not configured",
          })
          lastError = "Eve agent not configured"
          break
        }

        const parsed = safeParseAgentOutput(eveResult.output)
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
          tokensIn: eveResult.tokensIn,
          tokensOut: eveResult.tokensOut,
        })

        chosen = { ...eveResult, output: parsed.data }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await ctx.runMutation(internal.audit_agent.finishAuditAgentRun, {
          auditAgentRunId: runId,
          status: "failed",
          errorMessage: message.slice(0, 500),
        })
        lastError = message
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

      const fallbackSafety = validateOutputSafety(fallbackOutput, evidenceRefs)
      if (!fallbackSafety.ok) {
        console.error("[audit_agent] fallback failed safety", { auditId: args.auditId, reason: fallbackSafety.reason })
      }

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
