"use client"

import Script from "next/script"
import { useEffect, useRef, useState } from "react"
import { useAction, useMutation, useQuery } from "convex/react"
import { FileDown, KeyRound, Lock } from "lucide-react"

import { AuditReport } from "@/components/audit-report"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { trackRybbitEvent } from "@/lib/analytics"
import { api } from "../../convex/_generated/api"

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          theme: "auto"
          callback: (token: string) => void
          "expired-callback": () => void
          "error-callback": () => void
        },
      ) => string
      remove: (widgetId: string) => void
    }
  }
}

function currentHost() {
  return typeof window === "undefined" ? undefined : window.location.host
}

function grantStorageKey(slug: string) {
  return `sp:report-grant:${slug}`
}

function TurnstileChallenge({ onToken }: { onToken: (token: string | null) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!ready || !siteKey || !containerRef.current || !window.turnstile || widgetRef.current) return
    widgetRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: "auto",
      callback: (token) => onToken(token),
      "expired-callback": () => onToken(null),
      "error-callback": () => onToken(null),
    })
    return () => {
      if (widgetRef.current && window.turnstile) window.turnstile.remove(widgetRef.current)
      widgetRef.current = null
    }
  }, [onToken, ready, siteKey])

  if (!siteKey) {
    return <p className="text-xs text-muted-foreground">Die Sicherheitsprüfung ist derzeit nicht verfügbar.</p>
  }

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setReady(true)} />
      <div ref={containerRef} className="min-h-[65px]" />
    </>
  )
}

function PasswordGate({ slug, host, onUnlocked }: { slug: string; host?: string; onUnlocked: (token: string) => void }) {
  const unlock = useAction(api.report_password.unlockPublicReport)
  const [password, setPassword] = useState("")
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!password || !turnstileToken || isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await unlock({ slug, host, password, turnstileToken })
      sessionStorage.setItem(grantStorageKey(slug), result.grantToken)
      onUnlocked(result.grantToken)
    } catch {
      setError("Passwort oder Sicherheitsprüfung ist ungültig. Bitte versuche es erneut.")
      setTurnstileToken(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <form onSubmit={(event) => void handleSubmit(event)} className="w-full max-w-sm space-y-5">
        <div className="space-y-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted"><KeyRound className="size-5 text-muted-foreground" /></div>
          <div><h1 className="text-xl font-semibold tracking-tight">Geschützter Report</h1><p className="mt-1 text-sm text-muted-foreground">Gib das Passwort ein, das du zusammen mit dem Report-Link erhalten hast.</p></div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-password">Passwort</Label>
          <Input id="report-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
        </div>
        <TurnstileChallenge onToken={setTurnstileToken} />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={!password || !turnstileToken || isSubmitting}>
          {isSubmitting ? <Spinner className="size-4" /> : <Lock className="size-4" />}
          Report öffnen
        </Button>
      </form>
    </div>
  )
}

export function PublicReportView({ slug }: { slug: string }) {
  const host = currentHost()
  const [grantToken, setGrantToken] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined
    return sessionStorage.getItem(grantStorageKey(slug)) ?? undefined
  })
  const access = useQuery(api.reports.getPublicReportBySlug, { slug, host, grantToken })
  const recordView = useMutation(api.reports.recordPublicReportView)
  const recordCta = useMutation(api.reports.recordPublicReportCtaClick)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const trackedRef = useRef(false)

  useEffect(() => {
    if (access?.status !== "available" || trackedRef.current) return
    trackedRef.current = true
    const sessionKey = `sp:view:${slug}`
    if (sessionStorage.getItem(sessionKey)) return
    sessionStorage.setItem(sessionKey, "1")
    recordView({ slug, host, grantToken }).catch(() => {})
    trackRybbitEvent("report_opened", { source: "public_report" })
  }, [access, grantToken, host, recordView, slug])

  const handleCtaClick = () => {
    recordCta({ slug, host, grantToken }).catch(() => {})
    trackRybbitEvent("report_cta_clicked", { source: "public_report" })
  }

  const handlePdfDownload = async () => {
    const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL
    if (!siteUrl || isDownloadingPdf) return
    setIsDownloadingPdf(true)
    try {
      const response = await fetch(`${siteUrl}/reports/pdf?slug=${encodeURIComponent(slug)}`, {
        headers: {
          ...(grantToken ? { Authorization: `Bearer ${grantToken}` } : {}),
          ...(host ? { "X-Report-Host": host } : {}),
        },
        cache: "no-store",
      })
      if (!response.ok) return
      const blobUrl = URL.createObjectURL(await response.blob())
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "website-audit.pdf"
      link.click()
      URL.revokeObjectURL(blobUrl)
      trackRybbitEvent("pdf_exported", { source: "public_report" })
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  if (access === undefined) {
    return <div className="flex min-h-svh items-center justify-center bg-background"><Spinner className="size-6 text-primary" /></div>
  }

  if (access.status === "password_required") {
    return <PasswordGate slug={slug} host={host} onUnlocked={setGrantToken} />
  }

  if (access.status === "unavailable") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted"><Lock className="size-6 text-muted-foreground" /></div>
          <h1 className="text-lg font-semibold tracking-tight">Report nicht verfügbar</h1>
          <p className="mt-2 text-sm text-muted-foreground">Dieser Audit-Report ist nicht mehr öffentlich verfügbar.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh" style={{ backgroundColor: access.report.theme.backgroundColor }}>
      <div className="mx-auto max-w-[1000px] px-4 py-8 md:py-12">
        {access.capabilities.pdfExport && (
          <div className="mb-4 flex justify-end no-print">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => void handlePdfDownload()} disabled={isDownloadingPdf}><FileDown className="size-4" />{isDownloadingPdf ? "PDF wird geladen…" : "PDF exportieren"}</Button>
          </div>
        )}
        <AuditReport report={access.report} variant="public" onCtaClick={handleCtaClick} />
      </div>
    </div>
  )
}
