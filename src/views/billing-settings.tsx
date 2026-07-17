"use client"

import { useState } from "react"
import { useAction, useQuery } from "convex/react"
import { AlertCircle, Check, CreditCard, ExternalLink, Loader2, Sparkles } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { PRICING_CATALOG } from "@/lib/launch-content"
import { api } from "../../convex/_generated/api"

const PLANS = PRICING_CATALOG.plans

export function BillingSettingsView() {
  const data = useQuery(api.workspaces.getMyWorkspace)
  const portal = useQuery(api.billing.getPortal)
  const createCheckout = useAction(api.billing.createCheckout)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (data === undefined) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Spinner className="size-6 text-primary" /></div>
  }

  const credits = data.credits
  const plan = data.subscription?.plan ?? null
  const status = data.subscription?.status ?? "trial"
  const pct = credits.total > 0 ? (credits.used / credits.total) * 100 : 0

  async function checkout(kind: "starter" | "pro" | "agency" | "credit_pack") {
    setPending(kind)
    setError(null)
    try {
      const result = await createCheckout({ kind })
      window.location.assign(result.url)
    } catch {
      setError("Checkout konnte nicht geöffnet werden. Bitte versuche es erneut.")
      setPending(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Plan & Credits</h2>
        <p className="mt-1 text-sm text-muted-foreground">Monatsguthaben, Extra-Credits und Abonnement verwalten.</p>
      </div>

      {error ? <Alert variant="destructive"><AlertCircle className="size-4" /><AlertDescription>{error}</AlertDescription></Alert> : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><CardTitle>Aktueller Zugang</CardTitle><CardDescription>{plan ? `Dein ${plan}-Abonnement ist ${status}.` : "Einmaliges Testguthaben – danach ist ein Plan oder Credit-Pack erforderlich."}</CardDescription></div>
            <Badge className="gap-1.5 border-0 bg-primary/12 font-medium text-primary"><Sparkles className="size-3" />{plan ? plan.toUpperCase() : "TESTGUTHABEN"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1.5 flex justify-between text-sm"><span className="text-muted-foreground">Credits verbraucht</span><span className="font-medium tabular-nums">{credits.used} / {credits.total} · {credits.remaining} verfügbar</span></div>
            <Progress value={pct} className="h-2" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Monatlich / Testguthaben</div><div className="mt-1 text-xl font-semibold tabular-nums">{credits.monthly.remaining}</div><div className="text-xs text-muted-foreground">von {credits.monthly.total}, {credits.monthly.used} verbraucht</div></div>
            <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Extra-Credits</div><div className="mt-1 text-xl font-semibold tabular-nums">{credits.extra.remaining}</div><div className="text-xs text-muted-foreground">von {credits.extra.total}, {credits.extra.used} verbraucht</div></div>
          </div>
          {portal?.url ? <Button variant="outline" onClick={() => window.location.assign(portal.url!)}><CreditCard className="size-4" />Abonnement verwalten<ExternalLink className="size-3.5" /></Button> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((item) => (
          <Card key={item.id} className={plan === item.id ? "border-primary" : undefined}>
            <CardHeader>
              <CardTitle>{item.name}</CardTitle>
              <CardDescription>{item.monthlyPriceEuro} €/Monat · {item.credits} Audits</CardDescription>
            </CardHeader>
            <CardContent className="flex h-full flex-col gap-5">
              <ul className="grid gap-2 text-sm">
                {item.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button className="mt-auto w-full" variant={plan === item.id ? "outline" : "default"} disabled={pending !== null || plan === item.id} onClick={() => void checkout(item.id)}>{pending === item.id ? <Loader2 className="size-4 animate-spin" /> : null}{plan === item.id ? "Aktueller Plan" : `${item.name} wählen`}</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card><CardHeader><CardTitle>25 Extra-Credits</CardTitle><CardDescription>Einmalig 10 €. Extra-Credits verfallen nicht am Monatsende.</CardDescription></CardHeader><CardContent><Button disabled={pending !== null} onClick={() => void checkout("credit_pack")}>{pending === "credit_pack" ? <Loader2 className="size-4 animate-spin" /> : null}25 Credits kaufen</Button></CardContent></Card>
    </div>
  )
}

BillingSettingsView.displayName = "BillingSettingsView"
