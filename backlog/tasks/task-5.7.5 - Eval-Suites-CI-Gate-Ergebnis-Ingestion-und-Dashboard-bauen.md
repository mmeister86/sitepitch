---
id: TASK-5.7.5
title: 'Eval-Suites, CI-Gate, Ergebnis-Ingestion und Dashboard bauen'
status: In Progress
assignee: []
created_date: '2026-07-16 20:22'
updated_date: '2026-07-16 20:57'
labels: []
dependencies: []
parent_task_id: TASK-5.7
priority: high
type: feature
ordinal: 66000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Striktes Eve-Eval-Gate mit sanitisierten DE/EN-Fixtures, signierter Ingestion und internem Trend-/Regression-Dashboard.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Mindestens fünf Fixtures decken Standard-, schwache Evidenz- und adversariale Fälle ab
- [x] #2 Safety-Gates und Qualitäts-/Regression-Schwellen blockieren fehlerhafte Kandidaten
- [x] #3 Nur sanitierte signierte Resultate gelangen in Convex
- [x] #4 Support-Admins sehen Trends, Gates und Fallregressionen
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Release-Manifest und Fixtures
2. Assertions/Judges und Reporter
3. Ingestion und Retention
4. Dashboard und CI
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Five DE/EN fixtures, strict schema/evidence/claim/quality/regression gates, dynamic released baseline, signed sanitized Convex ingestion, 180-day trends and support-admin dashboard implemented. Real judge execution remains CI-credential-gated by design.
<!-- SECTION:NOTES:END -->
