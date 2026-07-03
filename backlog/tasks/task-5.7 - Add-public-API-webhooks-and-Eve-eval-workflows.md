---
id: TASK-5.7
title: 'Add public API, webhooks, and Eve eval workflows'
status: To Do
assignee: []
created_date: '2026-07-03 20:05'
labels:
  - post-mvp
  - api
  - eve
  - evals
dependencies:
  - TASK-5.3
references:
  - .docs/PRD-SitePitch-Post-MVP.md
documentation:
  - .docs/PRD-SitePitch-Post-MVP.md
parent_task_id: TASK-5
priority: low
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Post-MVP Phase 12: expose controlled programmatic access for advanced agencies and improve internal AI quality workflows. The public API and agentic workflows must use the same authorization, credit, rate-limit, and claim-safety boundaries as the app.

Scope includes API keys, audit creation/status/report endpoints, webhook lifecycle delivery, API rate limits, key rotation/revocation, versioning, Eve eval suites, prompt/skill output versioning, internal QA/recovery tools, and quality trend dashboards.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Workspace admins can create, rotate, and revoke scoped API keys without exposing raw key values after creation.
- [ ] #2 API clients can start an audit, check audit status, and retrieve report metadata while consuming credits and respecting plan rate limits.
- [ ] #3 Webhook delivery supports audit lifecycle events with retry limits, safe payloads, and visible delivery failures.
- [ ] #4 API, UI, webhook, and integration paths all use shared audit/credit/rate-limit use cases and cannot bypass workspace authorization.
- [ ] #5 Eve outputs store prompt or skill version, model/provider, evidence references, and validation status per run.
- [ ] #6 Eval dashboards show quality trends for summary, findings, outreach tone, evidence grounding, and claim safety, including regression failures before prompt/skill changes ship.
<!-- AC:END -->
