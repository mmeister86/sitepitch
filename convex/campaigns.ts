import { ConvexError, v } from "convex/values"

import { action, internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server"
import type { Id, Doc } from "./_generated/dataModel"
import { api, internal } from "./_generated/api"
import {
  requireExistingAppUser,
  getWorkspaceByOwner,
  getWorkspacePlan,
  findAppUser,
} from "./lib/workspace"
import {
  attachLeadToCampaign,
  campaignLeadStatusLabel,
  campaignStatusLabel,
  isTerminalStatus,
  loadCampaignForMutation,
  loadCampaignLeadByIds,
  loadCampaignLeadForMutation,
  logLeadActivity,
  validateCampaignName,
  validateCampaignSegment,
  validateNote,
  validateOutcomeReason,
  validateStatusTransition,
  type CampaignLeadStatus,
  type CampaignOfferType,
  type CampaignStatus,
} from "./lib/campaigns"
import {
  campaignLeadStatusValidator,
  campaignOfferTypeValidator,
  campaignStatusValidator,
  reportLanguageValidator,
} from "../src/lib/convex-schema-values"
import { loadReportViewCount } from "./lib/report_view_stats"
import { normalizeReportCtaText, normalizeReportCtaUrl } from "./lib/report_cta"
import {
  normalizeReportIntro,
  reportFeaturePolicy,
  requireReportCapability,
  type ReportFeaturePolicy,
} from "./lib/report_policy"

const CampaignLeadStatusValidator = campaignLeadStatusValidator
const CampaignOfferTypeValidator = campaignOfferTypeValidator
const CampaignStatusValidator = campaignStatusValidator
const ReportLanguageValidator = reportLanguageValidator

function toCampaignListItem(
  campaign: Doc<"campaigns">,
  metrics: CampaignMetrics,
): CampaignListItem {
  return {
    _id: campaign._id,
    name: campaign.name,
    targetIndustry: campaign.targetIndustry,
    targetCity: campaign.targetCity,
    targetCountry: campaign.targetCountry,
    offerType: campaign.offerType as CampaignOfferType,
    language: campaign.language as "de" | "en",
    ...(campaign.reportIntro ? { reportIntro: campaign.reportIntro } : {}),
    ...(campaign.reportCtaText ? { reportCtaText: campaign.reportCtaText } : {}),
    ...(campaign.reportCtaUrl ? { reportCtaUrl: campaign.reportCtaUrl } : {}),
    status: campaign.status as CampaignStatus,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    metrics,
  }
}

export type CampaignMetrics = {
  leads: number
  audits: number
  outreachCopied: number
  reportViews: number
  reportViewsCapped: boolean
  reportViewsPending: boolean
  won: number
  lost: number
  followUpsDue: number
}

export type CampaignListItem = {
  _id: Id<"campaigns">
  name: string
  targetIndustry: string
  targetCity: string
  targetCountry: string
  offerType: CampaignOfferType
  language: "de" | "en"
  reportIntro?: string
  reportCtaText?: string
  reportCtaUrl?: string
  status: CampaignStatus
  createdAt: number
  updatedAt: number
  metrics: CampaignMetrics
}

export type CampaignAssignmentOption = {
  _id: Id<"campaigns">
  name: string
  targetIndustry: string
  targetCity: string
  status: "draft" | "active"
}

export type CampaignLeadListItem = {
  campaignLeadId: Id<"campaignLeads">
  leadId: Id<"leads">
  businessName: string
  websiteUrl?: string
  normalizedWebsiteUrl?: string
  category?: string
  city?: string
  country?: string
  address?: string
  businessEmail?: string
  reportCtaText?: string
  reportCtaUrl?: string
  phone?: string
  latitude?: number
  longitude?: number
  sourceProvider?: string
  sourceId?: string
  status: CampaignLeadStatus
  note?: string
  noteUpdatedAt?: number
  outcomeReason?: string
  followUpAt?: number
  lastContactedAt?: number
  audit: {
    _id: Id<"audits">
    status: string
    overallScore?: number
    viewCount: number
    viewCountCapped: boolean
    viewCountPending: boolean
    outreachCopied: number
  } | null
  auditReady: boolean
  createdAt: number
  updatedAt: number
}

export type CampaignActivityItem = {
  _id: Id<"leadActivities">
  type: string
  message: string
  createdAt: number
  leadName?: string
}

async function computeCampaignMetrics(
  ctx: QueryCtx,
  campaignId: Id<"campaigns">,
  workspaceId: Id<"workspaces">,
): Promise<CampaignMetrics> {
  const campaignLeads = await ctx.db
    .query("campaignLeads")
    .withIndex("by_campaignId", (q) => q.eq("campaignId", campaignId))
    .take(500)

  let won = 0
  let lost = 0
  let followUpsDue = 0
  const now = Date.now()

  for (const cl of campaignLeads) {
    if (cl.status === "won") won++
    if (cl.status === "lost") lost++
    if (cl.status === "follow_up" && cl.followUpAt !== undefined && cl.followUpAt <= now) {
      followUpsDue++
    }
  }

  const attributedAudits = await ctx.db
    .query("audits")
    .withIndex("by_campaignId_and_createdAt", (q) => q.eq("campaignId", campaignId))
    .order("desc")
    .take(500)

  let reportViews = 0
  let reportViewsCapped = false
  let reportViewsPending = false
  let outreachCopied = 0

  let auditCount = 0
  for (const audit of attributedAudits) {
    if (audit.workspaceId !== workspaceId || !audit.campaignLeadId) continue
    auditCount++
    const viewCount = await loadReportViewCount(ctx, audit._id)
    reportViews += viewCount.count
    reportViewsCapped ||= viewCount.capped
    reportViewsPending ||= viewCount.pending

    const copiedEvent = await ctx.db
      .query("usageEvents")
      .withIndex("by_auditId_and_event", (q) =>
        q.eq("auditId", audit._id).eq("event", "outreach_copied"),
      )
      .first()
    if (copiedEvent?.workspaceId === workspaceId) outreachCopied++
  }

  return {
    leads: campaignLeads.length,
    audits: auditCount,
    outreachCopied,
    reportViews,
    reportViewsCapped,
    reportViewsPending,
    won,
    lost,
    followUpsDue,
  }
}

export const listMyCampaigns = query({
  args: {},
  handler: async (ctx): Promise<{ items: CampaignListItem[]; total: number } | null> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const user = await findAppUser(ctx, identity.tokenIdentifier)
    if (!user) return null

    const workspace = await getWorkspaceByOwner(ctx, user._id)
    if (!workspace) return null

    const campaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspace._id))
      .order("desc")
      .take(100)

    const items: CampaignListItem[] = []
    for (const campaign of campaigns) {
      const metrics = await computeCampaignMetrics(ctx, campaign._id, workspace._id)
      items.push(toCampaignListItem(campaign, metrics))
    }

    return { items, total: campaigns.length }
  },
})

