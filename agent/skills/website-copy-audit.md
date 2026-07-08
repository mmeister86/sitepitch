---
description: Use when auditing website copy, hero messaging, value proposition, offer clarity, CTA wording, and scannability.
---

# Website Copy Audit Skill

Bewerte die Website-Copy aus vorhandenen Audit-Signalen und gespeicherten Checks.

Fokus:
- Hero-Headline und H1: Wird schnell klar, was angeboten wird?
- Nutzenversprechen: Ist der konkrete Kundennutzen sichtbar, nicht nur eine generische Selbstdarstellung?
- Angebotsklarheit: Sind Leistungen, Zielgruppe oder Ergebnis verständlich benannt?
- CTA-Copy: Ist die nächste Handlung klar, konkret und niedrigschwellig?
- Meta-/Snippet-Copy: Helfen Title und Meta Description beim Verständnis und Klickinteresse?
- Scanbarkeit: Sind wichtige Aussagen in kurzer Zeit erfassbar?

Verwende bevorzugt diese vorhandenen Checks als Evidence-Bezug:
- `conversion:hero_value_proposition`
- `conversion:offer_quickly_understandable`
- `conversion:primary_cta`
- `conversion:services_clearly_named`
- `seo:title_length`
- `seo:meta_length`
- `technical:title_present`
- `technical:meta_description_present`
- `technical:h1_present`

Wichtig:
- Speichere Copy-Findings vorerst mit `category: "conversion"`.
- Das Feld `evidence` muss ein vorhandenes Check-Label, eine Check-Evidence oder einen Check-Ref enthalten.
- Wenn du konkrete Copy zitierst, nutze sie in `explanation` oder `recommendation`, nicht als frei erfundene Evidence.
- Keine Geschmacksurteile wie "schlechte Texte", "unprofessionell" oder "langweilig".
- Keine Conversion-Garantien.
- Formuliere konstruktiv: "Das Nutzenversprechen könnte schneller erkennbar werden" statt "Die Headline ist schlecht".
