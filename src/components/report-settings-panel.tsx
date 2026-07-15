"use client"

import { useEffect, useMemo, useState } from "react"
import { useAction, useMutation, useQuery } from "convex/react"
import { Check, Eye, KeyRound, Loader2, RefreshCw, Settings2, X } from "lucide-react"

import {
  AuditReport,
  reportSectionKeys,
  type AuditReportData,
  type ReportSectionKey,
  type ReportTheme,
} from "@/components/audit-report"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

const themes: Array<{ value: ReportTheme; label: string; description: string }> = [
  { value: "classic", label: "Classic", description: "Klar und ausgewogen" },
  { value: "minimal", label: "Minimal", description: "Ruhig und reduziert" },
  { value: "editorial", label: "Editorial", description: "Markant und magazinartig" },
]

const sectionLabels: Record<ReportSectionKey, string> = {
  score: "Score",
  summary: "Kurzfazit",
  opportunities: "Top-Chancen",
  strengths_weaknesses: "Stärken & Schwächen",
  screenshots: "Screenshots",
  findings: "Detail-Findings",
  next_steps: "Nächste Schritte",
  cta: "Call-to-Action",
}

const coreSections = new Set<ReportSectionKey>(["score", "summary", "findings", "next_steps"])

function sourceLabel(source: string | null) {
  if (source === "report") return "Report-Override"
  if (source === "lead") return "Lead"
  if (source === "campaign") return "Kampagne"
  if (source === "workspace") return "Workspace"
  return "Keine Vorgabe"
}

