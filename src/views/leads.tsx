"use client"

import { useRef, useState } from "react"
import { useAction, useMutation, useQuery } from "convex/react"
import { Building2, Globe, Loader2, Plus, Search, Trash2 } from "lucide-react"

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Expandable,
  ExpandableContent,
  ExpandableItem,
  ExpandableTrigger,
} from "@/components/ui/expandable"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/sonner"
import { LeadSearchPanel } from "@/components/lead-search"
import { LeadDetailPanel, LeadSummary } from "@/components/lead-common"
import { useRouter } from "@/lib/router"
import { cn } from "@/lib/utils"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import type { LeadListItem } from "../../convex/leads"

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
  if (code === "LEAD_WEBSITE_REQUIRED") {
    return "Bitte ergänze zuerst eine Website-URL für diesen Lead."
  }
  return dataError?.data.message ?? "Es ist ein Fehler aufgetreten."
}

export function LeadsView() {
  const { navigate } = useRouter()
  const leadsData = useQuery(api.leads.listMyLeads, {})
  const saveLead = useMutation(api.leads.saveLeadFromSearch)
  const updateWebsite = useMutation(api.leads.updateLeadWebsite)
  const deleteLead = useMutation(api.leads.deleteLead)
  const startAuditFromLead = useAction(api.leads.startAuditFromLead)

  const [websiteDialogLead, setWebsiteDialogLead] = useState<{ id: Id<"leads">; name: string } | null>(null)
  const [websiteInput, setWebsiteInput] = useState("")
  const [websiteError, setWebsiteError] = useState<string | null>(null)
  const [isSavingWebsite, setIsSavingWebsite] = useState(false)
  const [auditStartingId, setAuditStartingId] = useState<Id<"leads"> | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"leads">
    name: string
    hasAudit: boolean
  } | null>(null)
  const [isDeletingLead, setIsDeletingLead] = useState(false)

  const idempotencyKeyRef = useRef(crypto.randomUUID())

  const leads = leadsData?.items ?? []
  const totalLeads = leadsData?.total ?? 0

  async function handleSaveLead(result: LeadSearchResultItem, index: number) {
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
      })
    } catch {
      // ignore
    }
  }

  function openWebsiteDialog(leadId: Id<"leads">, name: string) {
    setWebsiteDialogLead({ id: leadId, name })
    setWebsiteInput("")
    setWebsiteError(null)
  }

  async function handleSaveWebsite() {
    if (!websiteDialogLead || isSavingWebsite) return
    setIsSavingWebsite(true)
    setWebsiteError(null)
    try {
      await updateWebsite({
        leadId: websiteDialogLead.id,
        websiteUrl: websiteInput.trim(),
      })
      setWebsiteDialogLead(null)
    } catch (error) {
      const dataError = getErrorData(error)
      setWebsiteError(dataError?.data.message ?? "Bitte gib eine gültige Website-URL ein.")
    } finally {
      setIsSavingWebsite(false)
    }
  }

  async function handleStartAudit(leadId: Id<"leads">, existingAuditId?: string) {
    if (existingAuditId) {
      navigate({ name: "audit", id: existingAuditId })
      return
    }
    if (auditStartingId) return
    setAuditStartingId(leadId)
    idempotencyKeyRef.current = crypto.randomUUID()
    try {
      const result = await startAuditFromLead({
        leadId,
        auditType: "local",
        reportLanguage: "de",
        idempotencyKey: idempotencyKeyRef.current,
      })
      navigate({ name: "audit", id: result.auditId })
    } catch (error) {
      const dataError = getErrorData(error)
      const code = dataError?.data.code
      if (code === "LEAD_WEBSITE_REQUIRED") {
        setWebsiteDialogLead({ id: leadId, name: "" })
        setWebsiteInput("")
        setWebsiteError(dataError?.data.message ?? "Bitte ergänze zuerst eine Website-URL.")
      }
    } finally {
      setAuditStartingId(null)
    }
  }

  async function confirmDeleteLead(e?: React.MouseEvent) {
    if (!deleteTarget || isDeletingLead) return
    e?.preventDefault()
    setIsDeletingLead(true)
    try {
      await deleteLead({ leadId: deleteTarget.id })
      toast.success("Lead gelöscht", { description: deleteTarget.name })
      setDeleteTarget(null)
    } catch {
      toast.error("Lead konnte nicht gelöscht werden")
    } finally {
      setIsDeletingLead(false)
    }
  }

  function renderLeadPrimaryAction(
    lead: LeadListItem,
    opts: { inline?: boolean } = {},
  ) {
    const { inline = false } = opts
    if (lead.auditReady) {
      return (
        <Button
          size="sm"
          className="gap-1.5"
          disabled={auditStartingId === lead._id}
          onClick={(e) => {
            e.stopPropagation()
            void handleStartAudit(lead._id, lead.auditId)
          }}
        >
          {auditStartingId === lead._id ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Globe className="size-3.5" />
          )}
          {lead.audit ? "Zum Audit" : "Audit starten"}
        </Button>
      )
    }
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={(e) => {
          e.stopPropagation()
          openWebsiteDialog(lead._id, lead.businessName)
        }}
        aria-label={inline ? "Website ergänzen" : undefined}
      >
        <Plus className="size-3.5" />
        {inline ? "Website" : "Website ergänzen"}
      </Button>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Leads</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Lokale Unternehmen finden, speichern und direkt auditieren
        </p>
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
              <h3 className="text-sm font-semibold">Gespeicherte Leads</h3>
            </div>
            <span className="text-xs text-muted-foreground">{totalLeads} gesamt</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {leadsData === undefined ? (
            <div className="flex items-center justify-center py-16">
              <Spinner className="size-6 text-primary" />
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Building2 className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Noch keine Leads</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Nutze die Suche oben, um lokale Unternehmen zu finden und zu speichern.
                </p>
              </div>
            </div>
          ) : (
            <Expandable type="single" collapsible className="divide-y">
              {leads.map((lead: (typeof leads)[number]) => (
                <ExpandableItem key={lead._id} value={lead._id} className="px-6">
                  <ExpandableTrigger
                    className="items-center"
                    action={
                      <div className="shrink-0 group-data-[state=closed]:block group-data-[state=open]:hidden">
                        {renderLeadPrimaryAction(lead, { inline: true })}
                      </div>
                    }
                  >
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
                  </ExpandableTrigger>

                  <ExpandableContent>
                    <LeadDetailPanel
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
                      action={
                        <>
                          {renderLeadPrimaryAction(lead)}
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-destructive hover:text-destructive"
                            onClick={() =>
                              setDeleteTarget({
                                id: lead._id,
                                name: lead.businessName,
                                hasAudit: Boolean(lead.audit),
                              })
                            }
                          >
                            <Trash2 className="size-3.5" />
                            Lead löschen
                          </Button>
                        </>
                      }
                    />
                  </ExpandableContent>
                </ExpandableItem>
              ))}
            </Expandable>
          )}
        </CardContent>
      </Card>

      <Dialog open={websiteDialogLead !== null} onOpenChange={(open) => !open && setWebsiteDialogLead(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Website ergänzen</DialogTitle>
            <DialogDescription>
              {websiteDialogLead?.name
                ? `Füge eine Website für ${websiteDialogLead.name} hinzu, um einen Audit zu starten.`
                : "Füge eine Website hinzu, um einen Audit zu starten."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="lead-website-input">Website-URL</Label>
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="lead-website-input"
                value={websiteInput}
                onChange={(e) => {
                  setWebsiteInput(e.target.value)
                  if (websiteError) setWebsiteError(null)
                }}
                placeholder="zahnarzt-mueller.de"
                className={cn("pl-9", websiteError && "border-destructive focus-visible:ring-destructive/30")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    void handleSaveWebsite()
                  }
                }}
              />
            </div>
            {websiteError && <p className="text-xs font-medium text-destructive">{websiteError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWebsiteDialogLead(null)} disabled={isSavingWebsite}>
              Abbrechen
            </Button>
            <Button onClick={() => void handleSaveWebsite()} disabled={isSavingWebsite || !websiteInput.trim()} className="gap-2">
              {isSavingWebsite && <Loader2 className="size-4 animate-spin" />}
              {isSavingWebsite ? "Speichert …" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDeletingLead) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Lead löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.hasAudit ? (
                <>
                  Der Lead „{deleteTarget?.name}“ wird gelöscht. Der verknüpfte Audit
                  bleibt erhalten.
                </>
              ) : (
                <>
                  Der Lead „{deleteTarget?.name}“ wird dauerhaft aus deiner Lead-Liste
                  entfernt.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingLead}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeletingLead}
              onClick={confirmDeleteLead}
            >
              {isDeletingLead ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

import type { SearchResultItem as LeadSearchResultItem } from "@/components/lead-common"
