"use client"

import { useState, useMemo } from "react"
import { Search, Eye, ArrowRight, Plus, Copy, Trash2, RotateCcw, MousePointerClick, FileDown } from "lucide-react"
import { useMutation, useQuery } from "convex/react"

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  ScoreBadge,
  AuditStatusBadge,
} from "@/components/status-badges"
import { NewAuditDialog } from "@/components/new-audit-dialog"
import { useRouter } from "@/lib/router"
import { formatRelativeTs } from "@/lib/scores"
import { toast } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  leadStatusOptions,
  formatAuditViewCount,
  matchesAuditFilter,
  matchesAuditSearch,
  outreachStatusMeta,
  type AuditFilter,
} from "@/lib/audit-inbox"
import type { LeadStatus } from "@/lib/types"

const statusFilters: { value: AuditFilter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "running", label: "Läuft" },
  { value: "completed", label: "Fertig" },
  { value: "failed", label: "Fehlgeschlagen" },
]

export function AuditsView() {
  const { navigate } = useRouter()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<AuditFilter>("all")
  const [deleteTarget, setDeleteTarget] = useState<{ id: Id<"audits">; domain: string } | null>(null)
  const [updatingLeadId, setUpdatingLeadId] = useState<Id<"leads"> | null>(null)

  const data = useQuery(api.audits.listMyAudits, {})
  const deleteAudit = useMutation(api.audits.deleteAudit)
  const updateLeadStatus = useMutation(api.leads.updateLeadStatus)

  const items = data?.items ?? []

  const filtered = useMemo(() => {
    return items.filter((a) => {
      return matchesAuditFilter(a.status, status) && matchesAuditSearch(a, query)
    })
  }, [items, query, status])

  if (data === undefined) {
    return (
      <div className="mx-auto flex min-h-[40vh] w-full max-w-[1400px] items-center justify-center p-4 md:p-6">
        <Spinner className="size-6 text-primary" />
      </div>
    )
  }

  const totalCount = data?.total ?? 0

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteAudit({ auditId: deleteTarget.id })
      toast.success("Audit gelöscht", { description: deleteTarget.domain })
    } catch {
      toast.error("Audit konnte nicht gelöscht werden")
    } finally {
      setDeleteTarget(null)
    }
  }

  const changeLeadStatus = async (leadId: Id<"leads">, nextStatus: LeadStatus) => {
    setUpdatingLeadId(leadId)
    try {
      await updateLeadStatus({ leadId, status: nextStatus })
      const label = leadStatusOptions.find((option) => option.value === nextStatus)?.label ?? nextStatus
      toast.success("Lead-Status aktualisiert", { description: `Neu: ${label}` })
    } catch {
      toast.error("Lead-Status konnte nicht aktualisiert werden")
    } finally {
      setUpdatingLeadId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Audit-Inbox</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} von {totalCount} Audits · nach Potenzial priorisieren
          </p>
        </div>
        <NewAuditDialog
          trigger={
            <Button className="gap-2">
              <Plus className="size-4" />
              Neuer Audit
            </Button>
          }
        />
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="gap-3 border-b py-4 [.border-b]:pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
              {statusFilters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatus(f.value)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    status === f.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Suche nach Domain …"
                  className="h-9 w-full pl-8 sm:w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[70px] pl-6">Score</TableHead>
                <TableHead>Lead / Website</TableHead>
                <TableHead>Audit-Status</TableHead>
                <TableHead>Engagement</TableHead>
                <TableHead>Outreach</TableHead>
                <TableHead>Lead-Status</TableHead>
                <TableHead className="w-[48px] pr-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow
                  key={a._id}
                  className="cursor-pointer"
                  onClick={() => navigate({ name: "audit", id: a._id })}
                >
                  <TableCell className="pl-6">
                    {a.overallScore !== null ? (
                      <ScoreBadge score={a.overallScore} />
                    ) : (
                      <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                        —
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {a.businessName ?? "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">{a.domain}</div>
                  </TableCell>
                  <TableCell>
                    <AuditStatusBadge status={a.status as Parameters<typeof AuditStatusBadge>[0]["status"]} />
                  </TableCell>
                  <TableCell>
                    <div className="grid w-fit grid-cols-4 gap-x-2 text-xs tabular-nums text-muted-foreground">
                      <span className="inline-flex items-center gap-1" title="Views"><Eye className="size-3.5" />{formatAuditViewCount(a.views, a.viewCountCapped)}</span>
                      <span className="inline-flex items-center gap-1" title="Reopens"><RotateCcw className="size-3.5" />{a.reopenCount}</span>
                      <span className="inline-flex items-center gap-1" title="CTA-Klicks"><MousePointerClick className="size-3.5" />{a.ctaClicks}</span>
                      <span className="inline-flex items-center gap-1" title="PDF-Downloads"><FileDown className="size-3.5" />{a.pdfDownloads}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {a.lastViewedAt ? `Zuletzt ${formatRelativeTs(a.lastViewedAt)}` : "Noch nicht angesehen"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("gap-1.5 border-0", outreachStatusMeta[a.outreachStatus].className)}>
                      {a.outreachStatus === "copied" && <Copy className="size-3" />}
                      {outreachStatusMeta[a.outreachStatus].label}
                    </Badge>
                  </TableCell>
                  <TableCell
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    {a.leadId && a.leadStatus ? (
                      <Select
                        value={a.leadStatus}
                        disabled={updatingLeadId === a.leadId}
                        onValueChange={(value) => void changeLeadStatus(a.leadId!, value as LeadStatus)}
                      >
                        <SelectTrigger className="h-8 w-[138px] text-xs" aria-label={`Lead-Status für ${a.businessName ?? a.domain}`}>
                          {updatingLeadId === a.leadId && <Spinner className="size-3" />}
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {leadStatusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget({ id: a._id, domain: a.domain })
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Search className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {totalCount === 0 ? "Noch keine Audits" : "Keine Audits gefunden"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {totalCount === 0
                    ? "Starte deinen ersten Audit, um loszulegen."
                    : "Passe die Filter an oder starte einen neuen Audit."}
                </p>
              </div>
              {totalCount === 0 ? (
                <NewAuditDialog
                  trigger={
                    <Button size="sm" className="gap-1.5">
                      <Plus className="size-4" />
                      Ersten Audit starten
                    </Button>
                  }
                />
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => { setStatus("all"); setQuery("") }}
                >
                  Filter zurücksetzen
                  <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Audit löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Audit für <span className="font-medium text-foreground">{deleteTarget?.domain}</span> wird
              inklusive aller Findings, Outreach-Texte und Views dauerhaft entfernt.
              Credit-Buchungen bleiben aus Abrechnungsgründen erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDelete}
            >
              <Trash2 className="size-4" />
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
