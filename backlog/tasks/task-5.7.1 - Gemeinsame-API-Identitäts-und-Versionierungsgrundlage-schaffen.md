---
id: TASK-5.7.1
title: 'Gemeinsame API-, Identitäts- und Versionierungsgrundlage schaffen'
status: In Progress
assignee: []
created_date: '2026-07-16 20:20'
updated_date: '2026-07-16 20:57'
labels: []
dependencies: []
parent_task_id: TASK-5.7
priority: high
type: feature
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
AuditPrincipal, gemeinsamer Audit-Start und migrationsfähige optionale Versionierungsfelder als Grundlage für UI und Public API.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 UI- und API-Starts verwenden denselben autorisierten Startpfad
- [x] #2 Credit-, Limit-, SSRF- und Failure-Settlement-Logik ist gemeinsam nutzbar
- [x] #3 Schemaänderungen sind optional, dual-read-fähig und für Backfills vorbereitet
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Bestehende Startpfade extrahieren
2. Principal und gemeinsame Mutationspfade ergänzen
3. Versionierungsfelder widen
4. Tests ergänzen
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shared AuditPrincipal/start use-case, consolidated failure settlement, optional output-version schema and dual-read/backfill paths implemented. Verified by codegen, schema contract, TypeScript and full Vitest suite.
<!-- SECTION:NOTES:END -->
