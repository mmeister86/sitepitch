import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { PublicShell } from "@/components/marketing/public-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { auditExamples } from "@/lib/audit-examples"

export const metadata: Metadata = {
  title: "Statische Beispielreports | SitePitch",
  description: "Drei schreibgeschützte SitePitch-Beispielreports für Zahnarztpraxis, Restaurant und Handwerksbetrieb.",
}

export default function ExamplesPage() {
  return (
    <PublicShell>
      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-primary">Beispielreports</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            So wird aus einem Score ein konkretes Gespräch.
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            Diese drei Reports verwenden fiktive Unternehmensdaten. Sie sind statisch, schreibgeschützt und rufen weder Audit-Anbieter noch Authentifizierung oder Analytics auf.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {auditExamples.map((example) => (
            <article key={example.slug} className="flex min-h-72 flex-col rounded-xl border bg-background p-6">
              <div className="flex items-start justify-between gap-4">
                <Badge variant="secondary">{example.industry}</Badge>
                <span className="text-3xl font-semibold text-primary tabular-nums">{example.report.overallScore}</span>
              </div>
              <h2 className="mt-8 text-xl font-semibold">{example.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{example.report.summary.shortSummary}</p>
              <div className="mt-auto pt-6">
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/examples/${example.slug}`}>Report öffnen <ArrowRight /></Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </PublicShell>
  )
}
