"use client"

import { useAction, useMutation } from "convex/react"
import { useState } from "react"
import { Loader2, Plus, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import {
  Expandable,
  ExpandableContent,
  ExpandableItem,
  ExpandableTrigger,
} from "@/components/ui/expandable"
import {
  LeadDetailPanel,
  LeadSummary,
  type SearchResultItem,
  type SearchResponse,
} from "@/components/lead-common"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

export type { SearchResultItem, SearchResponse }

function getErrorData(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof (error as { data?: unknown }).data === "object" &&
    (error as { data?: { code?: unknown; message?: unknown; retryAfter?: unknown } }).data !== null
  ) {
    return error as {
      data: {
        code?: string
        message?: string
        retryAfter?: number
      }
    }
  }
  return null
}

function errorMessageForCode(code: string | undefined, dataError: ReturnType<typeof getErrorData>): string {
  if (code === "RATE_LIMITED") {
    const retryAfter = dataError?.data.retryAfter
    const base = "Zu viele Versuche in kurzer Zeit. Bitte versuche es später erneut."
    return retryAfter && retryAfter > 0
      ? `${base} (freigegeben in ca. ${Math.max(1, Math.round(retryAfter / 60000))} Min.)`
      : base
  }
  if (code === "LEAD_SEARCH_NOT_CONFIGURED") {
    return "Die Lead-Suche ist noch nicht konfiguriert. Deine gespeicherten Leads bleiben verfügbar."
  }
  if (code === "LEAD_SEARCH_PROVIDER_ERROR") {
    return "Die Lead-Suche ist gerade nicht erreichbar. Deine gespeicherten Leads bleiben erhalten."
  }
  return dataError?.data.message ?? "Es ist ein Fehler aufgetreten."
}

export type LeadSearchPanelProps = {
  campaignId?: Id<"campaigns">
  defaultIndustry?: string
  defaultCity?: string
  defaultCountry?: string
  onSave?: (result: SearchResultItem, index: number) => Promise<void> | void
  saveLabel?: string
  disabled?: boolean
}

