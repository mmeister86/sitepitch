---
id: TASK-4.4
title: Build the audit provider pipeline
status: To Do
assignee: []
created_date: '2026-07-03 20:03'
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
ordinal: 8000
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
- [ ] #6 Every provider call records status, latency or timing where available, retry count, error detail when safe, and estimated or actual cost.
<!-- AC:END -->
