import { v } from "convex/values"

import { internalMutation } from "./_generated/server"
import { BATCH_QA_RULE_VERSION } from "./lib/batch_audit_qa"
import { reviewTextsClaimSafety } from "./lib/audit_agent_claim_safety"
import { buildEvidenceRefs, validateFindingEvidence } from "./lib/audit_agent_evidence"
import type { CheckInput } from "./lib/audit_scoring"

export const evaluateCompletedItem = internalMutation({
  args: { batchAuditItemId: v.id("batchAuditItems") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.batchAuditItemId)
    if (!item || !item.auditId || !item.qaSelected || item.status !== "completed") return null
    const existing = await ctx.db
      .query("batchAuditQaResults")
      .withIndex("by_batchAuditItemId", (q) => q.eq("batchAuditItemId", item._id))
      .unique()
    if (existing) return existing._id

    const [audit, job, findings, summary, drafts, checks] = await Promise.all([
      ctx.db.get(item.auditId),
      ctx.db.get(item.batchAuditJobId),
      ctx.db.query("auditFindings").withIndex("by_auditId", (q) => q.eq("auditId", item.auditId!)).take(100),
      ctx.db.query("auditSummaries").withIndex("by_auditId", (q) => q.eq("auditId", item.auditId!)).unique(),
      ctx.db.query("outreachDrafts").withIndex("by_auditId", (q) => q.eq("auditId", item.auditId!)).take(20),
      ctx.db.query("auditChecks").withIndex("by_auditId", (q) => q.eq("auditId", item.auditId!)).take(200),
    ])
    if (!audit || !job || audit.workspaceId !== item.workspaceId || job.workspaceId !== item.workspaceId) return null

    const schemaValid = Boolean(summary && findings.length > 0 && drafts.length > 0)
    const evidenceRefs = buildEvidenceRefs(checks as CheckInput[])
    const evidenceIssues = validateFindingEvidence(
      findings.map((finding) => ({
        title: finding.title,
        evidenceRefs: finding.evidenceRefs ?? [],
      })),
      evidenceRefs,
    )
    const texts = [
      ...findings.flatMap((finding, index) => [
        { text: finding.title, path: `findings[${index}].title` },
        { text: finding.explanation, path: `findings[${index}].explanation` },
        { text: finding.recommendation, path: `findings[${index}].recommendation` },
      ]),
      ...(summary ? [{ text: summary.shortSummary, path: "summary.shortSummary" }] : []),
      ...drafts.map((draft, index) => ({ text: draft.body, path: `outreach[${index}].body` })),
    ]
    const claimSafety = reviewTextsClaimSafety(texts)
    const issueCount = evidenceIssues.length + claimSafety.issues.length + (schemaValid ? 0 : 1)
    const status = issueCount === 0 ? "passed" as const : "failed" as const
    const current = Date.now()
    const resultId = await ctx.db.insert("batchAuditQaResults", {
      workspaceId: item.workspaceId,
      batchAuditJobId: item.batchAuditJobId,
      batchAuditItemId: item._id,
      auditId: audit._id,
      status,
      ruleVersion: BATCH_QA_RULE_VERSION,
      schemaValid,
      evidenceGrounded: evidenceIssues.length === 0,
      claimSafetyPassed: claimSafety.ok,
      issueCount,
      summary: issueCount === 0 ? "Schema, Evidenz und Claim-Safety bestanden." : `${issueCount} QA-Hinweise gefunden.`,
      checkedAt: current,
      createdAt: current,
    })
    await ctx.db.patch(item._id, { qaStatus: status, updatedAt: current })
    await ctx.db.patch(job._id, {
      qaPassedItems: job.qaPassedItems + (status === "passed" ? 1 : 0),
      qaFailedItems: job.qaFailedItems + (status === "failed" ? 1 : 0),
      updatedAt: current,
    })
    return resultId
  },
})
