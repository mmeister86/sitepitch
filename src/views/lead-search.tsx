"use client"

import { useMutation, useQuery } from "convex/react"
import { Building2, Search, ArrowLeft, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { LeadSearchPanel } from "@/components/lead-search"
import { LeadSummary } from "@/components/lead-common"
import { useRouter } from "@/lib/router"
import { api } from "../../convex/_generated/api"
import type { SearchResultItem } from "@/components/lead-common"

export function LeadSearchView() {
  const { navigate } = useRouter()
  const leadsData = useQuery(api.leads.listMyLeads, {})
  const saveLead = useMutation(api.leads.saveLeadFromSearch)

  const savedLeads = leadsData?.items ?? []
  const totalSaved = leadsData?.total ?? 0

  async function handleSaveLead(result: SearchResultItem) {
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
        sourceProvider: result.sourceProvider as
          | "rapidapi"
          | "google_places"
          | "manual"
          | "serpapi"
          | "dataforseo"
          | "apify",
        sourceId: result.sourceId,
        sourceLabel: result.sourceLabel,
      })
    } catch {
      // Der LeadSearchPanel zeigt Fehler über sein eigenes Toast-Management.
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Leads suchen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Finde lokale Unternehmen nach Branche und Stadt, speichere sie und starte Audits.
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2 self-start"
          onClick={() => navigate({ name: "leads" })}
        >
          <ArrowLeft className="size-4" />
          Gespeicherte Leads
          {totalSaved > 0 ? ` (${totalSaved})` : ""}
        </Button>
      </div>

      <LeadSearchPanel
        onSave={handleSaveLead}
        saveLabel="Speichern"
      />

      <Card className="gap-0 py-0">
        <CardHeader className="gap-3 border-b py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Kürzlich gespeicherte Leads</h3>
            </div>
            <span className="text-xs text-muted-foreground">{totalSaved} gesamt</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {savedLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Search className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Noch keine gespeicherten Leads</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Nutze die Suche oben, um Unternehmen zu finden und zu speichern.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {savedLeads.slice(0, 5).map((lead) => (
                <div
                  key={lead._id}
                  className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <LeadSummary
                      lead={{
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
                        auditReady: lead.auditReady,
                        audited: Boolean(lead.audit),
                      }}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 self-start"
                    onClick={() => navigate({ name: "leads" })}
                  >
                    <Plus className="size-3.5" />
                    In Leads ansehen
                  </Button>
                </div>
              ))}
              {savedLeads.length > 5 && (
                <div className="flex justify-center border-t px-6 py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate({ name: "leads" })}
                  >
                    Alle gespeicherten Leads anzeigen
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
