import { ConvexError, v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server"
import { attachLeadToCampaign, loadCampaignForMutation } from "./lib/campaigns"
import {
  normalizeBusinessEmail,
  normalizeLeadDomain,
  normalizeLeadWebsiteUrl,
} from "./lib/lead_search"
import { findAppUser, getWorkspaceByOwner, requireExistingAppUser } from "./lib/workspace"

const MAX_IMPORT_ROWS = 100
const MAX_IMPORT_BATCH_SIZE = 25
const MAX_FIELD_LENGTH = 500
const MAX_BUSINESS_NAME_LENGTH = 200

const importRowValidator = v.object({
  rowNumber: v.number(),
  businessName: v.string(),
  websiteUrl: v.optional(v.string()),
  category: v.optional(v.string()),
  city: v.optional(v.string()),
  country: v.optional(v.string()),
  address: v.optional(v.string()),
  phone: v.optional(v.string()),
  businessEmail: v.optional(v.string()),
})

export type CampaignImportRow = {
  rowNumber: number
  businessName: string
  websiteUrl?: string
  category?: string
  city?: string
  country?: string
  address?: string
  phone?: string
  businessEmail?: string
}

export type CampaignImportClassification =
  | "valid_new"
  | "duplicate_in_file"
  | "duplicate_existing"
  | "invalid"

export type CampaignImportPreviewItem = CampaignImportRow & {
  classification: CampaignImportClassification
  auditReady: boolean
  existingLeadId?: Id<"leads">
  error?: string
}

type ValidatedImportRow = CampaignImportRow & {
  normalizedWebsiteUrl?: string
  normalizedDomain?: string
  businessEmail?: string
}

function cleanOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  if (trimmed.length > MAX_FIELD_LENGTH) {
    throw new Error(`Felder dürfen maximal ${MAX_FIELD_LENGTH} Zeichen lang sein.`)
  }
  return trimmed
}

function validateImportRow(row: CampaignImportRow): { row?: ValidatedImportRow; error?: string } {
  const businessName = row.businessName.trim()
  if (!Number.isInteger(row.rowNumber) || row.rowNumber < 2) {
    return { error: "Ungültige Zeilennummer." }
  }
  if (!businessName) return { error: "Unternehmensname fehlt." }
  if (businessName.length > MAX_BUSINESS_NAME_LENGTH) {
    return { error: `Unternehmensname darf maximal ${MAX_BUSINESS_NAME_LENGTH} Zeichen lang sein.` }
  }

  try {
    const websiteUrl = cleanOptional(row.websiteUrl)
    const normalizedWebsiteUrl = normalizeLeadWebsiteUrl(websiteUrl)
    if (websiteUrl && !normalizedWebsiteUrl) return { error: "Website ist ungültig." }

    const emailInput = cleanOptional(row.businessEmail)
    const businessEmail = normalizeBusinessEmail(emailInput)
    if (emailInput && !businessEmail) return { error: "E-Mail-Adresse ist ungültig." }

    return {
      row: {
        rowNumber: row.rowNumber,
        businessName,
        websiteUrl,
        normalizedWebsiteUrl,
        normalizedDomain: normalizeLeadDomain(normalizedWebsiteUrl),
        category: cleanOptional(row.category),
        city: cleanOptional(row.city),
        country: cleanOptional(row.country),
        address: cleanOptional(row.address),
        phone: cleanOptional(row.phone),
        businessEmail,
      },
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Zeile ist ungültig." }
  }
}

async function requireCampaignContext(
  ctx: QueryCtx | MutationCtx,
  campaignId: Id<"campaigns">,
): Promise<{ workspaceId: Id<"workspaces">; userId: Id<"users">; campaign: Doc<"campaigns"> }> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Bitte melde dich an." })
  }
  const user = await findAppUser(ctx, identity.tokenIdentifier)
  if (!user) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Benutzerkonto nicht gefunden." })
  }
  const workspace = await getWorkspaceByOwner(ctx, user._id)
  if (!workspace) {
    throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
  }
  const campaign = await ctx.db.get(campaignId)
  if (!campaign || campaign.workspaceId !== workspace._id) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Kampagne nicht gefunden." })
  }
  if (campaign.status === "paused" || campaign.status === "archived") {
    throw new ConvexError({
      code: "VALIDATION_ERROR",
      message: "Nur Entwürfe und aktive Kampagnen können neue Leads aufnehmen.",
    })
  }
  return { workspaceId: workspace._id, userId: user._id, campaign }
}

