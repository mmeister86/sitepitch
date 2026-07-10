import { ConvexError, v } from "convex/values"

import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server"
import type { Id, Doc } from "./_generated/dataModel"
import { api, internal } from "./_generated/api"
import { findAppUser, getWorkspaceByOwner, requireExistingAppUser } from "./lib/workspace"
import { normalizeLeadWebsiteUrl, normalizeBusinessEmail } from "./lib/lead_search"
import { attachLeadToCampaign } from "./lib/campaigns"

export type LeadListItem = {
  _id: Id<"leads">
  businessName: string
  websiteUrl?: string
  normalizedWebsiteUrl?: string
  category?: string
  city?: string
  country?: string
  address?: string
  phone?: string
  businessEmail?: string
  latitude?: number
  longitude?: number
  sourceProvider: string
  sourceId?: string
  status: string
  auditId?: Id<"audits">
  auditReady: boolean
  audit?: {
    _id: Id<"audits">
    status: string
    domain: string
    overallScore?: number
    publicSlug: string
  } | null
  createdAt: number
  updatedAt: number
}

export const listMyLeads = query({
  args: {},
  handler: async (ctx): Promise<{ items: LeadListItem[]; total: number } | null> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const user = await findAppUser(ctx, identity.tokenIdentifier)
    if (!user) return null

    const workspace = await getWorkspaceByOwner(ctx, user._id)
    if (!workspace) return null

    const leads = await ctx.db
      .query("leads")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspace._id))
      .order("desc")
      .take(100)

    const items = await Promise.all(
      leads.map(async (lead): Promise<LeadListItem> => {
        let audit: LeadListItem["audit"] = null
        if (lead.auditId) {
          const auditDoc = await ctx.db.get(lead.auditId)
          if (auditDoc) {
            audit = {
              _id: auditDoc._id,
              status: auditDoc.status,
              domain: auditDoc.domain,
              overallScore: auditDoc.overallScore,
              publicSlug: auditDoc.publicSlug,
            }
          }
        }

        return {
          _id: lead._id,
          businessName: lead.businessName,
          websiteUrl: lead.websiteUrl,
          normalizedWebsiteUrl: lead.normalizedWebsiteUrl,
          category: lead.category,
          city: lead.city,
          country: lead.country,
          address: lead.address,
          phone: lead.phone,
          businessEmail: lead.businessEmail,
          latitude: lead.latitude,
          longitude: lead.longitude,
          sourceProvider: lead.sourceProvider,
          sourceId: lead.sourceId,
          status: lead.status,
          auditId: lead.auditId,
          auditReady: Boolean(lead.normalizedWebsiteUrl || lead.websiteUrl),
          audit,
          createdAt: lead.createdAt,
          updatedAt: lead.updatedAt,
        }
      }),
    )

    return { items, total: leads.length }
  },
})

export const saveLeadFromSearch = mutation({
  args: {
    businessName: v.string(),
    websiteUrl: v.optional(v.string()),
    normalizedWebsiteUrl: v.optional(v.string()),
    category: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    businessEmail: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    sourceProvider: v.union(
      v.literal("rapidapi"),
      v.literal("google_places"),
      v.literal("manual"),
      v.literal("serpapi"),
      v.literal("dataforseo"),
      v.literal("apify"),
    ),
    sourceId: v.optional(v.string()),
    sourceLabel: v.optional(v.string()),
    campaignId: v.optional(v.id("campaigns")),
  },
  handler: async (ctx, args): Promise<Id<"leads">> => {
    const user = await requireExistingAppUser(ctx)
    const workspace = await getWorkspaceByOwner(ctx, user.userId)
    if (!workspace) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }

    let campaignId: Id<"campaigns"> | undefined = args.campaignId
    if (campaignId) {
      const campaign = await ctx.db.get(campaignId)
      if (!campaign || campaign.workspaceId !== workspace._id) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Kampagne nicht gefunden." })
      }
      if (campaign.status === "archived") {
        throw new ConvexError({ code: "VALIDATION_ERROR", message: "Archivierte Kampagnen können nicht bearbeitet werden." })
      }
      if (campaign.status === "paused") {
        throw new ConvexError({ code: "VALIDATION_ERROR", message: "Pausierte Kampagnen können keine neuen Leads aufnehmen." })
      }
    }

    const businessName = args.businessName.trim()
    if (!businessName) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Ein Unternehmensname ist erforderlich." })
    }

    const normalizedWebsiteUrl = normalizeLeadWebsiteUrl(args.websiteUrl) ?? undefined
    const now = Date.now()

    if (args.sourceId) {
      const existing = await ctx.db
        .query("leads")
        .withIndex("by_workspaceId_and_sourceProvider_and_sourceId", (q) =>
          q
            .eq("workspaceId", workspace._id)
            .eq("sourceProvider", args.sourceProvider)
            .eq("sourceId", args.sourceId),
        )
        .unique()

      if (existing) {
        const patch: Partial<Doc<"leads">> = {
          businessName,
          category: args.category,
          city: args.city,
          country: args.country,
          address: args.address,
          phone: args.phone,
          updatedAt: now,
        }
        if (args.businessEmail && !existing.businessEmail) {
          patch.businessEmail = args.businessEmail
        }
        if (typeof args.latitude === "number" && typeof existing.latitude !== "number") {
          patch.latitude = args.latitude
        }
        if (typeof args.longitude === "number" && typeof existing.longitude !== "number") {
          patch.longitude = args.longitude
        }
        if (normalizedWebsiteUrl && !existing.normalizedWebsiteUrl && !existing.websiteUrl) {
          patch.websiteUrl = args.websiteUrl
          patch.normalizedWebsiteUrl = normalizedWebsiteUrl
        }
        await ctx.db.patch(existing._id, patch)

        if (campaignId) {
          await attachLeadToCampaign(ctx, {
            workspaceId: workspace._id,
            campaignId,
            leadId: existing._id,
            userId: user.userId,
          })
          await ctx.db.patch(campaignId, { updatedAt: now })
        }

        return existing._id
      }
    }

    const leadId = await ctx.db.insert("leads", {
      workspaceId: workspace._id,
      businessName,
      websiteUrl: args.websiteUrl,
      normalizedWebsiteUrl,
      category: args.category,
      city: args.city,
      country: args.country,
      address: args.address,
      phone: args.phone,
      businessEmail: args.businessEmail,
      latitude: args.latitude,
      longitude: args.longitude,
      sourceProvider: args.sourceProvider,
      sourceId: args.sourceId,
      status: "new",
      createdAt: now,
      updatedAt: now,
    })

    if (campaignId) {
      await attachLeadToCampaign(ctx, {
        workspaceId: workspace._id,
        campaignId,
        leadId,
        userId: user.userId,
      })
      await ctx.db.patch(campaignId, { updatedAt: now })
    }

    return leadId
  },
})

