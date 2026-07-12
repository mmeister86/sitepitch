import { ConvexError, v } from "convex/values"

import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import { outreachDraftTypeValidator, reportLanguageValidator } from "../src/lib/convex-schema-values"
import { scanClaimSafetyText, type ClaimSafetyIssue } from "./lib/audit_agent_claim_safety"
import { findAppUser, getWorkspaceByOwner } from "./lib/workspace"

const NAME_LIMIT = 80
const SUBJECT_LIMIT = 200
const BODY_LIMIT = 5_000
const ALLOWED_PLACEHOLDERS = ["business_name", "domain", "score", "report_url"] as const
type Placeholder = (typeof ALLOWED_PLACEHOLDERS)[number]
type TemplateInput = {
  name: string
  type: Doc<"outreachTemplates">["type"]
  language: "de" | "en"
  subject?: string
  body: string
}

function validationError(message: string, issues?: Array<ClaimSafetyIssue & { phase: "template" | "rendered" }>): never {
  if (issues) {
    throw new ConvexError({
      code: "VALIDATION_ERROR",
      message,
      issues: issues.map((issue) => ({
        path: issue.path,
        matched: issue.matched,
        phase: issue.phase,
      })),
    })
  }
  throw new ConvexError({ code: "VALIDATION_ERROR", message })
}

export function interpolateTemplate(
  text: string,
  context: Record<Placeholder, string>,
): string {
  return text.replace(/{{(business_name|domain|score|report_url)}}/g, (_, key: Placeholder) => context[key])
}

function validatePlaceholders(text: string, path: string): void {
  const placeholders = text.match(/{{[\s\S]*?}}/g) ?? []
  for (const placeholder of placeholders) {
    if (!ALLOWED_PLACEHOLDERS.some((key) => placeholder === `{{${key}}}`)) {
      validationError(`Ungültiger Platzhalter in ${path}: ${placeholder}`)
    }
  }
  const withoutAllowed = text.replace(/{{(business_name|domain|score|report_url)}}/g, "")
  if (text.includes("{{{") || text.includes("}}}") || withoutAllowed.includes("{{") || withoutAllowed.includes("}}")) {
    validationError(`Fehlerhafter Platzhalter in ${path}.`)
  }
}

function normalizeInput(input: TemplateInput): TemplateInput {
  const name = input.name.trim()
  const subject = input.subject?.trim() || undefined
  const body = input.body.trim()
  if (!name) validationError("Ein Vorlagenname ist erforderlich.")
  if (name.length > NAME_LIMIT) validationError(`Der Vorlagenname darf höchstens ${NAME_LIMIT} Zeichen lang sein.`)
  if (subject && subject.length > SUBJECT_LIMIT) validationError(`Der Betreff darf höchstens ${SUBJECT_LIMIT} Zeichen lang sein.`)
  if (!body) validationError("Der Vorlagentext ist erforderlich.")
  if (body.length > BODY_LIMIT) validationError(`Der Vorlagentext darf höchstens ${BODY_LIMIT} Zeichen lang sein.`)

  if (subject) validatePlaceholders(subject, "subject")
  validatePlaceholders(body, "body")
  const neutralContext: Record<Placeholder, string> = {
    business_name: "Muster GmbH",
    domain: "example.com",
    score: "50",
    report_url: "https://example.com/r/report",
  }
  const issues = [
    ...(subject ? scanClaimSafetyText(interpolateTemplate(subject, neutralContext), "subject") : []),
    ...scanClaimSafetyText(interpolateTemplate(body, neutralContext), "body"),
  ].map((issue) => ({ ...issue, phase: "template" as const }))
  if (issues.length > 0) {
    validationError("Die Vorlage enthält eine nicht zulässige Behauptung. Bitte formuliere sie sachlicher.", issues)
  }
  return { ...input, name, subject, body }
}

async function requireWorkspace(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" })
  }
  const appUser = await findAppUser(ctx, identity.tokenIdentifier)
  if (!appUser) {
    throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
  }
  const workspace = await getWorkspaceByOwner(ctx, appUser._id)
  if (!workspace) {
    throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
  }
  if (workspace.deletionRequestedAt) {
    throw new ConvexError({ code: "WORKSPACE_DELETION_PENDING", message: "Workspace deletion is pending" })
  }
  return { userId: appUser._id, workspace }
}

