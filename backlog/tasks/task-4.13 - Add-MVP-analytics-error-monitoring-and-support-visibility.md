---
id: TASK-4.13
title: 'Add MVP analytics, error monitoring, and support visibility'
status: In Progress
assignee: []
created_date: '2026-07-03 20:04'
updated_date: '2026-07-11 19:30'
labels:
  - mvp
  - analytics
  - ops
dependencies:
  - TASK-4.2
references:
  - .docs/PRD-SitePitch.md
documentation:
  - .docs/PRD-SitePitch.md
parent_task_id: TASK-4
priority: medium
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Instrument the SitePitch MVP so product activation, audit reliability, provider cost, and support debugging are visible from day one. The PRD calls out core events, provider-cost tracking, failed audits, report views, and admin/support needs; this task turns those into usable instrumentation.

Scope includes product analytics events, Sentry or equivalent error monitoring, provider-cost visibility, failed-job/audit inspection, safe support traces, and basic admin/support routes or documented Convex-dashboard workflows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Core events are emitted for signup, workspace created, branding completed, lead search started, lead saved, audit started/completed/failed, report opened, public link copied, outreach copied, PDF/export if present, upgrade clicked, checkout started, subscription started, and credits exhausted.
- [ ] #2 Audit duration, provider failure rate, average provider cost per audit, completion rate, outreach copy rate, and public report views can be measured.
- [ ] #3 Errors and provider failures are captured with enough context to debug while excluding API keys, OAuth tokens, and sensitive raw payloads.
- [ ] #4 Support can inspect failed audits, provider errors, credit state, and safe audit trace information from an admin page or documented Convex-dashboard process.
- [ ] #5 Admin/support actions that alter credits, disable reports, or rerun audits are auditable.
- [ ] #6 Analytics and monitoring setup is documented with required environment variables and privacy considerations.
<!-- AC:END -->
