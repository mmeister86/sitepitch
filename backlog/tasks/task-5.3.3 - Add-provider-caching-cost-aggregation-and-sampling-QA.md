---
id: TASK-5.3.3
title: Add provider caching cost aggregation and sampling QA
status: Done
assignee: []
created_date: '2026-07-13 20:00'
updated_date: '2026-07-16 20:20'
labels: []
dependencies: []
parent_task_id: TASK-5.3
priority: medium
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track workspace-local provider cache usage, batch provider costs, and deterministic sampling QA results.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Cache reuse is workspace scoped versioned and TTL bounded
- [x] #2 Provider costs and credit movements are aggregated per batch
- [x] #3 Deterministic sampling QA is stored without blocking batch completion
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add cache and cost attribution
2. Add deterministic QA sampling
3. Verify aggregation and isolation
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented versioned workspace-local TTL cache, zero-cost hit attribution, per-item/batch provider cost aggregation, deterministic QA sampling, and screenshot reference-safe retention.

Added a versioned preflight provider-cost estimator based on one-pass token budgets per audit type. Preview counts only valid deduplicated items, exposes pricing version, excludes retries, and does not seed settled batch costs. Unit coverage added.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented workspace-scoped versioned provider caching, reference-safe screenshot retention, batch cost aggregation, deterministic sampling QA, and versioned preflight provider-cost estimates.
<!-- SECTION:FINAL_SUMMARY:END -->
