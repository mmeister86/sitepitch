import { ConvexError, v } from "convex/values"

import { action, env, internalMutation, internalQuery, query } from "./_generated/server"
import type { ActionCtx } from "./_generated/server"
import { api, internal } from "./_generated/api"
import { checkLeadSearchLimit, checkProviderLimit } from "./lib/audit_rate_limit"
import {
  buildLeadSearchQuery,
  LEAD_SEARCH_MAX_RESULTS,
  normalizeGooglePlacesResults,
  normalizeRapidApiResults,
  type LeadSearchInput,
  type LeadSearchResponse,
  type LeadSearchResult,
} from "./lib/lead_search"
import { redactSensitiveText } from "./lib/audit_pipeline"
import { findAppUser, getWorkspaceByOwner } from "./lib/workspace"
import type { Doc, Id } from "./_generated/dataModel"

const GEOCODE_MAX_LOOKUPS = 5

async function geocodeAddress(
  address: string,
  apiKey: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
  url.searchParams.set("address", address)
  url.searchParams.set("key", apiKey)

  try {
    const response = await fetchProviderJson(url.toString(), { accept: "application/json" }, 10_000)
    const body = response.body as {
      status?: string
      results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>
    }
    if (body.status !== "OK" || !body.results?.length) return null
    const loc = body.results[0]?.geometry?.location
    if (typeof loc?.lat === "number" && typeof loc?.lng === "number") {
      return { latitude: loc.lat, longitude: loc.lng }
    }
    return null
  } catch {
    return null
  }
}

async function fillMissingCoordinates(
  ctx: ActionCtx,
  items: LeadSearchResult[],
): Promise<LeadSearchResult[]> {
  const googleKey = env.GOOGLE_PLACES_API_KEY
  if (!googleKey) return items

  const needGeocoding = items.filter((item) => !item.latitude && !item.longitude && item.address)
  if (needGeocoding.length === 0) return items

  let geocoded = 0
  for (const item of needGeocoding) {
    if (geocoded >= GEOCODE_MAX_LOOKUPS) break
    try {
      await checkProviderLimit(ctx, { kind: "businessData", provider: "google_places" })
    } catch {
      break
    }
    geocoded++
    const coords = await geocodeAddress(item.address!, googleKey)
    if (coords) {
      item.latitude = coords.latitude
      item.longitude = coords.longitude
    }
  }

  return items
}

type ProviderHttpResponse = {
  status: number
  body: unknown
}

async function fetchProviderJson(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<ProviderHttpResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    })
    const body = await response.json()
    return { status: response.status, body }
  } finally {
    clearTimeout(timeoutId)
  }
}

async function searchRapidApiLocalBusinessData(
  ctx: ActionCtx,
  query: string,
  limit: number,
): Promise<LeadSearchResponse> {
  const apiKey = env.LOCAL_BUSINESS_DATA_API_KEY
  if (!apiKey) return null as unknown as LeadSearchResponse

  await checkProviderLimit(ctx, { kind: "businessData", provider: "local_business_data" })

  const url = new URL("https://local-business-data.p.rapidapi.com/search")
  url.searchParams.set("query", query)
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("language", "de")
  url.searchParams.set("region", "de")
  url.searchParams.set("extract_emails_and_contacts", "true")

  const response = await fetchProviderJson(
    url.toString(),
    {
      accept: "application/json",
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": "local-business-data.p.rapidapi.com",
    },
    20_000,
  )

  if (response.status >= 400) {
    throw new ConvexError({
      code: "LEAD_SEARCH_PROVIDER_ERROR",
      message: "Die Lead-Suche ist gerade nicht erreichbar. Deine gespeicherten Leads bleiben erhalten.",
    })
  }

  const items = normalizeRapidApiResults(response.body, limit)
  return {
    items,
    provider: "rapidapi",
    sourceLabel: "Local Business Data",
    searchedAt: Date.now(),
    query,
  }
}

async function searchGooglePlaces(
  ctx: ActionCtx,
  query: string,
  limit: number,
): Promise<LeadSearchResponse> {
  const apiKey = env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return null as unknown as LeadSearchResponse

  await checkProviderLimit(ctx, { kind: "businessData", provider: "google_places" })

  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json")
  url.searchParams.set("query", query)
  url.searchParams.set("key", apiKey)

  const response = await fetchProviderJson(
    url.toString(),
    { accept: "application/json" },
    20_000,
  )

  if (response.status >= 400) {
    throw new ConvexError({
      code: "LEAD_SEARCH_PROVIDER_ERROR",
      message: "Die Lead-Suche ist gerade nicht erreichbar. Deine gespeicherten Leads bleiben erhalten.",
    })
  }

  const body = response.body as { status?: string; error_message?: string }
  if (body.status && body.status !== "OK" && body.status !== "ZERO_RESULTS") {
    throw new ConvexError({
      code: "LEAD_SEARCH_PROVIDER_ERROR",
      message: "Die Lead-Suche ist gerade nicht erreichbar. Deine gespeicherten Leads bleiben erhalten.",
    })
  }

  const items = normalizeGooglePlacesResults(response.body, limit)
  return {
    items,
    provider: "google_places",
    sourceLabel: "Google Places",
    searchedAt: Date.now(),
    query,
  }
}

