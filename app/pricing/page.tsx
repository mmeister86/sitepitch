import type { Metadata } from "next"

import { PricingSection } from "@/components/marketing/pricing-section"
import { PublicShell } from "@/components/marketing/public-shell"
import { PRICING_CATALOG } from "@/lib/launch-content"

export const metadata: Metadata = {
  title: "Preise und Credits | SitePitch",
  description: "SitePitch-Pläne für 25, 100 oder 300 monatliche Website-Audits sowie einmalige Extra-Credits.",
}

export default function PricingPage() {
  return (
    <PublicShell>
      <PricingSection catalog={PRICING_CATALOG} full headingLevel="h1" />
    </PublicShell>
  )
}
