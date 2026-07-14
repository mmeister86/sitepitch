---
id: TASK-5.3
title: Implement batch audits with credit and cost controls
status: In Progress
assignee: []
created_date: '2026-07-03 20:05'
updated_date: '2026-07-13 20:18'
labels:
  - post-mvp
  - batch-audits
  - cost-control
dependencies:
  - TASK-5.2
references:
  - .docs/PRD-SitePitch-Post-MVP.md
documentation:
  - .docs/PRD-SitePitch-Post-MVP.md
parent_task_id: TASK-5
priority: medium
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Post-MVP Phase 8: allow agencies to audit multiple websites efficiently while keeping credits, provider cost, quality, and abuse controls visible. Batch audits must be asynchronous, pausable, resumable, cancellable, and plan-limited.

Scope includes batch jobs from lead lists or CSV, credit estimation/reservation, queue state, pause/resume/cancel, per-item retry, cache reuse, provider-cost aggregation, failure summaries, sampling QA for AI outputs, and Workpool/rate-limiter enforcement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 User can start batches of 10, 25, or 100 URLs according to plan limits, from campaign leads or CSV.
- [x] #2 Before start, user sees estimated credits, relevant plan limits, and whether available credits are sufficient.
- [x] #3 System blocks batch start when credits or limits are insufficient and never bypasses workspace/user/provider/plan rate limits.
- [x] #4 Batch jobs run asynchronously with queued, running, paused, completed, failed, and cancelled states and per-item progress.
- [x] #5 A failed audit does not stop the whole batch; individual failed items can be retried when safe.
- [x] #6 Provider costs, consumed credits, refunded/reserved credits, cache usage, and sampling-QA results are stored per batch.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add batch policy, schema, and atomic credit reservations
2. Orchestrate pausable batch audits and safe retries
3. Add provider caching, cost aggregation, and sampling QA
4. Build campaign and CSV batch audit workflows
5. Harden limits, deletion, and acceptance coverage
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation landed across Convex batch policy/schema/credits, bounded Workpool orchestration, workspace-local provider cache/cost/QA, campaign/CSV UI, and deletion/retention paths.
Automated verification: 47 Vitest files / 440 tests, schema contract, Convex codegen, TypeScript, production build, and diff check passed. Task remains In Progress pending explicit user confirmation after manual browser acceptance.
<!-- SECTION:NOTES:END -->
