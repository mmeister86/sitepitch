---
id: TASK-5.3.5
title: Harden batch limits deletion and acceptance coverage
status: Done
assignee: []
created_date: '2026-07-13 20:00'
updated_date: '2026-07-14 21:34'
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
- [x] #3 Automated checks and manual acceptance evidence cover the parent criteria
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add lifecycle and race tests
2. Extend deletion and schema contracts
3. Run full verification and record evidence
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added exact batch/cache schema and index contracts, including previous-audit cleanup lookup. Integrated QA/item/job/cache records into resumable audit and workspace deletion while preserving batch history. Added credit invariant and public API regression coverage for authorization, lifecycle, refunds, and retries.

Final automated acceptance: 49 Vitest files / 450 tests, schema contract, TypeScript, Convex codegen, production build, and diff check. Manual Arc evidence verified signed-in navigation, batch list/detail metrics, campaign setup/preflight, CSV dialog, and visible cost estimate. State-changing pause/resume/cancel/retry behavior is covered by automated tests without spending live credits. No batch/preflight console errors; unrelated existing favicon/tracking-config 404s remain.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed authorization, limits, lifecycle, deletion, retention, schema, credit, and UI acceptance coverage. Final verification passed with 49 Vitest files / 450 tests, schema contract, TypeScript, production build, diff check, and authenticated Arc QA.
<!-- SECTION:FINAL_SUMMARY:END -->
