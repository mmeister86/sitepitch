"use client"

import { PenLine, Lightbulb, Quote } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export interface CopyReview {
  heroClarity: string
  valueProposition: string
  offerClarity: string
  ctaClarity: string
  snippetClarity: string
  overallVerdict: string
  recommendations: string[]
  evidenceRefs: string[]
}

interface CopyField {
  label: string
  value: string
}

export function CopyReviewPanel({ review }: { review: CopyReview | null }) {
  if (!review) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Die Copy-Analyse wurde für diesen Audit noch nicht erzeugt. Starte einen Re-Audit, um sie zu erhalten.
        </CardContent>
      </Card>
    )
  }

  const fields: CopyField[] = [
    { label: "Hero-Klarheit", value: review.heroClarity },
    { label: "Nutzenversprechen", value: review.valueProposition },
    { label: "Angebotsklarheit", value: review.offerClarity },
    { label: "CTA-Wording", value: review.ctaClarity },
    { label: "Snippet-Copy (Title & Meta)", value: review.snippetClarity },
  ]

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PenLine className="size-4 text-primary" />
            Website-Copy Analyse
          </CardTitle>
          <CardDescription>
            Bewertung der Texte aus Sicht von Klarheit, Nutzenversprechen und Handlungsaufruf.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-primary/15 bg-primary/5 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">Gesamturteil</p>
            <p className="mt-1 text-sm leading-relaxed text-foreground/80">{review.overallVerdict}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.label} className="rounded-lg border p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {field.label}
                </p>
                <p className="mt-1 text-sm text-foreground/80">{field.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {review.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="size-4 text-primary" />
              Empfehlungen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2.5">
              {review.recommendations.map((rec, i) => (
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

      {review.evidenceRefs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          <Quote className="size-3.5 text-muted-foreground" />
          {review.evidenceRefs.map((ref, i) => (
            <Badge key={i} variant="outline" className="font-normal text-muted-foreground">
              {ref}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