export const listAssignableCampaigns = query({
  args: { leadId: v.id("leads") },
  handler: async (
    ctx,
    args,
  ): Promise<{ items: CampaignAssignmentOption[] } | null> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const user = await findAppUser(ctx, identity.tokenIdentifier)
    if (!user) return null

    const workspace = await getWorkspaceByOwner(ctx, user._id)
    if (!workspace) return null

    const lead = await ctx.db.get(args.leadId)
    if (!lead || lead.workspaceId !== workspace._id) return null

    const existing = await ctx.db
      .query("campaignLeads")
      .withIndex("by_workspaceId_and_leadId", (q) =>
        q.eq("workspaceId", workspace._id).eq("leadId", args.leadId),
      )
      .take(100)
    const linkedCampaignIds = new Set(existing.map((item) => item.campaignId))

    const [drafts, active] = await Promise.all([
      ctx.db
        .query("campaigns")
        .withIndex("by_workspaceId_and_status", (q) =>
          q.eq("workspaceId", workspace._id).eq("status", "draft"),
        )
        .order("desc")
        .take(50),
      ctx.db
        .query("campaigns")
        .withIndex("by_workspaceId_and_status", (q) =>
          q.eq("workspaceId", workspace._id).eq("status", "active"),
        )
        .order("desc")
        .take(50),
    ])

    const items = [...drafts, ...active]
      .filter((campaign) => !linkedCampaignIds.has(campaign._id))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((campaign) => ({
        _id: campaign._id,
        name: campaign.name,
        targetIndustry: campaign.targetIndustry,
        targetCity: campaign.targetCity,
        status: campaign.status as "draft" | "active",
      }))

    return { items }
  },
})