export const searchLocalBusinesses = action({
  args: {
    industry: v.string(),
    city: v.string(),
    country: v.string(),
    keyword: v.optional(v.string()),
    radiusKm: v.optional(v.number()),
    campaignId: v.optional(v.id("campaigns")),
  },
  handler: async (ctx, args): Promise<LeadSearchResponse> => {
    const industry = args.industry.trim()
    const city = args.city.trim()
    const country = args.country.trim()

    if (!industry || !city || !country) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Bitte fülle Branche, Stadt und Land aus.",
      })
    }

    const input: LeadSearchInput = {
      industry,
      city,
      country,
      keyword: args.keyword?.trim() || undefined,
      radiusKm: args.radiusKm,
    }
    const query = buildLeadSearchQuery(input)

    const workspaceBootstrap = await ctx.runMutation(api.workspaces.ensureCurrentWorkspace)
    if (!workspaceBootstrap || !("workspaceId" in workspaceBootstrap) || !workspaceBootstrap.workspaceId) {
      throw new ConvexError({ code: "WORKSPACE_NOT_READY", message: "Workspace not ready" })
    }

    const workspaceId = workspaceBootstrap.workspaceId

    await checkLeadSearchLimit(ctx, { workspaceId })

    const rapidApiKey = env.LOCAL_BUSINESS_DATA_API_KEY
    const googleKey = env.GOOGLE_PLACES_API_KEY

    if (!rapidApiKey && !googleKey) {
      throw new ConvexError({
        code: "LEAD_SEARCH_NOT_CONFIGURED",
        message: "Die Lead-Suche ist noch nicht konfiguriert. Deine gespeicherten Leads bleiben verfügbar.",
      })
    }

    let result: LeadSearchResponse | null = null
    try {
      if (rapidApiKey) {
        result = await searchRapidApiLocalBusinessData(ctx, query, LEAD_SEARCH_MAX_RESULTS)
      } else if (googleKey) {
        result = await searchGooglePlaces(ctx, query, LEAD_SEARCH_MAX_RESULTS)
      }
    } catch (error) {
      if (error instanceof ConvexError) throw error
      console.warn(
        "Lead search provider failed",
        redactSensitiveText(error instanceof Error ? error.message : String(error)),
      )
      throw new ConvexError({
        code: "LEAD_SEARCH_PROVIDER_ERROR",
        message: "Die Lead-Suche ist gerade nicht erreichbar. Deine gespeicherten Leads bleiben erhalten.",
      })
    }

    if (!result) {
      throw new ConvexError({
        code: "LEAD_SEARCH_PROVIDER_ERROR",
        message: "Die Lead-Suche ist gerade nicht erreichbar. Deine gespeicherten Leads bleiben erhalten.",
      })
    }

    try {
      result.items = await fillMissingCoordinates(ctx, result.items)
    } catch (error) {
      console.warn(
        "Geocoding fallback failed",
        redactSensitiveText(error instanceof Error ? error.message : String(error)),
      )
    }

    try {
      await ctx.runMutation(internal.leads.logLeadSearchStarted, {
        workspaceId,
        provider: result.provider,
        resultCount: result.items.length,
      })
    } catch {
      // usage logging must never break search
    }

    try {
      await ctx.runMutation(internal.lead_search.saveSnapshot, {
        workspaceId,
        campaignId: args.campaignId,
        industry,
        city,
        country,
        keyword: input.keyword,
        radiusKm: input.radiusKm,
        provider: result.provider,
        sourceLabel: result.sourceLabel,
        items: result.items,
        searchedAt: result.searchedAt,
      })
    } catch (error) {
      // snapshot must never break the search
      console.warn(
        "Lead search snapshot failed",
        redactSensitiveText(error instanceof Error ? error.message : String(error)),
      )
    }

    return result
  },
})

