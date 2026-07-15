import { ConvexError, v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server"
import { normalizeReportCtaText, safeNormalizeReportCtaUrl } from "./lib/report_cta"
import {
  normalizeHiddenSections,
  normalizeReportColor,
  normalizeReportIntro,
  reportFeaturePolicy,
  requireReportCapability,
  type ReportFeaturePolicy,
  type ReportSection,
  type ReportTheme,
} from "./lib/report_policy"
import { queueReportPdfArtifact } from "./lib/report_pdf_queue"
import {
  DEFAULT_WORKSPACE_ACCENT,
  getWorkspacePlan,
  requireOwnerWorkspace,
} from "./lib/workspace"

const DEFAULT_BACKGROUND_COLOR = "#ffffff"
const DEFAULT_TEXT_COLOR = "#18181b"

const ReportThemeValidator = v.union(
  v.literal("classic"),
  v.literal("minimal"),
  v.literal("editorial"),
)

const ReportSectionValidator = v.union(
  v.literal("score"),
  v.literal("summary"),
  v.literal("opportunities"),
  v.literal("strengths_weaknesses"),
  v.literal("screenshots"),
  v.literal("findings"),
  v.literal("next_steps"),
  v.literal("cta"),
)

type SettingsCtx = QueryCtx | MutationCtx
type IntroSource = "report" | "campaign"
type CtaSource = "report" | "lead" | "campaign" | "workspace"

type SnapshotValues = {
  workspaceId: Id<"workspaces">
  auditId: Id<"audits">
  sourceCampaignId?: Id<"campaigns">
  sourceLeadId?: Id<"leads">
  brandName: string
  logoStorageId?: Id<"_storage">
  theme: ReportTheme
  primaryColor: string
  backgroundColor: string
  textColor: string
  language: "de" | "en"
  hiddenSections: ReportSection[]
  introText?: string
  ctaText?: string
  ctaUrl?: string
  introOverride?: string
  ctaTextOverride?: string
  ctaUrlOverride?: string
  introSource?: IntroSource
  ctaTextSource?: CtaSource
  ctaUrlSource?: CtaSource
  showPoweredByPreference: boolean
  passwordHash?: string
  passwordSalt?: string
  passwordAlgorithm?: "scrypt-v1"
  expiresAt?: number
  settingsVersion: number
  accessVersion: number
  snapshottedAt: number
  createdAt: number
  updatedAt: number
}

function firstText(
  candidates: Array<{ value: string | undefined; source: CtaSource }>,
): { value?: string; source?: CtaSource } {
  for (const candidate of candidates) {
    const value = candidate.value?.trim() || undefined
    if (value) return { value, source: candidate.source }
  }
  return {}
}

function firstSafeUrl(
  candidates: Array<{ value: string | undefined; source: CtaSource }>,
): { value?: string; source?: CtaSource } {
  for (const candidate of candidates) {
    const value = safeNormalizeReportCtaUrl(candidate.value)
    if (value) return { value, source: candidate.source }
  }
  return {}
}

async function loadSourceDocuments(ctx: SettingsCtx, audit: Doc<"audits">) {
  const workspace = await ctx.db.get(audit.workspaceId)
  if (!workspace || workspace.deletionRequestedAt) {
    throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
  }

  const campaign = audit.campaignId ? await ctx.db.get(audit.campaignId) : null
  const lead = audit.leadId ? await ctx.db.get(audit.leadId) : null

  return {
    workspace,
    campaign: campaign?.workspaceId === workspace._id ? campaign : null,
    lead: lead?.workspaceId === workspace._id ? lead : null,
  }
}

function workspaceFallbackUrl(workspace: Doc<"workspaces">): string | undefined {
  return (
    safeNormalizeReportCtaUrl(workspace.ctaUrl) ??
    safeNormalizeReportCtaUrl(workspace.website) ??
    safeNormalizeReportCtaUrl(
      workspace.contactEmail?.trim() ? `mailto:${workspace.contactEmail.trim()}` : undefined,
    )
  )
}

/** Build a stable snapshot without exposing storage or password metadata to clients. */
export async function buildReportSettingsSnapshotValues(
  ctx: SettingsCtx,
  audit: Doc<"audits">,
  previous?: Doc<"reportSettings"> | null,
): Promise<SnapshotValues> {
  const { workspace, campaign, lead } = await loadSourceDocuments(ctx, audit)
  const now = Date.now()

  const legacyCtaIsSnapshot = audit.reportCtaSnapshottedAt !== undefined
  const introOverride = previous?.introOverride
  const ctaTextOverride = previous?.ctaTextOverride
  const ctaUrlOverride = previous?.ctaUrlOverride

  const campaignIntro = normalizeReportIntro(campaign?.reportIntro)
  const introText = introOverride ?? campaignIntro
  const introSource: IntroSource | undefined = introOverride
    ? "report"
    : campaignIntro
      ? "campaign"
      : undefined

  const ctaText = firstText([
    { value: ctaTextOverride, source: "report" },
    {
      value: legacyCtaIsSnapshot ? audit.reportCtaText : undefined,
      source: "report",
    },
    { value: lead?.reportCtaText, source: "lead" },
    { value: campaign?.reportCtaText, source: "campaign" },
    { value: workspace.ctaText, source: "workspace" },
  ])

  const ctaUrl = firstSafeUrl([
    { value: ctaUrlOverride, source: "report" },
    {
      value: legacyCtaIsSnapshot ? audit.reportCtaUrl : undefined,
      source: "report",
    },
    { value: lead?.reportCtaUrl, source: "lead" },
    { value: campaign?.reportCtaUrl, source: "campaign" },
    { value: workspaceFallbackUrl(workspace), source: "workspace" },
  ])

  return {
    workspaceId: workspace._id,
    auditId: audit._id,
    sourceCampaignId: campaign?._id,
    sourceLeadId: lead?._id,
    brandName: workspace.name,
    logoStorageId: workspace.logoStorageId,
    theme: previous?.theme ?? "classic",
    primaryColor: previous?.primaryColor ?? workspace.accentColor ?? DEFAULT_WORKSPACE_ACCENT,
    backgroundColor: previous?.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
    textColor: previous?.textColor ?? DEFAULT_TEXT_COLOR,
    language: audit.reportLanguage,
    hiddenSections: previous?.hiddenSections ?? [],
    introText,
    ctaText: ctaText.value,
    ctaUrl: ctaUrl.value,
    introOverride,
    ctaTextOverride,
    ctaUrlOverride,
    introSource,
    ctaTextSource: ctaText.source,
    ctaUrlSource: ctaUrl.source,
    showPoweredByPreference: previous?.showPoweredByPreference ?? true,
    passwordHash: previous?.passwordHash,
    passwordSalt: previous?.passwordSalt,
    passwordAlgorithm: previous?.passwordAlgorithm,
    expiresAt: previous?.expiresAt,
    settingsVersion: previous ? previous.settingsVersion + 1 : 1,
    accessVersion: previous?.accessVersion ?? 1,
    snapshottedAt: previous?.snapshottedAt ?? now,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  }
}

export async function ensureReportSettingsSnapshot(
  ctx: MutationCtx,
  audit: Doc<"audits">,
): Promise<Doc<"reportSettings">> {
  const existing = await ctx.db
    .query("reportSettings")
    .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
    .unique()
  if (existing) return existing

  const settingsId = await ctx.db.insert(
    "reportSettings",
    await buildReportSettingsSnapshotValues(ctx, audit),
  )
  const inserted = await ctx.db.get(settingsId)
  if (!inserted) {
    throw new ConvexError({ code: "INTERNAL_ERROR", message: "Report settings unavailable" })
  }
  return inserted
}

async function requireOwnedAudit(ctx: SettingsCtx, auditId: Id<"audits">) {
  const { workspace } = await requireOwnerWorkspace(ctx)
  if (workspace.deletionRequestedAt) {
    throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
  }
  const audit = await ctx.db.get(auditId)
  if (!audit || audit.workspaceId !== workspace._id || audit.deletionRequestedAt) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Report not found" })
  }
  return { workspace, audit }
}