export const getMyCampaign = query({
  args: {
    campaignId: v.id("campaigns"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    campaign: CampaignListItem
    reportCapabilities: ReportFeaturePolicy
    metrics: CampaignMetrics
    leads: CampaignLeadListItem[]
    activity: CampaignActivityItem[]
  } | null> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const user = await findAppUser(ctx, identity.tokenIdentifier)
    if (!user) return null

    const workspace = await getWorkspaceByOwner(ctx, user._id)
    if (!workspace) return null

    const campaign = await ctx.db.get(args.campaignId)
    if (!campaign || campaign.workspaceId !== workspace._id) return null

    const metrics = await computeCampaignMetrics(ctx, campaign._id, workspace._id)

    const campaignLeads = await ctx.db
      .query("campaignLeads")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", campaign._id))
      .take(100)

    const leadIds = campaignLeads.map((cl) => cl.leadId)
    const leadMap = new Map<Id<"leads">, Doc<"leads">>()
    for (const leadId of leadIds) {
      const lead = await ctx.db.get(leadId)
      if (lead) leadMap.set(leadId, lead)
    }

    const latestAuditByCampaignLead = new Map<Id<"campaignLeads">, Doc<"audits">>()
    for (const campaignLead of campaignLeads) {
      const audit = await ctx.db
        .query("audits")
        .withIndex("by_campaignLeadId_and_createdAt", (q) =>
          q.eq("campaignLeadId", campaignLead._id),
        )
        .order("desc")
        .first()
      if (audit?.workspaceId === workspace._id && audit.campaignId === campaign._id) {
        latestAuditByCampaignLead.set(campaignLead._id, audit)
      }
    }

    const auditMeta = new Map<
      Id<"audits">,
      {
        status: string
        overallScore?: number
        viewCount: number
        viewCountCapped: boolean
        viewCountPending: boolean
        outreachCopied: number
      }
    >()
    for (const audit of latestAuditByCampaignLead.values()) {
      const auditId = audit._id
      const scoreDoc = await ctx.db
        .query("auditScores")
        .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
        .unique()
      const viewCount = await loadReportViewCount(ctx, auditId)
      const copiedEvent = await ctx.db
        .query("usageEvents")
        .withIndex("by_auditId_and_event", (q) =>
          q.eq("auditId", auditId).eq("event", "outreach_copied"),
        )
        .first()
      auditMeta.set(auditId, {
        status: audit.status,
        overallScore: audit.overallScore ?? scoreDoc?.overallScore ?? undefined,
        viewCount: viewCount.count,
        viewCountCapped: viewCount.capped,
        viewCountPending: viewCount.pending,
        outreachCopied: copiedEvent?.workspaceId === workspace._id ? 1 : 0,
      })
    }

    const leads: CampaignLeadListItem[] = campaignLeads.map((cl) => {
      const lead = leadMap.get(cl.leadId)
      const latestAudit = latestAuditByCampaignLead.get(cl._id)
      const auditInfo = latestAudit ? auditMeta.get(latestAudit._id) : undefined
      return {
        campaignLeadId: cl._id,
        leadId: cl.leadId,
        businessName: lead?.businessName ?? "",
        websiteUrl: lead?.websiteUrl ?? undefined,
        normalizedWebsiteUrl: lead?.normalizedWebsiteUrl ?? undefined,
        category: lead?.category ?? undefined,
        city: lead?.city ?? undefined,
        country: lead?.country ?? undefined,
        address: lead?.address ?? undefined,
        businessEmail: lead?.businessEmail ?? undefined,
        reportCtaText: lead?.reportCtaText ?? undefined,
        reportCtaUrl: lead?.reportCtaUrl ?? undefined,
        phone: lead?.phone ?? undefined,
        latitude: lead?.latitude ?? undefined,
        longitude: lead?.longitude ?? undefined,
        sourceProvider: lead?.sourceProvider ?? undefined,
        sourceId: lead?.sourceId ?? undefined,
        status: cl.status,
        note: cl.note ?? undefined,
        noteUpdatedAt: cl.noteUpdatedAt ?? undefined,
        outcomeReason: cl.outcomeReason ?? undefined,
        followUpAt: cl.followUpAt ?? undefined,
        lastContactedAt: cl.lastContactedAt ?? undefined,
        audit: auditInfo
          ? {
              _id: latestAudit!._id,
              status: auditInfo.status,
              overallScore: auditInfo.overallScore,
              viewCount: auditInfo.viewCount,
              viewCountCapped: auditInfo.viewCountCapped,
              viewCountPending: auditInfo.viewCountPending,
              outreachCopied: auditInfo.outreachCopied,
            }
          : null,
        auditReady: Boolean(lead?.normalizedWebsiteUrl || lead?.websiteUrl),
        createdAt: cl.createdAt,
        updatedAt: cl.updatedAt,
      }
    })

    const recentActivity = await ctx.db
      .query("leadActivities")
      .withIndex("by_campaignId_and_createdAt", (q) => q.eq("campaignId", campaign._id))
      .order("desc")
      .take(10)

    const activity: CampaignActivityItem[] = []
    for (const a of recentActivity) {
      let leadName: string | undefined
      if (a.leadId) {
        const lead = await ctx.db.get(a.leadId)
        leadName = lead?.businessName
      }
      activity.push({
        _id: a._id,
        type: a.type,
        message: a.message,
        createdAt: a.createdAt,
        leadName,
      })
    }

    return {
      campaign: toCampaignListItem(campaign, metrics),
      reportCapabilities: reportFeaturePolicy(await getWorkspacePlan(ctx, workspace._id)),
      metrics,
      leads,
      activity,
    }
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    targetIndustry: v.string(),
    targetCity: v.string(),
    targetCountry: v.string(),
    offerType: CampaignOfferTypeValidator,
    language: ReportLanguageValidator,
    status: v.union(v.literal("draft"), v.literal("active")),
  },
  handler: async (ctx, args): Promise<{ campaignId: Id<"campaigns"> }> => {
    const user = await requireExistingAppUser(ctx)
    const workspace = await getWorkspaceByOwner(ctx, user.userId)
    if (!workspace) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }

    const name = validateCampaignName(args.name)
    const targetIndustry = validateCampaignSegment(args.targetIndustry, "Branche")
    const targetCity = validateCampaignSegment(args.targetCity, "Stadt")
    const targetCountry = validateCampaignSegment(args.targetCountry, "Land")

    const now = Date.now()
    const campaignId = await ctx.db.insert("campaigns", {
      workspaceId: workspace._id,
      name,
      targetIndustry,
      targetCity,
      targetCountry,
      offerType: args.offerType,
      language: args.language,
      status: args.status,
      createdByUserId: user.userId,
      createdAt: now,
      updatedAt: now,
    })

    return { campaignId }
  },
})

