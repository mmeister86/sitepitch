"use client"

import { Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useRouter } from "@/lib/router"

export function LeadsView() {
  const { navigate } = useRouter()

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Leads</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Kontakte aus Lead-Suche und manuellem Import
        </p>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-20 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <Users className="size-7 text-muted-foreground" />
        </div>
        <div className="max-w-sm">
          <p className="text-sm font-medium">Noch keine Leads</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Die Lead-Suche (Google Places, Branchen-Verzeichnisse) wird mit einem
            kommenden Update freigeschaltet. Du kannst bereits jetzt Audits starten
            und Leads manuell verknüpfen.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => navigate({ name: "audits" })}
        >
          Zum Audit-Inbox
        </Button>
      </div>
    </div>
  )
}
