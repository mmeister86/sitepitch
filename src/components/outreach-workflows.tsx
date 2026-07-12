"use client"

import { useState } from "react"
import {
  Copy,
  Check,
  RotateCcw,
  Link2,
  Info,
  ShieldAlert,
  ChevronRight,
  Loader2,
  Save,
  Trash2,
} from "lucide-react"
import { useConvex, useMutation, useQuery } from "convex/react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { trackRybbitEvent } from "@/lib/analytics"
import { filterCompatibleTemplates } from "@/lib/outreach-template-compatibility"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

export type OutreachDraftType =
  | "email"
  | "linkedin"
  | "contact_form"
  | "phone_note"
  | "follow_up"

interface OutreachDraft {
  type: string
  subject?: string
  subjectLines?: string[]
  body: string
}

interface OutreachWorkflowsProps {
  auditId: Id<"audits">
  outreachDrafts: OutreachDraft[]
  shareUrl: string
  isPublic: boolean
  language: "de" | "en"
  onEnablePublic?: () => void | Promise<void>
}

const outreachTypeLabels: Record<string, string> = {
  email: "E-Mail",
  linkedin: "LinkedIn / Kontaktformular",
  contact_form: "Kontaktformular",
  phone_note: "Telefonnotiz",
  follow_up: "Follow-up",
}

interface DraftState {
  subject: string
  body: string
}

function buildInitialSubject(draft: OutreachDraft): string {
  return draft.subject ?? draft.subjectLines?.[0] ?? ""
}

export function OutreachWorkflows({
  auditId,
  outreachDrafts,
  shareUrl,
  isPublic,
  language,
  onEnablePublic,
}: OutreachWorkflowsProps) {
  const recordCopy = useMutation(api.reports.recordReportCopyEvent)
  const templates = useQuery(api.outreach_templates.listMyTemplates)

  const recordPublicLinkCopy = async () => {
    try {
      await recordCopy({ auditId, kind: "public_link" })
    } catch {
      /* analytics only */
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {outreachDrafts.map((draft, index) => (
          <OutreachDraftCard
            key={`${auditId}:${draft.type}:${index}`}
            auditId={auditId}
            draft={draft}
            shareUrl={shareUrl}
            isPublic={isPublic}
            language={language}
            templates={templates}
            onEnablePublic={onEnablePublic}
            recordCopy={recordCopy}
          />
        ))}

        {isPublic && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">Report-Link</p>
                <p className="truncate text-xs text-muted-foreground">{shareUrl}</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl)
                    } catch {
                      /* clipboard may be unavailable */
                    }
                    toast.success("Report-Link kopiert")
                    trackRybbitEvent("public_link_copied", { source: "internal_report" })
                    await recordPublicLinkCopy()
                  }}
                >
                  <Copy className="size-4" />
                  Link kopieren
                </button>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <ComplianceCard />
      </div>
    </div>
  )
}

