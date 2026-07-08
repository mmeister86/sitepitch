"use client"

import { Gauge, Brain, Sparkles, TriangleAlert, Wrench, Quote, ThumbsUp, Loader2, RefreshCw } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface DesignCritiqueHeuristic {
  name: string
  score: number
  keyIssue: string
}

export interface DesignPriorityIssue {
  severity: string
  title: string
  whyItMatters: string
  fix: string
  evidenceRefs: string[]
}

export interface DesignCritique {
  designHealthScore: number
  ratingBand: string
  overallImpression: string
  heuristicScores: DesignCritiqueHeuristic[]
  cognitiveLoadFailedCount: number
  cognitiveLoadLevel: string
  cognitiveLoadNotes: string
  antiPatternVerdict: string
  whatsWorking: string[]
  priorityIssues: DesignPriorityIssue[]
  recommendations: string[]
  evidenceRefs: string[]
}

const severityMeta: Record<string, { label: string; badge: string }> = {
  P0: { label: "Blockierend", badge: "bg-score-weak/15 text-score-weak" },
  P1: { label: "Hoch", badge: "bg-primary/12 text-primary" },
  P2: { label: "Gering", badge: "bg-muted text-muted-foreground" },
  P3: { label: "Optional", badge: "bg-muted/60 text-muted-foreground" },
}

const cognitiveLoadMeta: Record<string, { label: string; badge: string }> = {
  low: { label: "Niedrig", badge: "bg-score-strong/15 text-score-strong" },
  moderate: { label: "Moderat", badge: "bg-primary/12 text-primary" },
  high: { label: "Hoch", badge: "bg-score-weak/15 text-score-weak" },
}

function scoreBand(score: number): { label: string; tone: string } {
  if (score >= 36) return { label: "Exzellent", tone: "text-score-strong" }
  if (score >= 28) return { label: "Gut", tone: "text-score-strong" }
  if (score >= 20) return { label: "Akzeptabel", tone: "text-primary" }
  if (score >= 12) return { label: "Ausbaufähig", tone: "text-score-weak" }
  return { label: "Kritisch", tone: "text-score-weak" }
}

export function DesignCritiquePanel({
  critique,
  isGenerating = false,
  onGenerate,
}: {
  critique: DesignCritique | null
  isGenerating?: boolean
  onGenerate?: () => void | Promise<void>
}) {
  if (!critique) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center text-sm text-muted-foreground">
          <p>
            Die Design-Analyse wurde für diesen Audit noch nicht erzeugt. Du kannst sie für diesen bestehenden Audit
            nachträglich erzeugen, ohne einen vollständigen Re-Audit zu starten.
          </p>
          {onGenerate && (
            <Button onClick={onGenerate} disabled={isGenerating} className="gap-2">
              {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {isGenerating ? "Design-Analyse läuft ..." : "Design-Analyse erzeugen"}
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  const band = scoreBand(critique.designHealthScore)
  const cog = cognitiveLoadMeta[critique.cognitiveLoadLevel] ?? cognitiveLoadMeta.moderate

  return (
    <div className="space-y-3">
      {/* Health score hero */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="size-4 text-primary" />
            Design-Kritik
          </CardTitle>
          <CardDescription>
            UX- und Design-Bewertung wie aus Sicht eines Design Directors – basierend auf Heuristiken, kognitiver Last
            und sichtbaren Screenshots.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <div className="flex items-baseline gap-1">
                <span className={cn("text-4xl font-semibold tabular-nums", band.tone)}>
                  {critique.designHealthScore}
                </span>
                <span className="text-sm text-muted-foreground">/ 40</span>
              </div>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {critique.ratingBand}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Badge className={cn("w-fit border-0 font-medium", cog.badge)}>
                <Brain className="mr-1 size-3" />
                Cognitive Load: {cog.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {critique.cognitiveLoadFailedCount}/8 Kriterien nicht erfüllt
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-primary/15 bg-primary/5 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">Gesamteindruck</p>
            <p className="mt-1 text-sm leading-relaxed text-foreground/80">{critique.overallImpression}</p>
          </div>

          {critique.cognitiveLoadNotes && (
            <div className="rounded-lg border p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Brain className="size-3.5" />
                Kognitive Last
              </p>
              <p className="mt-1 text-sm text-foreground/80">{critique.cognitiveLoadNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Heuristic scores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nielsen-Heuristiken</CardTitle>
          <CardDescription>10 Usability-Heuristiken, jeweils 0–4 bewertet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {critique.heuristicScores.map((h, i) => (
            <div key={i} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{h.name}</p>
                <span
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    h.score >= 3 ? "text-score-strong" : h.score >= 2 ? "text-primary" : "text-score-weak",
                  )}
                >
                  {h.score}/4
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{h.keyIssue}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Anti-pattern verdict */}
      {critique.antiPatternVerdict && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" />
              Anti-Pattern-Check
            </CardTitle>
            <CardDescription>Wirkt die Website generisch, templatisiert oder überladen?</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground/80">{critique.antiPatternVerdict}</p>
          </CardContent>
        </Card>
      )}

      {/* What's working */}
      {critique.whatsWorking.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ThumbsUp className="size-4 text-score-strong" />
              Was funktioniert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {critique.whatsWorking.map((w, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-score-strong">+</span>
                  {w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Priority issues */}
      {critique.priorityIssues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlert className="size-4 text-score-weak" />
              Priorisierte Probleme
            </CardTitle>
            <CardDescription>Die wirkungsvollsten Design-Probleme, nach Priorität geordnet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {critique.priorityIssues.map((issue, i) => {
              const sev = severityMeta[issue.severity] ?? severityMeta.P2
              return (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold">{issue.title}</p>
                    <Badge className={cn("shrink-0 border-0 font-medium", sev.badge)}>
                      {issue.severity} · {sev.label}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground/70">Warum es zählt: </span>
                    {issue.whyItMatters}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground/70">Fix: </span>
                    {issue.fix}
                  </p>
                  {issue.evidenceRefs.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Quote className="size-3 text-muted-foreground" />
                      {issue.evidenceRefs.map((ref, j) => (
                        <Badge key={j} variant="outline" className="font-normal text-muted-foreground">
                          {ref}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {critique.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="size-4 text-primary" />
              Empfehlungen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2.5">
              {critique.recommendations.map((rec, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-muted-foreground">{rec}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {critique.evidenceRefs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          <Quote className="size-3.5 text-muted-foreground" />
          {critique.evidenceRefs.map((ref, i) => (
            <Badge key={i} variant="outline" className="font-normal text-muted-foreground">
              {ref}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
