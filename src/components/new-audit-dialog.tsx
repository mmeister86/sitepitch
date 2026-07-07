"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useAction, useQuery } from "convex/react"
import { Globe, Loader2, Sparkles } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import type { AuditType } from "@/lib/types"
import { api } from "../../convex/_generated/api"

function getErrorData(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof (error as { data?: unknown }).data === "object" &&
    (error as { data?: { code?: unknown; message?: unknown; retryAfter?: unknown } }).data !== null
  ) {
    return error as {
      data: {
        code?: string
        message?: string
        retryAfter?: number
      }
    }
  }
  return null
}

export function NewAuditDialog({ trigger }: { trigger: ReactNode }) {
  const { navigate } = useRouter()
  const data = useQuery(api.workspaces.getMyWorkspace)
  const startAudit = useAction(api.audits.startAudit)
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [auditType, setAuditType] = useState<AuditType>("standard")
  const [reportLanguage, setReportLanguage] = useState<"de" | "en">("de")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const idempotencyKeyRef = useRef(crypto.randomUUID())

  const credits = data?.credits
  const remainingCredits = credits?.remaining ?? 0
  const totalCredits = credits?.total ?? 0

  useEffect(() => {
    if (!open) return
    setUrl("")
    setAuditType("standard")
    setReportLanguage(data?.workspace.reportLanguage ?? "de")
    setUrlError(null)
    setFormError(null)
    idempotencyKeyRef.current = crypto.randomUUID()
  }, [data?.workspace.reportLanguage, open])

  async function handleSubmit() {
    if (isSubmitting) return

    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setUrlError("Bitte eine Website-URL eingeben.")
      return
    }

    setIsSubmitting(true)
    setUrlError(null)
    setFormError(null)

    try {
      const result = await startAudit({
        url: trimmedUrl,
        auditType,
        reportLanguage,
        idempotencyKey: idempotencyKeyRef.current,
      })

      setOpen(false)
      setUrl("")
      setAuditType("standard")
      setReportLanguage(data?.workspace.reportLanguage ?? "de")
      setUrlError(null)
      setFormError(null)
      idempotencyKeyRef.current = crypto.randomUUID()

      navigate({ name: "audit", id: result.auditId })
    } catch (error) {
      const dataError = getErrorData(error)
      const code = dataError?.data.code
      const message = dataError?.data.message

      if (code === "INVALID_URL" || code === "UNSAFE_URL" || code === "URL_UNRESOLVABLE") {
        setUrlError(message ?? "Bitte prüfe die eingegebene URL.")
      } else if (code === "INSUFFICIENT_CREDITS") {
        setFormError(message ?? "Für diesen Audit sind aktuell keine Credits verfügbar.")
      } else if (code === "RATE_LIMITED") {
        const retryAfter = dataError?.data.retryAfter
        const base = "Zu viele Versuche in kurzer Zeit. Bitte versuche es später erneut."
        setFormError(
          retryAfter && retryAfter > 0
            ? `${base} (freigegeben in ca. ${Math.max(1, Math.round(retryAfter / 60000))} Min.)`
            : base,
        )
      } else {
        setFormError("Der Audit konnte nicht gestartet werden.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neuen Audit starten</DialogTitle>
          <DialogDescription>
            Analysiere eine öffentlich erreichbare Website und erstelle einen gebrandeten Report.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="audit-url">Website-URL</Label>
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="audit-url"
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value)
                  if (urlError) setUrlError(null)
                }}
                placeholder="zahnarzt-mueller.de"
                className={cn("pl-9", urlError && "border-destructive focus-visible:ring-destructive/30")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void handleSubmit()
                  }
                }}
              />
            </div>
            {urlError && <p className="text-xs font-medium text-destructive">{urlError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Audit-Typ</Label>
              <Select value={auditType} onValueChange={(value) => setAuditType(value as AuditType)}>
                <SelectTrigger>
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
              <Label>Report-Sprache</Label>
              <Select value={reportLanguage} onValueChange={(value) => setReportLanguage(value as "de" | "en")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Dieser Audit reserviert <span className="font-medium text-foreground">1 Credit</span>.
            Noch {remainingCredits} von {totalCredits} verfügbar.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Abbrechen
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={isSubmitting} className="gap-2">
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {isSubmitting ? "Wird gestartet …" : "Audit starten"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
