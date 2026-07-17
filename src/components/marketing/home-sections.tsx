import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  Check,
  FileSearch,
  MailCheck,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { capabilityItems, workflowSteps } from "@/lib/launch-content"

import { TrackedLink } from "./tracked-link"

export function Hero261({ id }: { id: string }) {
  return (
    <section id={id} data-registry-block="hero261" className="border-b">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              Akquise mit konkretem Gesprächsanlass
            </div>
            <div className="space-y-5">
              <h1 className="max-w-4xl text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Website-Audits, die Kundengespräche starten.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                SitePitch hilft Webdesignern, potenzielle Kunden-Websites zu analysieren und daraus gebrandete Reports, konkrete Verbesserungschancen und passende Outreach-Texte zu erstellen.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <TrackedLink href="/demo" eventName="marketing_cta_clicked" eventSource="hero">
                  Demo-Audit starten <ArrowRight />
                </TrackedLink>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/examples">Beispielreport ansehen</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Ohne Erfolgsversprechen. Du prüfst und versendest jede Ansprache selbst.</p>
          </div>

          <div className="border-t border-dashed pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
            <p className="mb-5 text-sm font-semibold">Aus einer Website wird ein Gesprächsangebot</p>
            <ul className="grid gap-5">
              {[
                [Search, "Chancen auf der Kunden-Website finden"],
                [FileSearch, "Belege und Empfehlungen im Report bündeln"],
                [MailCheck, "Respektvolle Outreach-Entwürfe vorbereiten"],
              ].map(([Icon, text]) => (
                <li key={text as string} className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <span>{text as string}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 overflow-hidden rounded-xl border bg-muted/30 p-2 sm:p-3 lg:mt-20">
          <Image
            src="/audit-dental-desktop.webp"
            alt="Ausschnitt eines SitePitch Beispielreports mit Gesamtscore und konkreten Findings"
            width={1440}
            height={900}
            priority
            className="h-auto w-full rounded-lg border bg-background object-cover object-top"
          />
        </div>
      </div>
    </section>
  )
}

export function Compare10({ id }: { id: string }) {
  const generic = [
    "Klingt wie jede andere Akquise-Nachricht",
    "Behauptet Probleme ohne nachvollziehbaren Beleg",
    "Gibt dem Empfänger keinen konkreten nächsten Schritt",
  ]
  const specific = [
    "Beginnt mit einer sichtbaren Chance auf der Website",
    "Verbindet Beleg, Auswirkung und klare Empfehlung",
    "Bietet einen teilbaren Report als Gesprächsgrundlage",
  ]

  return (
    <section id={id} data-registry-block="compare10" className="border-b bg-muted/20">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold text-primary">Generische Nachricht oder konkreter Anlass?</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Zeige zuerst, dass du hingesehen hast.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            SitePitch ersetzt keine gute Akquise. Es gibt ihr einen glaubwürdigen, konkreten Einstieg.
          </p>
        </div>
        <div className="mt-12 grid border-y md:grid-cols-2">
          <div className="space-y-6 py-8 md:pr-10">
            <h3 className="text-sm font-semibold text-muted-foreground">Generische Kaltakquise</h3>
            <ul className="grid gap-5">
              {generic.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                  <X className="mt-1 size-4 shrink-0" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t py-8 md:border-t-0 md:border-l md:pl-10">
            <h3 className="text-sm font-semibold text-primary">Akquise mit SitePitch</h3>
            <ul className="mt-6 grid gap-5">
              {specific.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6">
                  <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

export function Feature207({ id, ...props }: { id: string; "aria-label"?: string }) {
  return (
    <section id={id} data-registry-block="feature207" className="border-b" {...props}>
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-primary">Find → Audit → Pitch</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Ein klarer Weg vom Lead zum Gespräch.
          </h2>
        </div>
        <ol className="mt-12 border-t">
          {workflowSteps.map((step) => (
            <li key={step.number} className="grid gap-3 border-b py-7 md:grid-cols-[0.25fr_0.75fr] md:gap-10">
              <div className="flex items-baseline gap-4">
                <span className="text-sm font-semibold text-primary">{step.number}</span>
                <h3 className="text-2xl font-semibold tracking-tight">{step.title}</h3>
              </div>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function Feature344({ id }: { id: string }) {
  return (
    <section id={id} data-registry-block="feature344" className="border-b bg-muted/20">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8">
        <div className="overflow-hidden rounded-xl border bg-background p-2">
          <Image
            src="/audit-dental-desktop.webp"
            alt="SitePitch Beispielreport für eine Zahnarztpraxis"
            width={1440}
            height={900}
            className="h-auto w-full rounded-lg border object-cover object-top"
          />
        </div>
        <div className="space-y-7">
          <div>
            <p className="text-sm font-semibold text-primary">Beispielreport</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Kein Blackbox-Score, sondern eine nachvollziehbare Argumentation.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
              Der Report zeigt relevante Chancen in einer Reihenfolge, die dein potenzieller Kunde verstehen und besprechen kann.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {["Kategorie-Scores", "Konkrete Belege", "Priorisierte Empfehlungen", "Nächste Schritte"].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm">
                <BadgeCheck className="size-4 shrink-0 text-primary" /> {item}
              </li>
            ))}
          </ul>
          <Button variant="outline" asChild>
            <Link href="/examples/zahnarzt">Statischen Report öffnen <ArrowRight /></Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

export function Feature101({ id }: { id: string }) {
  const icons = [FileSearch, BadgeCheck, MailCheck, Search, ShieldCheck]

  return (
    <section id={id} data-registry-block="feature101" className="border-b">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold text-primary">Im MVP enthalten</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Alles für den konkreten Gesprächseinstieg.
          </h2>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          {capabilityItems.map((item, index) => {
            const Icon = icons[index]
            const wide = index < 2
            return (
              <article
                key={item.title}
                className={`min-h-48 rounded-xl border bg-muted/25 p-6 ${wide ? "lg:col-span-3" : "lg:col-span-2"}`}
              >
                <Icon className="size-5 text-primary" />
                <h3 className="mt-8 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{item.description}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function Cta34({ id }: { id: string }) {
  return (
    <section id={id} data-registry-block="cta34" className="border-t">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Mach aus der nächsten Website ein besseres Kundengespräch.
        </h2>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Starte mit einem begrenzten Demo-Audit oder sieh dir zuerst einen statischen Beispielreport an.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <TrackedLink href="/demo" eventName="marketing_cta_clicked" eventSource="final_cta">
              Demo-Audit starten <ArrowRight />
            </TrackedLink>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/examples">Beispiele ansehen</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