export const update = mutation({
  args: {
    campaignId: v.id("campaigns"),
    name: v.string(),
    targetIndustry: v.string(),
    targetCity: v.string(),
    targetCountry: v.string(),
    offerType: CampaignOfferTypeValidator,
    language: ReportLanguageValidator,
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireExistingAppUser(ctx)
    const workspace = await getWorkspaceByOwner(ctx, user.userId)
    if (!workspace) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }

    const campaign = await loadCampaignForMutation(ctx, args.campaignId, workspace._id)
    if (campaign.status === "archived") {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Archivierte Kampagnen können nicht bearbeitet werden." })
    }

    const name = validateCampaignName(args.name)
    const targetIndustry = validateCampaignSegment(args.targetIndustry, "Branche")
    const targetCity = validateCampaignSegment(args.targetCity, "Stadt")
    const targetCountry = validateCampaignSegment(args.targetCountry, "Land")

    await ctx.db.patch(args.campaignId, {
      name,
      targetIndustry,
      targetCity,
      targetCountry,
      offerType: args.offerType,
      language: args.language,
      updatedAt: Date.now(),
    })
  },
})

export const updateReportDefaults = mutation({
  args: {
    campaignId: v.id("campaigns"),
    reportIntro: v.string(),
    reportCtaText: v.string(),
    reportCtaUrl: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireExistingAppUser(ctx)
    const workspace = await getWorkspaceByOwner(ctx, user.userId)
    if (!workspace || workspace.deletionRequestedAt) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }

    const campaign = await loadCampaignForMutation(ctx, args.campaignId, workspace._id)
    if (campaign.status === "archived") {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Archivierte Kampagnen können nicht bearbeitet werden.",
      })
    }

    const plan = await getWorkspacePlan(ctx, workspace._id)
    requireReportCapability(reportFeaturePolicy(plan), "campaignCta")

    await ctx.db.patch(campaign._id, {
      reportIntro: normalizeReportIntro(args.reportIntro),
      reportCtaText: normalizeReportCtaText(args.reportCtaText),
      reportCtaUrl: normalizeReportCtaUrl(args.reportCtaUrl),
      updatedAt: Date.now(),
    })
  },
})

