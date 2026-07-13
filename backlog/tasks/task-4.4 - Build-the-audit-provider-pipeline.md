---
id: TASK-4.4
title: Build the audit provider pipeline
status: Done
assignee: []
created_date: '2026-07-03 20:03'
updated_date: '2026-07-13 08:35'
labels:
  - mvp
  - audit
  - providers
dependencies:
  - TASK-4.3
references:
  - .docs/PRD-SitePitch.md
documentation:
  - .docs/PRD-SitePitch.md
parent_task_id: TASK-4
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the asynchronous audit data collection pipeline. Convex remains the source of truth for status, data, costs, and failures; provider calls run behind internal interfaces and are orchestrated through the configured job/workpool approach so external APIs are replaceable and bounded.

Scope includes HTML fetch, content extraction, screenshots, PageSpeed, optional business data lookup hooks, provider timeout handling, source attribution, partial-audit behavior, and provider cost recording. Do not implement deep crawling beyond the MVP maximum of roughly five prioritized pages.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Audit jobs progress through provider statuses for HTML fetch, content extraction, screenshots, PageSpeed, and optional business data without long synchronous requests from the UI.
- [ ] #2 Provider abstractions exist for content extraction, screenshots, performance analysis, business data, and AI provider handoff.
- [ ] #3 The pipeline captures raw audit data including HTTP status, final URL, title, meta description, headings, canonical, robots, sitemap, schema, contact signals, privacy/imprint links, CTA candidates, selected extracted content, screenshots, and performance metrics where available.
- [ ] #4 Missing optional pages, screenshot timeouts, PageSpeed errors, or business data errors produce warnings or unknown values instead of crashing the whole audit.
- [ ] #5 Critical failures such as unreachable HTML mark the audit failed with an understandable message.
- [ ] #6 Every provider call records status, latency or timing where available, retry count, safe error detail, and request/call evidence without storing estimated or actual cost data.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the cost tables and telemetry schema with provider-call tracking and pipeline state tables
2. Implement the Convex audit orchestrator, provider adapters, and safe fetch/image/performance/business helpers
3. Update audit start flow, status progression, and tests; regenerate generated Convex artifacts if needed
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the new audit pipeline skeleton and telemetry flow.
Verified with pnpm test, pnpm typecheck, node --experimental-strip-types --test convex/schema.contract.test.ts, and npx vitest run convex/audit_pipeline.test.ts.
Task remains In Progress until explicit user confirmation after manual validation.

Adjusted provider request path to pin directly to the resolved IP and pass the detected IP family to Node's client request to avoid the Invalid IP address: undefined runtime failure.
Verified with pnpm exec vitest run convex/audit_pipeline.test.ts and pnpm typecheck.

Raised starter credit floor to 20 in convex/lib/credits.ts and added automatic top-up for existing low balances when ensureCurrentWorkspace runs.
Credits live in the creditBalances table; startAudit checks the snapshot before reserving one credit.

Fixed the audit scheduler handoff by awaiting ctx.scheduler.runAfter in convex/audits.ts. This was likely the reason queued audits were not transitioning into the pipeline despite clean logs.

Expanded the live audit UI status list to include fetching_business_data and running_deterministic_checks so Convex progress no longer looks stalled after content extraction.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built the audit provider pipeline without provider cost gating, added provider telemetry and pipeline state tracking, set starter credits to 20 with automatic top-up for existing low balances, and aligned the live audit UI with the Convex status flow.
<!-- SECTION:FINAL_SUMMARY:END -->
