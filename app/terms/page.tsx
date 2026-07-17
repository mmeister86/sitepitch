import type { Metadata } from "next"

import { LegalArticle } from "@/components/marketing/legal-article"
import { PublicShell } from "@/components/marketing/public-shell"
import { getLegalOperator } from "@/lib/legal-operator"

export const metadata: Metadata = {
  title: "Nutzungsbedingungen | SitePitch",
  description: "Produktgrenzen und Verantwortlichkeiten bei SitePitch-Audits, Reports, Credits und Outreach-Entwürfen.",
}

export default function TermsPage() {
  return <PublicShell><LegalArticle kind="terms" operator={getLegalOperator()} /></PublicShell>
}