export const setStatus = mutation({
  args: {
    campaignId: v.id("campaigns"),
    status: CampaignStatusValidator,
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireExistingAppUser(ctx)
    const workspace = await getWorkspaceByOwner(ctx, user.userId)
    if (!workspace) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }

    const campaign = await loadCampaignForMutation(ctx, args.campaignId, workspace._id)
    validateStatusTransition(campaign.status as CampaignStatus, args.status as CampaignStatus)

    const now = Date.now()
    await ctx.db.patch(args.campaignId, {
      status: args.status,
      updatedAt: now,
    })

    await logLeadActivity(ctx, {
      workspaceId: workspace._id,
      campaignId: args.campaignId,
      type: "campaign_status_changed",
      message: `Kampagne ${campaignStatusLabel(args.status as CampaignStatus)}`,
      userId: user.userId,
    })
  },
})

export const attachExistingLead = mutation({
  args: {
    campaignId: v.id("campaigns"),
    leadId: v.id("leads"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ campaignLeadId: Id<"campaignLeads">; alreadyAttached: boolean }> => {
    const user = await requireExistingAppUser(ctx)
    const workspace = await getWorkspaceByOwner(ctx, user.userId)
    if (!workspace) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }

    const campaign = await loadCampaignForMutation(ctx, args.campaignId, workspace._id)
    if (campaign.status === "archived") {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Archivierte Kampagnen können nicht bearbeitet werden." })
    }
    if (campaign.status === "paused") {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Pausierte Kampagnen können keine neuen Leads aufnehmen." })
    }

    const lead = await ctx.db.get(args.leadId)
    if (!lead || lead.workspaceId !== workspace._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Lead nicht gefunden." })
    }

    const result = await attachLeadToCampaign(ctx, {
      workspaceId: workspace._id,
      campaignId: args.campaignId,
      leadId: args.leadId,
      userId: user.userId,
    })

    if (!result.alreadyAttached) {
      await ctx.db.patch(args.campaignId, { updatedAt: Date.now() })
    }

    return { campaignLeadId: result.campaignLeadId as Id<"campaignLeads">, alreadyAttached: result.alreadyAttached }
  },
})