async function findLeadByDomain(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  normalizedDomain: string | undefined,
): Promise<Doc<"leads"> | null> {
  if (!normalizedDomain) return null
  const matches = await ctx.db
    .query("leads")
    .withIndex("by_workspaceId_and_normalizedDomain", (q) =>
      q.eq("workspaceId", workspaceId).eq("normalizedDomain", normalizedDomain),
    )
    .take(1)
  return matches[0] ?? null
}

export const previewLeadImport = query({
  args: {
    campaignId: v.id("campaigns"),
    rows: v.array(importRowValidator),
  },
  handler: async (ctx, args): Promise<{ items: CampaignImportPreviewItem[] }> => {
    if (args.rows.length > MAX_IMPORT_ROWS) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: `Maximal ${MAX_IMPORT_ROWS} Zeilen pro CSV-Datei.`,
      })
    }
    const { workspaceId } = await requireCampaignContext(ctx, args.campaignId)
    const seenDomains = new Set<string>()
    const items: CampaignImportPreviewItem[] = []

    for (const input of args.rows) {
      const validated = validateImportRow(input)
      if (!validated.row) {
        items.push({ ...input, classification: "invalid", auditReady: false, error: validated.error })
        continue
      }
      const row = validated.row
      if (row.normalizedDomain && seenDomains.has(row.normalizedDomain)) {
        items.push({ ...input, classification: "duplicate_in_file", auditReady: true })
        continue
      }
      if (row.normalizedDomain) seenDomains.add(row.normalizedDomain)

      const existing = await findLeadByDomain(ctx, workspaceId, row.normalizedDomain)
      items.push({
        ...input,
        classification: existing ? "duplicate_existing" : "valid_new",
        auditReady: Boolean(row.normalizedWebsiteUrl),
        existingLeadId: existing?._id,
      })
    }

    return { items }
  },
})

function mergeMissingLeadFields(existing: Doc<"leads">, row: ValidatedImportRow): Partial<Doc<"leads">> {
  const patch: Partial<Doc<"leads">> = { updatedAt: Date.now() }
  if (!existing.websiteUrl && row.websiteUrl) patch.websiteUrl = row.websiteUrl
  if (!existing.normalizedWebsiteUrl && row.normalizedWebsiteUrl) {
    patch.normalizedWebsiteUrl = row.normalizedWebsiteUrl
  }
  if (!existing.normalizedDomain && row.normalizedDomain) patch.normalizedDomain = row.normalizedDomain
  if (!existing.category && row.category) patch.category = row.category
  if (!existing.city && row.city) patch.city = row.city
  if (!existing.country && row.country) patch.country = row.country
  if (!existing.address && row.address) patch.address = row.address
  if (!existing.phone && row.phone) patch.phone = row.phone
  if (!existing.businessEmail && row.businessEmail) patch.businessEmail = row.businessEmail
  return patch
}

async function insertLead(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">
    userId: Id<"users">
    row: ValidatedImportRow
    sourceProvider: "manual" | "csv" | "google_sheets"
    sourceId?: string
  },
): Promise<Id<"leads">> {
  const now = Date.now()
  const leadId = await ctx.db.insert("leads", {
    workspaceId: args.workspaceId,
    businessName: args.row.businessName,
    websiteUrl: args.row.websiteUrl,
    normalizedWebsiteUrl: args.row.normalizedWebsiteUrl,
    normalizedDomain: args.row.normalizedDomain,
    category: args.row.category,
    city: args.row.city,
    country: args.row.country,
    address: args.row.address,
    phone: args.row.phone,
    businessEmail: args.row.businessEmail,
    sourceProvider: args.sourceProvider,
    sourceId: args.sourceId,
    status: "new",
    createdAt: now,
    updatedAt: now,
  })
  await ctx.db.insert("usageEvents", {
    workspaceId: args.workspaceId,
    userId: args.userId,
    event: "lead_saved",
    idempotencyKey: `lead_saved:${leadId}`,
    metadata: { source: args.sourceProvider },
    createdAt: now,
  })
  return leadId
}

