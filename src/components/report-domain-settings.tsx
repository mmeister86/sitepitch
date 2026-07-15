"use client"

import { useState } from "react"
import { useAction, useMutation, useQuery } from "convex/react"
import { CheckCircle2, Globe2, Loader2, RefreshCw, Unlink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CopyButton } from "@/components/copy-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/sonner"
import { api } from "../../convex/_generated/api"

const statusCopy: Record<string, { label: string; description: string }> = {
  pending_dns: { label: "DNS ausstehend", description: "TXT- und CNAME-Einträge müssen noch bestätigt werden." },
  verified: { label: "DNS bestätigt", description: "Die Domain wartet auf die Hosting-Aktivierung." },
  pending_host: { label: "Hosting ausstehend", description: "DNS ist korrekt. SitePitch richtet Ingress und TLS ein." },
  active: { label: "Aktiv", description: "Neue Report-Links verwenden diese Domain." },
  suspended: { label: "Pausiert", description: "Die DNS-Einträge konnten mehrfach nicht bestätigt werden." },
  disabled: { label: "Deaktiviert", description: "Reports verwenden wieder die SitePitch-Domain." },
  error: { label: "Prüfung fehlgeschlagen", description: "Bitte prüfe die DNS-Einträge und starte die Prüfung erneut." },
}

export function ReportDomainSettings() {
  const workspace = useQuery(api.workspaces.getMyWorkspace)
  const domain = useQuery(api.report_domains.getMyReportDomain)
  const connectDomain = useMutation(api.report_domains.connectReportDomain)
  const disableDomain = useMutation(api.report_domains.disableReportDomain)
  const checkDns = useAction(api.report_domains.checkReportDomainDns)
  const [hostname, setHostname] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  if (workspace === undefined || domain === undefined) {
    return <Card><CardContent className="flex min-h-40 items-center justify-center"><Spinner className="size-5 text-primary" /></CardContent></Card>
  }

  const canUseCustomDomain = workspace.plan === "agency"
  const status = domain ? statusCopy[domain.status] ?? statusCopy.error : null

  async function handleConnect() {
    if (!hostname.trim() || isSaving) return
    setIsSaving(true)
    try {
      await connectDomain({ hostname })
      setHostname("")
      toast.success("Report-Domain verbunden")
    } catch (error) {
      toast.error((error as Error)?.message ?? "Domain konnte nicht verbunden werden")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCheck() {
    if (isChecking) return
    setIsChecking(true)
    try {
      const result = await checkDns({})
      toast.success(result.verification.ok ? "DNS-Einträge bestätigt" : "DNS-Einträge noch nicht vollständig")
    } catch (error) {
      toast.error((error as Error)?.message ?? "DNS-Prüfung fehlgeschlagen")
    } finally {
      setIsChecking(false)
    }
  }

  async function handleDisable() {
    if (isSaving || !window.confirm("Custom Domain deaktivieren und auf SitePitch-Links zurückfallen?")) return
    setIsSaving(true)
    try {
      await disableDomain({})
      toast.success("Report-Domain deaktiviert")
    } catch (error) {
      toast.error((error as Error)?.message ?? "Domain konnte nicht deaktiviert werden")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Globe2 className="size-4" />Custom Report Domain</CardTitle>
            <CardDescription className="mt-1">Eine verifizierte CNAME-Subdomain für Agency-Reports.</CardDescription>
          </div>
          <span className="text-xs font-medium text-muted-foreground">{canUseCustomDomain ? "Agency" : "Verfügbar im Agency-Plan"}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!domain || domain.status === "disabled" ? (
          <div className="space-y-2">
            <Label htmlFor="report-domain">Subdomain</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="report-domain" value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder="reports.agentur.de" autoCapitalize="none" autoCorrect="off" disabled={!canUseCustomDomain || isSaving} />
              <Button onClick={() => void handleConnect()} disabled={!canUseCustomDomain || !hostname.trim() || isSaving}>
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Globe2 className="size-4" />}Verbinden
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Apex-Domains und Wildcards werden in dieser Version nicht unterstützt.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{domain.hostname}</p><p className="mt-0.5 text-xs text-muted-foreground">{status?.description}</p></div>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium">{domain.status === "active" && <CheckCircle2 className="size-4 text-score-strong" />}{status?.label}</span>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <DnsValue label="TXT-Name" value={domain.verificationName} />
              <DnsValue label="TXT-Wert" value={domain.verificationValue} />
              <DnsValue label="CNAME-Name" value={domain.cnameName} />
              <DnsValue label="CNAME-Ziel" value={domain.cnameTarget ?? "Noch nicht konfiguriert"} />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {domain.status !== "active" && (
                <Button variant="outline" onClick={() => void handleCheck()} disabled={isChecking || !domain.cnameTarget}>
                  <RefreshCw className={isChecking ? "size-4 animate-spin" : "size-4"} />DNS prüfen
                </Button>
              )}
              <Button variant="ghost" onClick={() => void handleDisable()} disabled={isSaving}>
                <Unlink className="size-4" />Deaktivieren
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function DnsValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5 rounded-lg bg-muted/40 px-3 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center justify-between gap-2"><code className="min-w-0 truncate text-xs">{value}</code><CopyButton text={value} size="icon" variant="ghost" toastMessage={`${label} kopiert`} /></div>
    </div>
  )
}
