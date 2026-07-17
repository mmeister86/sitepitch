---
id: TASK-5.7.3
title: Lifecycle-Webhooks und Delivery-Protokoll ergänzen
status: In Progress
assignee: []
created_date: '2026-07-16 20:21'
updated_date: '2026-07-16 20:57'
labels: []
dependencies: []
parent_task_id: TASK-5.7
priority: high
type: enhancement
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-5.5-Webhooks um Audit-Lifecycle, getrennten Zustellpool, Filterprotokoll und sichere manuelle Redelivery erweitern.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 audit_started, audit_completed und audit_failed werden einmalig und sicher ausgelöst
- [x] #2 Retry-Historie bleibt in integrationRuns die einzige Wahrheit
- [x] #3 Terminale Fehler können rate-limitiert mit gleicher Event-ID erneut zugestellt werden
- [x] #4 UI zeigt paginierte gefilterte Zustellungen ohne Payloads oder Secrets
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Bestehende Infrastruktur erweitern
2. Lifecycle-Events und Pool
3. Redelivery und Filter
4. Tests/UI
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lifecycle webhooks now use the existing integration infrastructure and dedicated no-retry workpool. Delivery filtering and confirmed rate-limited redelivery implemented and tested without exposing payloads or secrets.
<!-- SECTION:NOTES:END -->
