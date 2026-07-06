import { z } from "zod"

export const AUDIT_AGENT_SCHEMA_VERSION = "2026.07.1"

export const findingCategorySchema = z.enum([
  "conversion",
  "seo",
  "local_seo",
  "performance",
  "mobile",
  "trust",
  "technical",
])

export const findingSeveritySchema = z.enum(["low", "medium", "high"])

export const auditFindingOutputSchema = z.object({
  category: findingCategorySchema,
  severity: findingSeveritySchema,
  title: z.string().min(1).max(120),
  evidence: z.string().min(1).max(400),
  explanation: z.string().min(1).max(600),
  recommendation: z.string().min(1).max(600),
  salesAngle: z.string().min(1).max(600),
})

export const auditSummaryOutputSchema = z.object({
  shortSummary: z.string().min(1).max(500),
  strengths: z.array(z.string().min(1).max(200)).min(1).max(8),
  weaknesses: z.array(z.string().min(1).max(200)).min(1).max(8),
  topOpportunities: z.array(z.string().min(1).max(200)).min(1).max(5),
  nextSteps: z.array(z.string().min(1).max(200)).min(1).max(6),
})

export const outreachDraftOutputSchema = z.object({
  type: z.enum(["email", "linkedin", "contact_form", "phone_note", "follow_up"]),
  subject: z.string().min(1).max(160).optional(),
  subjectLines: z.array(z.string().min(1).max(160)).max(5).optional(),
  body: z.string().min(1).max(2000),
})

export const outreachDraftsOutputSchema = z
  .array(outreachDraftOutputSchema)
  .min(3)
  .refine((drafts) => {
    const types = new Set(drafts.map((draft) => draft.type))
    return types.has("email") && (types.has("linkedin") || types.has("contact_form")) && types.has("phone_note")
  }, "Outreach must include email, linkedin/contact_form, and phone_note drafts")

export const auditAgentOutputSchema = z.object({
  findings: z.array(auditFindingOutputSchema).min(1).max(20),
  summary: auditSummaryOutputSchema,
  outreach: outreachDraftsOutputSchema,
  subjectLines: z.array(z.string().min(1).max(160)).min(1).max(5),
})

export type AuditFindingOutput = z.infer<typeof auditFindingOutputSchema>
export type AuditSummaryOutput = z.infer<typeof auditSummaryOutputSchema>
export type OutreachDraftOutput = z.infer<typeof outreachDraftOutputSchema>
export type AuditAgentOutput = z.infer<typeof auditAgentOutputSchema>

export function safeParseAgentOutput(raw: unknown):
  | { ok: true; data: AuditAgentOutput }
  | { ok: false; error: string } {
  const parsed = auditAgentOutputSchema.safeParse(raw)
  if (parsed.success) {
    return { ok: true, data: parsed.data }
  }
  const first = parsed.error.issues[0]
  const path = first?.path.length ? first.path.join(".") : "root"
  return { ok: false, error: `${first?.code ?? "invalid"} at ${path}: ${first?.message ?? "validation failed"}` }
}
