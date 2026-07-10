"use client"

import { useMemo, useRef, useState } from "react"
import { useAction, useMutation } from "convex/react"
import { useRouter } from "@/lib/router"
import {
  Building2,
  Calendar,
  Check,
  ChevronDown,
  FileText,
  Globe,
  Loader2,
  MoreHorizontal,
  Trash2,
  X,
} from "lucide-react"

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
import {
  Expandable,
  ExpandableContent,
  ExpandableItem,
  ExpandableTrigger,
} from "@/components/ui/expandable"
import { toast } from "@/components/ui/sonner"
import { LeadDetailPanel } from "@/components/lead-common"
import { LeadEditDialog, LeadEditButton } from "@/components/lead-edit-dialog"
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

function LeadAuditBadge({ lead }: { lead: CampaignLeadListItem }) {
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

function CampaignLeadSummary({ lead }: { lead: CampaignLeadListItem }) {
  return (
    <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1">
      <div className="min-w-0">
        <span className="font-medium">{lead.businessName}</span>
        {lead.category && (
          <span className="ml-2 text-xs text-muted-foreground">{lead.category}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <LeadAuditBadge lead={lead} />
        <CampaignLeadStatusBadge status={lead.status} />
        {lead.city && (
          <span className="hidden text-xs text-muted-foreground sm:inline">{lead.city}</span>
        )}
      </div>
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

export type CampaignLeadTableProps = {
  campaignId: Id<"campaigns">
  campaignStatus: CampaignStatus
  leads: CampaignLeadListItem[]
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

  const [filter, setFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<CampaignLeadStatus | "all">("all")
  const [sortBy, setSortBy] = useState<"updated" | "name" | "score">("updated")
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
  } | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)

  const isReadOnly = campaignStatus === "archived" || campaignStatus === "paused"

  const filtered = useMemo(() => {
    let rows = [...leads]
    if (statusFilter !== "all") {
      rows = rows.filter((l) => l.status === statusFilter)
    }
    if (filter.trim()) {
      const q = filter.toLowerCase()
      rows = rows.filter(
        (l) =>
          l.businessName.toLowerCase().includes(q) ||
          l.category?.toLowerCase().includes(q) ||
          l.city?.toLowerCase().includes(q) ||
          l.websiteUrl?.toLowerCase().includes(q),
      )
    }
    rows.sort((a, b) => {
      if (sortBy === "name") return a.businessName.localeCompare(b.businessName)
      if (sortBy === "score") {
        const aScore = a.audit?.overallScore ?? -1
        const bScore = b.audit?.overallScore ?? -1
        return bScore - aScore
      }
      return b.updatedAt - a.updatedAt
    })
    return rows
  }, [leads, statusFilter, filter, sortBy])

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
  ) {
    if (isReadOnly) return
    try {
      await updateLeadStatus({ campaignLeadId, status })
      toast.success("Status aktualisiert")
    } catch (error) {
      toast.error((error as Error)?.message ?? "Status konnte nicht geändert werden")
    }
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
    })
    setIsEditOpen(true)
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
      <div className="flex flex-col gap-3 px-6 pt-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as CampaignLeadStatus | "all")}
          >
            <SelectTrigger className="w-[180px]">
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
          <Input
            placeholder="Leads durchsuchen"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full sm:w-[240px]"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Zuletzt aktualisiert</SelectItem>
            <SelectItem value="name">Name A-Z</SelectItem>
            <SelectItem value="score">Audit-Score</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="px-6 text-xs text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "Lead" : "Leads"}
      </div>

      <Expandable type="single" collapsible className="divide-y">
        {filtered.map((lead) => (
          <ExpandableItem
            key={lead.campaignLeadId}
            value={lead.campaignLeadId}
            className="px-6"
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
              <CampaignLeadSummary lead={lead} />
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
                              onClick={() => void handleStatusChange(lead.campaignLeadId, s)}
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
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={isReadOnly}
                      onClick={() => setRemovingId(lead.campaignLeadId)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                }
              />

              <div className="grid gap-4 pt-4 md:grid-cols-2">
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
                      >
                        <X className="size-3.5" />
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
      </Expandable>

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
    </div>
  )
}