function assertFeatureChangesAllowed(args: {
  current: Doc<"reportSettings">
  next: {
    theme: ReportTheme
    primaryColor: string
    backgroundColor: string
    textColor: string
    hiddenSections: ReportSection[]
    introText?: string
    ctaText?: string
    ctaUrl?: string
    showPoweredByPreference: boolean
    expiresAt?: number
  }
  policy: ReportFeaturePolicy
}) {
  if (args.next.theme !== args.current.theme) {
    requireReportCapability(args.policy, "themes")
  }
  if (
    args.next.primaryColor !== args.current.primaryColor ||
    args.next.backgroundColor !== args.current.backgroundColor ||
    args.next.textColor !== args.current.textColor
  ) {
    requireReportCapability(args.policy, "customColors")
  }
  if (args.next.hiddenSections.join("|") !== args.current.hiddenSections.join("|")) {
    requireReportCapability(args.policy, "sectionVisibility")
  }
  if (args.next.introText !== args.current.introOverride) {
    requireReportCapability(args.policy, "intro")
  }
  if (
    args.next.ctaText !== args.current.ctaTextOverride ||
    args.next.ctaUrl !== args.current.ctaUrlOverride
  ) {
    requireReportCapability(args.policy, "campaignCta")
  }
  if (
    args.next.showPoweredByPreference !== args.current.showPoweredByPreference &&
    !args.next.showPoweredByPreference
  ) {
    requireReportCapability(args.policy, "poweredByToggle")
  }
  if (args.next.expiresAt !== args.current.expiresAt) {
    requireReportCapability(args.policy, "expiration")
  }
}

