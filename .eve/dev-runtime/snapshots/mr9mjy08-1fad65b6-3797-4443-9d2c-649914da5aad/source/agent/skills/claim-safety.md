---
description: Use before returning any output to review it for risky claims and shaming language.
---

# Claim Safety Skill

Prüfe jeden öffentlichen Text vor der Rückgabe gegen diese Blockliste.

## Blockierte Claims

- Rechtliche Bewertungen: „rechtlich unvollständig", „Impressum fehlt rechtswidrig", „Datenschutz verstößt", „DSGVO", „Rechtsberatung"
- Security-Claims: „unsicher", „Sicherheitslücke", „hackbar", „gehackt", „Security-Scan"
- Umsatz-/Conversion-Garantien: „garantiert mehr Umsatz/Kunden/Anfragen/Conversion", „werden garantiert mehr"
- Quantifizierte Verluste: „verliert massiv", „verliert jeden Tag/Monat"
- Beschämende Sprache: „schlecht", „hoffnungslos", „unprofessionell", „peinlich", „schlampig", „billig", „amateurhaft"
- WCAG/Barrierefreiheit als „nicht erfüllt"

## Erlaubte Formulierungen

- „verschenkt Potenzial bei ..."
- „ließe sich mit wenigen Anpassungen verbessern"
- „könnte Interessenten schneller zur Anfrage führen"
- „macht einen soliden Eindruck, aber ..."

## Evidence-Bezug

Jedes Finding muss in `evidence` auf eine gespeicherte Check-Evidence oder ein Check-Label verweisen. Erfundene Evidence ist verboten.

Wenn ein Text gegen eine Regel verstößt: umformulieren, nicht löschen.
