"use client"

import Script from "next/script"
import Link from "next/link"
import { useCallback, useEffect, useReducer, useRef, useState } from "react"
import { ArrowRight, Gauge, LockKeyhole, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import {
  demoFormReducer,
  initialDemoFormState,
  type DemoAuditResult,
  type DemoFormAction,
} from "./demo-state"
import { DemoStatusPanel } from "./demo-status-panel"

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

export interface DemoAuditRequest {
  url: string
  turnstileToken: string | null
}

export type SubmitDemoAudit = (request: DemoAuditRequest) => Promise<DemoAuditResult>

export interface DemoAuditSubmissionInput {
  url: string
  consent: boolean
  turnstileRequired: boolean
  turnstileToken: string | null
}

export async function runDemoAuditSubmission(
  input: DemoAuditSubmissionInput,
  submitAudit: SubmitDemoAudit,
  dispatch: (action: DemoFormAction) => void,
): Promise<void> {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(input.url)
    if (!new Set(["http:", "https:"]).has(parsedUrl.protocol)) throw new Error("unsupported protocol")
  } catch {
    dispatch({ type: "validation_error", message: "Bitte gib eine vollständige Website-URL mit http:// oder https:// ein." })
    return
  }

  if (!input.consent) {
    dispatch({ type: "validation_error", message: "Bitte bestätige Datenschutz und Nutzungsbedingungen." })
    return
  }
  if (input.turnstileRequired && !input.turnstileToken) {
    dispatch({ type: "validation_error", message: "Bitte schließe zuerst die Turnstile-Sicherheitsprüfung ab." })
    return
  }

  dispatch({ type: "submit" })
  try {
    const result = await submitAudit({
      url: parsedUrl.toString(),
      turnstileToken: input.turnstileToken,
    })
    dispatch({ type: "resolve", result })
  } catch (error) {
    dispatch({
      type: "submit_error",
      message: error instanceof Error && error.message
        ? error.message
        : "Der Demo-Audit konnte nicht gestartet werden. Bitte versuche es später erneut.",
    })
  }
}

function TurnstileShell({
  onToken,
  siteKey,
}: {
  onToken: (token: string | null) => void
  siteKey: string | null | undefined
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!ready || !siteKey || !containerRef.current || !window.turnstile || widgetRef.current) return
    widgetRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: "auto",
      callback: onToken,
      "expired-callback": () => onToken(null),
      "error-callback": () => onToken(null),
    })
    return () => {
      if (widgetRef.current && window.turnstile) window.turnstile.remove(widgetRef.current)
      widgetRef.current = null
    }
  }, [onToken, ready, siteKey])

  if (!siteKey) {
    return (
      <p className="rounded-md border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
        Die Turnstile-Sicherheitsprüfung ist in dieser Umgebung nicht konfiguriert. Ein echter Demo-Lauf bleibt dadurch deaktiviert.
      </p>
    )
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      <div ref={containerRef} className="min-h-[65px]" aria-label="Turnstile-Sicherheitsprüfung" />
    </>
  )
}

export function DemoAuditForm({
  submitAudit,
  turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
}: {
  submitAudit: SubmitDemoAudit
  turnstileSiteKey?: string | null
}) {
  const [formState, dispatch] = useReducer(demoFormReducer, initialDemoFormState)
  const [url, setUrl] = useState("")
  const [consent, setConsent] = useState(false)
  const state = formState.audit
  const turnstileRequired = Boolean(turnstileSiteKey)
  const onToken = useCallback((token: string | null) => dispatch({ type: "turnstile_token", token }), [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (state.status === "submitting") return

    await runDemoAuditSubmission(
      {
        url,
        consent,
        turnstileRequired,
        turnstileToken: formState.turnstileToken,
      },
      submitAudit,
      dispatch,
    )
  }

  return (
    <section data-registry-block="contact9" className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="max-w-3xl">
        <span className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold text-primary">Begrenzter Demo-Flow</span>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Prüfe eine Website als konkreten Gesprächseinstieg.
        </h1>
        <p className="mt-5 text-lg leading-8 text-muted-foreground">
          Der öffentliche Demo-Audit ist gegen Missbrauch begrenzt und liefert nur dann einen Report, wenn die Live-API erfolgreich antwortet.
        </p>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:gap-14">
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6 rounded-xl border bg-background p-5 sm:p-7">
          <div className="space-y-2">
            <Label htmlFor="demo-url">Website-URL</Label>
            <Input
              id="demo-url"
              name="url"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="https://beispiel.de"
              required
              value={url}
              onChange={(event) => {
                setUrl(event.target.value)
                if (state.status === "error" || state.status === "result") dispatch({ type: "reset_audit" })
              }}
            />
            <p className="text-xs leading-5 text-muted-foreground">Verwende nur Websites, die du rechtmäßig prüfen darfst.</p>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="demo-consent"
              checked={consent}
              onCheckedChange={(checked) => setConsent(checked === true)}
              aria-describedby="demo-consent-copy"
            />
            <Label id="demo-consent-copy" htmlFor="demo-consent" className="text-sm leading-6 font-normal text-muted-foreground">
              Ich habe die <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4">Datenschutzhinweise</Link> und <Link href="/terms" className="font-medium text-foreground underline underline-offset-4">Nutzungsbedingungen</Link> gelesen und darf die angegebene Website prüfen.
            </Label>
          </div>

          <TurnstileShell
            key={`turnstile-${formState.turnstileResetVersion}`}
            onToken={onToken}
            siteKey={turnstileSiteKey}
          />
          <DemoStatusPanel state={state} />

          <Button type="submit" size="lg" className="w-full" disabled={!url || !consent || state.status === "submitting" || (turnstileRequired && !formState.turnstileToken)}>
            Demo-Audit anfragen <ArrowRight />
          </Button>
        </form>

        <aside className="space-y-7 border-t pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
          <div>
            <h2 className="text-lg font-semibold">Faire Nutzung, klare Grenzen</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Die Begrenzung schützt den öffentlichen Flow vor unbegrenzten Provider-Kosten.</p>
          </div>
          <ul className="grid gap-6">
            <li className="flex gap-3">
              <Gauge className="mt-0.5 size-5 shrink-0 text-primary" />
              <div><h3 className="text-sm font-semibold">1 Demo-Audit pro IP und Tag</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Ein weiterer Versuch wird mit einer verständlichen Limit-Meldung abgelehnt.</p></div>
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
              <div><h3 className="text-sm font-semibold">25 Demo-Audits pro Tag</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Das globale Tageslimit stoppt zusätzliche kostenpflichtige Läufe.</p></div>
            </li>
            <li className="flex gap-3">
              <LockKeyhole className="mt-0.5 size-5 shrink-0 text-primary" />
              <div><h3 className="text-sm font-semibold">Turnstile erforderlich</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Ohne erfolgreiche Sicherheitsprüfung startet kein verbundener Live-Audit.</p></div>
            </li>
          </ul>
          <p className="border-t pt-5 text-xs leading-5 text-muted-foreground">Demo-Reports tragen SitePitch-Branding und enthalten keinen PDF-Export.</p>
        </aside>
      </div>
    </section>
  )
}
