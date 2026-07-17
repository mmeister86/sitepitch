import type { Metadata } from "next"

import { LegalArticle } from "@/components/marketing/legal-article"
import { PublicShell } from "@/components/marketing/public-shell"
import { getLegalOperator } from "@/lib/legal-operator"

export const metadata: Metadata = {
  title: "Datenschutzhinweise | SitePitch",
  description: "Faktische Hinweise zu Datenverarbeitung, Anbietern, Demo-Audits und Produktgrenzen von SitePitch.",
}

export default function PrivacyPage() {
  return <PublicShell><LegalArticle kind="privacy" operator={getLegalOperator()} /></PublicShell>
}
