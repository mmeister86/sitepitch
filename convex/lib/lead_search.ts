export type LeadSearchInput = {
  industry: string
  city: string
  country: string
  keyword?: string
  radiusKm?: number
}

export type LeadSearchProviderName = "rapidapi" | "google_places"

export type LeadSearchResult = {
  businessName: string
  websiteUrl?: string
  normalizedWebsiteUrl?: string
  category?: string
  address?: string
  phone?: string
  businessEmail?: string
  city?: string
  country?: string
  latitude?: number
  longitude?: number
  sourceProvider: LeadSearchProviderName
  sourceId?: string
  sourceLabel: string
  auditReady: boolean
}

export type LeadSearchResponse = {
  items: LeadSearchResult[]
  provider: LeadSearchProviderName
  sourceLabel: string
  searchedAt: number
  query: string
}

export const LEAD_SEARCH_MAX_RESULTS = 20

export function buildLeadSearchQuery(input: LeadSearchInput): string {
  return [input.industry, input.city, input.country, input.keyword]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ")
}

export function normalizeLeadWebsiteUrl(value?: string): string | undefined {
  if (!value) return undefined
  const raw = value.trim()
  if (!raw) return undefined

  const hasProtocol = raw.startsWith("http://") || raw.startsWith("https://")
  const candidate = hasProtocol ? raw : raw.startsWith("//") ? `https:${raw}` : `https://${raw}`

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return undefined
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
  if (url.username || url.password) return undefined
  if (!url.hostname) return undefined

  url.hash = ""
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = ""
  }

  return url.toString()
}

type RapidApiBusinessCandidate = {
  id?: string
  name?: string
  address?: string
  full_address?: string
  city?: string
  country?: string
  website?: string
  phone?: string
  phone_number?: string
  full_phone_number?: string
  international_phone_number?: string
  formatted_phone_number?: string
  phone_numbers?: string[]
  email?: string
  emails?: string[]
  business_email?: string
  business_emails?: string[]
  types?: string[]
  categories?: string[]
  business_type?: string
  type?: string
  latitude?: number | string
  longitude?: number | string
  lat?: number | string
  lng?: number | string
  gps_coordinates?: { latitude?: number | string; longitude?: number | string; lat?: number | string; lng?: number | string }
  coordinates?: { latitude?: number | string; longitude?: number | string; lat?: number | string; lng?: number | string }
  location?: { lat?: number | string; lng?: number | string; latitude?: number | string; longitude?: number | string }
}

type RapidApiBusinessPayload = {
  data?: RapidApiBusinessCandidate[]
  results?: RapidApiBusinessCandidate[]
}

type GooglePlacesCandidate = {
  place_id?: string
  name?: string
  formatted_address?: string
  website?: string
  international_phone_number?: string
  formatted_phone_number?: string
  types?: string[]
  business_status?: string
  geometry?: { location?: { lat?: number; lng?: number } }
}

type GooglePlacesPayload = {
  status?: string
  error_message?: string
  results?: GooglePlacesCandidate[]
}