function toDateTimeLocal(timestamp: number | null) {
  if (!timestamp) return ""
  const date = new Date(timestamp)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function withSettings(report: AuditReportData, data: NonNullable<ReturnType<typeof useQuery<typeof api.report_settings.getReportSettings>>>): AuditReportData {
  const settings = data.settings
  return {
    ...report,
    reportLanguage: settings.language,
    intro: settings.introText ?? undefined,
    hiddenSections: settings.hiddenSections,
    theme: {
      preset: settings.theme,
      primaryColor: settings.primaryColor,
      backgroundColor: settings.backgroundColor,
      textColor: settings.textColor,
    },
    showPoweredBy: settings.effectiveShowPoweredBy,
    branding: {
      ...report.branding,
      name: settings.brandName,
      logoUrl: settings.logoUrl,
      accentColor: settings.primaryColor,
      ctaText: settings.ctaText ?? undefined,
      ctaUrl: settings.ctaUrl ?? undefined,
      ctaSnapshotted: true,
    },
  }
}

export function ConfiguredAuditReport({
  auditId,
  report,
  variant,
  onCtaClick,
}: {
  auditId: Id<"audits">
  report: AuditReportData
  variant: "public" | "internal"
  onCtaClick?: () => void
}) {
  const data = useQuery(api.report_settings.getReportSettings, { auditId })
  return <AuditReport report={data ? withSettings(report, data) : report} variant={variant} onCtaClick={onCtaClick} />
}

export function ReportSettingsPanel({
  auditId,
  report,
}: {
  auditId: Id<"audits">
  report: AuditReportData
}) {
  const data = useQuery(api.report_settings.getReportSettings, { auditId })
  const saveSettings = useMutation(api.report_settings.saveReportSettings)
  const refreshSnapshot = useMutation(api.report_settings.refreshReportSettingsSnapshot)
  const setReportPassword = useAction(api.report_password.setReportPassword)
  const clearReportPassword = useAction(api.report_password.clearReportPassword)

  const [theme, setTheme] = useState<ReportTheme>("classic")
  const [primaryColor, setPrimaryColor] = useState("#5b5bd6")
  const [backgroundColor, setBackgroundColor] = useState("#ffffff")
  const [textColor, setTextColor] = useState("#18181b")
  const [hiddenSections, setHiddenSections] = useState<ReportSectionKey[]>([])
  const [introText, setIntroText] = useState("")
  const [ctaText, setCtaText] = useState("")
  const [ctaUrl, setCtaUrl] = useState("")
  const [showPoweredBy, setShowPoweredBy] = useState(true)
  const [expiresAt, setExpiresAt] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [isPasswordSaving, setIsPasswordSaving] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!data) return
    const settings = data.settings
    setTheme(settings.theme)
    setPrimaryColor(settings.primaryColor)
    setBackgroundColor(settings.backgroundColor)
    setTextColor(settings.textColor)
    setHiddenSections(settings.hiddenSections)
    setIntroText(settings.introText ?? "")
    setCtaText(settings.ctaText ?? "")
    setCtaUrl(settings.ctaUrl ?? "")
    setShowPoweredBy(settings.showPoweredByPreference)
    setExpiresAt(toDateTimeLocal(settings.expiresAt))
  }, [data?.settings.settingsVersion, data?.settings.accessVersion])

  const preview = useMemo<AuditReportData>(() => ({
    ...report,
    intro: introText || undefined,
    hiddenSections,
    theme: { preset: theme, primaryColor, backgroundColor, textColor },
    showPoweredBy: data?.capabilities.poweredByToggle ? showPoweredBy : true,
    branding: {
      ...report.branding,
      name: data?.settings.brandName ?? report.branding.name,
      logoUrl: data?.settings.logoUrl ?? report.branding.logoUrl,
      accentColor: primaryColor,
      ctaText: ctaText || undefined,
      ctaUrl: ctaUrl || undefined,
      ctaSnapshotted: true,
    },
  }), [backgroundColor, ctaText, ctaUrl, data, hiddenSections, introText, primaryColor, report, showPoweredBy, textColor, theme])

  if (data === undefined) {
    return <div className="flex min-h-48 items-center justify-center"><Spinner className="size-5 text-primary" /></div>
  }

  const { capabilities, settings } = data

  function toggleSection(section: ReportSectionKey, checked: boolean) {
    const nextHidden = checked
      ? hiddenSections.filter((item) => item !== section)
      : [...hiddenSections, section]
    if (coreSections.has(section) && [...coreSections].every((item) => nextHidden.includes(item))) {
      toast.error("Mindestens eine Kernsektion muss sichtbar bleiben")
      return
    }
    setHiddenSections(nextHidden)
  }

  async function handleSave() {
    if (isSaving) return
    setIsSaving(true)
    try {
      await saveSettings({
        auditId,
        theme,
        primaryColor,
        backgroundColor,
        textColor,
        hiddenSections,
        introText: introText.trim() || null,
        ctaText: ctaText.trim() || null,
        ctaUrl: ctaUrl.trim() || null,
        showPoweredByPreference: showPoweredBy,
        expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
      })
      toast.success("Report-Konfiguration gespeichert")
    } catch (error) {
      toast.error((error as Error)?.message ?? "Report-Konfiguration konnte nicht gespeichert werden")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRefresh() {
    if (isRefreshing || !window.confirm("Vorgaben aus Kampagne, Lead und Workspace neu übernehmen?")) return
    setIsRefreshing(true)
    try {
      await refreshSnapshot({ auditId })
      toast.success("Vorgaben neu übernommen")
    } catch (error) {
      toast.error((error as Error)?.message ?? "Vorgaben konnten nicht aktualisiert werden")
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleSetPassword() {
    if (isPasswordSaving) return
    setIsPasswordSaving(true)
    try {
      await setReportPassword({ auditId, password: newPassword })
      setNewPassword("")
      toast.success("Report-Passwort gesetzt")
    } catch (error) {
      toast.error((error as Error)?.message ?? "Passwort konnte nicht gesetzt werden")
    } finally {
      setIsPasswordSaving(false)
    }
  }

  async function handleClearPassword() {
    if (isPasswordSaving || !window.confirm("Passwortschutz für diesen Report entfernen?")) return
    setIsPasswordSaving(true)
    try {
      await clearReportPassword({ auditId })
      setNewPassword("")
      toast.success("Passwortschutz entfernt")
    } catch (error) {
      toast.error((error as Error)?.message ?? "Passwortschutz konnte nicht entfernt werden")
    } finally {
      setIsPasswordSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Settings2 className="size-4" />Report konfigurieren</CardTitle>
              <CardDescription className="mt-1">Snapshot-Version {settings.settingsVersion} · {data.plan.charAt(0).toUpperCase() + data.plan.slice(1)}-Plan</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={isRefreshing}>
              <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
              Vorgaben neu übernehmen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-7">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2"><Label>Theme</Label>{!capabilities.themes && <Badge variant="outline">Ab Pro</Badge>}</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {themes.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  disabled={!capabilities.themes}
                  aria-pressed={theme === option.value}
                  className={cn("flex items-start justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50", theme === option.value && "border-primary bg-primary/5")}
                >
                  <span><span className="block text-sm font-medium">{option.label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span></span>
                  {theme === option.value && <Check className="size-4 text-primary" />}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2"><Label>Report-Farben</Label>{!capabilities.customColors && <Badge variant="outline">Ab Pro</Badge>}</div>
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                ["Primär", primaryColor, setPrimaryColor],
                ["Hintergrund", backgroundColor, setBackgroundColor],
                ["Text", textColor, setTextColor],
              ] as const).map(([label, value, setter]) => (
                <div key={label} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <div className="flex gap-2">
                    <Input type="color" value={value} onChange={(event) => setter(event.target.value)} disabled={!capabilities.customColors} className="w-12 shrink-0 p-1" aria-label={`${label}farbe auswählen`} />
                    <Input value={value} onChange={(event) => setter(event.target.value)} disabled={!capabilities.customColors} maxLength={7} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2"><Label>Sichtbare Sektionen</Label>{!capabilities.sectionVisibility && <Badge variant="outline">Ab Pro</Badge>}</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {reportSectionKeys.map((section) => (
                <label key={section} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <Checkbox checked={!hiddenSections.includes(section)} onCheckedChange={(checked) => toggleSection(section, checked === true)} disabled={!capabilities.sectionVisibility} />
                  {sectionLabels[section]}
                </label>
              ))}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2"><Label htmlFor="report-intro">Einleitung</Label><span className="text-xs text-muted-foreground">{sourceLabel(settings.introSource)}</span></div>
              <Textarea id="report-intro" value={introText} onChange={(event) => setIntroText(event.target.value)} rows={5} maxLength={2_000} disabled={!capabilities.intro} placeholder="Persönliche Einleitung für diesen Report" />
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2"><Label htmlFor="report-cta-text">CTA-Text</Label><span className="text-xs text-muted-foreground">{sourceLabel(settings.ctaTextSource)}</span></div>
                <Input id="report-cta-text" value={ctaText} onChange={(event) => setCtaText(event.target.value)} disabled={!capabilities.campaignCta} maxLength={80} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2"><Label htmlFor="report-cta-url">CTA-Ziel</Label><span className="text-xs text-muted-foreground">{sourceLabel(settings.ctaUrlSource)}</span></div>
                <Input id="report-cta-url" value={ctaUrl} onChange={(event) => setCtaUrl(event.target.value)} disabled={!capabilities.campaignCta} inputMode="url" maxLength={2_048} />
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2"><Label htmlFor="report-expiry">Ablaufdatum</Label>{!capabilities.expiration && <Badge variant="outline">Ab Pro</Badge>}</div>
              <Input id="report-expiry" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} disabled={!capabilities.expiration} />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
              <div><Label htmlFor="report-powered-by">Powered by SitePitch</Label><p className="mt-0.5 text-xs text-muted-foreground">Nur im Agency-Plan ausblendbar</p></div>
              <Switch id="report-powered-by" checked={capabilities.poweredByToggle ? showPoweredBy : true} onCheckedChange={setShowPoweredBy} disabled={!capabilities.poweredByToggle} />
            </div>
          </section>

          <section className="space-y-3 rounded-lg border px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2"><KeyRound className="size-4 text-muted-foreground" /><Label htmlFor="report-password-setting">Passwortschutz</Label></div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {settings.hasPassword ? "Aktiv · bestehende Freigaben werden bei einer Änderung widerrufen." : "Optionaler Empfängerzugriff mit Turnstile-Sicherheitsprüfung."}
                </p>
              </div>
              {!capabilities.passwordProtection && <Badge variant="outline">Ab Pro</Badge>}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="report-password-setting"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder={settings.hasPassword ? "Neues Passwort (mind. 10 Zeichen)" : "Mindestens 10 Zeichen"}
                minLength={10}
                maxLength={128}
                disabled={!capabilities.passwordProtection || isPasswordSaving}
              />
              <Button variant="outline" onClick={() => void handleSetPassword()} disabled={!capabilities.passwordProtection || newPassword.length < 10 || isPasswordSaving}>
                {isPasswordSaving ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                {settings.hasPassword ? "Ändern" : "Aktivieren"}
              </Button>
              {settings.hasPassword && (
                <Button variant="ghost" onClick={() => void handleClearPassword()} disabled={isPasswordSaving}>
                  <X className="size-4" />Entfernen
                </Button>
              )}
            </div>
          </section>

          <div className="flex justify-end">
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Konfiguration speichern
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center gap-2"><Eye className="size-4 text-muted-foreground" /><h3 className="text-sm font-semibold">Vorschau</h3></div>
        <AuditReport report={preview} variant="public" />
      </div>
    </div>
  )
}
