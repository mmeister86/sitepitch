"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NewAuditForm } from "@/components/new-audit-form"

export function NewAuditView() {
  return (
    <div className="mx-auto w-full max-w-[720px] space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Neuen Audit starten</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gib eine Website-URL ein oder wähle einen gespeicherten Lead. Der Audit erstellt einen
          gebrandeten Report mit Stärken, Schwächen und Outreach-Texten.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Website auswählen</CardTitle>
          <CardDescription>
            Öffentlich erreichbare Websites werden analysiert. Private IPs und ungültige URLs werden
            abgelehnt.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-6 md:px-6">
          <NewAuditForm submitLabel="Audit starten" />
        </CardContent>
      </Card>
    </div>
  )
}
