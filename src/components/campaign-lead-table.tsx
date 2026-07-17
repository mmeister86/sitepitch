"use client"

import { useMemo, useRef, useState } from "react"
import { useAction, useMutation, useQuery } from "convex/react"
import { useRouter } from "@/lib/router"
import {
  Building2,
  Calendar,
  Check,
  Clock3,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Globe,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Expandable,
  ExpandableContent,
  ExpandableItem,
  ExpandableTrigger,
} from "@/components/ui/expandable"
import { toast } from "@/components/ui/sonner"
import { LeadDetailPanel } from "@/components/lead-common"
import { LeadEditDialog, LeadEditButton } from "@/components/lead-edit-dialog"
import { ScoreBadge } from "@/components/status-badges"
import {
  campaignLeadFilterOptions,
  defaultCampaignLeadFilters,
  filterCampaignLeads,
  hasActiveCampaignLeadFilters,
  isFollowUpDue,
  sortCampaignLeads,
  type CampaignLastContactFilter,
  type CampaignLeadFilterState,
  type CampaignLeadSort,
  type CampaignReportFilter,
  type CampaignScoreFilter,
} from "@/lib/campaign-lead-filters"
import { formatReportViewCount } from "@/lib/report-view-count"
import { exportCampaignLeadsCsv } from "@/lib/campaign-csv"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import type { CampaignLeadListItem } from "../../convex/campaigns"
import type { CampaignLeadStatus, CampaignStatus } from "../../convex/lib/campaigns"
import { campaignLeadStatusLabel, isTerminalStatus } from "../../convex/lib/campaigns"

const statusOptions: CampaignLeadStatus[] = [
  "new",
  "audited",
  "contacted",
  "follow_up",
  "interested",
  "won",
  "lost",
]

function statusBadgeClasses(status: CampaignLeadStatus): string {
  switch (status) {
    case "new":
      return "bg-muted text-muted-foreground"
    case "audited":
      return "bg-primary/15 text-primary"
    case "contacted":
      return "bg-score-weak/15 text-score-weak"
    case "follow_up":
      return "bg-yellow-500/15 text-yellow-500"
    case "interested":
      return "bg-purple-500/15 text-purple-500"
    case "won":
      return "bg-score-strong/15 text-score-strong"
    case "lost":
      return "bg-destructive/15 text-destructive"
  }
}

function CampaignLeadStatusBadge({ status }: { status: CampaignLeadStatus }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${statusBadgeClasses(status)}`}
    >
      {campaignLeadStatusLabel(status)}
    </span>
  )
}

type CampaignLeadRow = CampaignLeadListItem & {
  outcomeReason?: string
}

type CrmProvider = "hubspot" | "pipedrive"

type IntegrationConnection = {
  _id: Id<"workspaceIntegrations">
  provider: "hubspot" | "pipedrive" | "gmail" | "google_sheets" | "webhook"
  status: "connecting" | "connected" | "error" | "revoked"
  accountLabel?: string | null
}

type IntegrationRun = {
  _id: Id<"integrationRuns">
  provider: IntegrationConnection["provider"]
  operation: string
  status:
    | "queued"
    | "running"
    | "succeeded"
    | "retryable_failed"
    | "permanent_failed"
    | "unknown"
    | "cancelled"
  campaignLeadId?: Id<"campaignLeads"> | null
  safeError?: string | null
  createdAt: number
  updatedAt: number
}

type LeadPushPreview = {
  integrationId: Id<"workspaceIntegrations">
  provider: CrmProvider
  accountLabel?: string | null
  existingRemoteEntity: boolean
  fields: {
    businessName: string
    domain?: string | null
    city?: string | null
    country?: string | null
    score?: number | null
    reportUrl?: string | null
    outcome?: "interested" | "won" | "lost" | null
  }
}

type SheetExportResult = {
  tabName: string
  rowCount: number
  spreadsheetUrl?: string
}

function integrationRunLabel(run: IntegrationRun): string {
  switch (run.status) {
    case "queued":
      return "CRM vorgemerkt"
    case "running":
      return "CRM wird aktualisiert"
    case "succeeded":
      return run.provider === "hubspot" ? "In HubSpot" : "In Pipedrive"
    case "retryable_failed":
      return "CRM fehlgeschlagen"
    case "permanent_failed":
      return "CRM abgelehnt"
    case "unknown":
      return "CRM unklar"
    case "cancelled":
      return "CRM abgebrochen"
  }
}

function integrationRunClasses(run: IntegrationRun): string {
  switch (run.status) {
    case "queued":
    case "running":
      return "bg-primary/10 text-primary"
    case "succeeded":
      return "bg-score-strong/10 text-score-strong"
    case "retryable_failed":
    case "permanent_failed":
    case "unknown":
      return "bg-destructive/10 text-destructive"
    case "cancelled":
      return "bg-muted text-muted-foreground"
  }
}

function LeadAuditBadge({ lead }: { lead: CampaignLeadRow }) {
  if (!lead.auditReady) {
    return (
      <span className="inline-flex rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
        Website fehlt
      </span>
    )
  }
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-xs ${lead.audit ? "text-score-strong" : "text-muted-foreground"}`}
    >
      <Globe className="mr-1 size-3" />
      {lead.audit ? "Auditiert" : "Audit-ready"}
    </span>
  )
}

