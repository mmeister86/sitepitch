---
id: TASK-4.2
title: Define the Convex MVP data model
status: Done
assignee: []
created_date: '2026-07-03 20:02'
updated_date: '2026-07-05 20:22'
labels:
  - mvp
  - convex
  - data-model
dependencies:
  - TASK-4.1
references:
  - .docs/PRD-SitePitch.md
documentation:
  - .docs/PRD-SitePitch.md
parent_task_id: TASK-4
priority: high
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the Convex data model needed for the SitePitch MVP. The schema should support users, workspaces, subscriptions, credit balances, credit ledger entries, leads, audits, raw audit data, assets, performance results, checks, scores, findings, summaries, outreach drafts, report views, usage events, provider costs, and audit agent runs.

Before touching Convex code, read convex/_generated/ai/guidelines.md as required by the project instructions. Keep MVP scope focused: one owner per workspace is acceptable, but the schema should not block future workspace roles, campaigns, batch audits, or integrations.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Convex schema covers all MVP entities required for URL audits, reports, outreach, credits, billing, analytics, and provider cost tracking.
- [x] #2 Tables include workspace IDs and indexes needed for secure workspace-scoped queries.
- [x] #3 Audit status values cover the PRD lifecycle from draft or queued through provider steps, deterministic checks, Eve generation, completed, failed, and cancelled.
- [x] #4 Credit ledger and usage events are append-only enough to reconstruct audit usage and billing-relevant changes.
- [x] #5 Public report slugs are modeled without exposing internal IDs in public URLs.
- [x] #6 Schema decisions and intentional MVP omissions are documented for future implementers.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented shared Convex schema validators, expanded the MVP schema to 20 tables, added a schema contract test, and verified with npx convex codegen, npm run test:schema, npm run typecheck, and npm run build.
<!-- SECTION:NOTES:END -->
