---
id: TASK-5.3.1
title: Add batch policy schema and atomic credit reservations
status: Done
assignee: []
created_date: '2026-07-13 20:00'
updated_date: '2026-07-16 20:20'
labels: []
dependencies: []
parent_task_id: TASK-5.3
priority: high
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the plan policy, durable batch data model, and idempotent aggregate credit reservation and settlement primitives.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Agency and Scale batch limits are enforced server-side
- [x] #2 Batch start reserves all required credits atomically and idempotently
- [x] #3 Batch, item, audit, ledger, provider-call, and provider-cost relations are queryable by indexed fields
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add validators and tables
2. Add policy and credit primitives
3. Cover schema and credit invariants
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented Agency/Scale policy, indexed batch schema, and atomic idempotent reserve/consume/refund primitives. Covered by policy, schema-contract, and credit invariant tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented Agency/Scale batch policy, normalized batch schema with indexed relations, and atomic idempotent reserve/consume/refund credit primitives. Policy, schema-contract, and credit invariant tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->
