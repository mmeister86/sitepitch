---
id: TASK-5.3.5
title: Harden batch limits deletion and acceptance coverage
status: In Progress
assignee: []
created_date: '2026-07-13 20:00'
updated_date: '2026-07-13 20:22'
labels: []
dependencies: []
parent_task_id: TASK-5.3
priority: high
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Close authorization, rate-limit, retention, deletion, race-condition, and regression coverage for batch audits.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Cross-workspace access and limit bypasses are blocked
- [x] #2 Batch and cache records participate in workspace and audit deletion
- [ ] #3 Automated checks and manual acceptance evidence cover the parent criteria
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add lifecycle and race tests
2. Extend deletion and schema contracts
3. Run full verification and record evidence
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added exact batch/cache schema and index contracts, including previous-audit cleanup lookup.
Integrated QA/item/job/cache records into resumable audit and workspace deletion; audit deletion preserves batch history while unlinking audit references and purging QA/cache storage.
Added direct credit invariant coverage for idempotent aggregate reservation, conflict/insufficient-credit rollback, and exactly-once consume/refund settlement.
Focused verification currently passes: schema contract plus 17 policy/credit/privacy tests.

Added convex/batch_audits.test.ts public API regression coverage. Verified unauthenticated and cross-workspace list/detail/mutation isolation; pause/resume/cancel item transitions with full reservation refunds; safe retry reservation and state reset; repeated, unsafe, and retry-limit rejection. Focused result: 3 tests passed.

Full automated acceptance pass: 47 Vitest files / 440 tests, schema contract, TypeScript, Convex codegen, production build, and diff check. AC #3 remains open for explicit manual browser acceptance evidence.

Manual browser attempt: unauthenticated in-app session correctly redirected the batch route to login. An existing authenticated Chrome SitePitch tab was detected, but browser control timed out while claiming/navigating it, so authenticated visual acceptance remains explicitly open.
<!-- SECTION:NOTES:END -->