export const updateLeadStatus = mutation({
  args: {
    campaignLeadId: v.id("campaignLeads"),
    status: CampaignLeadStatusValidator,
    outcomeReason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireExistingAppUser(ctx)
    const workspace = await getWorkspaceByOwner(ctx, user.userId)
    if (!workspace) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }

    const campaignLead = await loadCampaignLeadForMutation(ctx, args.campaignLeadId, workspace._id)
    const campaign = await loadCampaignForMutation(ctx, campaignLead.campaignId, workspace._id)
    if (campaign.status === "paused" || campaign.status === "archived") {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Pausierte oder archivierte Kampagnen können nicht bearbeitet werden.",
      })
    }
    if (isTerminalStatus(campaignLead.status) && args.status !== campaignLead.status) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Gewonnene oder verlorene Leads können nicht mehr verändert werden.",
      })
    }

    const now = Date.now()
    const patch: Partial<Doc<"campaignLeads">> = {
      status: args.status,
      updatedAt: now,
    }

    if (args.status === "contacted") {
      patch.lastContactedAt = now
    }

    if (isTerminalStatus(args.status)) {
      patch.followUpAt = undefined
    }

    if (args.status === "won" || args.status === "lost") {
      patch.outcomeReason = validateOutcomeReason(args.outcomeReason)
    } else {
      patch.outcomeReason = undefined
    }

    await ctx.db.patch(args.campaignLeadId, patch)

    await ctx.db.patch(campaignLead.campaignId, { updatedAt: now })

    await logLeadActivity(ctx, {
      workspaceId: workspace._id,
      campaignId: campaignLead.campaignId,
      campaignLeadId: campaignLead._id,
      leadId: campaignLead.leadId,
      type: "status_changed",
      message: `Status geändert: ${campaignLeadStatusLabel(args.status as CampaignLeadStatus)}`,
      userId: user.userId,
    })
  },
})

export const saveLeadNote = mutation({
  args: {
    campaignLeadId: v.id("campaignLeads"),
    note: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireExistingAppUser(ctx)
    const workspace = await getWorkspaceByOwner(ctx, user.userId)
    if (!workspace) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }

    const campaignLead = await loadCampaignLeadForMutation(ctx, args.campaignLeadId, workspace._id)
    const campaign = await loadCampaignForMutation(ctx, campaignLead.campaignId, workspace._id)
    if (campaign.status === "paused" || campaign.status === "archived") {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Pausierte oder archivierte Kampagnen können nicht bearbeitet werden." })
    }

    const validated = validateNote(args.note)
    const now = Date.now()

    await ctx.db.patch(args.campaignLeadId, {
      note: validated,
      noteUpdatedAt: validated ? now : undefined,
      updatedAt: now,
    })

    await ctx.db.patch(campaignLead.campaignId, { updatedAt: now })

    await logLeadActivity(ctx, {
      workspaceId: workspace._id,
      campaignId: campaignLead.campaignId,
      campaignLeadId: campaignLead._id,
      leadId: campaignLead.leadId,
      type: "note_updated",
      message: validated ? "Notiz aktualisiert" : "Notiz entfernt",
      userId: user.userId,
    })
  },
})