function CampaignLeadSummary({
  lead,
  now,
  crmRun,
}: {
  lead: CampaignLeadRow
  now: number
  crmRun?: IntegrationRun
}) {
  const viewCount = lead.audit?.viewCount ?? 0
  const outreachCopied = lead.audit?.outreachCopied ?? 0
  const due = isFollowUpDue(lead, now)

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-medium">{lead.businessName}</span>
          {lead.category && <span className="text-xs text-muted-foreground">{lead.category}</span>}
          {lead.city && <span className="text-xs text-muted-foreground">· {lead.city}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LeadAuditBadge lead={lead} />
          <CampaignLeadStatusBadge status={lead.status} />
          {crmRun && (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${integrationRunClasses(crmRun)}`}
              title={crmRun.safeError ?? undefined}
            >
              {(crmRun.status === "queued" || crmRun.status === "running") && (
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              )}
              {integrationRunLabel(crmRun)}
            </span>
          )}
          {due && (
            <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              <Clock3 className="size-3" aria-hidden="true" />
              Follow-up fällig
            </span>
          )}
          {lead.outcomeReason && (
            <span className="max-w-[28rem] truncate text-xs text-muted-foreground" title={lead.outcomeReason}>
              Ergebnis: {lead.outcomeReason}
            </span>
          )}
        </div>
      </div>
      <dl className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5" title="Audit-Score">
          <dt className="sr-only">Audit-Score</dt>
          <dd>
            {lead.audit?.overallScore !== undefined ? (
              <ScoreBadge score={lead.audit.overallScore} className="size-7 rounded-md text-xs" />
            ) : (
              <span className="inline-flex size-7 items-center justify-center rounded-md bg-muted">–</span>
            )}
          </dd>
        </div>
        <div className="flex items-center gap-1" title="Report-Views">
          <dt><Eye className="size-3.5" aria-hidden="true" /><span className="sr-only">Report-Views</span></dt>
          <dd className="font-medium tabular-nums text-foreground">
            {formatReportViewCount(
              viewCount,
              lead.audit?.viewCountCapped ?? false,
              lead.audit?.viewCountPending ?? false,
            )}
          </dd>
        </div>
        <div className="flex items-center gap-1" title="Outreach kopiert">
          <dt><Copy className="size-3.5" aria-hidden="true" /><span className="sr-only">Outreach kopiert</span></dt>
          <dd className="font-medium tabular-nums text-foreground">{outreachCopied}</dd>
        </div>
        <div className="flex items-center gap-1" title="Letzter Kontakt">
          <dt><Clock3 className="size-3.5" aria-hidden="true" /><span className="sr-only">Letzter Kontakt</span></dt>
          <dd className="whitespace-nowrap">{lead.lastContactedAt ? formatDateTime(lead.lastContactedAt) : "Nie"}</dd>
        </div>
      </dl>
    </div>
  )
}

function timestampToDateInput(ts?: number): string {
  if (!ts) return ""
  const d = new Date(ts)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function dateInputToTimestamp(value: string): number | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.setHours(0, 0, 0, 0)
}

function formatDateTime(ts?: number): string {
  if (!ts) return ""
  return new Date(ts).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function downloadCsv(contents: string, filename: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export type CampaignLeadTableProps = {
  campaignId: Id<"campaigns">
  campaignStatus: CampaignStatus
  leads: CampaignLeadRow[]
}

export function CampaignLeadTable({
  campaignId,
  campaignStatus,
  leads,
}: CampaignLeadTableProps) {
  const { navigate } = useRouter()
  const updateLeadStatus = useMutation(api.campaigns.updateLeadStatus)
  const saveLeadNote = useMutation(api.campaigns.saveLeadNote)
  const setFollowUp = useMutation(api.campaigns.setFollowUp)
  const removeLead = useMutation(api.campaigns.removeLead)
  const startAudit = useAction(api.campaigns.startAuditFromCampaign)
  const connectionsResult = useQuery(api.integrations.listConnections, {}) as unknown as
    | { connections: IntegrationConnection[] }
    | undefined
  const runsResult = useQuery(api.integrations.listRuns, { campaignId, limit: 100 }) as unknown as
    | { items: IntegrationRun[] }
    | undefined
  const enqueueLeadPush = useMutation(api.integrations.enqueueLeadPush)
  const retryRun = useMutation(api.integrations.retryRun)
  const exportCampaignLeadsToSheet = useAction(api.integration_actions.exportCampaignLeads)

  const [filters, setFilters] = useState<CampaignLeadFilterState>(defaultCampaignLeadFilters)
  const [sortBy, setSortBy] = useState<CampaignLeadSort>("priority")
  const [filterReferenceTime] = useState(() => Date.now())
  const [removingId, setRemovingId] = useState<Id<"campaignLeads"> | null>(null)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [savingNoteId, setSavingNoteId] = useState<Id<"campaignLeads"> | null>(null)
  const [followUpDrafts, setFollowUpDrafts] = useState<Record<string, string>>({})
  const [savingFollowUpId, setSavingFollowUpId] = useState<Id<"campaignLeads"> | null>(null)
  const [auditStartingId, setAuditStartingId] = useState<Id<"campaignLeads"> | null>(null)
  const idempotencyKeyRef = useRef(crypto.randomUUID())
  const [editLead, setEditLead] = useState<{
    leadId: Id<"leads">
    businessName: string
    category?: string
    city?: string
    country?: string
    address?: string
    phone?: string
    businessEmail?: string
    reportCtaText?: string
    reportCtaUrl?: string
  } | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [pendingOutcome, setPendingOutcome] = useState<{
    campaignLeadId: Id<"campaignLeads">
    status: "won" | "lost"
  } | null>(null)
  const [outcomeReason, setOutcomeReason] = useState("")
  const [crmTarget, setCrmTarget] = useState<CampaignLeadRow | null>(null)
  const [crmProvider, setCrmProvider] = useState<CrmProvider | null>(null)
  const [crmBusy, setCrmBusy] = useState(false)
  const [retryingRunId, setRetryingRunId] = useState<Id<"integrationRuns"> | null>(null)
  const [sheetExportOpen, setSheetExportOpen] = useState(false)
  const [sheetSpreadsheetUrl, setSheetSpreadsheetUrl] = useState("")
  const [sheetName, setSheetName] = useState("SitePitch Leads")
  const [sheetExportBusy, setSheetExportBusy] = useState(false)
  const [sheetExportResult, setSheetExportResult] = useState<SheetExportResult | null>(null)

  const isReadOnly = campaignStatus === "archived" || campaignStatus === "paused"
  const connectedCrms = useMemo(
    () =>
      (connectionsResult?.connections ?? []).filter(
        (connection): connection is IntegrationConnection & { provider: CrmProvider } =>
          (connection.provider === "hubspot" || connection.provider === "pipedrive") &&
          connection.status === "connected",
      ),
    [connectionsResult?.connections],
  )
  const sheetsConnection = connectionsResult?.connections.find(
    (connection) => connection.provider === "google_sheets" && connection.status === "connected",
  )
  const latestCrmRunByLead = useMemo(() => {
    const result = new Map<Id<"campaignLeads">, IntegrationRun>()
    for (const run of runsResult?.items ?? []) {
      if (
        !run.campaignLeadId ||
        (run.provider !== "hubspot" && run.provider !== "pipedrive") ||
        (run.operation !== "crm_push" && run.operation !== "crm_lead_push" && run.operation !== "lead_push")
      ) continue
      const existing = result.get(run.campaignLeadId)
      if (!existing || run.updatedAt > existing.updatedAt) result.set(run.campaignLeadId, run)
    }
    return result
  }, [runsResult?.items])

  const crmPreview = useQuery(
    api.integrations.previewLeadPush,
    crmTarget && crmProvider
      ? { campaignLeadId: crmTarget.campaignLeadId, provider: crmProvider }
      : "skip",
  ) as unknown as LeadPushPreview | undefined

  const filtered = useMemo(() => {
    return sortCampaignLeads(
      filterCampaignLeads(leads, filters, filterReferenceTime),
      sortBy,
      filterReferenceTime,
    )
  }, [leads, filters, sortBy, filterReferenceTime])

  const filterOptions = useMemo(() => campaignLeadFilterOptions(leads), [leads])

  const statusCounts = useMemo(() => {
    const counts = new Map<CampaignLeadStatus | "all", number>()
    counts.set("all", leads.length)
    for (const status of statusOptions) {
      counts.set(status, leads.filter((l) => l.status === status).length)
    }
    return counts
  }, [leads])

  async function handleStatusChange(
    campaignLeadId: Id<"campaignLeads">,
    status: CampaignLeadStatus,
    reason?: string,
  ): Promise<boolean> {
    if (isReadOnly) return false
    try {
      await updateLeadStatus({ campaignLeadId, status, outcomeReason: reason })
      toast.success("Status aktualisiert")
      return true
    } catch (error) {
      toast.error((error as Error)?.message ?? "Status konnte nicht geändert werden")
      return false
    }
  }

  function requestStatusChange(campaignLeadId: Id<"campaignLeads">, status: CampaignLeadStatus) {
    if (status === "won" || status === "lost") {
      setOutcomeReason("")
      setPendingOutcome({ campaignLeadId, status })
      return
    }
    void handleStatusChange(campaignLeadId, status)
  }

  async function confirmOutcome() {
    if (!pendingOutcome) return
    const saved = await handleStatusChange(
      pendingOutcome.campaignLeadId,
      pendingOutcome.status,
      outcomeReason.trim() || undefined,
    )
    if (!saved) return
    setPendingOutcome(null)
    setOutcomeReason("")
  }

  async function handleSaveNote(campaignLeadId: Id<"campaignLeads">) {
    const note = noteDrafts[campaignLeadId]?.trim() ?? ""
    if (isReadOnly) return
    setSavingNoteId(campaignLeadId)
    try {
      await saveLeadNote({ campaignLeadId, note })
      toast.success("Notiz gespeichert")
    } catch (error) {
      toast.error((error as Error)?.message ?? "Notiz konnte nicht gespeichert werden")
    } finally {
      setSavingNoteId(null)
    }
  }

  async function handleSetFollowUp(
    campaignLeadId: Id<"campaignLeads">,
    dateString: string,
  ) {
    if (isReadOnly) return
    const ts = dateInputToTimestamp(dateString)
    if (ts === null) return
    setSavingFollowUpId(campaignLeadId)
    try {
      await setFollowUp({ campaignLeadId, followUpAt: ts })
      toast.success("Follow-up gesetzt")
    } catch (error) {
      toast.error((error as Error)?.message ?? "Follow-up konnte nicht gesetzt werden")
    } finally {
      setSavingFollowUpId(null)
    }
  }

  async function handleClearFollowUp(campaignLeadId: Id<"campaignLeads">) {
    if (isReadOnly) return
    setSavingFollowUpId(campaignLeadId)
    try {
      await setFollowUp({ campaignLeadId, followUpAt: null })
      toast.success("Follow-up entfernt")
      setFollowUpDrafts((prev) => {
        const next = { ...prev }
        delete next[campaignLeadId]
        return next
      })
    } catch (error) {
      toast.error((error as Error)?.message ?? "Follow-up konnte nicht entfernt werden")
    } finally {
      setSavingFollowUpId(null)
    }
  }

  async function handleStartAudit(campaignLeadId: Id<"campaignLeads">, existingAuditId?: string) {
    if (existingAuditId) {
      navigate({ name: "audit", id: existingAuditId })
      return
    }
    if (auditStartingId) return
    setAuditStartingId(campaignLeadId)
    idempotencyKeyRef.current = crypto.randomUUID()
    try {
      const result = await startAudit({
        campaignLeadId,
        auditType: "local",
        idempotencyKey: idempotencyKeyRef.current,
      })
      navigate({ name: "audit", id: result.auditId })
    } catch (error) {
      toast.error((error as Error)?.message ?? "Audit konnte nicht gestartet werden")
    } finally {
      setAuditStartingId(null)
    }
  }

  async function confirmRemove(campaignLeadId: Id<"campaignLeads">) {
    setRemovingId(null)
    try {
      await removeLead({ campaignLeadId })
      toast.success("Lead aus Kampagne entfernt")
    } catch (error) {
      toast.error((error as Error)?.message ?? "Lead konnte nicht entfernt werden")
    }
  }

  function openEditLead(lead: CampaignLeadListItem) {
    setEditLead({
      leadId: lead.leadId,
      businessName: lead.businessName,
      category: lead.category,
      city: lead.city,
      country: lead.country,
      address: lead.address,
      phone: lead.phone,
      businessEmail: lead.businessEmail,
      reportCtaText: lead.reportCtaText,
      reportCtaUrl: lead.reportCtaUrl,
    })
    setIsEditOpen(true)
  }

  function handleExport() {
    const csv = exportCampaignLeadsCsv(
      filtered.map((lead) => ({
        businessName: lead.businessName,
        websiteUrl: lead.websiteUrl,
        category: lead.category,
        city: lead.city,
        country: lead.country,
        address: lead.address,
        phone: lead.phone,
        businessEmail: lead.businessEmail,
        status: campaignLeadStatusLabel(lead.status),
        score: lead.audit?.overallScore,
        reportOpened: (lead.audit?.viewCount ?? 0) > 0,
        lastContactedAt: lead.lastContactedAt,
        followUpAt: lead.followUpAt,
        note: lead.note,
        outcomeReason: lead.outcomeReason,
      })),
    )
    downloadCsv(csv, `kampagnen-leads-${new Date().toISOString().slice(0, 10)}.csv`)
    toast.success(`${filtered.length} ${filtered.length === 1 ? "Lead" : "Leads"} exportiert`)
  }

  function openCrmPush(lead: CampaignLeadRow) {
    const provider = connectedCrms[0]?.provider
    if (!provider) {
      toast.error("Verbinde zuerst HubSpot oder Pipedrive in den Integrations-Einstellungen")
      return
    }
    setCrmProvider(provider)
    setCrmTarget(lead)
  }

  async function handleEnqueueLeadPush() {
    if (!crmTarget || !crmPreview || crmBusy) return
    setCrmBusy(true)
    try {
      await enqueueLeadPush({
        campaignLeadId: crmTarget.campaignLeadId,
        integrationId: crmPreview.integrationId,
      })
      toast.success(`${crmPreview.provider === "hubspot" ? "HubSpot" : "Pipedrive"}-Abgleich vorgemerkt`)
      setCrmTarget(null)
    } catch (error) {
      toast.error((error as Error)?.message ?? "CRM-Abgleich konnte nicht gestartet werden")
    } finally {
      setCrmBusy(false)
    }
  }

  async function handleRetryRun(runId: Id<"integrationRuns">) {
    if (retryingRunId) return
    setRetryingRunId(runId)
    try {
      await retryRun({ runId })
      toast.success("CRM-Abgleich erneut vorgemerkt")
    } catch (error) {
      toast.error((error as Error)?.message ?? "CRM-Abgleich konnte nicht erneut gestartet werden")
    } finally {
      setRetryingRunId(null)
    }
  }

  async function handleSheetExport() {
    if (!sheetSpreadsheetUrl.trim() || !sheetName.trim() || sheetExportBusy) return
    setSheetExportBusy(true)
    setSheetExportResult(null)
    try {
      const result = await exportCampaignLeadsToSheet({
        campaignId,
        spreadsheetUrl: sheetSpreadsheetUrl.trim(),
        sheetName: sheetName.trim(),
        campaignLeadIds: filtered.map((lead) => lead.campaignLeadId),
      })
      setSheetExportResult(result as SheetExportResult)
      toast.success(`${result.rowCount} ${result.rowCount === 1 ? "Lead" : "Leads"} in neuen Tabellen-Tab exportiert`)
    } catch (error) {
      toast.error((error as Error)?.message ?? "Google-Sheets-Export konnte nicht abgeschlossen werden")
    } finally {
      setSheetExportBusy(false)
    }
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Building2 className="size-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">Noch keine Leads in dieser Kampagne</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Nutze die Suche oben, um lokale Unternehmen zu finden und direkt hinzuzufügen.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-0">
      <div className="space-y-3 px-4 pt-4 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <Label htmlFor="campaign-lead-search" className="sr-only">Leads durchsuchen</Label>
            <Input
              id="campaign-lead-search"
              placeholder="Name, Branche, Stadt oder Website"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              className="w-full md:max-w-sm"
            />
          </div>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as CampaignLeadSort)}>
            <SelectTrigger className="w-full md:w-[210px]" aria-label="Leads sortieren">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Fällig & niedriger Score</SelectItem>
              <SelectItem value="updated">Zuletzt aktualisiert</SelectItem>
              <SelectItem value="name">Name A–Z</SelectItem>
              <SelectItem value="score">Niedrigster Score</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
          role="group"
          aria-label="Lead-Filter"
        >
          <Select
            value={filters.category}
            onValueChange={(value) => setFilters((current) => ({ ...current, category: value }))}
          >
            <SelectTrigger aria-label="Nach Branche filtern"><SelectValue placeholder="Branche" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Branchen</SelectItem>
              {filterOptions.categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={filters.city}
            onValueChange={(value) => setFilters((current) => ({ ...current, city: value }))}
          >
            <SelectTrigger aria-label="Nach Stadt filtern"><SelectValue placeholder="Stadt" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Städte</SelectItem>
              {filterOptions.cities.map((city) => <SelectItem key={city} value={city}>{city}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={filters.score}
            onValueChange={(value) => setFilters((current) => ({ ...current, score: value as CampaignScoreFilter }))}
          >
            <SelectTrigger aria-label="Nach Audit-Score filtern"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Scores</SelectItem>
              <SelectItem value="under-40">Unter 40</SelectItem>
              <SelectItem value="40-59">40–59</SelectItem>
              <SelectItem value="60-74">60–74</SelectItem>
              <SelectItem value="75-plus">Ab 75</SelectItem>
              <SelectItem value="without-audit">Ohne Audit</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.status}
            onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          >
            <SelectTrigger aria-label="Nach CRM-Status filtern">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                Alle ({statusCounts.get("all")})
              </SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {campaignLeadStatusLabel(s)} ({statusCounts.get(s) ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.report}
            onValueChange={(value) => setFilters((current) => ({ ...current, report: value as CampaignReportFilter }))}
          >
            <SelectTrigger aria-label="Nach Report-Öffnung filtern"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Reports</SelectItem>
              <SelectItem value="opened">Report geöffnet</SelectItem>
              <SelectItem value="not-opened">Nicht geöffnet</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.lastContact}
            onValueChange={(value) => setFilters((current) => ({ ...current, lastContact: value as CampaignLastContactFilter }))}
          >
            <SelectTrigger aria-label="Nach letztem Kontakt filtern"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Jeder Kontakt</SelectItem>
              <SelectItem value="never">Nie kontaktiert</SelectItem>
              <SelectItem value="last-7-days">Bis 7 Tage</SelectItem>
              <SelectItem value="days-8-30">8–30 Tage</SelectItem>
              <SelectItem value="older-30-days">Älter als 30 Tage</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="campaign-audit-ready"
              checked={filters.auditReadyOnly}
              onCheckedChange={(checked) => setFilters((current) => ({ ...current, auditReadyOnly: checked === true }))}
            />
            <Label htmlFor="campaign-audit-ready" className="cursor-pointer text-xs font-normal">Nur auditierbar</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="campaign-follow-up-due"
              checked={filters.followUpDueOnly}
              onCheckedChange={(checked) => setFilters((current) => ({ ...current, followUpDueOnly: checked === true }))}
            />
            <Label htmlFor="campaign-follow-up-due" className="cursor-pointer text-xs font-normal">Follow-up fällig</Label>
          </div>
          {hasActiveCampaignLeadFilters(filters) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => setFilters(defaultCampaignLeadFilters)}
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              Filter zurücksetzen
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 sm:px-6">
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "Lead" : "Leads"}
        </span>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={filtered.length === 0}
            onClick={handleExport}
          >
            <Download className="size-3.5" aria-hidden="true" />
            CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={filtered.length === 0}
            onClick={() => {
              if (!sheetsConnection) {
                toast.error("Verbinde zuerst Google Sheets in den Integrations-Einstellungen")
                return
              }
              setSheetExportResult(null)
              setSheetExportOpen(true)
            }}
          >
            <FileSpreadsheet className="size-3.5" aria-hidden="true" />
            Google Sheets
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium">Keine passenden Leads</p>
          <p className="mt-1 text-xs text-muted-foreground">Passe die Filter an oder setze sie zurück.</p>
        </div>
      ) : <Expandable type="single" collapsible className="divide-y">
        {filtered.map((lead) => (
          <ExpandableItem
            key={lead.campaignLeadId}
            value={lead.campaignLeadId}
            className="px-4 sm:px-6"
          >
            <ExpandableTrigger
              className="items-center"
              action={
                <div className="shrink-0 group-data-[state=closed]:block group-data-[state=open]:hidden">
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={
                      auditStartingId === lead.campaignLeadId || campaignStatus !== "active"
                    }
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleStartAudit(lead.campaignLeadId, lead.audit?._id)
                    }}
                  >
                    {auditStartingId === lead.campaignLeadId ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Globe className="size-3.5" />
                    )}
                    {lead.audit ? "Zum Audit" : "Audit starten"}
                  </Button>
                </div>
              }
            >
              <CampaignLeadSummary
                lead={lead}
                now={filterReferenceTime}
                crmRun={latestCrmRunByLead.get(lead.campaignLeadId)}
              />
            </ExpandableTrigger>

            <ExpandableContent>
              <LeadDetailPanel
                lead={lead}
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={
                        auditStartingId === lead.campaignLeadId || campaignStatus !== "active"
                      }
                      onClick={() => void handleStartAudit(lead.campaignLeadId, lead.audit?._id)}
                    >
                      {auditStartingId === lead.campaignLeadId ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Globe className="size-3.5" />
                      )}
                      {lead.audit ? "Zum Audit" : "Audit starten"}
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={isReadOnly || isTerminalStatus(lead.status)}
                        >
                          Status
                          <MoreHorizontal className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {statusOptions
                          .filter((s) => s !== lead.status && !isTerminalStatus(lead.status))
                          .map((s) => (
                            <DropdownMenuItem
                              key={s}
                              onClick={() => requestStatusChange(lead.campaignLeadId, s)}
                            >
                              {campaignLeadStatusLabel(s)}
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={isReadOnly}
                      onClick={() =>
                        setNoteDrafts((prev) => ({
                          ...prev,
                          [lead.campaignLeadId]: lead.note ?? "",
                        }))
                      }
                    >
                      <FileText className="size-3.5" />
                      Notiz
                    </Button>

                    <LeadEditButton lead={lead} onClick={() => openEditLead(lead)} />

                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={
                        isReadOnly ||
                        !lead.audit
                      }
                      title={
                        connectedCrms.length === 0
                          ? "HubSpot oder Pipedrive unter Integrationen verbinden"
                          : !lead.audit
                            ? "Lead zuerst auditieren"
                            : undefined
                      }
                      onClick={() => openCrmPush(lead)}
                    >
                      <Send className="size-3.5" aria-hidden="true" />
                      An CRM senden
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={isReadOnly}
                      onClick={() => setRemovingId(lead.campaignLeadId)}
                      aria-label={`${lead.businessName} aus der Kampagne entfernen`}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                }
              />

              {lead.status === "won" && connectedCrms.length > 0 && !latestCrmRunByLead.get(lead.campaignLeadId) && (
                <div className="mt-4 flex flex-col gap-3 rounded-lg border bg-score-strong/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Gewonnenen Lead ins CRM übernehmen</p>
                    <p className="text-xs text-muted-foreground">
                      Übertrage nur Unternehmensdaten, Score, öffentlichen Report-Link und Ergebnis.
                    </p>
                  </div>
                  <Button size="sm" className="shrink-0 gap-1.5" onClick={() => openCrmPush(lead)}>
                    <Send className="size-3.5" aria-hidden="true" />
                    Vorschau prüfen
                  </Button>
                </div>
              )}

              {(() => {
                const run = latestCrmRunByLead.get(lead.campaignLeadId)
                if (!run || !["retryable_failed", "permanent_failed", "unknown"].includes(run.status)) return null
                return (
                  <Alert variant="destructive" className="mt-4">
                    <TriangleAlert aria-hidden="true" />
                    <AlertDescription>
                      <p>{run.safeError ?? "Der CRM-Abgleich konnte nicht abgeschlossen werden."}</p>
                      {run.status === "retryable_failed" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={retryingRunId !== null}
                          onClick={() => void handleRetryRun(run._id)}
                        >
                          {retryingRunId === run._id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="size-3.5" />
                          )}
                          Erneut versuchen
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>
                )
              })()}

              <div className="grid gap-4 pt-4 md:grid-cols-2">
                {isTerminalStatus(lead.status) && (
                  <div className="rounded-md border bg-muted/30 p-3 md:col-span-2">
                    <p className="text-xs font-medium">Ergebnis</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {lead.outcomeReason || "Kein Ergebnisgrund hinterlegt."}
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Notiz</Label>
                  <Textarea
                    placeholder="Gesprächsnotiz, nächste Schritte..."
                    value={noteDrafts[lead.campaignLeadId] ?? lead.note ?? ""}
                    onChange={(e) =>
                      setNoteDrafts((prev) => ({
                        ...prev,
                        [lead.campaignLeadId]: e.target.value,
                      }))
                    }
                    disabled={isReadOnly}
                    rows={3}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {lead.noteUpdatedAt
                        ? `Zuletzt ${formatDateTime(lead.noteUpdatedAt)}`
                        : "Noch keine Notiz"}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isReadOnly || savingNoteId === lead.campaignLeadId}
                      onClick={() => void handleSaveNote(lead.campaignLeadId)}
                    >
                      {savingNoteId === lead.campaignLeadId ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                      Speichern
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Follow-up</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={
                        followUpDrafts[lead.campaignLeadId] ??
                        timestampToDateInput(lead.followUpAt)
                      }
                      onChange={(e) =>
                        setFollowUpDrafts((prev) => ({
                          ...prev,
                          [lead.campaignLeadId]: e.target.value,
                        }))
                      }
                      disabled={isReadOnly || isTerminalStatus(lead.status)}
                      className="w-full"
                    />
                    <Button
                      size="sm"
                      disabled={isReadOnly || savingFollowUpId === lead.campaignLeadId}
                      onClick={() =>
                        void handleSetFollowUp(
                          lead.campaignLeadId,
                          followUpDrafts[lead.campaignLeadId] ??
                            timestampToDateInput(lead.followUpAt),
                        )
                      }
                    >
                      {savingFollowUpId === lead.campaignLeadId ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Calendar className="size-3.5" />
                      )}
                      Setzen
                    </Button>
                    {lead.followUpAt && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isReadOnly || savingFollowUpId === lead.campaignLeadId}
                        onClick={() => void handleClearFollowUp(lead.campaignLeadId)}
                        aria-label={`Follow-up für ${lead.businessName} entfernen`}
                      >
                        <X className="size-3.5" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Beim Setzen wechselt der Status automatisch zu "Follow-up".
                  </p>
                </div>
              </div>
            </ExpandableContent>
          </ExpandableItem>
        ))}
      </Expandable>}

      <LeadEditDialog lead={editLead} open={isEditOpen} onOpenChange={setIsEditOpen} />

      <Dialog open={!!removingId} onOpenChange={() => setRemovingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lead entfernen</DialogTitle>
            <DialogDescription>
              Dieser Lead wird aus der Kampagne entfernt. Der gespeicherte Lead bleibt im Account erhalten.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemovingId(null)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() => removingId && void confirmRemove(removingId)}
            >
              Entfernen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pendingOutcome}
        onOpenChange={(open) => {
          if (!open) {
            setPendingOutcome(null)
            setOutcomeReason("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Lead als {pendingOutcome?.status === "won" ? "gewonnen" : "verloren"} markieren
            </DialogTitle>
            <DialogDescription>
              Ein kurzer Grund ist optional und hilft bei der späteren Kampagnenauswertung.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="campaign-outcome-reason">Ergebnisgrund (optional)</Label>
            <Input
              id="campaign-outcome-reason"
              value={outcomeReason}
              onChange={(event) => setOutcomeReason(event.target.value)}
              placeholder={pendingOutcome?.status === "won" ? "z. B. Angebot angenommen" : "z. B. Kein Budget"}
              maxLength={500}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingOutcome(null)}>Abbrechen</Button>
            <Button onClick={() => void confirmOutcome()}>Status speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!crmTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCrmTarget(null)
            setCrmProvider(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Lead an CRM senden</DialogTitle>
            <DialogDescription>
              Ein manueller, einmaliger Upsert. SitePitch synchronisiert keine späteren Änderungen automatisch.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {connectedCrms.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="campaign-crm-provider">Ziel</Label>
                <Select value={crmProvider ?? ""} onValueChange={(value) => setCrmProvider(value as CrmProvider)}>
                  <SelectTrigger id="campaign-crm-provider">
                    <SelectValue placeholder="CRM auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedCrms.map((connection) => (
                      <SelectItem key={connection._id} value={connection.provider}>
                        {connection.provider === "hubspot" ? "HubSpot" : "Pipedrive"}
                        {connection.accountLabel ? ` · ${connection.accountLabel}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {crmPreview === undefined ? (
              <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Sichere Vorschau wird erstellt …
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {crmPreview.provider === "hubspot" ? "HubSpot Company" : "Pipedrive Organization"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {crmPreview.accountLabel ?? "Verbundenes Konto"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {crmPreview.existingRemoteEntity ? "Bestehenden Eintrag aktualisieren" : "Eintrag anlegen"}
                  </span>
                </div>

                <dl className="grid gap-x-5 gap-y-2 rounded-lg border p-4 text-sm sm:grid-cols-[8rem_1fr]">
                  <dt className="text-muted-foreground">Unternehmen</dt>
                  <dd className="font-medium">{crmPreview.fields.businessName}</dd>
                  <dt className="text-muted-foreground">Domain</dt>
                  <dd>{crmPreview.fields.domain ?? "Nicht vorhanden"}</dd>
                  <dt className="text-muted-foreground">Ort</dt>
                  <dd>{[crmPreview.fields.city, crmPreview.fields.country].filter(Boolean).join(", ") || "Nicht vorhanden"}</dd>
                  <dt className="text-muted-foreground">Audit-Score</dt>
                  <dd>{crmPreview.fields.score ?? "Nicht vorhanden"}</dd>
                  <dt className="text-muted-foreground">Report-Link</dt>
                  <dd className="min-w-0 break-all">{crmPreview.fields.reportUrl ?? "Report nicht öffentlich"}</dd>
                  <dt className="text-muted-foreground">Ergebnis</dt>
                  <dd>{crmPreview.fields.outcome ? campaignLeadStatusLabel(crmPreview.fields.outcome) : "Nicht ausgewählt"}</dd>
                </dl>
                <p className="text-xs text-muted-foreground">
                  Notizen, Ergebnisgrund, Outreach-Texte, Rohdaten und Findings werden nicht übertragen.
                </p>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={crmBusy} onClick={() => setCrmTarget(null)}>
              Abbrechen
            </Button>
            <Button disabled={!crmPreview || crmBusy} onClick={() => void handleEnqueueLeadPush()}>
              {crmBusy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {crmPreview?.provider === "pipedrive" ? "An Pipedrive senden" : "An HubSpot senden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={sheetExportOpen}
        onOpenChange={(open) => {
          setSheetExportOpen(open)
          if (!open) setSheetExportResult(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nach Google Sheets exportieren</DialogTitle>
            <DialogDescription>
              Exportiert die aktuell gefilterten Leads als RAW-Werte in einen neuen Tab. Bestehende Tabs werden nie überschrieben.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-sheet-export-url">Google-Sheets-URL</Label>
              <Input
                id="campaign-sheet-export-url"
                type="url"
                inputMode="url"
                value={sheetSpreadsheetUrl}
                placeholder="https://docs.google.com/spreadsheets/d/…"
                onChange={(event) => setSheetSpreadsheetUrl(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-sheet-export-name">Name des neuen Tabs</Label>
              <Input
                id="campaign-sheet-export-name"
                value={sheetName}
                maxLength={80}
                onChange={(event) => setSheetName(event.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "gefilterter Lead wird" : "gefilterte Leads werden"} exportiert.
            </p>
            {sheetExportResult && (
              <Alert className="bg-score-strong/5 text-score-strong">
                <Check aria-hidden="true" />
                <AlertDescription className="text-foreground">
                  {sheetExportResult.rowCount} {sheetExportResult.rowCount === 1 ? "Lead wurde" : "Leads wurden"} in „{sheetExportResult.tabName}“ exportiert.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={sheetExportBusy} onClick={() => setSheetExportOpen(false)}>
              {sheetExportResult ? "Schließen" : "Abbrechen"}
            </Button>
            {!sheetExportResult && (
              <Button
                disabled={!sheetSpreadsheetUrl.trim() || !sheetName.trim() || sheetExportBusy}
                onClick={() => void handleSheetExport()}
              >
                {sheetExportBusy ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
                In neuen Tab exportieren
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
