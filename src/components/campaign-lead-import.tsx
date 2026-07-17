"use client"

import { useMemo, useRef, useState } from "react"
import { useAction, useMutation, useQuery } from "convex/react"
import { Download, FileSpreadsheet, Loader2, Plus, RefreshCw, Upload } from "lucide-react"

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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/sonner"
import {
  CAMPAIGN_CSV_MAX_BYTES,
  CAMPAIGN_IMPORT_BATCH_SIZE,
  campaignCsvTemplate,
  parseCampaignCsv,
  type CampaignImportPreviewItem,
  type CampaignImportRow,
} from "@/lib/campaign-csv"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import type { CampaignStatus } from "../../convex/lib/campaigns"

type ManualLeadForm = {
  businessName: string
  websiteUrl: string
  category: string
  city: string
  country: string
  address: string
  phone: string
  businessEmail: string
}

const EMPTY_MANUAL_FORM: ManualLeadForm = {
  businessName: "",
  websiteUrl: "",
  category: "",
  city: "",
  country: "",
  address: "",
  phone: "",
  businessEmail: "",
}

function optional(value: string): string | undefined {
  return value.trim() || undefined
}

function triggerDownload(contents: string, filename: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const classificationLabels = {
  valid_new: "Neu",
  duplicate_existing: "Bestehend",
  duplicate_in_file: "Doppelt in Datei",
  invalid: "Ungültig",
} as const

type SheetsConnection = {
  _id: Id<"workspaceIntegrations">
  provider: "google_sheets"
  status: "connecting" | "connected" | "error" | "revoked"
  accountLabel?: string | null
}

type SheetImportPreview = {
  snapshotId: Id<"sheetImportSnapshots">
  accountLabel?: string | null
  spreadsheetTitle?: string
  sheetName: string
  items: CampaignImportPreviewItem[]
  expiresAt: number
}

type SheetImportResult = {
  created: number
  reused: number
  attached: number
  skipped: number
}

export function CampaignLeadImport({
  campaignId,
  campaignStatus,
  initialTab = "existing",
  triggerLabel = "Lead hinzufügen",
}: {
  campaignId: Id<"campaigns">
  campaignStatus: CampaignStatus
  initialTab?: "existing" | "manual" | "csv" | "sheets"
  triggerLabel?: string
}) {
  const canAdd = campaignStatus === "draft" || campaignStatus === "active"
  const fileInputRef = useRef<HTMLInputElement>(null)
  const leads = useQuery(api.leads.listMyLeads, {})
  const attachExisting = useMutation(api.campaigns.attachExistingLead)
  const createManual = useMutation(api.campaign_imports.createManualLead)
  const importBatch = useMutation(api.campaign_imports.importLeadBatch)
  const connectionsResult = useQuery(api.integrations.listConnections, {}) as unknown as
    | { connections: Array<SheetsConnection | { provider: string; status: string }> }
    | undefined
  const previewSheetImport = useAction(api.integration_actions.previewSheetImport)
  const confirmSheetImport = useAction(api.integration_actions.confirmSheetImport)

  const [open, setOpen] = useState(false)
  const [existingSearch, setExistingSearch] = useState("")
  const [busyLeadId, setBusyLeadId] = useState<Id<"leads"> | null>(null)
  const [manual, setManual] = useState<ManualLeadForm>(EMPTY_MANUAL_FORM)
  const [manualBusy, setManualBusy] = useState(false)
  const [csvRows, setCsvRows] = useState<CampaignImportRow[] | null>(null)
  const [csvFilename, setCsvFilename] = useState("")
  const [csvError, setCsvError] = useState<string | null>(null)
  const [importId, setImportId] = useState("")
  const [importBusy, setImportBusy] = useState(false)
  const [sheetSpreadsheetUrl, setSheetSpreadsheetUrl] = useState("")
  const [sheetName, setSheetName] = useState("Leads")
  const [sheetPreview, setSheetPreview] = useState<SheetImportPreview | null>(null)
  const [sheetError, setSheetError] = useState<string | null>(null)
  const [sheetPreviewBusy, setSheetPreviewBusy] = useState(false)
  const [sheetImportBusy, setSheetImportBusy] = useState(false)

  const sheetsConnection = connectionsResult?.connections.find(
    (connection): connection is SheetsConnection =>
      connection.provider === "google_sheets" && connection.status === "connected",
  )

  const preview = useQuery(
    api.campaign_imports.previewLeadImport,
    csvRows ? { campaignId, rows: csvRows } : "skip",
  )

  const availableLeads = useMemo(() => {
    const query = existingSearch.trim().toLowerCase()
    return (leads?.items ?? [])
      .filter((lead) => !lead.campaigns.some((campaign) => campaign.campaignId === campaignId))
      .filter((lead) => {
        if (!query) return true
        return [lead.businessName, lead.websiteUrl, lead.city]
          .some((value) => value?.toLowerCase().includes(query))
      })
  }, [campaignId, existingSearch, leads?.items])

  const importableItems = preview?.items.filter(
    (item) => item.classification === "valid_new" || item.classification === "duplicate_existing",
  ) ?? []

  function updateManual(field: keyof ManualLeadForm, value: string) {
    setManual((current) => ({ ...current, [field]: value }))
  }

  async function handleAttach(leadId: Id<"leads">) {
    setBusyLeadId(leadId)
    try {
      const result = await attachExisting({ campaignId, leadId })
      toast.success(result.alreadyAttached ? "Lead war bereits zugeordnet" : "Lead hinzugefügt")
    } catch (error) {
      toast.error((error as Error)?.message ?? "Lead konnte nicht hinzugefügt werden")
    } finally {
      setBusyLeadId(null)
    }
  }

  async function handleManualSubmit() {
    if (!manual.businessName.trim() || manualBusy) return
    setManualBusy(true)
    try {
      const result = await createManual({
        campaignId,
        businessName: manual.businessName.trim(),
        websiteUrl: optional(manual.websiteUrl),
        category: optional(manual.category),
        city: optional(manual.city),
        country: optional(manual.country),
        address: optional(manual.address),
        phone: optional(manual.phone),
        businessEmail: optional(manual.businessEmail),
      })
      setManual(EMPTY_MANUAL_FORM)
      toast.success(result.reused ? "Bestehenden Lead zugeordnet" : "Lead erstellt und zugeordnet")
    } catch (error) {
      toast.error((error as Error)?.message ?? "Lead konnte nicht gespeichert werden")
    } finally {
      setManualBusy(false)
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    setCsvError(null)
    setCsvRows(null)
    if (file.size > CAMPAIGN_CSV_MAX_BYTES) {
      setCsvError("Die CSV-Datei darf maximal 1 MB groß sein.")
      return
    }
    try {
      const contents = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer())
      const parsed = parseCampaignCsv(contents)
      setCsvFilename(file.name)
      setCsvRows(parsed.rows)
      setImportId(crypto.randomUUID().replace(/-/g, "_"))
    } catch (error) {
      setCsvError(
        error instanceof TypeError
          ? "Die Datei muss gültiges UTF-8 enthalten."
          : (error as Error)?.message ?? "CSV-Datei konnte nicht gelesen werden.",
      )
    }
  }

  async function handleImport() {
    if (importBusy || importableItems.length === 0) return
    setImportBusy(true)
    try {
      let created = 0
      let reused = 0
      let attached = 0
      for (let offset = 0; offset < importableItems.length; offset += CAMPAIGN_IMPORT_BATCH_SIZE) {
        const rows = importableItems.slice(offset, offset + CAMPAIGN_IMPORT_BATCH_SIZE).map((item) => ({
          rowNumber: item.rowNumber,
          businessName: item.businessName,
          websiteUrl: item.websiteUrl,
          category: item.category,
          city: item.city,
          country: item.country,
          address: item.address,
          phone: item.phone,
          businessEmail: item.businessEmail,
        }))
        const result = await importBatch({ campaignId, importId, rows })
        created += result.created
        reused += result.reused
        attached += result.attached
      }
      toast.success(`${attached} Leads hinzugefügt (${created} neu, ${reused} bestehend)`)
      setCsvRows(null)
      setCsvFilename("")
      if (fileInputRef.current) fileInputRef.current.value = ""
    } catch (error) {
      toast.error((error as Error)?.message ?? "CSV-Import konnte nicht abgeschlossen werden")
    } finally {
      setImportBusy(false)
    }
  }

  async function handleSheetPreview() {
    if (!sheetSpreadsheetUrl.trim() || !sheetName.trim() || sheetPreviewBusy) return
    setSheetPreviewBusy(true)
    setSheetError(null)
    setSheetPreview(null)
    try {
      const result = await previewSheetImport({
        campaignId,
        spreadsheetUrl: sheetSpreadsheetUrl.trim(),
        sheetName: sheetName.trim(),
      })
      setSheetPreview(result as SheetImportPreview)
    } catch (error) {
      setSheetError((error as Error)?.message ?? "Google-Sheets-Vorschau konnte nicht geladen werden")
    } finally {
      setSheetPreviewBusy(false)
    }
  }

  async function handleSheetImport() {
    if (!sheetPreview || sheetImportBusy) return
    setSheetImportBusy(true)
    setSheetError(null)
    try {
      const result = await confirmSheetImport({ snapshotId: sheetPreview.snapshotId }) as SheetImportResult
      toast.success(
        `${result.attached} Leads hinzugefügt (${result.created} neu, ${result.reused} bestehend${result.skipped ? `, ${result.skipped} übersprungen` : ""})`,
      )
      setSheetPreview(null)
    } catch (error) {
      setSheetError(
        (error as Error)?.message ??
          "Google Sheet hat sich geändert oder der Import konnte nicht abgeschlossen werden. Lade die Vorschau erneut.",
      )
    } finally {
      setSheetImportBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1.5" disabled={!canAdd}>
          <Plus className="size-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lead hinzufügen</DialogTitle>
          <DialogDescription>
            Vorhandenen Lead zuordnen, manuell anlegen oder bis zu 100 Zeilen per CSV oder Google Sheets importieren.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={initialTab}>
          <TabsList className="grid h-auto w-full grid-cols-2 sm:h-9 sm:grid-cols-4">
            <TabsTrigger value="existing">Vorhanden</TabsTrigger>
            <TabsTrigger value="manual">Manuell</TabsTrigger>
            <TabsTrigger value="csv">CSV</TabsTrigger>
            <TabsTrigger value="sheets">Sheets</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="space-y-3 pt-2">
            <Input
              value={existingSearch}
              onChange={(event) => setExistingSearch(event.target.value)}
              placeholder="Name, Website oder Stadt suchen"
              aria-label="Vorhandene Leads durchsuchen"
            />
            <ScrollArea className="h-72 rounded-md border">
              <div className="divide-y">
                {leads === undefined ? (
                  <div className="flex justify-center p-8"><Loader2 className="size-5 animate-spin" /></div>
                ) : availableLeads.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">Keine passenden Leads verfügbar.</p>
                ) : availableLeads.map((lead) => (
                  <div key={lead._id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{lead.businessName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[lead.websiteUrl, lead.city].filter(Boolean).join(" · ") || "Keine Website"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyLeadId !== null}
                      onClick={() => void handleAttach(lead._id)}
                    >
                      {busyLeadId === lead._id ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                      Hinzufügen
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-manual-name">Unternehmensname</Label>
              <Input id="campaign-manual-name" value={manual.businessName} onChange={(e) => updateManual("businessName", e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                ["websiteUrl", "Website"],
                ["category", "Branche"],
                ["city", "Stadt"],
                ["country", "Land"],
                ["address", "Adresse"],
                ["phone", "Telefon"],
                ["businessEmail", "E-Mail"],
              ] as const).map(([field, label]) => (
                <div key={field} className="space-y-1.5">
                  <Label htmlFor={`campaign-manual-${field}`}>{label}</Label>
                  <Input
                    id={`campaign-manual-${field}`}
                    type={field === "businessEmail" ? "email" : "text"}
                    value={manual[field]}
                    onChange={(event) => updateManual(field, event.target.value)}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button disabled={!manual.businessName.trim() || manualBusy} onClick={() => void handleManualSubmit()}>
                {manualBusy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Erstellen und hinzufügen
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="csv" className="space-y-4 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="size-4" />
                CSV auswählen
              </Button>
              <Button
                variant="ghost"
                onClick={() => triggerDownload(campaignCsvTemplate(), "kampagnen-leads-vorlage.csv")}
              >
                <Download className="size-4" />
                Vorlage
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
              {csvFilename && <span className="text-xs text-muted-foreground">{csvFilename}</span>}
            </div>

            {csvError && <Alert variant="destructive"><AlertDescription>{csvError}</AlertDescription></Alert>}
            {csvRows && preview === undefined && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Datei wird geprüft …
              </div>
            )}
            {preview && (
              <>
                <div className="flex flex-wrap gap-2 text-xs">
                  {(Object.keys(classificationLabels) as Array<keyof typeof classificationLabels>).map((kind) => {
                    const count = preview.items.filter((item) => item.classification === kind).length
                    return count > 0 ? <Badge key={kind} variant="outline">{classificationLabels[kind]}: {count}</Badge> : null
                  })}
                </div>
                <ScrollArea className="h-64 rounded-md border">
                  <div className="divide-y">
                    {preview.items.map((item) => (
                      <div key={item.rowNumber} className="flex items-start justify-between gap-3 p-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">Zeile {item.rowNumber}: {item.businessName || "Ohne Name"}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.error ?? item.websiteUrl ?? "Ohne Website"}</p>
                        </div>
                        <Badge variant="outline">{classificationLabels[item.classification]}</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs text-muted-foreground">
                    {importableItems.length} von {preview.items.length} Zeilen werden importiert.
                  </p>
                  <Button disabled={importBusy || importableItems.length === 0} onClick={() => void handleImport()}>
                    {importBusy ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
                    Importieren
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="sheets" className="space-y-4 pt-2">
            {!sheetsConnection ? (
              <Alert>
                <FileSpreadsheet aria-hidden="true" />
                <AlertDescription>
                  Verbinde Google Sheets zuerst in den Integrations-Einstellungen. Der Import bleibt vollständig manuell.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                  <p className="font-medium">{sheetsConnection.accountLabel ?? "Google Sheets verbunden"}</p>
                  <p className="text-xs text-muted-foreground">
                    Es werden maximal 100 Zeilen beziehungsweise 1 MB gelesen.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="campaign-sheet-import-url">Google-Sheets-URL</Label>
                  <Input
                    id="campaign-sheet-import-url"
                    type="url"
                    inputMode="url"
                    value={sheetSpreadsheetUrl}
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    onChange={(event) => {
                      setSheetSpreadsheetUrl(event.target.value)
                      setSheetPreview(null)
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="campaign-sheet-import-tab">Tab-Name</Label>
                  <Input
                    id="campaign-sheet-import-tab"
                    value={sheetName}
                    maxLength={100}
                    onChange={(event) => {
                      setSheetName(event.target.value)
                      setSheetPreview(null)
                    }}
                  />
                </div>

                {sheetError && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      <p>{sheetError}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={sheetPreviewBusy}
                        onClick={() => void handleSheetPreview()}
                      >
                        {sheetPreviewBusy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                        Vorschau neu laden
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {!sheetPreview && !sheetPreviewBusy && (
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      disabled={!sheetSpreadsheetUrl.trim() || !sheetName.trim()}
                      onClick={() => void handleSheetPreview()}
                    >
                      <FileSpreadsheet className="size-4" />
                      Vorschau laden
                    </Button>
                  </div>
                )}

                {sheetPreviewBusy && (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Tabellen-Tab wird geprüft …
                  </div>
                )}

                {sheetPreview && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {sheetPreview.spreadsheetTitle ?? "Google Sheet"} · {sheetPreview.sheetName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Momentaufnahme bis {new Date(sheetPreview.expiresAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr gültig
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => void handleSheetPreview()}>
                        <RefreshCw className="size-3.5" />
                        Neu laden
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      {(Object.keys(classificationLabels) as Array<keyof typeof classificationLabels>).map((kind) => {
                        const count = sheetPreview.items.filter((item) => item.classification === kind).length
                        return count > 0 ? <Badge key={kind} variant="outline">{classificationLabels[kind]}: {count}</Badge> : null
                      })}
                    </div>
                    <ScrollArea className="h-64 rounded-md border">
                      <div className="divide-y">
                        {sheetPreview.items.map((item) => (
                          <div key={item.rowNumber} className="flex items-start justify-between gap-3 p-3 text-sm">
                            <div className="min-w-0">
                              <p className="truncate font-medium">Zeile {item.rowNumber}: {item.businessName || "Ohne Name"}</p>
                              <p className="truncate text-xs text-muted-foreground">{item.error ?? item.websiteUrl ?? "Ohne Website"}</p>
                            </div>
                            <Badge variant="outline">{classificationLabels[item.classification]}</Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs text-muted-foreground">
                        {sheetPreview.items.filter((item) => item.classification === "valid_new" || item.classification === "duplicate_existing").length} von {sheetPreview.items.length} Zeilen werden importiert.
                      </p>
                      <Button
                        disabled={
                          sheetImportBusy ||
                          !sheetPreview.items.some((item) => item.classification === "valid_new" || item.classification === "duplicate_existing")
                        }
                        onClick={() => void handleSheetImport()}
                      >
                        {sheetImportBusy ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
                        Import bestätigen
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
