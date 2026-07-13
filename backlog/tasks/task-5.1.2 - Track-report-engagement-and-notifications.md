---
id: TASK-5.1.2
title: Track report engagement and notifications
status: In Progress
assignee: []
created_date: '2026-07-12 13:17'
updated_date: '2026-07-13 08:18'
labels:
  - post-mvp
  - engagement
dependencies:
  - TASK-5.1.1
parent_task_id: TASK-5.1
priority: medium
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Classify public report opens and reopens, maintain engagement aggregates, suppress preview tracking, and surface durable report notifications.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 First external view and subsequent reopens are classified and aggregated atomically.
- [x] #2 CTA clicks and PDF downloads update per-audit aggregates without weakening rate limits.
- [x] #3 Owner previews do not emit engagement events.
- [x] #4 Notification APIs and bell UI support unread, mark-read, and mark-all-read.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Implement atomic engagement recording
2. Add notification APIs
3. Integrate public report preview handling
4. Add engagement and notification tests
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
RED: focused suite failed 6 targeted tests (classification/notifications/preview), while 42 existing report tests stayed green.
GREEN: focused 49/49, schema contract green, typecheck green, production build green outside sandbox, full suite 307/307.
Implemented exclusive opened/reopened classification, atomic workspace-idempotent first-open/reopen notifications, owner-authorized notification list/read APIs, preview telemetry suppression, internal preview links, and notification bell popover.

Review fix RED: npx vitest run convex/notifications.test.ts => 1 failed, 4 passed; same-recipient foreign newer notifications displaced the owner list (0 vs 20).
Review fix GREEN: focused notifications 5/5, schema contract 1/1, typecheck exit 0, full suite 308/308. Workspace+recipient are now bound inside compound index ranges before bounded reads; Bell relative times tick only while open with cleanup.

Implemented in commits b40640b and 036a985. Review approved after moving notification list/unread scoping into compound workspace-recipient indexes and adding a multi-workspace regression test. Evidence: 308/308 tests, schema contract, typecheck, and production build pass. Status remains In Progress pending manual confirmation.

Statusabgleich 2026-07-13: Parent bleibt In Progress, weil TASK-5.1.2.1 ausdrücklich noch In Progress ist.
<!-- SECTION:NOTES:END -->
