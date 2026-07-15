"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { useRouter } from "@/lib/router"
import {
  ArrowLeft,
  Archive,
  Check,
  FileText,
  History,
  Loader2,
  Megaphone,
  Pencil,
  Play,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/sonner"
import { LeadSearchPanel } from "@/components/lead-search"
import { CampaignLeadTable } from "@/components/campaign-lead-table"
import { CampaignLeadImport } from "@/components/campaign-lead-import"
import { ActivityFeed } from "@/components/activity-feed"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import type { CampaignOfferType, CampaignStatus } from "../../convex/lib/campaigns"
import { campaignStatusLabel, offerTypeLabel } from "../../convex/lib/campaigns"
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

const offerOptions: { value: CampaignOfferType; label: string }[] = [
  { value: "relaunch", label: "Website-Relaunch" },
  { value: "maintenance", label: "Website-Pflege" },
  { value: "seo", label: "SEO-Optimierung" },
  { value: "conversion", label: "Conversion-Optimierung" },
  { value: "performance", label: "Performance-Optimierung" },
  { value: "custom", label: "Individuelles Angebot" },
]

export function CampaignDetailView({ id }: { id: string }) {
  const { navigate } = useRouter()
  const campaignId = id as Id<"campaigns">
  const data = useQuery(api.campaigns.getMyCampaign, { campaignId })
  const setStatus = useMutation(api.campaigns.setStatus)
  const updateCampaign = useMutation(api.campaigns.update)
  const updateReportDefaults = useMutation(api.campaigns.updateReportDefaults)
  const deleteCampaign = useMutation(api.campaigns.deleteCampaign)
  const saveLead = useMutation(api.leads.saveLeadFromSearch)

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [reportDefaultsSaving, setReportDefaultsSaving] = useState(false)
  const [reportIntro, setReportIntro] = useState("")
  const [reportCtaText, setReportCtaText] = useState("")
  const [reportCtaUrl, setReportCtaUrl] = useState("")

  const [editName, setEditName] = useState("")
  const [editIndustry, setEditIndustry] = useState("")
  const [editCity, setEditCity] = useState("")
  const [editCountry, setEditCountry] = useState("")
  const [editOfferType, setEditOfferType] = useState<CampaignOfferType>("relaunch")
  const [editLanguage, setEditLanguage] = useState<"de" | "en">("de")

  const campaign = data?.campaign
  const metrics = data?.metrics

  useEffect(() => {
    if (!campaign) return
    setReportIntro(campaign.reportIntro ?? "")
    setReportCtaText(campaign.reportCtaText ?? "")
    setReportCtaUrl(campaign.reportCtaUrl ?? "")
  }, [campaign?._id, campaign?.updatedAt])

  function openEdit() {
    if (!campaign) return
    setEditName(campaign.name)
    setEditIndustry(campaign.targetIndustry)
    setEditCity(campaign.targetCity)
    setEditCountry(campaign.targetCountry)
    setEditOfferType(campaign.offerType)
    setEditLanguage(campaign.language)
    setIsEditOpen(true)
  }

  async function handleStatusChange(next: CampaignStatus) {
    if (!campaign || statusLoading) return
    setStatusLoading(true)
    try {
      await setStatus({ campaignId, status: next })
      toast.success(`Kampagne ${campaignStatusLabel(next)}`)
    } catch (error) {
      toast.error((error as Error)?.message ?? "Status konnte nicht geändert werden")
    } finally {
      setStatusLoading(false)
    }
  }

  async function handleUpdate() {
    if (!campaign || isSubmitting) return
    setIsSubmitting(true)
    try {
      await updateCampaign({
        campaignId,
        name: editName.trim(),
        targetIndustry: editIndustry.trim(),
        targetCity: editCity.trim(),
        targetCountry: editCountry.trim(),
        offerType: editOfferType,
        language: editLanguage,
      })
      setIsEditOpen(false)
      toast.success("Kampagne aktualisiert")
    } catch (error) {
      toast.error((error as Error)?.message ?? "Kampagne konnte nicht aktualisiert werden")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!campaign || isSubmitting) return
    setIsSubmitting(true)
    try {
      await deleteCampaign({ campaignId })
      setIsDeleteOpen(false)
      toast.success("Kampagne gelöscht")
      navigate({ name: "campaigns" })
    } catch (error) {
      toast.error((error as Error)?.message ?? "Kampagne konnte nicht gelöscht werden")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReportDefaultsUpdate() {
    if (!campaign || reportDefaultsSaving) return
    setReportDefaultsSaving(true)
    try {
      await updateReportDefaults({
        campaignId,
        reportIntro,
        reportCtaText,
        reportCtaUrl,
      })
      toast.success("Report-Vorgaben gespeichert")
    } catch (error) {
      toast.error((error as Error)?.message ?? "Report-Vorgaben konnten nicht gespeichert werden")
    } finally {
      setReportDefaultsSaving(false)
    }
  }

  async function handleSaveLeadFromSearch(result: {
    businessName: string
    websiteUrl?: string
    normalizedWebsiteUrl?: string
    category?: string
    city?: string
    country?: string
    address?: string
    phone?: string
    businessEmail?: string
    latitude?: number
    longitude?: number
    sourceProvider: string
    sourceId?: string
    sourceLabel: string
  }) {
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
        campaignId,
      })
      toast.success("Lead zur Kampagne hinzugefügt")
    } catch {
      toast.error("Lead konnte nicht zur Kampagne hinzugefügt werden")
    }
  }

  if (data === undefined) {
    return (
      <div className="mx-auto flex min-h-[40vh] w-full max-w-[1100px] items-center justify-center p-4 md:p-6">
        <Spinner className="size-6 text-primary" />
      </div>
    )
  }

  if (!campaign || !metrics) {
    return (
      <div className="mx-auto w-full max-w-[1100px] space-y-5 p-4 md:p-6">
        <button
          type="button"
          onClick={() => navigate({ name: "campaigns" })}
          className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-3.5" />
          Zurück zu Kampagnen
        </button>
        <Card className="py-16">
          <CardContent className="text-center text-sm text-muted-foreground">
            Kampagne nicht gefunden.
          </CardContent>
        </Card>
      </div>
    )
  }

  const canEdit = campaign.status !== "archived"
  const canDelete = campaign.status === "draft" || campaign.status === "archived"
  const canEditReportDefaults = canEdit && data.reportCapabilities.campaignCta

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5 p-4 md:p-6">
      <button
        type="button"
        onClick={() => navigate({ name: "campaigns" })}
        className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-3.5" />
        Zurück zu Kampagnen
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone className="size-5 text-muted-foreground" />
            <h2 className="text-2xl font-semibold tracking-tight">{campaign.name}</h2>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <CampaignStatusBadge status={campaign.status} />
            <span>{offerTypeLabel(campaign.offerType)}</span>
            <span>·</span>
            <span>{campaign.language === "de" ? "Deutsch" : "English"}</span>
            <span>·</span>
            <span>
              {campaign.targetIndustry}, {campaign.targetCity}, {campaign.targetCountry}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {campaign.status === "draft" && (
            <Button
              className="gap-1.5"
              onClick={() => void handleStatusChange("active")}
              disabled={statusLoading}
            >
              <Play className="size-3.5" />
              Starten
            </Button>
          )}
          {campaign.status === "active" && (
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => void handleStatusChange("paused")}
              disabled={statusLoading}
            >
              Pausieren
            </Button>
          )}
          {campaign.status === "paused" && (
            <Button
              className="gap-1.5"
              onClick={() => void handleStatusChange("active")}
              disabled={statusLoading}
            >
              <Play className="size-3.5" />
              Fortsetzen
            </Button>
          )}
          {campaign.status !== "archived" && campaign.status !== "draft" && (
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => void handleStatusChange("archived")}
              disabled={statusLoading}
            >
              <Archive className="size-3.5" />
              Archivieren
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={openEdit}
            disabled={!canEdit}
            aria-label="Bearbeiten"
          >
            <Pencil className="size-4" />
          </Button>

          {canDelete && (
            <Button
              variant="outline"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => setIsDeleteOpen(true)}
              aria-label="Löschen"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        {[
          { label: "Leads", value: metrics.leads },
          { label: "Audits", value: metrics.audits },
          { label: "Outreach", value: metrics.outreachCopied },
          {
            label: "Views",
            value: formatReportViewCount(
              metrics.reportViews,
              metrics.reportViewsCapped,
              metrics.reportViewsPending,
            ),
          },
          { label: "Won", value: metrics.won },
          { label: "Lost", value: metrics.lost },
          { label: "Fällig", value: metrics.followUpsDue },
        ].map((m) => (
          <div key={m.label} className="flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5">
            <span className="font-semibold tabular-nums">{m.value}</span>
            <span className="text-xs text-muted-foreground">{m.label}</span>
          </div>
        ))}
      </div>

      <div className="space-y-5">
        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
                <h3 className="text-sm font-semibold">Report-Vorgaben</h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {data.reportCapabilities.campaignCta ? "Für neue Report-Snapshots" : "Verfügbar ab Pro"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-report-intro">Einleitung</Label>
              <Textarea
                id="campaign-report-intro"
                value={reportIntro}
                onChange={(event) => setReportIntro(event.target.value)}
                placeholder="Kurze persönliche Einleitung vor den Audit-Ergebnissen"
                rows={3}
                maxLength={2_000}
                disabled={!canEditReportDefaults || reportDefaultsSaving}
              />
              <p className="text-xs text-muted-foreground">
                Wird beim ersten Freigeben übernommen. Lead- und Report-Angaben können diese Vorgabe überschreiben.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="campaign-report-cta-text">CTA-Text</Label>
                <Input
                  id="campaign-report-cta-text"
                  value={reportCtaText}
                  onChange={(event) => setReportCtaText(event.target.value)}
                  placeholder="Kostenloses Erstgespräch"
                  maxLength={80}
                  disabled={!canEditReportDefaults || reportDefaultsSaving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campaign-report-cta-url">CTA-Ziel</Label>
                <Input
                  id="campaign-report-cta-url"
                  value={reportCtaUrl}
                  onChange={(event) => setReportCtaUrl(event.target.value)}
                  placeholder="https://agentur.de/kontakt"
                  inputMode="url"
                  maxLength={2_048}
                  disabled={!canEditReportDefaults || reportDefaultsSaving}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => void handleReportDefaultsUpdate()}
                disabled={!canEditReportDefaults || reportDefaultsSaving}
              >
                {reportDefaultsSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Vorgaben speichern
              </Button>
            </div>
          </CardContent>
        </Card>

        <LeadSearchPanel
          campaignId={campaignId}
          defaultIndustry={campaign.targetIndustry}
          defaultCity={campaign.targetCity}
          defaultCountry={campaign.targetCountry}
          onSave={handleSaveLeadFromSearch}
          saveLabel="Zur Kampagne hinzufügen"
          disabled={campaign.status === "paused" || campaign.status === "archived"}
        />

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Leads verwalten</p>
            <p className="text-xs text-muted-foreground">
              Vorhandene Leads zuordnen, manuell anlegen oder per CSV importieren.
            </p>
          </div>
          <CampaignLeadImport campaignId={campaignId} campaignStatus={campaign.status} />
        </div>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Kampagnen-Leads</h3>
              </div>
              <span className="text-xs text-muted-foreground">{data.leads.length} gesamt</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <CampaignLeadTable
              campaignId={campaignId}
              campaignStatus={campaign.status}
              leads={data.leads}
            />
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="size-4 text-muted-foreground" aria-hidden="true" />
                <h3 id="campaign-activity-heading" className="text-sm font-semibold">Aktivität</h3>
              </div>
              <span className="text-xs text-muted-foreground">Letzte {data.activity.length}</span>
            </div>
          </CardHeader>
          <CardContent
            role="region"
            aria-labelledby="campaign-activity-heading"
            className="px-6 py-4"
          >
            {data.activity.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-muted-foreground">Noch keine Kampagnen-Aktivität</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Lead-Zuordnungen, Status, Notizen und Follow-ups erscheinen hier.
                </p>
              </div>
            ) : (
              <ActivityFeed
                label="Kampagnen-Aktivität"
                items={data.activity.map((item) => ({
                  id: item._id,
                  event: item.type,
                  createdAt: item.createdAt,
                  auditId: null,
                  domain: null,
                  businessName: item.leadName ?? null,
                  detail: item.message,
                }))}
                compact
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Kampagne bearbeiten</DialogTitle>
            <DialogDescription>
              Zielgruppe, Angebot und Sprache aktualisieren
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Kampagnenname</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-industry">Branche</Label>
                <Input
                  id="edit-industry"
                  value={editIndustry}
                  onChange={(e) => setEditIndustry(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-city">Stadt</Label>
                <Input
                  id="edit-city"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-country">Land</Label>
                <Input
                  id="edit-country"
                  value={editCountry}
                  onChange={(e) => setEditCountry(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-language">Sprache</Label>
                <Select value={editLanguage} onValueChange={(v) => setEditLanguage(v as "de" | "en")}>
                  <SelectTrigger id="edit-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-offer">Zielangebot</Label>
              <Select value={editOfferType} onValueChange={(v) => setEditOfferType(v as CampaignOfferType)}>
                <SelectTrigger id="edit-offer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {offerOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={() => void handleUpdate()} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kampagne löschen</DialogTitle>
            <DialogDescription>
              Die Kampagne und alle zugehörigen Lead-Zuordnungen werden gelöscht. Gespeicherte Leads und Audits bleiben erhalten.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