export const setFollowUp = mutation({
  args: {
    campaignLeadId: v.id("campaignLeads"),
    followUpAt: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireExistingAppUser(ctx)
    const workspace = await getWorkspaceByOwner(ctx, user.userId)
    if (!workspace) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }

    const campaignLead = await loadCampaignLeadForMutation(ctx, args.campaignLeadId, workspace._id)
    const campaign = await loadCampaignForMutation(ctx, campaignLead.campaignId, workspace._id)
    if (campaign.status === "paused" || campaign.status === "archived") {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Pausierte oder archivierte Kampagnen können nicht bearbeitet werden." })
    }

    if (isTerminalStatus(campaignLead.status)) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Gewonnene oder verlorene Leads können kein Follow-up erhalten.",
      })
    }

    const now = Date.now()
    if (args.followUpAt === null) {
      await ctx.db.patch(args.campaignLeadId, {
        followUpAt: undefined,
        status: campaignLead.status === "follow_up" ? "audited" : campaignLead.status,
        updatedAt: now,
      })
      await ctx.db.patch(campaignLead.campaignId, { updatedAt: now })
      await logLeadActivity(ctx, {
        workspaceId: workspace._id,
        campaignId: campaignLead.campaignId,
        campaignLeadId: campaignLead._id,
        leadId: campaignLead.leadId,
        type: "follow_up_cleared",
        message: "Follow-up entfernt",
        userId: user.userId,
      })
      return
    }

    if (!Number.isFinite(args.followUpAt) || args.followUpAt <= 0) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Ungültiges Follow-up-Datum." })
    }

    await ctx.db.patch(args.campaignLeadId, {
      followUpAt: args.followUpAt,
      status: "follow_up",
      updatedAt: now,
    })

    await ctx.db.patch(campaignLead.campaignId, { updatedAt: now })

    await logLeadActivity(ctx, {
      workspaceId: workspace._id,
      campaignId: campaignLead.campaignId,
      campaignLeadId: campaignLead._id,
      leadId: campaignLead.leadId,
      type: "follow_up_scheduled",
      message: `Follow-up gesetzt: ${new Date(args.followUpAt).toLocaleDateString("de-DE")}`,
      userId: user.userId,
    })
  },
})

export const removeLead = mutation({
  args: {
    campaignLeadId: v.id("campaignLeads"),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireExistingAppUser(ctx)
    const workspace = await getWorkspaceByOwner(ctx, user.userId)
    if (!workspace) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }

    const campaignLead = await loadCampaignLeadForMutation(ctx, args.campaignLeadId, workspace._id)
    const campaign = await loadCampaignForMutation(ctx, campaignLead.campaignId, workspace._id)
    if (campaign.status === "paused" || campaign.status === "archived") {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Pausierte oder archivierte Kampagnen können nicht bearbeitet werden." })
    }

    const activities = await ctx.db
      .query("leadActivities")
      .withIndex("by_campaignLeadId_and_createdAt", (q) => q.eq("campaignLeadId", args.campaignLeadId))
      .collect()

    for (const activity of activities) {
      await ctx.db.delete(activity._id)
    }

    await ctx.db.delete(args.campaignLeadId)
    await ctx.db.patch(campaignLead.campaignId, { updatedAt: Date.now() })
  },
})

export const deleteCampaign = mutation({
  args: {
    campaignId: v.id("campaigns"),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireExistingAppUser(ctx)
    const workspace = await getWorkspaceByOwner(ctx, user.userId)
    if (!workspace) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }

    const campaign = await loadCampaignForMutation(ctx, args.campaignId, workspace._id)
    if (campaign.status !== "draft" && campaign.status !== "archived") {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Nur Entwürfe oder archivierte Kampagnen können gelöscht werden.",
      })
    }

    const campaignLeads = await ctx.db
      .query("campaignLeads")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .collect()

    for (const cl of campaignLeads) {
      const activities = await ctx.db
        .query("leadActivities")
        .withIndex("by_campaignLeadId_and_createdAt", (q) => q.eq("campaignLeadId", cl._id))
        .collect()
      for (const activity of activities) {
        await ctx.db.delete(activity._id)
      }
      await ctx.db.delete(cl._id)
    }

    await ctx.runMutation(internal.lead_search.deleteSnapshotsForCampaign, { campaignId: args.campaignId })

    const campaignActivities = await ctx.db
      .query("leadActivities")
      .withIndex("by_campaignId_and_createdAt", (q) => q.eq("campaignId", args.campaignId))
      .collect()
    for (const activity of campaignActivities) {
      await ctx.db.delete(activity._id)
    }

    await ctx.db.delete(args.campaignId)
  },
})

