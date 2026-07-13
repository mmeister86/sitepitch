---
id: TASK-5.1.3
title: Add lead workflow controls to the audit inbox
status: Done
assignee: []
created_date: '2026-07-12 13:17'
updated_date: '2026-07-13 08:18'
labels:
  - post-mvp
  - activation
  - leads
dependencies:
  - TASK-5.1.1
parent_task_id: TASK-5.1
priority: medium
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose canonical lead and outreach status plus complete engagement data in the audit inbox, with workspace-authorized manual status changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Inbox shows audit status, score, lead, views, reopens, CTA/PDF engagement, outreach status, and lead status.
- [x] #2 Lead status supports new, audited, contacted, follow_up, interested, won, and lost.
- [x] #3 Status updates are workspace-authorized and completed audits promote only new leads to audited.
- [x] #4 Outreach status is derived as not_started, ready, or copied.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend audit list DTO
2. Add lead status mutation and lifecycle promotion
3. Update inbox controls and responsive states
4. Add authorization and UI tests
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in commits 05efb38, 336b4af, and 8f5991f. Review approved after preserving bounded 100+ legacy view semantics, prioritizing copy evidence, and indexing legacy last-view ordering by auditId+viewedAt. Evidence: 319/319 tests, schema contract, typecheck, and production build pass. Status remains In Progress pending manual confirmation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Audit-Inbox, kanonische Lead-Status, autorisierte Statuspflege, automatische audited-Promotion und Outreach-Status wurden implementiert und automatisiert verifiziert. Der Nutzer hat TASK-5.1.3 am 2026-07-13 ausdrücklich abgenommen.
<!-- SECTION:FINAL_SUMMARY:END -->
