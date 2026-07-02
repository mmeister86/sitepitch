import { toast } from "sonner"
import {
  Plus,
  Users,
  ScanSearch,
  Copy,
  Eye,
  Trophy,
  MapPin,
  MoreHorizontal,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from "@/lib/router"
import { campaigns } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import type { Campaign } from "@/lib/types"

const offerLabel: Record<Campaign["offerType"], string> = {
  relaunch: "Website-Relaunch",
  maintenance: "Website-Pflege",
  seo: "SEO-Optimierung",
  conversion: "Conversion-Optimierung",
  performance: "Performance-Optimierung",
}

const statusMeta: Record<
  Campaign["status"],
  { label: string; badge: string; dot: string }
> = {
  active: { label: "Aktiv", badge: "bg-score-strong/15 text-score-strong", dot: "bg-score-strong" },
  paused: { label: "Pausiert", badge: "bg-score-weak/15 text-score-weak", dot: "bg-score-weak" },
  draft: { label: "Entwurf", badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
  archived: { label: "Archiviert", badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
}

function Metric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Users
  value: number
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-muted-foreground" />
      <div className="leading-none">
        <span className="text-sm font-semibold tabular-nums">{value}</span>
        <span className="ml-1 text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

export function CampaignsView() {
  const { navigate } = useRouter()

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Kampagnen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {campaigns.length} Zielgruppen-Kampagnen · nach Branche und Stadt gebündelt
          </p>
        </div>
        <Button
          className="gap-2"
          onClick={() =>
            toast.info("Neue Kampagne", {
              description: "Kampagnen-Erstellung folgt im Post-MVP.",
            })
          }
        >
          <Plus className="size-4" />
          Neue Kampagne
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {campaigns.map((c) => {
          const conv = c.auditCount > 0 ? Math.round((c.won / c.auditCount) * 100) : 0
          const meta = statusMeta[c.status]
          return (
            <Card key={c.id} className="gap-0 overflow-hidden py-0">
              <CardHeader className="gap-0 space-y-0 border-b p-5 [.border-b]:pb-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold">{c.name}</h3>
                      <Badge className={cn("gap-1.5 border-0 font-medium", meta.badge)}>
                        <span className={cn("size-1.5 rounded-full", meta.dot)} />
                        {meta.label}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      {c.targetIndustry} · {c.targetCity}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8 shrink-0">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Aktionen</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate({ name: "audits" })}>
                        Audits ansehen
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate({ name: "leads" })}>
                        Leads ansehen
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => toast.success("Kampagne dupliziert")}
                      >
                        Duplizieren
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-3">
                  <Badge variant="secondary" className="font-normal">
                    Angebot: {offerLabel[c.offerType]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <div className="grid grid-cols-2 gap-3">
                  <Metric icon={Users} value={c.leadCount} label="Leads" />
                  <Metric icon={ScanSearch} value={c.auditCount} label="Audits" />
                  <Metric icon={Copy} value={c.outreachCopied} label="Outreach" />
                  <Metric icon={Eye} value={c.reportViews} label="Views" />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Trophy className="size-3.5 text-score-strong" />
                      Gewonnen
                    </span>
                    <span className="font-medium tabular-nums">
                      {c.won} · {conv}% der Audits
                    </span>
                  </div>
                  <Progress value={conv} className="h-1.5" />
                </div>

                <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>
                    {c.won} gewonnen · {c.lost} verloren
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => navigate({ name: "audits" })}
                  >
                    Öffnen
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
