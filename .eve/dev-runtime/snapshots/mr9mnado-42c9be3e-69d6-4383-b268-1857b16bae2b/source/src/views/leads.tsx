"use client"

import { useState, useMemo } from "react"
import {
  Search,
  Phone,
  Globe,
  ArrowRight,
  CalendarClock,
  ScanSearch,
  MapPin,
  Users,
} from "lucide-react"

import { toast } from "@/components/ui/sonner"
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
import { ScoreBadge, LeadStatusBadge } from "@/components/status-badges"
import { useRouter } from "@/lib/router"
import { leads, campaignById } from "@/lib/mock-data"
import { leadStatusMeta, formatRelative } from "@/lib/scores"
import { cn } from "@/lib/utils"
import type { LeadStatus } from "@/lib/types"

const pipeline: { value: LeadStatus | "all"; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "new", label: "Neu" },
  { value: "audited", label: "Auditiert" },
  { value: "contacted", label: "Kontaktiert" },
  { value: "follow_up", label: "Follow-up" },
  { value: "interested", label: "Interessiert" },
  { value: "won", label: "Gewonnen" },
  { value: "lost", label: "Verloren" },
]

function isOverdue(iso?: string) {
  return iso !== undefined && new Date(iso).getTime() < Date.now()
}

export function LeadsView() {
  const { navigate } = useRouter()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<LeadStatus | "all">("all")

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const l of leads) map[l.status] = (map[l.status] ?? 0) + 1
    return map
  }, [])

  const followUps = useMemo(
    () => leads.filter((l) => isOverdue(l.followUpAt)).length,
    []
  )

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (status !== "all" && l.status !== status) return false
      if (
        query &&
        !`${l.businessName} ${l.websiteUrl ?? ""} ${l.city} ${l.category}`
          .toLowerCase()
          .includes(query.toLowerCase())
      )
        return false
      return true
    })
  }, [query, status])

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Leads</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {leads.length} Kontakte in der Pipeline
            {followUps > 0 && (
              <> · <span className="font-medium text-score-weak">{followUps} Follow-ups fällig</span></>
            )}
          </p>
        </div>
        <Button className="gap-2" onClick={() => toast.info("Lead-Import", { description: "Lead-Quellen werden im Post-MVP angebunden." })}>
          <Users className="size-4" />
          Leads importieren
        </Button>
      </div>

      {/* Pipeline summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(["new", "contacted", "follow_up", "interested", "won", "lost"] as LeadStatus[]).map(
          (s) => (
            <button
              key={s}
              onClick={() => setStatus(status === s ? "all" : s)}
              className={cn(
                "rounded-xl border bg-card p-3 text-left transition-colors hover:border-foreground/20",
                status === s && "border-primary ring-1 ring-primary/30"
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", leadStatusMeta[s].dot)} />
                <span className="text-xs text-muted-foreground">{leadStatusMeta[s].label}</span>
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{counts[s] ?? 0}</div>
            </button>
          )
        )}
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="gap-3 border-b py-4 [.border-b]:pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
              {pipeline.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatus(f.value)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    status === f.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Suche …"
                className="h-9 w-full pl-8 lg:w-60"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[70px] pl-6">Score</TableHead>
                <TableHead>Unternehmen</TableHead>
                <TableHead className="hidden md:table-cell">Kampagne</TableHead>
                <TableHead className="hidden lg:table-cell">Kontakt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell text-right pr-6">Nächster Schritt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => {
                const overdue = isOverdue(l.followUpAt)
                return (
                  <TableRow
                    key={l.id}
                    className={cn(l.auditId && "cursor-pointer")}
                    onClick={() =>
                      l.auditId && navigate({ name: "audit", id: l.auditId })
                    }
                  >
                    <TableCell className="pl-6">
                      {l.score !== undefined ? (
                        <ScoreBadge score={l.score} />
                      ) : (
                        <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{l.businessName}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" />
                        {l.category} · {l.city}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {l.campaignId ? campaignById(l.campaignId)?.name : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                        {l.websiteUrl ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Globe className="size-3" />
                            {l.websiteUrl}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground/60">
                            <Globe className="size-3" />
                            keine Website
                          </span>
                        )}
                        {l.phone && (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="size-3" />
                            {l.phone}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <LeadStatusBadge status={l.status} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell pr-6 text-right">
                      {overdue ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-score-weak">
                          <CalendarClock className="size-3.5" />
                          Follow-up fällig
                        </span>
                      ) : l.auditId ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <ScanSearch className="size-3.5" />
                          Report ansehen
                        </span>
                      ) : l.websiteUrl ? (
                        <span className="text-xs text-muted-foreground">Audit bereit</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">
                          {formatRelative(l.createdAt)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Users className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Keine Leads gefunden</p>
                <p className="text-xs text-muted-foreground">
                  Passe die Filter an oder importiere neue Leads.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setStatus("all")
                  setQuery("")
                }}
              >
                Filter zurücksetzen
                <ArrowRight className="size-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
