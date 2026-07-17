---
id: TASK-5.5.3
title: Add confirmed Gmail draft creation
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
ordinal: 57000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create Gmail outreach drafts only after a separate server-recorded user confirmation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Preparing a Gmail draft performs no provider call and confirmation creates a draft only.
- [x] #2 No automatic send or sequence path exists and ambiguous provider results are not automatically retried.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented 15-minute server intent, explicit confirmation, Gmail draft.create only, stable MIME Message-ID, and unknown-without-auto-retry handling.
<!-- SECTION:NOTES:END -->
