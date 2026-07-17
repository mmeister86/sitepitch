import Link from "next/link"
import { ArrowRight, CircleAlert, Loader2 } from "lucide-react"

import type { DemoAuditState } from "./demo-state"

export function DemoStatusPanel({ state }: { state: DemoAuditState }) {
  if (state.status === "submitting") {
    return (
      <div data-demo-state="submitting" aria-live="polite" className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
        <Loader2 className="size-4 animate-spin text-primary" />
        {state.message}
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div data-demo-state="error" role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        <span>{state.message}</span>
      </div>
    )
  }

  if (state.status === "result") {
    return (
      <div data-demo-state="result" aria-live="polite" className="rounded-lg border bg-muted/30 p-4">
        <p className="text-sm font-medium">Dein Demo-Report ist bereit.</p>
        <Link
          href={state.result.reportHref}
          className="mt-3 inline-flex h-8 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {state.result.label} <ArrowRight className="size-4" />
        </Link>
      </div>
    )
  }

  return (
    <div data-demo-state="idle" className="rounded-lg border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
      Nach dem Absenden zeigt dieser Bereich den Fortschritt, eine verständliche Fehlermeldung oder den echten Report-Link.
    </div>
  )
}
