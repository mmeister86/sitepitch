---
id: TASK-4.10
title: 'Add rate limiting, workpool controls, and abuse protection'
status: To Do
assignee: []
created_date: '2026-07-03 20:03'
labels:
  - mvp
  - security
  - rate-limits
dependencies:
  - TASK-4.3
references:
  - .docs/PRD-SitePitch.md
documentation:
  - .docs/PRD-SitePitch.md
parent_task_id: TASK-4
priority: high
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Protect SitePitch from unbounded provider cost and public-form abuse. The MVP must use Convex Rate Limiter as the primary application limiter and Convex Workpool or equivalent queue controls for provider/job parallelism. Public/demo surfaces should use Turnstile where appropriate.

Scope includes limits for demo audit, authenticated audit creation, lead search, screenshot creation, LLM generation, PDF/export behavior, and public report view tracking. Redis/Upstash may be used only for short-lived edge or idempotency signals, not as business truth.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Rate limits can be applied by workspace, user, IP, provider, and plan for all cost-generating entry points.
- [ ] #2 Provider/job workpools enforce documented max parallelism, retry policy, and backoff for screenshot, PageSpeed, content extraction, business data, LLM, and PDF-like work.
- [ ] #3 Rate-limit errors are user-friendly in the UI and safe in logs.
- [ ] #4 Demo or public forms are protected with Turnstile or an equivalent explicit anti-abuse gate.
- [ ] #5 Provider-specific limits and failures can be tuned without disabling the entire audit pipeline.
- [ ] #6 Tests or controlled simulations prove repeated audit starts, demo audits, and provider calls cannot create unlimited cost.
<!-- AC:END -->