export const startAuditFromCampaign = action({
  args: {
    campaignLeadId: v.id("campaignLeads"),
    auditType: v.union(v.literal("standard"), v.literal("local"), v.literal("quick")),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args): Promise<{ auditId: Id<"audits">; status: string; domain: string; publicSlug: string }> => {
    const workspaceBootstrap = await ctx.runMutation(api.workspaces.ensureCurrentWorkspace)
    if (!workspaceBootstrap || !("workspaceId" in workspaceBootstrap) || !workspaceBootstrap.workspaceId) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }

    const campaignLead = await ctx.runQuery(internal.campaigns.getCampaignLeadForAudit, {
      campaignLeadId: args.campaignLeadId,
      workspaceId: workspaceBootstrap.workspaceId,
    })

    if (!campaignLead) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Kampagnen-Lead nicht gefunden." })
    }

    const campaign = await ctx.runQuery(internal.campaigns.getCampaignForAudit, {
      campaignId: campaignLead.campaignId,
      workspaceId: workspaceBootstrap.workspaceId,
    })
    if (!campaign) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Kampagne nicht gefunden." })
    }
    if (campaign.status !== "active") {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Audits können nur aus aktiven Kampagnen gestartet werden." })
    }

    const lead = await ctx.runQuery(internal.leads.getLeadForAudit, {
      leadId: campaignLead.leadId,
      workspaceId: workspaceBootstrap.workspaceId,
    })
    if (!lead) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Lead nicht gefunden." })
    }

    const websiteUrl = lead.normalizedWebsiteUrl ?? lead.websiteUrl
    if (!websiteUrl) {
      throw new ConvexError({
        code: "LEAD_WEBSITE_REQUIRED",
        message: "Bitte ergänze zuerst eine Website-URL für diesen Lead.",
      })
    }

    const result = await ctx.runAction(api.leads.startAuditFromLead, {
      leadId: lead._id,
      auditType: args.auditType,
      reportLanguage: campaign.language as "de" | "en",
      idempotencyKey: args.idempotencyKey,
      campaignId: campaign._id,
      campaignLeadId: campaignLead._id,
    })

    return result
  },
})

export const getCampaignLeadForAudit = internalQuery({
  args: {
    campaignLeadId: v.id("campaignLeads"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args): Promise<Doc<"campaignLeads"> | null> => {
    const campaignLead = await ctx.db.get(args.campaignLeadId)
    if (!campaignLead || campaignLead.workspaceId !== args.workspaceId) return null
    return campaignLead
  },
})

export const getCampaignForAudit = internalQuery({
  args: {
    campaignId: v.id("campaigns"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args): Promise<Doc<"campaigns"> | null> => {
    const campaign = await ctx.db.get(args.campaignId)
    if (!campaign || campaign.workspaceId !== args.workspaceId) return null
    return campaign
  },
})

export const setCampaignLeadAudited = internalMutation({
  args: {
    campaignLeadId: v.id("campaignLeads"),
  },
  handler: async (ctx, args): Promise<void> => {
    const campaignLead = await ctx.db.get(args.campaignLeadId)
    if (!campaignLead) return

    const now = Date.now()
    const status: CampaignLeadStatus =
      campaignLead.status === "new" ? "audited" : (campaignLead.status as CampaignLeadStatus)

    await ctx.db.patch(args.campaignLeadId, {
      status,
      updatedAt: now,
    })

    await ctx.db.patch(campaignLead.campaignId, { updatedAt: now })

    const user = await ctx.auth.getUserIdentity()
    if (!user) return

    const appUser = await findAppUser(ctx, user.tokenIdentifier)
    if (!appUser) return

    await logLeadActivity(ctx, {
      workspaceId: campaignLead.workspaceId,
      campaignId: campaignLead.campaignId,
      campaignLeadId: campaignLead._id,
      leadId: campaignLead.leadId,
      type: "status_changed",
      message: "Status geändert: Auditiert",
      userId: appUser._id,
    })
  },
})
