---
id: TASK-5.7.2
title: API-Keys und Public API v1 bereitstellen
status: In Progress
assignee: []
created_date: '2026-07-16 20:21'
updated_date: '2026-07-16 20:57'
labels: []
dependencies: []
parent_task_id: TASK-5.7
priority: high
type: feature
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Hash-only API-Key-Lifecycle, REST-v1-Endpunkte, OpenAPI-Vertrag und API-Einstellungsseite für Scale-Workspaces.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Keys sind raw-once, scoped, rotierbar, widerrufbar und workspace-isoliert
- [x] #2 POST/GET Audit-Endpunkte liefern ausschließlich externe IDs und definierte Fehler
- [x] #3 OpenAPI 3.1 beschreibt Auth, Idempotenz, Limits und Webhooks
- [x] #4 API-Einstellungsseite ist barrierefrei und entfernt Rohschlüssel nach Bestätigung
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Key-Datenmodell und Lifecycle
2. Transport- und Audit-Endpunkte
3. OpenAPI-Vertrag
4. UI und Tests
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scale API-key lifecycle, REST v1, OpenAPI 3.1 and accessible /app/settings/api implemented. Raw-once/hash-only, scopes, rotation grace, revocation, external IDs and error mapping covered by automated tests.
<!-- SECTION:NOTES:END -->
