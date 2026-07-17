import type { Metadata } from "next"

import { FaqSection } from "@/components/marketing/faq-section"
import {
  Compare10,
  Cta34,
  Feature101,
  Feature207,
  Feature344,
  Hero261,
} from "@/components/marketing/home-sections"
import { PricingSection } from "@/components/marketing/pricing-section"
import { PublicShell } from "@/components/marketing/public-shell"
import { PRICING_CATALOG } from "@/lib/launch-content"

export const metadata: Metadata = {
  title: "Website-Audits für bessere Kundengespräche | SitePitch",
  description: "SitePitch erstellt konkrete Website-Audits, gebrandete Reports und Outreach-Entwürfe für Webdesigner und kleine Agenturen.",
}

export default function Page() {
  return (
    <PublicShell>
      <Hero261 id="hero" />
      <Compare10 id="vergleich" />
      <Feature207 id="workflow" aria-label="Find Audit Pitch" />
      <Feature344 id="beispiel-report" />
      <Feature101 id="funktionen" />
      <PricingSection id="preise" catalog={PRICING_CATALOG} />
      <FaqSection id="faq" />
      <Cta34 id="start" />
    </PublicShell>
  )
}