export const saveSnapshot = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    campaignId: v.optional(v.id("campaigns")),
    industry: v.string(),
    city: v.string(),
    country: v.string(),
    keyword: v.optional(v.string()),
    radiusKm: v.optional(v.number()),
    provider: v.union(v.literal("rapidapi"), v.literal("google_places")),
    sourceLabel: v.string(),
    items: v.array(
      v.object({
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
        sourceProvider: v.union(v.literal("rapidapi"), v.literal("google_places")),
        sourceId: v.optional(v.string()),
        sourceLabel: v.string(),
        auditReady: v.boolean(),
      }),
    ),
    searchedAt: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    if (args.campaignId) {
      const campaign = await ctx.db.get(args.campaignId)
      if (!campaign || campaign.workspaceId !== args.workspaceId) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Kampagne nicht gefunden." })
      }
    }

    const existing = args.campaignId
      ? await ctx.db
          .query("leadSearchSnapshots")
          .withIndex("by_workspaceId_and_campaignId", (q) =>
            q.eq("workspaceId", args.workspaceId).eq("campaignId", args.campaignId),
          )
          .unique()
      : await ctx.db
          .query("leadSearchSnapshots")
          .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
          .unique()

    const now = Date.now()
    const snapshot = {
      workspaceId: args.workspaceId,
      campaignId: args.campaignId,
      industry: args.industry,
      city: args.city,
      country: args.country,
      keyword: args.keyword,
      radiusKm: args.radiusKm,
      provider: args.provider,
      sourceLabel: args.sourceLabel,
      resultCount: args.items.length,
      items: args.items,
      searchedAt: args.searchedAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    if (existing) {
      await ctx.db.replace(existing._id, snapshot)
    } else {
      await ctx.db.insert("leadSearchSnapshots", snapshot)
    }
  },
})

export const getLatestSnapshot = query({
  args: {
    campaignId: v.optional(v.id("campaigns")),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | {
        snapshotId: Id<"leadSearchSnapshots">
        campaignId?: Id<"campaigns">
        industry: string
        city: string
        country: string
        keyword?: string
        radiusKm?: number
        provider: string
        sourceLabel: string
        resultCount: number
        items: LeadSearchResult[]
        searchedAt: number
        updatedAt: number
        savedKeys: string[]
        campaignLeadKeys: string[]
      }
    | null
  > => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const user = await findAppUser(ctx, identity.tokenIdentifier)
    if (!user) return null

    const workspace = await getWorkspaceByOwner(ctx, user._id)
    if (!workspace) return null

    if (args.campaignId) {
      const campaign = await ctx.db.get(args.campaignId)
      if (!campaign || campaign.workspaceId !== workspace._id) return null
    }

    const snapshot = args.campaignId
      ? await ctx.db
          .query("leadSearchSnapshots")
          .withIndex("by_workspaceId_and_campaignId", (q) =>
            q.eq("workspaceId", workspace._id).eq("campaignId", args.campaignId),
          )
          .order("desc")
          .first()
      : await ctx.db
          .query("leadSearchSnapshots")
          .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspace._id))
          .order("desc")
          .first()

    if (!snapshot) return null

    const savedKeys: string[] = []
    const campaignLeadKeys: string[] = []

    for (const item of snapshot.items) {
      const key = `${item.sourceProvider}-${item.sourceId ?? ""}`
      if (item.sourceId) {
        const existing = await ctx.db
          .query("leads")
          .withIndex("by_workspaceId_and_sourceProvider_and_sourceId", (q) =>
            q.eq("workspaceId", workspace._id).eq("sourceProvider", item.sourceProvider).eq("sourceId", item.sourceId),
          )
          .unique()
        if (existing) {
          savedKeys.push(key)
          if (args.campaignId) {
            const campaignLead = await ctx.db
              .query("campaignLeads")
              .withIndex("by_campaignId_and_leadId", (q) =>
                q.eq("campaignId", args.campaignId as Id<"campaigns">).eq("leadId", existing._id),
              )
              .unique()
            if (campaignLead) {
              campaignLeadKeys.push(key)
            }
          }
        }
      }
    }

    return {
      snapshotId: snapshot._id,
      campaignId: snapshot.campaignId ?? undefined,
      industry: snapshot.industry,
      city: snapshot.city,
      country: snapshot.country,
      keyword: snapshot.keyword ?? undefined,
      radiusKm: snapshot.radiusKm ?? undefined,
      provider: snapshot.provider,
      sourceLabel: snapshot.sourceLabel,
      resultCount: snapshot.resultCount,
      items: snapshot.items as LeadSearchResult[],
      searchedAt: snapshot.searchedAt,
      updatedAt: snapshot.updatedAt,
      savedKeys,
      campaignLeadKeys,
    }
  },
})

export const deleteSnapshotsForCampaign = internalMutation({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args): Promise<void> => {
    const snapshots = await ctx.db
      .query("leadSearchSnapshots")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .take(100)

    for (const snapshot of snapshots) {
      await ctx.db.delete(snapshot._id)
    }
  },
})
