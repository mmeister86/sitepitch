import { z } from "zod"

export const auditCategorySchema = z.enum([
  "conversion",
  "seo",
  "local_seo",
  "performance",
  "mobile",
  "trust",
  "technical",
])

export const auditCheckRefSchema = z
  .string()
  .min(3)
  .max(160)
  .regex(/^[a-z][a-z0-9_]*:[a-z0-9][a-z0-9_.-]*$/)

export const eveAuditContextSchema = z
  .object({
    auditId: z.string().min(1).max(128),
    domain: z.string().min(1).max(253),
    reportLanguage: z.enum(["de", "en"]),
    overallScore: z.number().min(0).max(100),
    categoryScores: z.record(z.string(), z.number().min(0).max(100)),
    checks: z
      .array(
        z
          .object({
            ref: auditCheckRefSchema,
            category: auditCategorySchema,
            key: z.string().min(1).max(120),
            status: z.enum([
              "passed",
              "failed",
              "warning",
              "not_applicable",
              "unknown",
            ]),
            label: z.string().min(1).max(240),
            evidence: z.string().max(800).optional(),
            source: z.string().max(160).optional(),
            weight: z.number().min(0).max(100).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(160),
    signals: z
      .object({
        title: z.string().max(300).optional(),
        metaDescription: z.string().max(600).optional(),
        openGraphText: z.string().max(600).optional(),
        headings: z.array(z.string().max(300)).max(40).optional(),
        ctaCandidates: z.array(z.string().max(200)).max(20).optional(),
        contactLinks: z.array(z.string().max(500)).max(20).optional(),
        schemaTypes: z.array(z.string().max(120)).max(30).optional(),
        copyExcerpt: z.string().max(6_000).optional(),
      })
      .strict()
      .optional(),
    performance: z
      .object({
        mobileScore: z.number().min(0).max(100).optional(),
        desktopScore: z.number().min(0).max(100).optional(),
        lcpMs: z.number().min(0).max(120_000).optional(),
        cls: z.number().min(0).max(100).optional(),
        fcpMs: z.number().min(0).max(120_000).optional(),
      })
      .strict()
      .optional(),
    business: z
      .object({
        name: z.string().max(240).optional(),
        city: z.string().max(160).optional(),
        rating: z.number().min(0).max(5).optional(),
      })
      .strict()
      .optional(),
    workspaceBranding: z
      .object({
        name: z.string().max(160).optional(),
        ctaText: z.string().max(240).optional(),
      })
      .strict()
      .optional(),
    reportUrl: z.string().url().max(2_048).optional(),
  })
  .strict()

const evidenceRefsSchema = z.array(auditCheckRefSchema).min(1).max(8)

export const eveAuditFindingSchema = z
  .object({
    category: auditCategorySchema,
    severity: z.enum(["low", "medium", "high"]),
    title: z.string().min(1).max(120),
    evidence: z.string().min(1).max(400),
    evidenceRefs: evidenceRefsSchema,
    explanation: z.string().min(1).max(600),
    recommendation: z.string().min(1).max(600),
    salesAngle: z.string().min(1).max(600),
  })
  .strict()

export const eveAuditSummarySchema = z
  .object({
    shortSummary: z.string().min(1).max(500),
    strengths: z.array(z.string().min(1).max(200)).min(1).max(8),
    weaknesses: z.array(z.string().min(1).max(200)).min(1).max(8),
    topOpportunities: z.array(z.string().min(1).max(200)).min(1).max(5),
    nextSteps: z.array(z.string().min(1).max(200)).min(1).max(6),
    evidenceRefs: evidenceRefsSchema,
  })
  .strict()

export const eveAuditOutreachSchema = z
  .object({
    type: z.enum(["email", "linkedin", "contact_form", "phone_note", "follow_up"]),
    subject: z.string().min(1).max(160).optional(),
    body: z.string().min(1).max(2_000),
    evidenceRefs: evidenceRefsSchema,
  })
  .strict()

export const eveAuditOutputSchema = z
  .object({
    findings: z.array(eveAuditFindingSchema).min(1).max(20),
    summary: eveAuditSummarySchema,
    outreach: z.array(eveAuditOutreachSchema).min(3).max(8),
    subjectLines: z.array(z.string().min(1).max(160)).min(1).max(5),
  })
  .strict()
  .superRefine((value, ctx) => {
    const types = new Set(value.outreach.map((item) => item.type))
    if (!types.has("phone_note")) {
      ctx.addIssue({
        code: "custom",
        message: "outreach must include phone_note",
        path: ["outreach"],
      })
    }
    if (!["email", "linkedin", "contact_form"].some((type) => types.has(type as never))) {
      ctx.addIssue({
        code: "custom",
        message: "outreach must include email, linkedin, or contact_form",
        path: ["outreach"],
      })
    }
  })

export type EveAuditContext = z.infer<typeof eveAuditContextSchema>
export type EveAuditOutput = z.infer<typeof eveAuditOutputSchema>

export type EveAuditValidationResult = {
  schemaPassed: boolean
  evidencePassed: boolean
  claimSafetyPassed: boolean
  invalidEvidenceRefs: string[]
  unsafeClaimCodes: string[]
}

const CLAIM_SAFETY_PATTERNS: ReadonlyArray<{ code: string; pattern: RegExp }> = [
  { code: "legal_judgement", pattern: /\b(?:dsgvo|gdpr)[- ]?(?:versto(?:ß|ss)|violation)|\brechtswidrig\b|\billegal\b/iu },
  { code: "security_claim", pattern: /\b(?:hackbar|hackable|sicherheitsl(?:ü|ue)cke|security vulnerability|unsichere website)\b/iu },
  { code: "guaranteed_outcome", pattern: /\b(?:garantiert|garantie auf|guaranteed)\b.{0,50}\b(?:umsatz|anfragen|kunden|conversion|revenue|leads?|customers?)\b/iu },
  { code: "shaming", pattern: /\b(?:peinlich|schlampig|unprofessionell|embarrassing|sloppy|unprofessional)\b/iu },
  { code: "wcag_judgement", pattern: /\b(?:wcag|barrierefreiheit|accessibility)\b.{0,40}\b(?:nicht erf(?:ü|ue)llt|versto(?:ß|ss)|violation|non-compliant|fails?)\b/iu },
]

function collectEvidenceRefs(output: EveAuditOutput): string[] {
  return [
    ...output.findings.flatMap((finding) => finding.evidenceRefs),
    ...output.summary.evidenceRefs,
    ...output.outreach.flatMap((draft) => draft.evidenceRefs),
  ]
}

function collectPublicText(output: EveAuditOutput): string {
  return [
    ...output.findings.flatMap((finding) => [
      finding.title,
      finding.evidence,
      finding.explanation,
      finding.recommendation,
      finding.salesAngle,
    ]),
    output.summary.shortSummary,
    ...output.summary.strengths,
    ...output.summary.weaknesses,
    ...output.summary.topOpportunities,
    ...output.summary.nextSteps,
    ...output.outreach.flatMap((draft) => [draft.subject ?? "", draft.body]),
    ...output.subjectLines,
  ].join("\n")
}

export function validateEveAuditCandidate(
  contextInput: EveAuditContext,
  outputInput: unknown,
): EveAuditValidationResult {
  const context = eveAuditContextSchema.parse(contextInput)
  const parsed = eveAuditOutputSchema.safeParse(outputInput)
  if (!parsed.success) {
    return {
      schemaPassed: false,
      evidencePassed: false,
      claimSafetyPassed: false,
      invalidEvidenceRefs: [],
      unsafeClaimCodes: ["schema_invalid"],
    }
  }

  const allowedRefs = new Set(context.checks.map((check) => check.ref))
  const invalidEvidenceRefs = [...new Set(collectEvidenceRefs(parsed.data).filter((ref) => !allowedRefs.has(ref)))]
  const publicText = collectPublicText(parsed.data)
  const unsafeClaimCodes = CLAIM_SAFETY_PATTERNS.filter(({ pattern }) => pattern.test(publicText)).map(
    ({ code }) => code,
  )

  return {
    schemaPassed: true,
    evidencePassed: invalidEvidenceRefs.length === 0,
    claimSafetyPassed: unsafeClaimCodes.length === 0,
    invalidEvidenceRefs,
    unsafeClaimCodes,
  }
}
