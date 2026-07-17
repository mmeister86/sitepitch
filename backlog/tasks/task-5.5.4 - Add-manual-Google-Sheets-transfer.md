---
id: TASK-5.5.4
title: Add manual Google Sheets transfer
status: In Progress
assignee: []
created_date: '2026-07-16 11:47'
updated_date: '2026-07-16 12:23'
labels: []
dependencies: []
references:
  - .docs/PRD-SitePitch-Post-MVP.md
documentation:
  - .docs/PRD-SitePitch-Post-MVP.md
parent_task_id: TASK-5.5
priority: low
ordinal: 58000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add bounded Google Sheets preview/import and non-destructive campaign export using the existing CSV rules.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Sheet imports preserve domain duplicate handling and audit-ready state through 25-row idempotent batches.
- [x] #2 Exports write RAW values to a new SitePitch tab and never overwrite an existing tab.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented bounded Sheets previews, snapshot verification, idempotent 25-row imports using google_sheets source, and RAW non-overwriting SitePitch tab exports with formula-injection protection.
<!-- SECTION:NOTES:END -->
