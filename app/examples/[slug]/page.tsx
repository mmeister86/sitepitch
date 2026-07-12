import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { AuditReport } from "@/components/audit-report"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { auditExamples, getAuditExample } from "@/lib/audit-examples"

export const metadata: Metadata = {
  title: "Beispiel-Audit | SitePitch",
  description: "Ein statischer, schreibgeschützter SitePitch Beispielreport.",
  robots: { index: false, follow: false },
}

export function generateStaticParams() {
  return auditExamples.map(({ slug }) => ({ slug }))
}

export default async function AuditExamplePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const example = getAuditExample(slug)
  if (!example) notFound()

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto max-w-[1000px] px-4 py-6 md:py-10">
        <div className="mb-5 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Zurück
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-semibold">{example.title}</h1>
                <Badge variant="secondary">Beispiel</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Statisch und schreibgeschützt · keine Credits oder Tracking-Events</p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link href="/app/audits/new">
              Eigenen Audit starten
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <AuditReport report={example.report} variant="public" />
      </div>
    </main>
  )
}
