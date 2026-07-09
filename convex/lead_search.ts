"use node"

import { ConvexError, v } from "convex/values"

import { action, env } from "./_generated/server"
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
        query,
        provider: result.provider,
        resultCount: result.items.length,
      })
    } catch {
      // usage logging must never break search
    }

    return result
  },
})
