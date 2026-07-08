"use client"

import { Users, ThumbsUp, ThumbsDown, Target, Quote } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface PersonaReview {
  personaId: string
  personaName: string
  lens: string
  verdict: string
  positives: string[]
  frictionPoints: string[]
  topRecommendation: string
  evidenceRefs: string[]
  confidence: string
  sortOrder: number
}

const confidenceMeta: Record<string, { label: string; badge: string }> = {
  high: { label: "Hohe Sicherheit", badge: "bg-score-strong/15 text-score-strong" },
  medium: { label: "Mittlere Sicherheit", badge: "bg-primary/12 text-primary" },
  low: { label: "Geringe Sicherheit", badge: "bg-muted text-muted-foreground" },
}

export function PersonaPanel({ reviews }: { reviews: PersonaReview[] }) {
  if (reviews.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Persona-Reviews wurden für diesen Audit noch nicht erzeugt. Starte einen Re-Audit, um sie zu erhalten.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => {
        const conf = confidenceMeta[review.confidence] ?? confidenceMeta.low
        return (
          <Card key={review.personaId}>
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="size-4 text-muted-foreground" />
                    {review.personaName}
                  </CardTitle>
                  <CardDescription className="mt-1">{review.lens}</CardDescription>
                </div>
                <Badge className={cn("shrink-0 border-0 font-medium", conf.badge)}>
                  {conf.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-primary/15 bg-primary/5 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-primary">Urteil</p>
                <p className="mt-1 text-sm text-foreground/80">{review.verdict}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {review.positives.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-score-strong">
                      <ThumbsUp className="size-3.5" />
                      Positiv
                    </p>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      {review.positives.map((p, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-score-strong">+</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {review.frictionPoints.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-score-weak">
                      <ThumbsDown className="size-3.5" />
                      Reibungspunkte
                    </p>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      {review.frictionPoints.map((p, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-score-weak">–</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Target className="size-3.5" />
                  Top-Empfehlung
                </p>
                <p className="mt-1 text-sm text-foreground/80">{review.topRecommendation}</p>
              </div>

              {review.evidenceRefs.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Quote className="size-3 text-muted-foreground" />
                  {review.evidenceRefs.map((ref, i) => (
                    <Badge key={i} variant="outline" className="font-normal text-muted-foreground">
                      {ref}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