function OutreachDraftCard({
  auditId,
  draft,
  shareUrl,
  isPublic,
  language,
  templates,
  onEnablePublic,
  recordCopy,
}: {
  auditId: Id<"audits">
  draft: OutreachDraft
  shareUrl: string
  isPublic: boolean
  language: "de" | "en"
  templates: Array<{
    _id: Id<"outreachTemplates">
    name: string
    type: string
    language: "de" | "en"
    subject?: string
    body: string
  }> | undefined
  onEnablePublic?: () => void | Promise<void>
  recordCopy: ReturnType<typeof useMutation<typeof api.reports.recordReportCopyEvent>>
}) {
  const label = outreachTypeLabels[draft.type] ?? draft.type
  const isEmail = draft.type === "email"
  const hasSubject = isEmail || Boolean(draft.subject)

  const original: DraftState = {
    subject: buildInitialSubject(draft),
    body: draft.body,
  }

  const [subject, setSubject] = useState(original.subject)
  const [body, setBody] = useState(original.body)
  const [copied, setCopied] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [templateName, setTemplateName] = useState(`${label} Vorlage`)
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false)
  const [isUpdatingTemplate, setIsUpdatingTemplate] = useState(false)
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false)
  const createTemplate = useMutation(api.outreach_templates.create)
  const updateTemplate = useMutation(api.outreach_templates.update)
  const deleteTemplate = useMutation(api.outreach_templates.deleteTemplate)
  const convex = useConvex()

  const dirty = subject !== original.subject || body !== original.body
  const draftType = draft.type as OutreachDraftType
  const linkInserted = body.includes(shareUrl)
  const compatibleTemplates = filterCompatibleTemplates(templates ?? [], draft.type, language)
  const selectedTemplate = compatibleTemplates.find((template) => template._id === selectedTemplateId)

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || isSavingTemplate) return
    setIsSavingTemplate(true)
    try {
      await createTemplate({
        name: templateName,
        type: draftType,
        language,
        subject: subject.trim() || undefined,
        body,
      })
      toast.success("Vorlage gespeichert")
      setSaveDialogOpen(false)
    } catch (error) {
      toast.error((error as Error)?.message ?? "Vorlage konnte nicht gespeichert werden")
    } finally {
      setIsSavingTemplate(false)
    }
  }

  const handleApplyTemplate = async () => {
    if (!selectedTemplateId || isApplyingTemplate) return
    setIsApplyingTemplate(true)
    try {
      const rendered = await convex.query(api.outreach_templates.renderForAudit, {
        templateId: selectedTemplateId as Id<"outreachTemplates">,
        auditId,
      })
      setSubject(rendered.subject ?? "")
      setBody(rendered.body)
      toast.success("Vorlage auf die Arbeitskopie angewendet")
    } catch (error) {
      toast.error((error as Error)?.message ?? "Vorlage konnte nicht angewendet werden")
    } finally {
      setIsApplyingTemplate(false)
    }
  }

  const handleUpdateTemplate = async () => {
    if (!selectedTemplate || isUpdatingTemplate) return
    if (!window.confirm(`Vorlage „${selectedTemplate.name}“ mit der aktuellen Arbeitskopie überschreiben?`)) return
    setIsUpdatingTemplate(true)
    try {
      await updateTemplate({
        templateId: selectedTemplate._id,
        name: selectedTemplate.name,
        type: draftType,
        language,
        subject: subject.trim() || undefined,
        body,
      })
      toast.success("Vorlage aktualisiert")
    } catch (error) {
      toast.error((error as Error)?.message ?? "Vorlage konnte nicht aktualisiert werden")
    } finally {
      setIsUpdatingTemplate(false)
    }
  }

  const handleDeleteTemplate = async () => {
    if (!selectedTemplateId || isDeletingTemplate) return
    if (!window.confirm("Diese Vorlage wirklich löschen?")) return
    setIsDeletingTemplate(true)
    try {
      await deleteTemplate({ templateId: selectedTemplateId as Id<"outreachTemplates"> })
      setSelectedTemplateId("")
      toast.success("Vorlage gelöscht")
    } catch (error) {
      toast.error((error as Error)?.message ?? "Vorlage konnte nicht gelöscht werden")
    } finally {
      setIsDeletingTemplate(false)
    }
  }

  const insertLink = () => {
    if (!isPublic || linkInserted) return
    const sep = body.endsWith("\n") ? "" : "\n\n"
    setBody(`${body}${sep}${shareUrl}`)
  }

  const reset = () => {
    setSubject(original.subject)
    setBody(original.body)
  }

  const handleCopy = async () => {
    const full = hasSubject && subject ? `Betreff: ${subject}\n\n${body}` : body
    try {
      await navigator.clipboard.writeText(full)
    } catch {
      /* clipboard may be unavailable */
    }
    setCopied(true)
    toast.success(`${label}-Text kopiert`)
    trackRybbitEvent("outreach_copied", { draft_type: draftType })
    setTimeout(() => setCopied(false), 1600)
    try {
      await recordCopy({
        auditId,
        kind: "outreach",
        draftType,
        edited: dirty,
        includedReportLink: linkInserted,
      })
    } catch {
      /* analytics only */
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{label}</CardTitle>
          <div className="flex items-center gap-1.5">
            {dirty && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={reset}
              >
                <RotateCcw className="size-3.5" />
                Zurücksetzen
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopy}>
              {copied ? (
                <Check className="size-4 text-score-strong" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "Kopiert" : "Kopieren"}
            </Button>
          </div>
        </div>

        {isEmail && draft.subjectLines && draft.subjectLines.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Betreffzeilen
            </p>
            <div className="flex flex-wrap gap-1.5">
              {draft.subjectLines.map((line, i) => {
                const active = line === subject
                return (
                  <button
                    key={`${line}-${i}`}
                    type="button"
                    onClick={() => setSubject(line)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-left text-xs transition-colors",
                      active
                        ? "border-primary bg-primary/10 font-medium text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/60",
                    )}
                  >
                    {line}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {hasSubject && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Betreff</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Text</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-40 font-sans leading-relaxed"
          />
        </div>

        <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="min-w-0 flex-1">
                <SelectValue placeholder={templates === undefined ? "Vorlagen laden …" : "Vorlage auswählen"} />
              </SelectTrigger>
              <SelectContent>
                {compatibleTemplates.map((template) => (
                  <SelectItem key={template._id} value={template._id}>
                    {template.name} · {template.language.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!selectedTemplateId || isApplyingTemplate}
              onClick={() => void handleApplyTemplate()}
            >
              {isApplyingTemplate && <Loader2 className="size-3.5 animate-spin" />}
              Anwenden
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Vorlage löschen"
              disabled={!selectedTemplateId || isDeletingTemplate}
              onClick={() => void handleDeleteTemplate()}
            >
              {isDeletingTemplate ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => setSaveDialogOpen(true)}>
              <Save className="size-3.5" />
              Als Vorlage speichern
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!selectedTemplate || isUpdatingTemplate}
              onClick={() => void handleUpdateTemplate()}
            >
              {isUpdatingTemplate ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Vorlage aktualisieren
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {dirty ? (
            <p className="text-xs text-muted-foreground">
              Arbeitskopie bearbeitet — das Original bleibt gespeichert.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Editierbar — Original bleibt unverändert erhalten.
            </p>
          )}

          {isPublic ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={insertLink}
              disabled={linkInserted}
            >
              <Link2 className="size-3.5" />
              {linkInserted ? "Link enthalten" : "Report-Link einfügen"}
            </Button>
          ) : (
            onEnablePublic && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
                onClick={onEnablePublic}
              >
                <Link2 className="size-3.5" />
                Report freigeben für Link
                <ChevronRight className="size-3.5" />
              </Button>
            )
          )}
        </div>
      </CardContent>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Arbeitskopie als Vorlage speichern</DialogTitle>
            <DialogDescription>Die aktuelle Betreffzeile und der Text werden geprüft und im Workspace gespeichert.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor={`template-name-${draft.type}`}>Vorlagenname</Label>
            <Input
              id={`template-name-${draft.type}`}
              value={templateName}
              maxLength={80}
              onChange={(event) => setTemplateName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)} disabled={isSavingTemplate}>Abbrechen</Button>
            <Button onClick={() => void handleSaveTemplate()} disabled={!templateName.trim() || isSavingTemplate}>
              {isSavingTemplate ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function ComplianceCard() {
  return (
    <>
      <Card className="border-score-strong/25 bg-score-strong/5">
        <CardContent className="space-y-2 py-5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-score-strong" />
            <p className="text-sm font-medium">Verantwortung Outreach</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Diese Texte sind bearbeitbare Entwürfe. SitePitch versendet nichts
            automatisch, reichert keine Kontakte an und prüft keine Rechtsgrundlage für
            deine Kontaktaufnahme. Du entscheidest selbst, wen du kontaktierst, und bist
            für Prüfung, Versand und die Einhaltung geltender Gesetze verantwortlich.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Claim-Safety geprüft</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <p>
              Alle Texte wurden auf belegbare Aussagen geprüft. Keine rechtlichen, Umsatz-
              oder Security-Behauptungen ohne Evidenz.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant="outline" className="text-xs">manuell kopierbar</Badge>
            <Badge variant="outline" className="text-xs">kein Massenversand</Badge>
            <Badge variant="outline" className="text-xs">keine Kontaktanreicherung</Badge>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
