"use client"

import { useEffect, useMemo, useState } from "react"
import { useAction, useQuery } from "convex/react"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
  Users,
} from "lucide-react"

import { CampaignLeadImport } from "@/components/campaign-lead-import"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/sonner"
import {
  type BatchAuditType,
  type BatchPreview,
  type BatchSourceArgs,
  batchAuditApi,
} from "@/lib/batch-audit-api"
import { formatUsd } from "@/lib/batch-audits"
import { useRouter } from "@/lib/router"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

export function NewBatchAuditView() {
  const { navigate } = useRouter()
  const campaigns = useQuery(api.campaigns.listMyCampaigns, {})
  const previewBatch = useAction(batchAuditApi.previewBatch)
  const startBatch = useAction(batchAuditApi.startBatch)

  const [mode, setMode] = useState<"campaign" | "csv">("campaign")
  const [campaignId, setCampaignId] = useState<Id<"campaigns"> | null>(null)
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<Id<"campaignLeads">>>(new Set())
  const [auditType, setAuditType] = useState<BatchAuditType>("local")
  const [starting, setStarting] = useState(false)
  const [preview, setPreview] = useState<BatchPreview | null | undefined>(undefined)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const campaignData = useQuery(
    api.campaigns.getMyCampaign,
    campaignId ? { campaignId } : "skip",
  )
  const campaign = campaignData?.campaign
  const auditReadyLeads = campaignData?.leads.filter((lead) => lead.auditReady) ?? []

  const requestArgs = useMemo<BatchSourceArgs | null>(() => {
    if (!campaignId || !campaign || selectedLeadIds.size < 2) return null
    return {
      source: "campaign",
      campaignId,
      campaignLeadIds: Array.from(selectedLeadIds),
      auditType,
      reportLanguage: campaign.language,
    }
  }, [auditType, campaign, campaignId, selectedLeadIds])

  const hasInput = selectedLeadIds.size > 0

  useEffect(() => {
    if (!requestArgs) {
      setPreview(undefined)
      setPreviewError(null)
      return
    }
    let current = true
    setPreview(undefined)
    setPreviewError(null)
    const timeout = window.setTimeout(() => {
      void previewBatch(requestArgs)
        .then((result) => {
          if (current) setPreview(result)
        })
        .catch((error) => {
          if (!current) return
          setPreview(null)
          setPreviewError((error as Error)?.message ?? "Preflight konnte nicht geladen werden.")
        })
    }, 250)
    return () => {
      current = false
      window.clearTimeout(timeout)
    }
  }, [previewBatch, requestArgs])

  function selectCampaign(nextId: string) {
    setCampaignId(nextId as Id<"campaigns">)
    setSelectedLeadIds(new Set())
  }

  function toggleLead(id: Id<"campaignLeads">, checked: boolean) {
    setSelectedLeadIds((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    setSelectedLeadIds(checked ? new Set(auditReadyLeads.map((lead) => lead.campaignLeadId)) : new Set())
  }

  async function handleStart() {
    if (!requestArgs || !preview?.allowed || starting) return
    setStarting(true)
    try {
      const result = await startBatch({
        ...requestArgs,
        idempotencyKey: crypto.randomUUID(),
      })
      toast.success("Batch-Audit gestartet", {
        description: `${result.totalItems} Websites wurden eingeplant.`,
      })
      navigate({ name: "batch-audit", id: result.batchAuditJobId })
    } catch (error) {
      toast.error((error as Error)?.message ?? "Batch-Audit konnte nicht gestartet werden")
    } finally {
      setStarting(false)
    }
  }

  if (campaigns === undefined) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Spinner className="size-6 text-primary" /></div>
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5 p-4 md:p-6">
      <button
        type="button"
        onClick={() => navigate({ name: "batch-audits" })}
        className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Zurück zu Batch-Audits
      </button>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Batch vorbereiten</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Quelle auswählen, Websites prüfen und Credits vor dem Start bestätigen
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-4">
            <h3 className="text-sm font-semibold">1. Websites auswählen</h3>
          </CardHeader>
          <CardContent className="py-5">
            <Tabs value={mode} onValueChange={(value) => setMode(value as "campaign" | "csv")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="campaign"><Users className="size-4" />Kampagne</TabsTrigger>
                <TabsTrigger value="csv"><FileSpreadsheet className="size-4" />CSV-Datei</TabsTrigger>
              </TabsList>

              <TabsContent value="campaign" className="pt-3">
                <p className="text-xs text-muted-foreground">
                  Wähle auditierbare Leads aus einer aktiven Kampagne aus.
                </p>
              </TabsContent>

              <TabsContent value="csv" className="pt-3">
                <p className="text-xs text-muted-foreground">
                  Importiere die CSV zuerst in eine aktive Kampagne. Die bestehende Vorschau prüft Zeilen,
                  Duplikate und Websites; danach wählst du die importierten Leads unten aus.
                </p>
              </TabsContent>
            </Tabs>

            <div className="mt-5 space-y-1.5">
              <Label htmlFor="batch-campaign">Aktive Kampagne</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={campaignId ?? ""} onValueChange={selectCampaign}>
                  <SelectTrigger id="batch-campaign" className="flex-1">
                    <SelectValue placeholder="Kampagne auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {(campaigns?.items ?? []).filter((item) => item.status === "active").map((item) => (
                      <SelectItem key={item._id} value={item._id}>
                        {item.name} ({item.metrics.leads})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mode === "csv" && campaign && (
                  <CampaignLeadImport
                    campaignId={campaign._id}
                    campaignStatus={campaign.status}
                    initialTab="csv"
                    triggerLabel="CSV in Kampagne importieren"
                  />
                )}
              </div>
              {(campaigns?.items ?? []).every((item) => item.status !== "active") && (
                <p className="text-xs text-score-weak">Aktiviere zuerst eine Kampagne, um einen Batch zu starten.</p>
              )}
            </div>

            {campaignId && campaignData === undefined && (
              <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
            )}

            {campaignData && (
              <div className="mt-4 overflow-hidden rounded-md border">
                <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="batch-select-all"
                      checked={auditReadyLeads.length > 0 && selectedLeadIds.size === auditReadyLeads.length}
                      onCheckedChange={(checked) => toggleAll(checked === true)}
                      disabled={auditReadyLeads.length === 0}
                    />
                    <Label htmlFor="batch-select-all" className="cursor-pointer text-xs font-medium">
                      Alle auditierbaren auswählen
                    </Label>
                  </div>
                  <span className="text-xs text-muted-foreground">{selectedLeadIds.size} ausgewählt</span>
                </div>
                <ScrollArea className="h-80">
                  <div className="divide-y">
                    {campaignData.leads.map((lead) => (
                      <label
                        key={lead.campaignLeadId}
                        className="flex cursor-pointer items-start gap-3 px-3 py-3 hover:bg-muted/30 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
                      >
                        <Checkbox
                          checked={selectedLeadIds.has(lead.campaignLeadId)}
                          onCheckedChange={(checked) => toggleLead(lead.campaignLeadId, checked === true)}
                          disabled={!lead.auditReady}
                          aria-label={`${lead.businessName} auswählen`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{lead.businessName}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {lead.websiteUrl ?? "Keine Website hinterlegt"}
                          </span>
                        </span>
                        {!lead.auditReady && <Badge variant="outline">Nicht auditierbar</Badge>}
                      </label>
                    ))}
                    {campaignData.leads.length === 0 && (
                      <p className="px-6 py-10 text-center text-sm text-muted-foreground">Keine Leads in dieser Kampagne.</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5 lg:sticky lg:top-20">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b py-4">
              <h3 className="text-sm font-semibold">2. Audit konfigurieren</h3>
            </CardHeader>
            <CardContent className="space-y-4 py-5">
              <div className="space-y-1.5">
                <Label htmlFor="batch-audit-type">Audit-Typ</Label>
                <Select value={auditType} onValueChange={(value) => setAuditType(value as BatchAuditType)}>
                  <SelectTrigger id="batch-audit-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quick">Quick</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="local">Local</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="batch-language">Report-Sprache</Label>
                <Select
                  value={campaign?.language ?? "de"}
                  disabled
                >
                  <SelectTrigger id="batch-language"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
                {campaign && (
                  <p className="text-xs text-muted-foreground">Von der Kampagne übernommen.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b py-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
                <h3 className="text-sm font-semibold">3. Preflight</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 py-5">
              {!hasInput ? (
                <p className="text-sm text-muted-foreground">Wähle mindestens zwei Websites aus.</p>
              ) : !requestArgs ? (
                <Alert><AlertCircle /><AlertDescription>Für einen Batch werden mindestens zwei Websites benötigt.</AlertDescription></Alert>
              ) : preview === undefined ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Limits und Credits werden geprüft …
                </div>
              ) : preview === null ? (
                <Alert variant="destructive"><AlertCircle /><AlertDescription>{previewError ?? "Preflight konnte nicht geladen werden."}</AlertDescription></Alert>
              ) : (
                <>
                  <dl className="space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">Verarbeitbar</dt><dd className="font-semibold tabular-nums">{preview.effectiveItems.length}</dd></div>
                    <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">Ausgeschlossen</dt><dd className="font-semibold tabular-nums">{preview.invalidItems.length}</dd></div>
                    <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">Plan</dt><dd className="font-semibold capitalize">{preview.plan}</dd></div>
                    <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">Plan-Limit</dt><dd className="font-semibold tabular-nums">{preview.planLimit}</dd></div>
                    <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">Parallel</dt><dd className="font-semibold tabular-nums">{preview.maxParallelism}</dd></div>
                    <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">Credits</dt><dd className="font-semibold tabular-nums">{preview.estimatedCredits} von {preview.availableCredits}</dd></div>
                    <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">Geschätzte Kosten</dt><dd className="font-semibold tabular-nums">{formatUsd(preview.estimatedCostUsd)}</dd></div>
                  </dl>

                  {preview.invalidItems.length > 0 && (
                    <Alert>
                      <AlertCircle />
                      <AlertTitle>Ausschlüsse</AlertTitle>
                      <AlertDescription>
                        {preview.invalidItems.slice(0, 4).map((item, index) => (
                          <p key={`${item.position}-${item.url || index}`}>
                            {item.input ?? item.url ?? `Eintrag ${index + 1}`}: {item.reason ?? item.errorMessage ?? item.message ?? item.code ?? "Nicht verarbeitbar"}
                          </p>
                        ))}
                        {preview.invalidItems.length > 4 && <p>+ {preview.invalidItems.length - 4} weitere</p>}
                      </AlertDescription>
                    </Alert>
                  )}

                  {!preview.allowed && (
                    <Alert variant="destructive">
                      <AlertCircle />
                      <AlertTitle>Start blockiert</AlertTitle>
                      <AlertDescription>
                        {(preview.blockReasons?.length ? preview.blockReasons : [
                          preview.blockingCode === "INSUFFICIENT_CREDITS"
                            ? `${preview.shortfall} Credits fehlen.`
                            : preview.blockingCode === "BATCH_TOO_SMALL"
                              ? "Für diesen Plan sind mehr verarbeitbare Websites erforderlich."
                              : preview.blockingCode === "BATCH_TOO_LARGE"
                                ? `Der ${preview.plan}-Plan erlaubt höchstens ${preview.planLimit} Websites pro Batch.`
                                : "Die Auswahl erfüllt die Batch-Limits nicht.",
                        ]).map((reason) => <p key={reason}>{reason}</p>)}
                      </AlertDescription>
                    </Alert>
                  )}

                  {preview.allowed && (
                    <Alert>
                      <CheckCircle2 className="text-score-strong" />
                      <AlertTitle>Bereit zum Start</AlertTitle>
                      <AlertDescription>
                        {preview.estimatedCredits} Credits werden atomar reserviert. Nicht verbrauchte Credits werden zurückgegeben.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}

              <Button className="w-full" disabled={!preview?.allowed || starting} onClick={() => void handleStart()}>
                {starting ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                {starting ? "Batch wird gestartet …" : "Batch verbindlich starten"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
