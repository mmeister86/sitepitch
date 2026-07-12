"use client"

import { useEffect, useRef } from "react"
import { useMutation, useQuery } from "convex/react"
import { Printer, Lock } from "lucide-react"
import { useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { AuditReport } from "@/components/audit-report"
import { trackRybbitEvent } from "@/lib/analytics"
import { api } from "../../convex/_generated/api"
import { isPublicReportPreview } from "./public-report-tracking"

export function PublicReportView({ slug }: { slug: string }) {
  const searchParams = useSearchParams()
  const isPreview = isPublicReportPreview(searchParams)
  const report = useQuery(api.reports.getPublicReportBySlug, { slug })
  const recordView = useMutation(api.reports.recordPublicReportView)
  const recordCta = useMutation(api.reports.recordPublicReportCtaClick)
  const recordPdf = useMutation(api.reports.recordPublicReportPdfExport)
  const trackedRef = useRef(false)

  useEffect(() => {
    if (!report || isPreview || trackedRef.current) return
    trackedRef.current = true

    const sessionKey = `sp:view:${slug}`
    if (typeof window !== "undefined") {
      if (sessionStorage.getItem(sessionKey)) return
      sessionStorage.setItem(sessionKey, "1")
    }

    recordView({ slug }).catch(() => {})
    trackRybbitEvent("report_opened", { source: "public_report" })
  }, [isPreview, report, slug, recordView])

  const handleCtaClick = () => {
    if (isPreview) return
    recordCta({ slug }).catch(() => {})
    trackRybbitEvent("report_cta_clicked", { source: "public_report" })
  }

  const handlePrint = () => {
    if (!isPreview) {
      recordPdf({ slug }).catch(() => {})
      trackRybbitEvent("pdf_exported", { source: "public_report" })
    }
    window.print()
  }

  if (report === undefined) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Spinner className="size-6 text-primary" />
      </div>
    )
  }

  if (report === null) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            <Lock className="size-6 text-muted-foreground" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Report nicht verfügbar</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Dieser Audit-Report wurde deaktiviert oder ist nicht mehr öffentlich freigegeben.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto max-w-[1000px] px-4 py-8 md:py-12">
        <div className="mb-4 flex justify-end no-print">
          <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
            <Printer className="size-4" />
            Drucken / PDF
          </Button>
        </div>
        <AuditReport report={report} variant="public" onCtaClick={handleCtaClick} />
      </div>
    </div>
  )
}