function toDto(template: Doc<"outreachTemplates">, fallbackLanguage: "de" | "en") {
  return {
    _id: template._id,
    name: template.name,
    type: template.type,
    language: template.language ?? fallbackLanguage,
    subject: template.subject,
    body: template.body,
    updatedAt: template.updatedAt,
  }
}

export const listMyTemplates = query({
  args: {},
  handler: async (ctx) => {
    const { workspace } = await requireWorkspace(ctx)
    const templates = await ctx.db
      .query("outreachTemplates")
      .withIndex("by_workspaceId_and_updatedAt", (q) => q.eq("workspaceId", workspace._id))
      .order("desc")
      .take(50)
    return templates.map((template) => toDto(template, workspace.reportLanguage))
  },
})

const templateArgs = {
  name: v.string(),
  type: outreachDraftTypeValidator,
  language: reportLanguageValidator,
  subject: v.optional(v.string()),
  body: v.string(),
}

export const create = mutation({
  args: templateArgs,
  handler: async (ctx, args): Promise<Id<"outreachTemplates">> => {
    const { userId, workspace } = await requireWorkspace(ctx)
    const input = normalizeInput(args)
    const now = Date.now()
    return await ctx.db.insert("outreachTemplates", {
      workspaceId: workspace._id,
      createdByUserId: userId,
      ...input,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: { templateId: v.id("outreachTemplates"), ...templateArgs },
  handler: async (ctx, args): Promise<void> => {
    const { workspace } = await requireWorkspace(ctx)
    const template = await ctx.db.get(args.templateId)
    if (!template || template.workspaceId !== workspace._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Vorlage nicht gefunden." })
    }
    const { templateId: _templateId, ...values } = args
    const input = normalizeInput(values)
    await ctx.db.patch(template._id, { ...input, updatedAt: Date.now() })
  },
})

export const deleteTemplate = mutation({
  args: { templateId: v.id("outreachTemplates") },
  handler: async (ctx, args): Promise<void> => {
    const { workspace } = await requireWorkspace(ctx)
    const template = await ctx.db.get(args.templateId)
    if (!template || template.workspaceId !== workspace._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Vorlage nicht gefunden." })
    }
    await ctx.db.delete(template._id)
  },
})

function validateReportUrl(reportUrl: string, publicSlug: string): string {
  const trimmed = reportUrl.trim()
  try {
    const url = new URL(trimmed)
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.pathname !== `/r/${publicSlug}` ||
      url.search ||
      url.hash
    ) {
      validationError("Der Report-Link passt nicht zu diesem Audit.")
    }
    return url.toString()
  } catch {
    validationError("Der Report-Link passt nicht zu diesem Audit.")
  }
}

export const renderForAudit = mutation({
  args: {
    templateId: v.id("outreachTemplates"),
    auditId: v.id("audits"),
    reportUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspace(ctx)
    const [template, audit] = await Promise.all([
      ctx.db.get(args.templateId),
      ctx.db.get(args.auditId),
    ])
    if (
      !template || template.workspaceId !== workspace._id ||
      !audit || audit.workspaceId !== workspace._id
    ) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Vorlage oder Audit nicht gefunden." })
    }
    const lead = audit.leadId ? await ctx.db.get(audit.leadId) : null
    const usesReportUrl = template.subject?.includes("{{report_url}}") || template.body.includes("{{report_url}}")
    if (usesReportUrl && !audit.isPublic) {
      validationError("Bitte veröffentliche den Report, bevor du eine Vorlage mit Report-Link anwendest.")
    }
    const context: Record<Placeholder, string> = {
      business_name: lead && lead.workspaceId === workspace._id ? lead.businessName : audit.domain,
      domain: audit.domain,
      score: audit.overallScore === undefined ? "—" : String(Math.round(audit.overallScore)),
      report_url: validateReportUrl(args.reportUrl, audit.publicSlug),
    }
    const subject = template.subject ? interpolateTemplate(template.subject, context) : undefined
    const body = interpolateTemplate(template.body, context)
    const issues = [
      ...(subject ? scanClaimSafetyText(subject, "subject") : []),
      ...scanClaimSafetyText(body, "body"),
    ].map((issue) => ({ ...issue, phase: "rendered" as const }))
    if (issues.length > 0) {
      validationError("Die gerenderte Vorlage enthält eine nicht zulässige Behauptung.", issues)
    }
    return {
      subject,
      body,
      context: {
        businessName: context.business_name,
        domain: context.domain,
        score: context.score,
        reportUrl: context.report_url,
      },
    }
  },
})
