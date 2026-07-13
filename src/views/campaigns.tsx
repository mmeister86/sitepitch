"use client"

import { useRouter } from "@/lib/router"
import { useQuery } from "convex/react"
import { Megaphone } from "lucide-react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { CampaignSetupForm } from "@/components/campaign-setup-form"
import { api } from "../../convex/_generated/api"
import { campaignStatusLabel, type CampaignStatus } from "../../convex/lib/campaigns"
import { formatReportViewCount } from "@/lib/report-view-count"

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
      <div className="mx-auto flex min-h-[40vh] w-full max-w-[1100px] items-center justify-center p-4 md:p-6">
        <Spinner className="size-6 text-primary" />
      </div>
    )
  }

  const items = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Kampagnen</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Lokale Akquise nach Zielgruppe steuern
        </p>
      </div>

      <CampaignSetupForm onCreated={(id) => navigate({ name: "campaign", id })} />

      <Card className="gap-0 py-0">
        <CardHeader className="gap-3 border-b py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Meine Kampagnen</h3>
            </div>
            <span className="text-xs text-muted-foreground">{total} gesamt</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Megaphone className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Noch keine Kampagnen</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Lege oben eine Zielgruppe fest und starte deine erste Kampagne.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {items.map((campaign) => (
                <button
                  type="button"
                  key={campaign._id}
                  className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors outline-none hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => navigate({ name: "campaign", id: campaign._id })}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {campaign.targetIndustry}, {campaign.targetCity}, {campaign.targetCountry} · {" "}
                      {campaign.offerType}
                    </p>
                    <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1"><dd className="font-medium tabular-nums text-foreground">{campaign.metrics.leads}</dd><dt>Leads</dt></div>
                      <div className="flex items-center gap-1"><dd className="font-medium tabular-nums text-foreground">{campaign.metrics.audits}</dd><dt>Audits</dt></div>
                      <div className="flex items-center gap-1"><dd className="font-medium tabular-nums text-foreground">{campaign.metrics.followUpsDue}</dd><dt>fällig</dt></div>
                      <div className="flex items-center gap-1"><dd className="font-medium tabular-nums text-foreground">{formatReportViewCount(campaign.metrics.reportViews, campaign.metrics.reportViewsCapped, campaign.metrics.reportViewsPending)}</dd><dt>Views</dt></div>
                      <div className="flex items-center gap-1"><dd className="font-medium tabular-nums text-foreground">{campaign.metrics.won}/{campaign.metrics.lost}</dd><dt>Won/Lost</dt></div>
                    </dl>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <CampaignStatusBadge status={campaign.status} />
                    <span className="text-sm font-medium text-muted-foreground">Öffnen</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
