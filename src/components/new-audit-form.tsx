"use client"

import { useEffect, useRef, useState } from "react"
import { useAction, useQuery } from "convex/react"
import { Globe, Loader2, Sparkles } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useRouter } from "@/lib/router"
import { trackRybbitEvent } from "@/lib/analytics"
import type { AuditType } from "@/lib/types"
import type { LeadListItem } from "../../convex/leads"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

type AuditErrorCode =
  | "INVALID_URL"
  | "UNSAFE_URL"
  | "URL_UNRESOLVABLE"
  | "INSUFFICIENT_CREDITS"
  | "RATE_LIMITED"
  | "WORKSPACE_NOT_READY"

interface StartErrorData {
  code?: AuditErrorCode
  message?: string
  retryAfter?: number
}

function getErrorData(error: unknown): StartErrorData | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof (error as { data?: unknown }).data === "object" &&
    (error as { data?: { code?: unknown; message?: unknown; retryAfter?: unknown } }).data !== null
  ) {
    const data = (error as { data: StartErrorData }).data
    return data
  }
  return null
}

interface NewAuditFormProps {
  onStarted?: () => void
  onCancel?: () => void
  showCancel?: boolean
  submitLabel?: string
  className?: string
}

export function NewAuditForm({
  onStarted,
  onCancel,
  showCancel = false,
  submitLabel = "Audit starten",
  className,
}: NewAuditFormProps) {
  const { navigate } = useRouter()
  const data = useQuery(api.workspaces.getMyWorkspace)
  const leadsData = useQuery(api.leads.listMyLeads, {})
  const startAudit = useAction(api.audits.startAudit)

  const [url, setUrl] = useState("")
  const [auditType, setAuditType] = useState<AuditType>("standard")
  const [reportLanguage, setReportLanguage] = useState<"de" | "en">("de")
  const [selectedLeadId, setSelectedLeadId] = useState<string | "">("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const idempotencyKeyRef = useRef(crypto.randomUUID())

  const credits = data?.credits
  const remainingCredits = credits?.remaining ?? 0
  const totalCredits = credits?.total ?? 0

  const auditReadyLeads = (leadsData?.items ?? []).filter((lead) => lead.auditReady)

  useEffect(() => {
    setReportLanguage(data?.workspace.reportLanguage ?? "de")
  }, [data?.workspace.reportLanguage])

  function resetForm() {
    setUrl("")
    setAuditType("standard")
    setReportLanguage(data?.workspace.reportLanguage ?? "de")
    setSelectedLeadId("")
    setUrlError(null)
    setFormError(null)
    idempotencyKeyRef.current = crypto.randomUUID()
  }

  function selectLead(leadId: string) {
    if (!leadId) {
      setSelectedLeadId("")
      return
    }
    const lead = auditReadyLeads.find((l) => l._id === leadId)
    if (!lead) {
      setSelectedLeadId("")
      return
    }
    setSelectedLeadId(leadId)
    setUrl(lead.websiteUrl ?? lead.normalizedWebsiteUrl ?? "")
    setUrlError(null)
  }

  function handleUrlChange(value: string) {
    setUrl(value)
    if (urlError) setUrlError(null)
    if (selectedLeadId) {
      const lead = auditReadyLeads.find((l) => l._id === selectedLeadId)
      const leadUrl = lead?.websiteUrl ?? lead?.normalizedWebsiteUrl ?? ""
      if (value.trim() !== leadUrl.trim()) {
        setSelectedLeadId("")
      }
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (isSubmitting) return

    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setUrlError("Bitte eine Website-URL eingeben.")
      return
    }

    setIsSubmitting(true)
    setUrlError(null)
    setFormError(null)

    let leadId: Id<"leads"> | undefined
    if (selectedLeadId) {
      const lead = auditReadyLeads.find((l) => l._id === selectedLeadId)
      const leadUrl = lead?.websiteUrl ?? lead?.normalizedWebsiteUrl ?? ""
      if (lead && trimmedUrl === leadUrl.trim()) {
        leadId = lead._id as Id<"leads">
      }
    }

    try {
      const result = await startAudit({
        url: trimmedUrl,
        auditType,
        reportLanguage,
        idempotencyKey: idempotencyKeyRef.current,
        leadId,
      })

      trackRybbitEvent("audit_started", { audit_type: auditType, report_language: reportLanguage })
      resetForm()
      onStarted?.()
      navigate({ name: "audit", id: result.auditId })
    } catch (error) {
      const dataError = getErrorData(error)
      const code = dataError?.code
      const message = dataError?.message

      if (code === "INVALID_URL" || code === "UNSAFE_URL" || code === "URL_UNRESOLVABLE") {
        setUrlError(message ?? "Bitte prüfe die eingegebene URL.")
      } else if (code === "INSUFFICIENT_CREDITS") {
        trackRybbitEvent("credits_exhausted", { plan: data?.subscription?.plan ?? "trial" })
        setFormError(
          message ?? "Für diesen Audit sind aktuell keine Credits verfügbar. Verwalte deinen Plan unter Plan & Credits.",
        )
      } else if (code === "RATE_LIMITED") {
        const retryAfter = dataError?.retryAfter
        const base = "Zu viele Versuche in kurzer Zeit. Bitte versuche es später erneut."
        setFormError(
          retryAfter && retryAfter > 0
            ? `${base} (freigegeben in ca. ${Math.max(1, Math.round(retryAfter / 60000))} Min.)`
            : base,
        )
      } else if (code === "WORKSPACE_NOT_READY") {
        setFormError(message ?? "Dein Workspace wird vorbereitet. Bitte versuche es gleich erneut.")
      } else {
        setFormError("Der Audit konnte nicht gestartet werden.")
      }
    } finally {
      setIsSubmitting(false)
      idempotencyKeyRef.current = crypto.randomUUID()
    }
  }

  const labelId = "audit-url-label"
  const urlInputId = "audit-url"
  const urlErrorId = "audit-url-error"
  const formErrorId = "audit-form-error"
  const leadLabelId = "audit-lead-label"
  const leadSelectId = "audit-lead"

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("space-y-4", className)}
      aria-describedby={formError ? formErrorId : undefined}
    >
      <div className="space-y-2" role="group" aria-labelledby={leadLabelId}>
        <Label id={leadLabelId} htmlFor={leadSelectId}>
          Gespeicherter Lead (optional)
        </Label>
        <Select value={selectedLeadId} onValueChange={selectLead} disabled={isSubmitting}>
          <SelectTrigger id={leadSelectId} aria-label="Gespeicherten Lead auswählen">
            <SelectValue placeholder="Ohne gespeicherten Lead" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Ohne gespeicherten Lead</SelectItem>
            {auditReadyLeads.map((lead) => (
              <SelectItem key={lead._id} value={lead._id}>
                {lead.businessName}
                {lead.websiteUrl ? ` · ${lead.websiteUrl}` : ""}
                {lead.city ? ` · ${lead.city}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2" role="group" aria-labelledby={labelId}>
        <Label id={labelId} htmlFor={urlInputId}>
          Website-URL
        </Label>
        <div className="relative">
          <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={urlInputId}
            value={url}
            onChange={(event) => handleUrlChange(event.target.value)}
            placeholder="zahnarzt-mueller.de"
            className={cn(
              "pl-9",
              urlError && "border-destructive focus-visible:ring-destructive/30",
            )}
            aria-invalid={urlError ? true : undefined}
            aria-describedby={urlError ? urlErrorId : undefined}
            disabled={isSubmitting}
          />
        </div>
        {urlError ? (
          <p id={urlErrorId} className="text-xs font-medium text-destructive">
            {urlError}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="audit-type">Audit-Typ</Label>
          <Select
            value={auditType}
            onValueChange={(value) => setAuditType(value as AuditType)}
            disabled={isSubmitting}
          >
            <SelectTrigger id="audit-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="local">Local SEO</SelectItem>
              <SelectItem value="quick">Quick</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="report-language">Report-Sprache</Label>
          <Select
            value={reportLanguage}
            onValueChange={(value) => setReportLanguage(value as "de" | "en")}
            disabled={isSubmitting}
          >
            <SelectTrigger id="report-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="de">Deutsch</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {formError ? (
        <Alert variant="destructive" id={formErrorId}>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{formError}</span>
            {remainingCredits === 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => navigate({ name: "billing-settings" })}
              >
                Plan wählen oder Credits kaufen
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
        <Sparkles className="size-3.5 text-primary" />
        Dieser Audit reserviert <span className="font-medium text-foreground">1 Credit</span>. Noch{" "}
        {remainingCredits} von {totalCredits} verfügbar.
      </div>

      <div className="flex justify-end gap-2">
        {showCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Abbrechen
          </Button>
        ) : null}
        <Button
          type="submit"
          disabled={isSubmitting || data === undefined || remainingCredits === 0}
          className="gap-2"
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {isSubmitting ? "Wird gestartet …" : submitLabel}
        </Button>
        {data !== undefined && remainingCredits === 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ name: "billing-settings" })}
          >
            Credits kaufen
          </Button>
        ) : null}
      </div>
    </form>
  )
}

NewAuditForm.displayName = "NewAuditForm"
