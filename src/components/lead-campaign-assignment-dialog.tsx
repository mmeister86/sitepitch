"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { Check, CircleCheck, Loader2, Megaphone } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

type AssignableCampaign = {
  _id: Id<"campaigns">
  name: string
  targetIndustry: string
  targetCity: string
  status: "draft" | "active"
}

type LeadCampaignAssignmentDialogProps = {
  lead: {
    id: Id<"leads">
    name: string
  }
  open: boolean
  onOpenChange: (open: boolean) => void
  onCampaignNavigate: (campaignId: Id<"campaigns">) => void
  onCampaignsNavigate: () => void
}

function assignmentErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof (error as { data?: unknown }).data === "object" &&
    (error as { data?: { message?: unknown } }).data !== null
  ) {
    const message = (error as { data: { message?: unknown } }).data.message
    if (typeof message === "string") return message
  }
  return "Der Lead konnte nicht hinzugefügt werden. Bitte versuche es erneut."
}

function CampaignStatusBadge({ status }: { status: AssignableCampaign["status"] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[11px]",
        status === "active"
          ? "border-score-strong/30 bg-score-strong/10 text-score-strong"
          : "bg-muted text-muted-foreground",
      )}
    >
      {status === "active" ? "Aktiv" : "Entwurf"}
    </Badge>
  )
}

function CampaignListLoading() {
  return (
    <div className="space-y-2" aria-label="Kampagnen werden geladen">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex items-center gap-3 rounded-lg border p-3">
          <Skeleton className="size-4 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function LeadCampaignAssignmentDialog({
  lead,
  open,
  onOpenChange,
  onCampaignNavigate,
  onCampaignsNavigate,
}: LeadCampaignAssignmentDialogProps) {
  const campaignsData = useQuery(
    api.campaigns.listAssignableCampaigns,
    open ? { leadId: lead.id } : "skip",
  )
  const attachExistingLead = useMutation(api.campaigns.attachExistingLead)
  const [selectedCampaignId, setSelectedCampaignId] = useState<Id<"campaigns"> | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [assignedCampaign, setAssignedCampaign] = useState<AssignableCampaign | null>(null)

  const campaigns = campaignsData?.items ?? []
  const selectedCampaign = campaigns.find((campaign) => campaign._id === selectedCampaignId)

  function handleOpenChange(nextOpen: boolean) {
    if (isSubmitting) return
    onOpenChange(nextOpen)
  }

  async function handleAssign() {
    if (!selectedCampaign || isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await attachExistingLead({
        campaignId: selectedCampaign._id,
        leadId: lead.id,
      })
      setAssignedCampaign(selectedCampaign)
    } catch (error) {
      setSubmitError(assignmentErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {assignedCampaign ? (
          <>
            <DialogHeader>
              <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-score-strong/15 text-score-strong">
                <CircleCheck className="size-5" />
              </div>
              <DialogTitle>Lead hinzugefügt</DialogTitle>
              <DialogDescription>
                „{lead.name}“ ist jetzt der Kampagne „{assignedCampaign.name}“ zugeordnet.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Schließen
              </Button>
              <Button onClick={() => onCampaignNavigate(assignedCampaign._id)} className="gap-2">
                <Megaphone className="size-4" />
                Kampagne öffnen
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Zu Kampagne hinzufügen</DialogTitle>
              <DialogDescription>
                Wähle eine Kampagne für „{lead.name}“. Bereits zugeordnete Kampagnen werden nicht angezeigt.
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-32 py-1">
              {campaignsData === undefined ? (
                <CampaignListLoading />
              ) : campaignsData === null ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    Die Kampagnen konnten nicht geladen werden. Bitte lade die Seite neu und versuche es erneut.
                  </AlertDescription>
                </Alert>
              ) : campaigns.length === 0 ? (
                <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 px-5 text-center">
                  <div className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Megaphone className="size-4" />
                  </div>
                  <p className="text-sm font-medium">Keine verfügbare Kampagne</p>
                  <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                    Lege eine Kampagne als Entwurf an oder aktiviere eine Kampagne. Bereits verknüpfte Kampagnen sind hier ausgeblendet.
                  </p>
                </div>
              ) : (
                <div
                  className="max-h-72 space-y-2 overflow-y-auto pr-1"
                  role="radiogroup"
                  aria-label="Kampagne auswählen"
                >
                  {campaigns.map((campaign) => {
                    const selected = campaign._id === selectedCampaignId
                    return (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        key={campaign._id}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left outline-none transition-colors",
                          "hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          selected && "border-primary/50 bg-primary/5",
                        )}
                        onClick={() => {
                          setSelectedCampaignId(campaign._id)
                          setSubmitError(null)
                        }}
                      >
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full border",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/40",
                          )}
                          aria-hidden="true"
                        >
                          {selected && <Check className="size-3" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{campaign.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {campaign.targetIndustry} · {campaign.targetCity}
                          </span>
                        </span>
                        <CampaignStatusBadge status={campaign.status} />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              {campaignsData !== undefined && campaignsData !== null && campaigns.length === 0 ? (
                <>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Schließen
                  </Button>
                  <Button onClick={onCampaignsNavigate} className="gap-2">
                    <Megaphone className="size-4" />
                    Zu Kampagnen
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                    Abbrechen
                  </Button>
                  <Button
                    onClick={() => void handleAssign()}
                    disabled={!selectedCampaign || isSubmitting || campaignsData === undefined}
                    className="gap-2"
                  >
                    {isSubmitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Megaphone className="size-4" />
                    )}
                    {isSubmitting ? "Wird hinzugefügt …" : "Hinzufügen"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
