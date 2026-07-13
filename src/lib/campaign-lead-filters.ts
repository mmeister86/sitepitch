export type CampaignScoreFilter =
  | "all"
  | "under-40"
  | "40-59"
  | "60-74"
  | "75-plus"
  | "without-audit"

export type CampaignReportFilter = "all" | "opened" | "not-opened"
export type CampaignLastContactFilter =
  | "all"
  | "never"
  | "last-7-days"
  | "days-8-30"
  | "older-30-days"
export type CampaignLeadSort = "priority" | "updated" | "name" | "score"

export type CampaignLeadFilterState = {
  search: string
  category: string
  city: string
  score: CampaignScoreFilter
  status: string
  report: CampaignReportFilter
  lastContact: CampaignLastContactFilter
  auditReadyOnly: boolean
  followUpDueOnly: boolean
}

export type FilterableCampaignLead = {
  businessName: string
  websiteUrl?: string
  category?: string
  city?: string
  status: string
  auditReady: boolean
  lastContactedAt?: number
  followUpAt?: number
  updatedAt: number
  audit?: {
    overallScore?: number
    viewCount?: number
  } | null
}

export const defaultCampaignLeadFilters: CampaignLeadFilterState = {
  search: "",
  category: "all",
  city: "all",
  score: "all",
  status: "all",
  report: "all",
  lastContact: "all",
  auditReadyOnly: false,
  followUpDueOnly: false,
}

const DAY_MS = 24 * 60 * 60 * 1000

function matchesScore(score: number | undefined, filter: CampaignScoreFilter): boolean {
  if (filter === "all") return true
  if (filter === "without-audit") return score === undefined
  if (score === undefined) return false
  if (filter === "under-40") return score < 40
  if (filter === "40-59") return score >= 40 && score < 60
  if (filter === "60-74") return score >= 60 && score < 75
  return score >= 75
}

function matchesLastContact(
  lastContactedAt: number | undefined,
  filter: CampaignLastContactFilter,
  now: number,
): boolean {
  if (filter === "all") return true
  if (filter === "never") return lastContactedAt === undefined
  if (lastContactedAt === undefined) return false

  const age = Math.max(0, now - lastContactedAt)
  if (filter === "last-7-days") return age <= 7 * DAY_MS
  if (filter === "days-8-30") return age > 7 * DAY_MS && age <= 30 * DAY_MS
  return age > 30 * DAY_MS
}

export function isFollowUpDue(
  lead: Pick<FilterableCampaignLead, "followUpAt">,
  now: number,
): boolean {
  return lead.followUpAt !== undefined && lead.followUpAt <= now
}

export function filterCampaignLeads<T extends FilterableCampaignLead>(
  leads: T[],
  filters: CampaignLeadFilterState,
  now: number,
): T[] {
  const query = filters.search.trim().toLocaleLowerCase("de")

  return leads.filter((lead) => {
    if (filters.status !== "all" && lead.status !== filters.status) return false
    if (filters.category !== "all" && lead.category !== filters.category) return false
    if (filters.city !== "all" && lead.city !== filters.city) return false
    if (!matchesScore(lead.audit?.overallScore, filters.score)) return false

    const wasOpened = (lead.audit?.viewCount ?? 0) > 0
    if (filters.report === "opened" && !wasOpened) return false
    if (filters.report === "not-opened" && wasOpened) return false
    if (!matchesLastContact(lead.lastContactedAt, filters.lastContact, now)) return false
    if (filters.auditReadyOnly && !lead.auditReady) return false
    if (filters.followUpDueOnly && !isFollowUpDue(lead, now)) return false

    if (!query) return true
    return [lead.businessName, lead.category, lead.city, lead.websiteUrl].some((value) =>
      value?.toLocaleLowerCase("de").includes(query),
    )
  })
}

export function sortCampaignLeads<T extends FilterableCampaignLead>(
  leads: T[],
  sort: CampaignLeadSort,
  now: number,
): T[] {
  const rows = [...leads]
  const collator = new Intl.Collator("de", { sensitivity: "base" })

  rows.sort((a, b) => {
    if (sort === "name") return collator.compare(a.businessName, b.businessName)
    if (sort === "updated") return b.updatedAt - a.updatedAt

    if (sort === "priority") {
      const dueDelta = Number(isFollowUpDue(b, now)) - Number(isFollowUpDue(a, now))
      if (dueDelta !== 0) return dueDelta
    }

    const aScore = a.audit?.overallScore
    const bScore = b.audit?.overallScore
    if (aScore === undefined && bScore !== undefined) return 1
    if (aScore !== undefined && bScore === undefined) return -1
    if (aScore !== undefined && bScore !== undefined && aScore !== bScore) return aScore - bScore
    return b.updatedAt - a.updatedAt
  })

  return rows
}

export function campaignLeadFilterOptions<T extends FilterableCampaignLead>(leads: T[]) {
  const collator = new Intl.Collator("de", { sensitivity: "base" })
  return {
    categories: [...new Set(leads.map((lead) => lead.category).filter(Boolean) as string[])].sort(
      collator.compare,
    ),
    cities: [...new Set(leads.map((lead) => lead.city).filter(Boolean) as string[])].sort(
      collator.compare,
    ),
  }
}

export function hasActiveCampaignLeadFilters(filters: CampaignLeadFilterState): boolean {
  return Object.entries(filters).some(([key, value]) => {
    if (key === "search") return value !== ""
    return value !== "all" && value !== false
  })
}
