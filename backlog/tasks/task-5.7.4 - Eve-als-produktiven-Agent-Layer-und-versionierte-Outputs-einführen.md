---
id: TASK-5.7.4
title: Eve als produktiven Agent-Layer und versionierte Outputs einführen
status: In Progress
assignee: []
created_date: '2026-07-16 20:21'
updated_date: '2026-07-16 20:57'
labels: []
dependencies: []
parent_task_id: TASK-5.7
priority: high
type: feature
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Produktive Audit-Läufe über Eve führen, sichere Recovery behalten und Candidates immutable validieren/aktivieren.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Eve ist intern authentifiziert und kein Public-API-Key erhält Zugriff
- [x] #2 Eve-, AI-SDK- und deterministische Versuche werden versions- und kostenbezogen erfasst
- [x] #3 Ungültige Candidates verändern den aktiven Bericht nicht
- [x] #4 Summary, Findings und Outreach besitzen exakte Evidence-Refs
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Eve-Route und Client-Adapter
2. Release-Manifest und Run-Metadaten
3. Immutable Candidates und Validierung
4. Recovery-Fallbacks und Tests
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Eve is fail-closed and primary for core, persona, copy and design runs. Immutable candidates, exact evidence refs, validation gates, run metadata/costs and AI-SDK/deterministic recovery implemented. Release manifest advanced to 2026.07.16.2 / prompt v3 / schema v3.
<!-- SECTION:NOTES:END -->
