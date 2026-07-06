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
} from "lucide-react"
import { useMutation } from "convex/react"

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
import { toast } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
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
  onEnablePublic,
}: OutreachWorkflowsProps) {
  const recordCopy = useMutation(api.reports.recordReportCopyEvent)

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
        {outreachDrafts.map((draft) => (
          <OutreachDraftCard
            key={draft.type}
            auditId={auditId}
            draft={draft}
            shareUrl={shareUrl}
            isPublic={isPublic}
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
  onEnablePublic,
  recordCopy,
}: {
  auditId: Id<"audits">
  draft: OutreachDraft
  shareUrl: string
  isPublic: boolean
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

  const dirty = subject !== original.subject || body !== original.body
  const draftType = draft.type as OutreachDraftType
  const linkInserted = body.includes(shareUrl)

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
            Du entscheidest selbst, wen du kontaktierst. SitePitch versendet nichts
            automatisch, reichert keine Kontakte an und prüft keine Rechtsgrundlage für
            deine Kontaktaufnahme. Du bist für die Einhaltung geltender Gesetze
            verantwortlich.
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