export function LeadSearchPanel({
  campaignId,
  defaultIndustry = "",
  defaultCity = "",
  defaultCountry = "Deutschland",
  onSave,
  saveLabel = "Zur Kampagne hinzufügen",
  disabled = false,
}: LeadSearchPanelProps) {
  const searchLeads = useAction(api.lead_search.searchLocalBusinesses)
  const saveLead = useMutation(api.leads.saveLeadFromSearch)

  const [industry, setIndustry] = useState(defaultIndustry)
  const [city, setCity] = useState(defaultCity)
  const [country, setCountry] = useState(defaultCountry)
  const [keyword, setKeyword] = useState("")
  const [radiusKm, setRadiusKm] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  async function handleSearch() {
    if (isSearching) return
    if (!industry.trim() || !city.trim() || !country.trim()) {
      setSearchError("Bitte fülle Branche, Stadt und Land aus.")
      return
    }

    setIsSearching(true)
    setSearchError(null)

    try {
      const result = await searchLeads({
        industry: industry.trim(),
        city: city.trim(),
        country: country.trim(),
        keyword: keyword.trim() || undefined,
        radiusKm: radiusKm.trim() ? Number(radiusKm) : undefined,
      })
      setSearchResults(result as SearchResponse)
    } catch (error) {
      const dataError = getErrorData(error)
      const code = dataError?.data.code
      setSearchError(errorMessageForCode(code, dataError))
    } finally {
      setIsSearching(false)
    }
  }

  async function handleSaveLead(result: SearchResultItem, index: number) {
    if (onSave) {
      setSavingId(`${index}`)
      try {
        await onSave(result, index)
      } finally {
        setSavingId(null)
        setSavedIds((prev) => new Set(prev).add(`${result.sourceProvider}-${result.sourceId ?? index}`))
      }
      return
    }

    setSavingId(`${index}`)
    try {
      await saveLead({
        businessName: result.businessName,
        websiteUrl: result.websiteUrl,
        normalizedWebsiteUrl: result.normalizedWebsiteUrl,
        category: result.category,
        city: result.city,
        country: result.country,
        address: result.address,
        phone: result.phone,
        businessEmail: result.businessEmail,
        latitude: result.latitude,
        longitude: result.longitude,
        sourceProvider: result.sourceProvider as "rapidapi" | "google_places" | "manual" | "serpapi" | "dataforseo" | "apify",
        sourceId: result.sourceId,
        sourceLabel: result.sourceLabel,
        campaignId,
      })
      setSavedIds((prev) => new Set(prev).add(`${result.sourceProvider}-${result.sourceId ?? index}`))
    } catch {
      // ignore
    } finally {
      setSavingId(null)
    }
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="gap-3 border-b py-4">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Lead-Suche</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="lead-industry">Branche</Label>
            <Input
              id="lead-industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Zahnarzt"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void handleSearch()
                }
              }}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-city">Stadt</Label>
            <Input
              id="lead-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Leipzig"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void handleSearch()
                }
              }}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-country">Land</Label>
            <Input
              id="lead-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Deutschland"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void handleSearch()
                }
              }}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-keyword">Keyword (optional)</Label>
            <Input
              id="lead-keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Notfall"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void handleSearch()
                }
              }}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-radius">Radius km (optional)</Label>
            <Input
              id="lead-radius"
              value={radiusKm}
              onChange={(e) => setRadiusKm(e.target.value)}
              placeholder="10"
              type="number"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void handleSearch()
                }
              }}
              disabled={disabled}
            />
          </div>
          <div className="flex items-end">
            <Button
              className="w-full gap-2"
              onClick={() => void handleSearch()}
              disabled={disabled || isSearching || !industry.trim() || !city.trim() || !country.trim()}
            >
              {isSearching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              {isSearching ? "Sucht …" : "Suchen"}
            </Button>
          </div>
        </div>
        {searchError && (
          <Alert variant="destructive">
            <AlertDescription>{searchError}</AlertDescription>
          </Alert>
        )}
      </CardHeader>

      {searchResults && (
        <CardContent className="p-0">
          <div className="border-b px-6 py-3">
            <p className="text-xs text-muted-foreground">
              {searchResults.items.length} Ergebnisse über {searchResults.sourceLabel}
            </p>
          </div>
          {searchResults.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Search className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Keine Ergebnisse. Versuche es mit einer anderen Branche oder Stadt.
              </p>
            </div>
          ) : (
            <Expandable type="single" collapsible className="divide-y">
              {searchResults.items.map((result, index) => {
                const resultKey = `${result.sourceProvider}-${result.sourceId ?? index}`
                const isSaved = savedIds.has(resultKey)
                return (
                  <ExpandableItem
                    key={resultKey}
                    value={`result-${index}`}
                    className="px-6"
                  >
                    <ExpandableTrigger className="items-center">
                      <LeadSummary lead={result} />
                    </ExpandableTrigger>
                    <ExpandableContent>
                      <LeadDetailPanel
                        lead={result}
                        action={
                          <>
                            <Button
                              size="sm"
                              className="gap-1.5"
                              disabled={savingId === `${index}` || isSaved}
                              onClick={() => void handleSaveLead(result, index)}
                            >
                              {savingId === `${index}` ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Plus className="size-3.5" />
                              )}
                              {isSaved ? "Bereits hinzugefügt" : saveLabel}
                            </Button>
                            {!result.auditReady && !isSaved && (
                              <span className="self-center text-xs text-muted-foreground">
                                Speichere den Lead, um eine Website zu ergänzen oder einen Audit zu starten.
                              </span>
                            )}
                          </>
                        }
                      />
                    </ExpandableContent>
                  </ExpandableItem>
                )
              })}
            </Expandable>
          )}
        </CardContent>
      )}
    </Card>
  )
}
