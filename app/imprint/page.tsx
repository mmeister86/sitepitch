import type { Metadata } from "next"

import { LegalArticle } from "@/components/marketing/legal-article"
import { PublicShell } from "@/components/marketing/public-shell"
import { getLegalOperator } from "@/lib/legal-operator"

export const metadata: Metadata = {
  title: "Impressum und Betreiberangaben | SitePitch",
  description: "Zentral konfigurierte Betreiber- und Kontaktangaben für das SitePitch-Angebot.",
}

export default function ImprintPage() {
  return <PublicShell><LegalArticle kind="imprint" operator={getLegalOperator()} /></PublicShell>
}
