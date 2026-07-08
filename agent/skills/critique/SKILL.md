---
description: Use when running the design critique to evaluate UX, visual hierarchy, cognitive load, and design quality like a design director (Design-Kritik aus Checks, Signalen und Screenshots).
---

# Design-Kritik Skill

Bewerte die Website wie ein Design Director: visuelle Hierarchie, Informationsarchitektur, kognitive Last, Anti-Patterns und generelle Designqualität. Grundlage sind die gespeicherten Checks, Signale, Scores und Screenshots des Audits.

Diese Prozedur wird produktiv über den Convex-Prompt-Builder
`convex/lib/audit_design_critique_prompt.ts` gespiegelt. Beide Quellen müssen
inhaltlich übereinstimmen; ändere eine Seite, passe die andere an.

## Bewertungs-Grundlage

Bewerte ausschließlich auf Basis der gelieferten Checks, Signale, Screenshots
und Scores. Behauute keine visuellen oder technischen Eigenschaften, die du aus
diesen Quellen nicht ableiten kannst. Ist etwas nicht beurteilbar, wähle einen
konservativen Score und nenne es in `keyIssue`.

## Nielsens 10 Usability-Heuristiken (jeweils 0–4)

Bewerte diese 10 Heuristiken (Score 0–4, 4 = tatsächlich exzellent, die meisten
echten Seiten erreichen 20–32 von 40):

1. Sichtbarkeit des Systemstatus
2. Übereinstimmung mit der realen Welt
3. Benutzerkontrolle und Freiheit
4. Konsistenz und Standards
5. Fehlervermeidung
6. Erkennen statt Erinnern
7. Flexibilität und Effizienz der Nutzung
8. Ästhetisches und minimalistisches Design
9. Unterstützung bei Fehlererkennung, -diagnose und -behebung
10. Hilfe und Dokumentation

Details zur Bewertung: `reference/heuristics-scoring.md`.

## Cognitive Load

Prüfe die 8-Punkte-Checkliste in `reference/cognitive-load.md` und gib
`failedCount` (0–8) an. Level: 0–1 = `low`, 2–3 = `moderate`, 4+ = `high`.

## Anti-Pattern-Erkennung

Erkenne generisches, templatisiertes oder überladenes Design: identische
Karten-Raster, seitliche Akzent-Streifen, Gradient-Text, rein dekoratives
Glassmorphism, bedeutungslose Sparklines, Hero-Metriken-Template,
alles-in-Karten, fehlende Hierarchie, monotone Farben. Leitfrage: Würde jemand
sofort glauben, das sei „KI/Template-generiert"? Ehrlich, aber konstruktiv.

## Output

Strukturiertes JSON gemäß `designCritiqueOutputSchema`:

- `designHealthScore` (Ganzzahl 0–40): Summe der 10 Heuristik-Scores.
- `ratingBand`: „Kritisch" | „Ausbaufähig" | „Akzeptabel" | „Gut" | „Exzellent".
- `overallImpression` (1–600 Zeichen).
- `heuristicScores` (genau 10, in obiger Reihenfolge): `{ name (deutscher Name), score, keyIssue }`.
- `cognitiveLoad`: `{ failedCount, level, notes }`.
- `antiPatternVerdict` (1–600 Zeichen).
- `whatsWorking` (1–3).
- `priorityIssues` (1–5): `{ severity ("P0".."P3"), title, whyItMatters, fix, evidenceRefs }`.
- `recommendations` (1–6).
- `evidenceRefs` (1–8): übergeordnete Bezüge auf gespeicherte Checks.

## Harte Regeln — Claim Safety

Verboten in jedem Text:
- Rechtliche Bewertungen, Security-Claims, Umsatz-/Conversion-Garantien
- Beschämende Sprache („schlecht", „unprofessionell", „peinlich", „schlampig", „hässlich")
- WCAG/Barrierefreiheit als „nicht erfüllt"
- Erfundene Zahlen oder erfundene Messwerte

Erlaubt: konstruktive, konkrete Formulierungen mit Bezug auf vorhandene Evidence
oder sichtbare Screenshots.

## Harte Regel — Evidence-Bezug

Das Top-Level `evidenceRefs` muss mindestens einen gespeicherten Check berühren
(Ref wie `conversion:primary_cta`, ein Label oder eine Check-Evidence).

Einzelne `priorityIssues` beruhen oft auf Heuristiken oder Screenshots, für die
es keinen gespeicherten Check gibt (z. B. Hilfe/Dokumentation, Benutzerkontrolle,
Fehlervermeidung, visuelle Konsistenz). Das ist erlaubt: nenne in deren
`evidenceRefs` die Quelle als kurzen Tag, z. B. `screenshot:hero`,
`heuristic:help-documentation` oder `signal:images_missing_alt_count`. Wenn ein
passender gespeicherter Check existiert, bevorzuge ihn.

Sprache exakt in `reportLanguage` (`de` oder `en`).
