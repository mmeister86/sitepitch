---
id: TASK-5.3.2
title: Orchestrate pausable batch audits and safe retries
status: In Progress
assignee: []
created_date: '2026-07-13 20:00'
updated_date: '2026-07-13 20:18'
labels: []
dependencies: []
parent_task_id: TASK-5.3
priority: high
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement bounded Workpool dispatch, lifecycle controls, terminal settlement, and safe retry handling for batch audit items.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Jobs expose queued running paused completed failed and cancelled lifecycle states
- [x] #2 Pause resume and cancel preserve credit and in-flight semantics
- [x] #3 Failed items do not stop siblings and retry only when classified safe
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add batch Workpool and dispatcher
2. Add lifecycle APIs
3. Integrate terminal audit settlement
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented bounded dispatcher, separate Workpool, pause/resume/cancel, terminal settlement hooks, partial-failure continuation, and safe retry limits. Lifecycle regression tests pass.
<!-- SECTION:NOTES:END -->
