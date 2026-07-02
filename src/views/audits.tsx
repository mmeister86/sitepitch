import { useState, useMemo } from "react"
import { Search, Eye, Copy, ArrowRight, Plus, SlidersHorizontal } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ScoreBadge,
  LeadStatusBadge,
  AuditStatusBadge,
} from "@/components/status-badges"
import { NewAuditDialog } from "@/components/new-audit-dialog"
import { useRouter } from "@/lib/router"
import { audits, campaigns, campaignById } from "@/lib/mock-data"
import { formatRelative } from "@/lib/scores"
import { cn } from "@/lib/utils"
import type { LeadStatus } from "@/lib/types"

const statusFilters: { value: LeadStatus | "all"; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "new", label: "Neu" },
  { value: "contacted", label: "Kontaktiert" },
  { value: "follow_up", label: "Follow-up" },
  { value: "interested", label: "Interessiert" },
  { value: "won", label: "Gewonnen" },
]

export function AuditsView() {
  const { navigate } = useRouter()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<LeadStatus | "all">("all")
  const [campaign, setCampaign] = useState<string>("all")

  const filtered = useMemo(() => {
    return audits.filter((a) => {
      if (status !== "all" && a.leadStatus !== status) return false
      if (campaign !== "all" && a.campaignId !== campaign) return false
      if (
        query &&
        !`${a.businessName} ${a.domain} ${a.city} ${a.industry}`
          .toLowerCase()
          .includes(query.toLowerCase())
      )
        return false
      return true
    })
  }, [query, status, campaign])

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Audit-Inbox</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} von {audits.length} Audits · nach Potenzial priorisieren
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
                      : "text-muted-foreground hover:text-foreground"
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
                  placeholder="Suche …"
                  className="h-9 w-full pl-8 sm:w-52"
                />
              </div>
              <Select value={campaign} onValueChange={setCampaign}>
                <SelectTrigger className="h-9 w-[180px]">
                  <SlidersHorizontal className="size-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Kampagne" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Kampagnen</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <TableHead className="hidden lg:table-cell">Audit</TableHead>
                <TableHead className="text-center">Views</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell text-right pr-6">
                  Erstellt
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow
                  key={a.id}
                  className="cursor-pointer"
                  onClick={() => navigate({ name: "audit", id: a.id })}
                >
                  <TableCell className="pl-6">
                    {a.overallScore !== undefined ? (
                      <ScoreBadge score={a.overallScore} />
                    ) : (
                      <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                        —
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{a.businessName}</div>
                    <div className="text-xs text-muted-foreground">{a.domain}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {a.campaignId ? campaignById(a.campaignId)?.name : "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {a.status === "completed" ? (
                      a.outreachStatus !== "not_started" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Copy className="size-3.5" />
                          Outreach kopiert
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Bereit</span>
                      )
                    ) : (
                      <AuditStatusBadge status={a.status} />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center gap-1 text-sm tabular-nums text-muted-foreground">
                      <Eye className="size-3.5" />
                      {a.engagement.views}
                    </span>
                  </TableCell>
                  <TableCell>
                    <LeadStatusBadge status={a.leadStatus} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell pr-6 text-right text-xs text-muted-foreground">
                    {formatRelative(a.createdAt)}
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
                <p className="text-sm font-medium">Keine Audits gefunden</p>
                <p className="text-xs text-muted-foreground">
                  Passe die Filter an oder starte einen neuen Audit.
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setStatus("all"); setCampaign("all"); setQuery("") }}>
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
