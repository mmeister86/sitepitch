"use client"

import { useRouter } from "@/lib/router"
import { useMutation, useQuery } from "convex/react"
import { Megaphone, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { api } from "../../convex/_generated/api"
import { campaignStatusLabel, offerTypeLabel, type CampaignStatus, type CampaignOfferType } from "../../convex/lib/campaigns"

function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const classes: Record<CampaignStatus, string> = {
    draft: "bg-muted text-muted-foreground",
    active: "bg-score-strong/15 text-score-strong",
    paused: "bg-score-weak/15 text-score-weak",
    archived: "bg-muted text-muted-foreground",
  }
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${classes[status]}`}>
      {campaignStatusLabel(status)}
    </span>
  )
}

export function CampaignsView() {
  const { navigate } = useRouter()
  const data = useQuery(api.campaigns.listMyCampaigns, {})

  if (data === undefined) {
    return (
      <div className="mx-auto flex min-h-[40vh] w-full max-w-[1400px] items-center justify-center p-4 md:p-6">
        <Spinner className="size-6 text-primary" />
      </div>
    )
  }

  const items = data?.items ?? []

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Kampagnen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Lokale Akquise nach Zielgruppe steuern
          </p>
        </div>
        <Button onClick={() => navigate({ name: "newCampaign" })} className="gap-2">
          <Plus className="size-4" />
          Neue Kampagne
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="py-20">
          <CardContent className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted">
              <Megaphone className="size-7 text-muted-foreground" />
            </div>
            <div className="max-w-sm">
              <p className="text-sm font-medium">Noch keine Kampagnen</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Lege eine Zielgruppe fest, finde passende Unternehmen und behalte Audit, Outreach und Follow-ups an einem Ort im Blick.
              </p>
            </div>
            <Button onClick={() => navigate({ name: "newCampaign" })} className="gap-2">
              <Plus className="size-4" />
              Erste Kampagne erstellen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((campaign) => (
            <Card
              key={campaign._id}
              className="cursor-pointer transition-colors hover:bg-muted/30"
              onClick={() => navigate({ name: "campaign", id: campaign._id })}
            >
              <CardContent className="space-y-4 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{campaign.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {campaign.targetIndustry}, {campaign.targetCity}, {campaign.targetCountry}
                    </p>
                  </div>
                  <CampaignStatusBadge status={campaign.status} />
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                    {offerTypeLabel(campaign.offerType as CampaignOfferType)}
                  </span>
                  <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                    {campaign.language === "de" ? "Deutsch" : "English"}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-2">
                  {[
                    { label: "Leads", value: campaign.metrics.leads },
                    { label: "Audits", value: campaign.metrics.audits },
                    { label: "Outreach", value: campaign.metrics.outreachCopied },
                    { label: "Views", value: campaign.metrics.reportViews },
                  ].map((m) => (
                    <div key={m.label} className="text-center">
                      <p className="text-lg font-semibold tabular-nums">{m.value}</p>
                      <p className="text-[11px] text-muted-foreground">{m.label}</p>
                    </div>
                  ))}
                </div>

                {(campaign.metrics.won > 0 || campaign.metrics.lost > 0 || campaign.metrics.followUpsDue > 0) && (
                  <div className="flex flex-wrap gap-2 border-t pt-3 text-xs">
                    {campaign.metrics.won > 0 && (
                      <span className="text-score-strong">{campaign.metrics.won} gewonnen</span>
                    )}
                    {campaign.metrics.lost > 0 && (
                      <span className="text-muted-foreground">{campaign.metrics.lost} verloren</span>
                    )}
                    {campaign.metrics.followUpsDue > 0 && (
                      <span className="text-score-weak">{campaign.metrics.followUpsDue} fällige Follow-ups</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
