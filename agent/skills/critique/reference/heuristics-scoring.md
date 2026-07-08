# Heuristics Scoring Guide

Bewerte jede der 10 Nielsen-Heuristiken auf einer 0–4 Skala. Eine 4 bedeutet
genuinely exzellent, nicht „gut genug".

## Score-Regeln

| Score | Kriterien |
|-------|----------|
| 0 | Kein Feedback / rein technisch / errors easy to make / kein Help |
| 1 | Selten / verwirrend / wenige Safeguards |
| 2 | Teilweise / Hauptfluss ok, Details lückenhaft |
| 3 | Gut / meist klar, kleine Lücken |
| 4 | Exzellent / durchgängig umgesetzt |

## Summen-Bewertung

| Score | Rating | Bedeutung |
|-------|--------|-----------|
| 36–40 | Excellent | Nur Polish nötig |
| 28–35 | Good | Schwache Bereiche adressieren |
| 20–27 | Acceptable | Deutliche Verbesserungen nötig |
| 12–19 | Poor | Größere UX-Überarbeitung |
| 0–11 | Critical | Neuaufbau nötig |

## Issue Severity (P0–P3)

| Priority | Name | Beschreibung |
|----------|------|-------------|
| P0 | Blocking | Taskabschluss verhindert |
| P1 | Major | Erhebliche Schwierigkeit/Verwirrung |
| P2 | Minor | Ärgernis, Workaround vorhanden |
| P3 | Polish | Nice-to-fix |

Leitfrage bei Unsicherheit: „Würde ein Nutzer deshalb Support kontaktieren?" →
mindestens P1.

## Hinweis für SitePitch

Bewerte nur, was aus Checks, Signalen, Scores und Screenshots ableitbar ist.
Nicht beurteilbare Heuristiken bekommen einen konservativen Score mit Hinweis in
`keyIssue`.
