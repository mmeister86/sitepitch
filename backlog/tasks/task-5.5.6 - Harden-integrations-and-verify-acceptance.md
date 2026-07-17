---
id: TASK-5.5.6
title: Harden integrations and verify acceptance
status: In Progress
assignee: []
created_date: '2026-07-16 11:47'
updated_date: '2026-07-16 12:25'
labels: []
dependencies: []
references:
  - .docs/PRD-SitePitch-Post-MVP.md
documentation:
  - .docs/PRD-SitePitch-Post-MVP.md
parent_task_id: TASK-5.5
priority: low
ordinal: 60000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Complete retention, deletion, operations visibility, analytics, automated coverage, and release controls.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All new records are covered by workspace deletion and bounded retention.
- [ ] #2 Schema, tests, typecheck, codegen, production build, and five manual provider scenarios are documented; TASK-5.5 remains In Progress pending user confirmation.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Workspace/audit deletion phases, one-hour ephemeral cleanup, 30-day run/event retention, lease recovery, operations failure rates, provider kill switches, automated tests, schema contract, codegen, and build verification added. Manual provider test-account scenarios and explicit user acceptance remain pending; status stays In Progress.
<!-- SECTION:NOTES:END -->
