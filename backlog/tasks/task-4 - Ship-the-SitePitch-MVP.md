---
id: TASK-4
title: Ship the SitePitch MVP
status: In Progress
assignee: []
created_date: '2026-07-03 20:02'
updated_date: '2026-07-12 13:00'
labels: []
dependencies: []
references:
  - .docs/PRD-SitePitch.md
documentation:
  - .docs/PRD-SitePitch.md
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the sellable SitePitch MVP described in .docs/PRD-SitePitch.md. The MVP must support the core workflow: lead or URL input -> website audit -> branded public report -> outreach-ready copy. Keep scope focused on the PRD MVP and explicitly avoid CRM, automated cold-email sending, deep crawling, full legal/security audits, and enterprise team management.

This is a parent task for implementation work. Execute through focused subtasks so each future agent can ship, test, and review one coherent slice.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A new user can complete the MVP workflow from signup to sharing or copying outreach for at least one audited website.
- [x] #2 The MVP includes auth, workspace ownership, branding, URL audit creation, live status, report sharing, outreach drafts, credits, billing hooks, rate limiting, analytics, and understandable error handling.
- [x] #3 The audit engine separates deterministic checks, provider data collection, scoring, and Eve-generated language outputs.
- [x] #4 Public reports never expose API keys, private IDs, sensitive raw data, or unsupported legal/security claims.
- [ ] #5 Launch readiness is validated against the PRD MVP launch criteria, including at least 10 real test audits and measurable provider cost per audit.
<!-- AC:END -->









## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Complete existing platform migration/setup work already tracked in TASK-1.
2. Build auth, workspace, branding, and base data model.
3. Implement the audit job pipeline with provider abstraction, rate limits, workpool orchestration, and status updates.
4. Add deterministic checks, scoring, Eve outputs, reports, and outreach drafts.
5. Add credits, billing, launch pages, analytics, compliance, QA, and documentation.
6. Run launch validation with real websites and record follow-up gaps as separate tasks.
<!-- SECTION:PLAN:END -->
