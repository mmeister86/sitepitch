import { defineTool } from "eve/tools"
import { z } from "zod"

const findingSchema = z.object({
  category: z.enum(["conversion", "seo", "local_seo", "performance", "mobile", "trust", "technical"]),
  severity: z.enum(["low", "medium", "high"]),
  title: z.string().min(1).max(120),
  evidence: z.string().min(1).max(400),
  explanation: z.string().min(1).max(600),
  recommendation: z.string().min(1).max(600),
  salesAngle: z.string().min(1).max(600),
})

const summarySchema = z.object({
  shortSummary: z.string().min(1).max(500),
  strengths: z.array(z.string().min(1).max(200)).min(1).max(8),
  weaknesses: z.array(z.string().min(1).max(200)).min(1).max(8),
  topOpportunities: z.array(z.string().min(1).max(200)).min(1).max(5),
  nextSteps: z.array(z.string().min(1).max(200)).min(1).max(6),
})

const outreachSchema = z.object({
  type: z.enum(["email", "linkedin", "contact_form", "phone_note", "follow_up"]),
  subject: z.string().min(1).max(160).optional(),
  body: z.string().min(1).max(2000),
})

export default defineTool({
  description:
    "Persist validated audit findings, summary, and outreach drafts for an audit. Only call after claim-safety review. Convex is the single source of truth.",
  inputSchema: z.object({
    auditId: z.string().min(1),
    findings: z.array(findingSchema).min(1).max(20),
    summary: summarySchema,
    outreach: z.array(outreachSchema).min(3),
    subjectLines: z.array(z.string().min(1).max(160)).min(1).max(5),
  }),
  outputSchema: z.object({
    saved: z.boolean(),
    findingsCount: z.number(),
    outreachCount: z.number(),
  }),
  async execute({ auditId, findings, outreach }) {
    // In the Convex-driven path, saving happens server-side after outputSchema
    // validation. When Eve runs standalone, wire this to the Convex internal
    // mutation audit_agent:saveAuditAgentOutput via the HTTP API.
    return {
      saved: true,
      findingsCount: findings.length,
      outreachCount: outreach.length,
    }
  },
})
