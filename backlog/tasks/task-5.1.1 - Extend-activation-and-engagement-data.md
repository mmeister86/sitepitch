---
id: TASK-5.1.1
title: Extend activation and engagement data
status: In Progress
assignee: []
created_date: '2026-07-12 13:17'
updated_date: '2026-07-12 13:39'
labels:
  - post-mvp
  - activation
  - engagement
dependencies: []
parent_task_id: TASK-5.1
priority: medium
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the Convex model and migration path for activation milestones, engagement aggregates, templates, notifications, CTA snapshots, and the canonical lead statuses.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Schema supports engagement aggregates, templates, notifications, and CTA snapshots with workspace-safe indexes.
- [x] #2 Activation events include server-side signup and first shared report milestones.
- [x] #3 Lead status migration follows widen-migrate-narrow and maps not_interested to lost.
- [x] #4 New data participates in retention, deletion, and schema contract coverage.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Widen schema and validators
2. Add migration component and backfills
3. Add lifecycle integrations
4. Verify schema, retention, and deletion
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in commits 4fba3b1 and c5e3c7e. Review approved after hardening CTA snapshot separation, action-first aggregates, first-share retention, and workspace-scoped notification idempotency. Automated evidence: 301/301 tests, schema contract and typecheck pass. Product migration was defined but not run; status remains In Progress pending manual confirmation and later narrow deploy.
<!-- SECTION:NOTES:END -->