function pickFirstCategory(raw?: string[]): string | undefined {
  if (!raw || raw.length === 0) return undefined
  const first = raw.find((entry) => typeof entry === "string" && entry.trim() !== "")
  return first ?? undefined
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeBusinessEmail(value?: string): string | undefined {
  if (!value) return undefined
  const raw = value.trim().toLowerCase()
  if (!raw || !EMAIL_PATTERN.test(raw)) return undefined
  return raw
}

function firstNonEmpty(...values: Array<string | string[] | undefined | null>): string | undefined {
  for (const v of values) {
    if (Array.isArray(v)) {
      const first = v.find((entry) => typeof entry === "string" && entry.trim() !== "")
      if (first) return first.trim()
    } else if (typeof v === "string" && v.trim() !== "") {
      return v.trim()
    }
  }
  return undefined
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

type CoordContainer = {
  latitude?: number | string
  longitude?: number | string
  lat?: number | string
  lng?: number | string
} | undefined

function extractCoordinates(
  directLat?: number | string,
  directLng?: number | string,
  ...containers: CoordContainer[]
): { latitude?: number; longitude?: number } {
  for (const c of containers) {
    if (!c) continue
    const lat = toNumber(c.latitude) ?? toNumber(c.lat) ?? toNumber(directLat)
    const lng = toNumber(c.longitude) ?? toNumber(c.lng) ?? toNumber(directLng)
    if (typeof lat === "number" && typeof lng === "number") {
      return { latitude: lat, longitude: lng }
    }
  }

  const lat = toNumber(directLat)
  const lng = toNumber(directLng)
  if (typeof lat === "number" && typeof lng === "number") {
    return { latitude: lat, longitude: lng }
  }
  return {}
}

function extractRapidApiPhone(c: RapidApiBusinessCandidate): string | undefined {
  return firstNonEmpty(
    c.phone,
    c.phone_number,
    c.full_phone_number,
    c.international_phone_number,
    c.formatted_phone_number,
    c.phone_numbers,
  )
}

function extractRapidApiEmail(c: RapidApiBusinessCandidate): string | undefined {
  return normalizeBusinessEmail(
    firstNonEmpty(c.business_email, c.email, c.business_emails, c.emails),
  )
}

function extractRapidApiCoordinates(c: RapidApiBusinessCandidate): { latitude?: number; longitude?: number } {
  return extractCoordinates(
    c.latitude ?? c.lat,
    c.longitude ?? c.lng,
    c.gps_coordinates,
    c.coordinates,
    c.location,
  )
}

function mapRapidApiCandidate(candidate: RapidApiBusinessCandidate): LeadSearchResult {
  const websiteUrl = candidate.website?.trim() || undefined
  const normalizedWebsiteUrl = normalizeLeadWebsiteUrl(websiteUrl)
  const businessName = candidate.name?.trim() || "Unbekanntes Unternehmen"
  const category =
    pickFirstCategory(candidate.types) ??
    pickFirstCategory(candidate.categories) ??
    candidate.business_type?.trim() ??
    candidate.type?.trim() ??
    undefined
  const coords = extractRapidApiCoordinates(candidate)

  return {
    businessName,
    websiteUrl,
    normalizedWebsiteUrl,
    category,
    address: (candidate.address ?? candidate.full_address)?.trim() || undefined,
    phone: extractRapidApiPhone(candidate),
    businessEmail: extractRapidApiEmail(candidate),
    city: candidate.city?.trim() || undefined,
    country: candidate.country?.trim() || undefined,
    latitude: coords.latitude,
    longitude: coords.longitude,
    sourceProvider: "rapidapi",
    sourceId: candidate.id?.trim() || undefined,
    sourceLabel: "Local Business Data",
    auditReady: Boolean(normalizedWebsiteUrl),
  }
}

function mapGooglePlacesCandidate(candidate: GooglePlacesCandidate): LeadSearchResult {
  const websiteUrl = candidate.website?.trim() || undefined
  const normalizedWebsiteUrl = normalizeLeadWebsiteUrl(websiteUrl)
  const businessName = candidate.name?.trim() || "Unbekanntes Unternehmen"
  const category = pickFirstCategory(candidate.types)
  const lat = candidate.geometry?.location?.lat
  const lng = candidate.geometry?.location?.lng

  return {
    businessName,
    websiteUrl,
    normalizedWebsiteUrl,
    category,
    address: candidate.formatted_address?.trim() || undefined,
    phone:
      candidate.international_phone_number?.trim() ||
      candidate.formatted_phone_number?.trim() ||
      undefined,
    sourceProvider: "google_places",
    sourceId: candidate.place_id?.trim() || undefined,
    sourceLabel: "Google Places",
    latitude: typeof lat === "number" ? lat : undefined,
    longitude: typeof lng === "number" ? lng : undefined,
    auditReady: Boolean(normalizedWebsiteUrl),
  }
}

export function normalizeRapidApiResults(payload: unknown, limit: number): LeadSearchResult[] {
  const body = payload as RapidApiBusinessPayload
  const candidates = body.data ?? body.results ?? []
  return candidates
    .slice(0, limit)
    .map(mapRapidApiCandidate)
    .filter((result): result is LeadSearchResult => Boolean(result.businessName))
}

export function normalizeGooglePlacesResults(payload: unknown, limit: number): LeadSearchResult[] {
  const body = payload as GooglePlacesPayload
  if (body.status && body.status !== "OK" && body.status !== "ZERO_RESULTS") {
    return []
  }
  const candidates = body.results ?? []
  return candidates
    .slice(0, limit)
    .map(mapGooglePlacesCandidate)
    .filter((result): result is LeadSearchResult => Boolean(result.businessName))
}
