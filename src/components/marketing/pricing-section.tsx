import Link from "next/link"
import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PRICING_CATALOG } from "@/lib/launch-content"
import { cn } from "@/lib/utils"

type PricingCatalog = typeof PRICING_CATALOG

export function PricingSection({
  id,
  catalog,
  full = false,
  headingLevel = "h2",
}: {
  id?: string
  catalog: PricingCatalog
  full?: boolean
  headingLevel?: "h1" | "h2"
}) {
  const Heading = headingLevel

  return (
    <section id={id} data-registry-block="pricing1" className="border-b bg-muted/20">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold text-primary">Einfache Credits</p>
          <Heading className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {full ? "Ein Plan für deinen Akquise-Rhythmus." : "Ein gewonnener Kunde zahlt SitePitch für Monate."}
          </Heading>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            {catalog.trial.description}
          </p>
        </div>

        <div className="mt-12 grid border-y md:grid-cols-3">
          {catalog.plans.map((plan, index) => (
            <article
              key={plan.id}
              className={cn(
                "flex flex-col py-8 md:px-6",
                index > 0 && "border-t md:border-t-0 md:border-l",
                plan.featured && "bg-background",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                {plan.featured ? <span className="text-xs font-semibold text-primary">Beliebt</span> : null}
              </div>
              <p className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">
                {plan.monthlyPriceEuro} €<span className="text-sm font-normal text-muted-foreground"> / Monat</span>
              </p>
              <p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">{plan.description}</p>
              <Button className="mt-6 w-full" variant={plan.featured ? "default" : "outline"} asChild>
                <Link href={plan.ctaHref}>{plan.ctaLabel}</Link>
              </Button>
              <div className="my-6 border-t" />
              <ul className="grid gap-3 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {feature}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        {full ? (
          <div className="mt-8 flex flex-col justify-between gap-5 border-b pb-8 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-semibold">{catalog.extraPack.name}: {catalog.extraPack.credits} Audits</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{catalog.extraPack.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <span className="text-xl font-semibold tabular-nums">{catalog.extraPack.priceEuro} €</span>
              <Button variant="outline" asChild>
                <Link href={catalog.extraPack.ctaHref}>{catalog.extraPack.ctaLabel}</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-8 text-center">
            <Button variant="link" asChild>
              <Link href="/pricing">Alle Preisdetails ansehen</Link>
            </Button>
          </div>
        )}

        <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-5 text-muted-foreground">
          Jeder erfolgreich abgeschlossene Audit verbraucht einen Credit. Eine sofort ungültige URL verbraucht keinen Credit. Checkout und Credit-Kauf erfolgen erst nach Registrierung im geschützten Workspace.
        </p>
      </div>
    </section>
  )
}
