---
id: TASK-5.7.6
title: 'Migration, Retention, Sicherheit und manuelle Abnahme abschließen'
status: In Progress
assignee: []
created_date: '2026-07-16 20:22'
updated_date: '2026-07-16 20:59'
labels: []
dependencies: []
parent_task_id: TASK-5.7
priority: high
type: task
ordinal: 67000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Widen–Migrate–Narrow-Backfills, Lösch-/Retention-Pfade, Feature-Schalter, Recovery-Limits und vollständige Abnahme absichern.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Backfills für API-IDs und Legacy-Outputversionen sind resumierbar und idempotent
- [x] #2 Retention und Workspace-Löschung behandeln Keys, Versionen und Eval-Metriken korrekt
- [x] #3 Recovery verlangt Grund, ist limitiert und verbraucht keine Kundencredits
- [ ] #4 Codegen, Vitest, TypeScript, Build und manuelle Szenarien sind dokumentiert
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Migrationsdefinitionen
2. Retention/Löschung/Flags
3. Recovery-Sicherheit
4. Automatisierte und manuelle Verifikation
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Resumable API-ID/legacy-output backfills, deletion/retention, feature switches and bounded reason-required zero-credit recovery implemented. Automated verification: Convex codegen passed; 68 Vitest files / 568 tests passed; schema contract passed; TypeScript passed; Eve release hashcheck and 5-fixture discovery passed; production build passed. AC #4 remains open pending real manual deployment, webhook and judge scenarios.

Added an idempotent migration-resumption test covering stable aud_ IDs, one legacy immutable output version, linked rows and verification. Final automated result: 69 Vitest files / 569 tests passed.
<!-- SECTION:NOTES:END -->