export const updateLeadWebsite = mutation({
  args: {
    leadId: v.id("leads"),
    websiteUrl: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireExistingAppUser(ctx)
    const workspace = await getWorkspaceByOwner(ctx, user.userId)
    if (!workspace) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }

    const lead = await ctx.db.get(args.leadId)
    if (!lead || lead.workspaceId !== workspace._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Lead nicht gefunden." })
    }

    const websiteUrl = args.websiteUrl.trim()
    if (!websiteUrl) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Bitte gib eine gültige Website-URL ein.",
      })
    }

    const normalizedWebsiteUrl = normalizeLeadWebsiteUrl(websiteUrl)
    if (!normalizedWebsiteUrl) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Bitte gib eine gültige Website-URL ein.",
      })
    }

    await ctx.db.patch(args.leadId, {
      websiteUrl,
      normalizedWebsiteUrl,
      updatedAt: Date.now(),
    })
  },
})

export const updateLeadProfile = mutation({
  args: {
    leadId: v.id("leads"),
    businessName: v.optional(v.string()),
    category: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    businessEmail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireExistingAppUser(ctx)
    const workspace = await getWorkspaceByOwner(ctx, user.userId)
    if (!workspace) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }

    const lead = await ctx.db.get(args.leadId)
    if (!lead || lead.workspaceId !== workspace._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Lead nicht gefunden." })
    }

    const businessName = args.businessName?.trim() ?? lead.businessName
    if (!businessName) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Ein Unternehmensname ist erforderlich.",
      })
    }

    const businessEmail = normalizeBusinessEmail(args.businessEmail)

    const patch: Partial<Doc<"leads">> = {
      businessName,
      category: args.category?.trim() || undefined,
      city: args.city?.trim() || undefined,
      country: args.country?.trim() || undefined,
      address: args.address?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      businessEmail,
      updatedAt: Date.now(),
    }

    await ctx.db.patch(args.leadId, patch)
  },
})

export const deleteLead = mutation({
  args: { leadId: v.id("leads") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireExistingAppUser(ctx)
    const workspace = await getWorkspaceByOwner(ctx, user.userId)
    if (!workspace) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }

    const lead = await ctx.db.get(args.leadId)
    if (!lead || lead.workspaceId !== workspace._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Lead nicht gefunden." })
    }

    if (lead.auditId) {
      const audit = await ctx.db.get(lead.auditId)
      if (audit && audit.workspaceId === workspace._id && audit.leadId === lead._id) {
        await ctx.db.patch(audit._id, {
          leadId: undefined,
          updatedAt: Date.now(),
        })
      }
    }

    const campaignLeads = await ctx.db
      .query("campaignLeads")
      .withIndex("by_workspaceId_and_leadId", (q) => q.eq("workspaceId", workspace._id).eq("leadId", args.leadId))
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

    await ctx.db.delete(args.leadId)
  },
})

export const getLeadForAudit = internalQuery({
  args: {
    leadId: v.id("leads"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args): Promise<Doc<"leads"> | null> => {
    const lead = await ctx.db.get(args.leadId)
    if (!lead || lead.workspaceId !== args.workspaceId) return null
    return lead
  },
})

export const logLeadSearchStarted = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    provider: v.union(v.literal("rapidapi"), v.literal("google_places")),
    resultCount: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    await ctx.db.insert("usageEvents", {
      workspaceId: args.workspaceId,
      event: "lead_search_started",
      metadata: {
        query: args.query,
        provider: args.provider,
        resultCount: args.resultCount,
      },
      createdAt: now,
    })
  },
})

type LeadAuditStartResult = {
  auditId: Id<"audits">
  status: "queued"
  normalizedUrl: string
  domain: string
  publicSlug: string
}

export const startAuditFromLead = action({
  args: {
    leadId: v.id("leads"),
    auditType: v.union(v.literal("standard"), v.literal("local"), v.literal("quick")),
    reportLanguage: v.union(v.literal("de"), v.literal("en")),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args): Promise<LeadAuditStartResult> => {
    const workspaceBootstrap = await ctx.runMutation(api.workspaces.ensureCurrentWorkspace)
    if (!workspaceBootstrap || !("workspaceId" in workspaceBootstrap) || !workspaceBootstrap.workspaceId) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }

    const lead = await ctx.runQuery(internal.leads.getLeadForAudit, {
      leadId: args.leadId,
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

    return await ctx.runAction(api.audits.startAudit, {
      url: websiteUrl,
      auditType: args.auditType,
      reportLanguage: args.reportLanguage,
      idempotencyKey: args.idempotencyKey,
      leadId: args.leadId,
    })
  },
})