async function markPdfArtifactsStale(ctx: MutationCtx, auditId: Id<"audits">) {
  const artifacts = await ctx.db
    .query("reportPdfArtifacts")
    .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
    .take(50)
  const now = Date.now()
  for (const artifact of artifacts) {
    if (artifact.status !== "stale") {
      await ctx.db.patch(artifact._id, { status: "stale", updatedAt: now })
    }
  }
}

function settingsDto(
  settings: SnapshotValues | Doc<"reportSettings">,
  logoUrl: string | null,
  policy: ReportFeaturePolicy,
  isLegacyFallback: boolean,
) {
  return {
    brandName: settings.brandName,
    logoUrl,
    theme: settings.theme,
    primaryColor: settings.primaryColor,
    backgroundColor: settings.backgroundColor,
    textColor: settings.textColor,
    language: settings.language,
    hiddenSections: settings.hiddenSections,
    introText: settings.introText ?? null,
    ctaText: settings.ctaText ?? null,
    ctaUrl: settings.ctaUrl ?? null,
    showPoweredByPreference: settings.showPoweredByPreference,
    effectiveShowPoweredBy: policy.poweredByToggle
      ? settings.showPoweredByPreference
      : true,
    expiresAt: settings.expiresAt ?? null,
    hasPassword: Boolean(settings.passwordHash),
    settingsVersion: settings.settingsVersion,
    accessVersion: settings.accessVersion,
    isLegacyFallback,
    introSource: settings.introSource ?? null,
    ctaTextSource: settings.ctaTextSource ?? null,
    ctaUrlSource: settings.ctaUrlSource ?? null,
  }
}

export const getReportSettings = query({
  args: { auditId: v.id("audits") },
  handler: async (ctx, args) => {
    const { workspace, audit } = await requireOwnedAudit(ctx, args.auditId)
    const plan = await getWorkspacePlan(ctx, workspace._id)
    const capabilities = reportFeaturePolicy(plan)
    const stored = await ctx.db
      .query("reportSettings")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .unique()
    const settings = stored ?? await buildReportSettingsSnapshotValues(ctx, audit)
    const logoUrl = settings.logoStorageId
      ? await ctx.storage.getUrl(settings.logoStorageId)
      : null

    return {
      plan,
      capabilities,
      settings: settingsDto(settings, logoUrl, capabilities, !stored),
    }
  },
})

