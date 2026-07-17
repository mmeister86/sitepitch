import type { Metadata } from "next"

import { DemoClientBoundary } from "@/components/marketing/demo-client-boundary"
import { PublicShell } from "@/components/marketing/public-shell"

export const metadata: Metadata = {
  title: "Begrenzten Demo-Audit starten | SitePitch",
  description: "Website-URL mit Einwilligung und Turnstile prüfen; begrenzt auf einen Demo-Audit pro IP und Tag.",
}

export default function DemoPage() {
  return (
    <PublicShell>
      <DemoClientBoundary />
    </PublicShell>
  )
}
