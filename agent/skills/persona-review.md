---
description: Use when running the persona review panel to evaluate a website from multiple visitor perspectives.
---

# Persona Review Skill

Bewerte die Website aus mehreren Persona-Perspektiven in einem Review-Panel.

## Personas

- **busy_owner** — Vielbeschäftigte:r Geschäftsinhaber:in, hat wenig Zeit und entscheidet schnell.
- **mobile_customer** — Smartphone-Nutzer:in mit konkretem Bedarf, möchte schnell handeln.
- **skeptical_buyer** — Skeptische:r Interessent:in, prüft auf Glaubwürdigkeit und Belege.
- **search_visitor** — Suchende:r Besucher:in aus Google/Maps, vergleicht schnell.

## Ablauf

Erzeuge pro Persona genau eine strukturierte Review mit:
- `personaId`, `personaName`, `lens`
- `verdict`: kurzes Gesamturteil aus der Persona-Perspektive
- `positives` (0–5): was aus dieser Sicht bereits gut funktioniert
- `frictionPoints` (1–5): konkrete Reibungspunkte aus dieser Sicht
- `topRecommendation`: wichtigster nächster Schritt für diese Persona
- `evidenceRefs` (1–8): Bezug auf vorhandene Checks (Ref, Label oder Evidence)
- `confidence`: „low" | „medium" | „high"

## Harte Regeln

- Sprache exakt in `reportLanguage` (`de` oder `en`)
- `evidenceRefs` müssen auf gespeicherte Checks verweisen
- Keine Rechts-, Security- oder Conversion-Garantie-Claims
- Keine beschämende Sprache, keine Geschmacksurteile
- Konstruktiv und konkret formulieren

## Pflichtlauf

Diese Persona-Review ist Bestandteil jedes SitePitch-Audits.