export const createManualLead = mutation({
  args: {
    campaignId: v.id("campaigns"),
    businessName: v.string(),
    websiteUrl: v.optional(v.string()),
    category: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    businessEmail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ leadId: Id<"leads">; reused: boolean }> => {
    const authUser = await requireExistingAppUser(ctx)
    const workspace = await getWorkspaceByOwner(ctx, authUser.userId)
    if (!workspace) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }
    const campaign = await loadCampaignForMutation(ctx, args.campaignId, workspace._id)
    if (campaign.status === "paused" || campaign.status === "archived") {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Nur Entwürfe und aktive Kampagnen können neue Leads aufnehmen.",
      })
    }

    const validated = validateImportRow({ rowNumber: 2, ...args })
    if (!validated.row) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: validated.error ?? "Lead ist ungültig." })
    }
    const existing = await findLeadByDomain(ctx, workspace._id, validated.row.normalizedDomain)
    const leadId = existing
      ? existing._id
      : await insertLead(ctx, {
          workspaceId: workspace._id,
          userId: authUser.userId,
          row: validated.row,
          sourceProvider: "manual",
        })
    if (existing) await ctx.db.patch(existing._id, mergeMissingLeadFields(existing, validated.row))

    const attached = await attachLeadToCampaign(ctx, {
      workspaceId: workspace._id,
      campaignId: args.campaignId,
      leadId,
      userId: authUser.userId,
    })
    if (!attached.alreadyAttached) await ctx.db.patch(args.campaignId, { updatedAt: Date.now() })
    return { leadId, reused: Boolean(existing) }
  },
})

export const importLeadBatch = mutation({
  args: {
    campaignId: v.id("campaigns"),
    importId: v.string(),
    sourceProvider: v.optional(v.union(v.literal("csv"), v.literal("google_sheets"))),
    rows: v.array(importRowValidator),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    created: number
    reused: number
    attached: number
    skipped: number
    items: Array<{
      rowNumber: number
      status: "created" | "reused" | "skipped"
      attached: boolean
      leadId?: Id<"leads">
      error?: string
    }>
  }> => {
    if (args.rows.length === 0 || args.rows.length > MAX_IMPORT_BATCH_SIZE) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: `Import-Batches müssen 1 bis ${MAX_IMPORT_BATCH_SIZE} Zeilen enthalten.`,
      })
    }
    const importId = args.importId.trim()
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(importId)) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Ungültige Import-ID." })
    }
    const { workspaceId, userId } = await requireCampaignContext(ctx, args.campaignId)
    const seenDomains = new Set<string>()
    let created = 0
    let reused = 0
    let attached = 0
    let skipped = 0
    const items: Array<{
      rowNumber: number
      status: "created" | "reused" | "skipped"
      attached: boolean
      leadId?: Id<"leads">
      error?: string
    }> = []

    for (const input of args.rows) {
      const validated = validateImportRow(input)
      if (!validated.row) {
        skipped++
        items.push({
          rowNumber: input.rowNumber,
          status: "skipped",
          attached: false,
          error: validated.error,
        })
        continue
      }
      const row = validated.row
      if (row.normalizedDomain && seenDomains.has(row.normalizedDomain)) {
        skipped++
        items.push({
          rowNumber: row.rowNumber,
          status: "skipped",
          attached: false,
          error: "Domain ist in diesem Batch bereits enthalten.",
        })
        continue
      }
      if (row.normalizedDomain) seenDomains.add(row.normalizedDomain)

      const sourceProvider = args.sourceProvider ?? "csv"
      const sourceId = `${importId}:${row.rowNumber}`
      let lead = await findLeadByDomain(ctx, workspaceId, row.normalizedDomain)
      if (!lead) {
        lead = await ctx.db
          .query("leads")
          .withIndex("by_workspaceId_and_sourceProvider_and_sourceId", (q) =>
            q.eq("workspaceId", workspaceId).eq("sourceProvider", sourceProvider).eq("sourceId", sourceId),
          )
          .unique()
      }

      let leadId: Id<"leads">
      let rowStatus: "created" | "reused"
      if (lead) {
        leadId = lead._id
        reused++
        rowStatus = "reused"
        await ctx.db.patch(lead._id, mergeMissingLeadFields(lead, row))
      } else {
        leadId = await insertLead(ctx, {
          workspaceId,
          userId,
          row,
          sourceProvider,
          sourceId,
        })
        created++
        rowStatus = "created"
      }

      const result = await attachLeadToCampaign(ctx, {
        workspaceId,
        campaignId: args.campaignId,
        leadId,
        userId,
      })
      if (!result.alreadyAttached) attached++
      items.push({
        rowNumber: row.rowNumber,
        status: rowStatus,
        attached: !result.alreadyAttached,
        leadId,
      })
    }

    if (attached > 0) await ctx.db.patch(args.campaignId, { updatedAt: Date.now() })
    return { created, reused, attached, skipped, items }
  },
})