export const saveReportSettings = mutation({
  args: {
    auditId: v.id("audits"),
    theme: ReportThemeValidator,
    primaryColor: v.string(),
    backgroundColor: v.string(),
    textColor: v.string(),
    hiddenSections: v.array(ReportSectionValidator),
    introText: v.union(v.string(), v.null()),
    ctaText: v.union(v.string(), v.null()),
    ctaUrl: v.union(v.string(), v.null()),
    showPoweredByPreference: v.boolean(),
    expiresAt: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const { workspace, audit } = await requireOwnedAudit(ctx, args.auditId)
    const current = await ensureReportSettingsSnapshot(ctx, audit)
    const policy = reportFeaturePolicy(await getWorkspacePlan(ctx, workspace._id))

    const introText = normalizeReportIntro(args.introText ?? undefined)
    const ctaText = normalizeReportCtaText(args.ctaText ?? undefined)
    const ctaUrl = args.ctaUrl === null
      ? undefined
      : safeNormalizeReportCtaUrl(args.ctaUrl)
    if (args.ctaUrl !== null && args.ctaUrl.trim() && !ctaUrl) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Bitte gib eine gültige CTA-URL ein." })
    }
    const expiresAt = args.expiresAt ?? undefined
    if (expiresAt !== undefined && expiresAt <= Date.now()) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Das Ablaufdatum muss in der Zukunft liegen.",
      })
    }

    const next = {
      theme: args.theme as ReportTheme,
      primaryColor: normalizeReportColor(args.primaryColor, "Primärfarbe"),
      backgroundColor: normalizeReportColor(args.backgroundColor, "Hintergrundfarbe"),
      textColor: normalizeReportColor(args.textColor, "Textfarbe"),
      hiddenSections: normalizeHiddenSections(args.hiddenSections),
      introText,
      ctaText,
      ctaUrl,
      showPoweredByPreference: args.showPoweredByPreference,
      expiresAt,
    }
    assertFeatureChangesAllowed({ current, next, policy })

    const refreshed = await buildReportSettingsSnapshotValues(ctx, audit, {
      ...current,
      introOverride: introText,
      ctaTextOverride: ctaText,
      ctaUrlOverride: ctaUrl,
    })
    const accessVersion = expiresAt === current.expiresAt
      ? current.accessVersion
      : current.accessVersion + 1

    await ctx.db.patch(current._id, {
      ...refreshed,
      theme: next.theme,
      primaryColor: next.primaryColor,
      backgroundColor: next.backgroundColor,
      textColor: next.textColor,
      hiddenSections: next.hiddenSections,
      introOverride: introText,
      ctaTextOverride: ctaText,
      ctaUrlOverride: ctaUrl,
      showPoweredByPreference: next.showPoweredByPreference,
      expiresAt,
      accessVersion,
    })
    await markPdfArtifactsStale(ctx, audit._id)
    if (policy.pdfExport) {
      await queueReportPdfArtifact(ctx, {
        workspaceId: workspace._id,
        auditId: audit._id,
        settingsVersion: refreshed.settingsVersion,
      })
    }

    return { settingsVersion: refreshed.settingsVersion, accessVersion }
  },
})

export const refreshReportSettingsSnapshot = mutation({
  args: { auditId: v.id("audits") },
  handler: async (ctx, args) => {
    const { workspace, audit } = await requireOwnedAudit(ctx, args.auditId)
    const current = await ensureReportSettingsSnapshot(ctx, audit)
    const refreshed = await buildReportSettingsSnapshotValues(ctx, audit, current)
    await ctx.db.patch(current._id, refreshed)
    await markPdfArtifactsStale(ctx, audit._id)
    if (reportFeaturePolicy(await getWorkspacePlan(ctx, workspace._id)).pdfExport) {
      await queueReportPdfArtifact(ctx, {
        workspaceId: workspace._id,
        auditId: audit._id,
        settingsVersion: refreshed.settingsVersion,
      })
    }
    return { settingsVersion: refreshed.settingsVersion, accessVersion: refreshed.accessVersion }
  },
})
