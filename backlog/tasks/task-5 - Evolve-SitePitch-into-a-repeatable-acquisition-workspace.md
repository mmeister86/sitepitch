---
id: TASK-5
title: Evolve SitePitch into a repeatable acquisition workspace
status: In Progress
assignee: []
created_date: '2026-07-03 20:04'
updated_date: '2026-07-12 13:00'
labels:
  - post-mvp
  - prd
dependencies: []
references:
  - .docs/PRD-SitePitch-Post-MVP.md
documentation:
  - .docs/PRD-SitePitch-Post-MVP.md
priority: medium
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the Post-MVP evolution described in .docs/PRD-SitePitch-Post-MVP.md. The product should grow from a single audit generator into a repeatable acquisition workflow for web designers and small agencies while preserving the core anti-spam, evidence-grounded, cost-controlled product principles.

This is a parent task for Post-MVP initiatives. Do not start these before the MVP is validated unless a specific initiative is pulled forward intentionally.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Post-MVP work improves at least one of: finding more relevant websites, producing better reports, simplifying/measuring outreach, supporting repeatable follow-up, improving branding/professionalism, or controlling audit cost and quality.
- [ ] #2 No Post-MVP work turns SitePitch into automated cold-email sequencing, full CRM, legal compliance scanner, security scanner, or personal-data enrichment database.
- [ ] #3 Credits, rate limits, workspace authorization, privacy, and claim-safety boundaries remain consistent across UI, API, integrations, and webhooks.
- [ ] #4 Each phase has analytics, error states, privacy/retention notes, launch gates, and rollback or deactivation paths.
- [ ] #5 The 90-day success metrics from the Post-MVP PRD can be measured or approximated from product data.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Start with activation and report engagement once MVP usage exists.
2. Add campaigns and CRM-light organization before heavy automation.
3. Add batch audits only after cost, rate limits, and quality gates are proven.
4. Expand distribution, integrations, monitoring, API, and Eve evals behind plan gates.
5. Keep every phase opt-in, measurable, and reversible.
<!-- SECTION:PLAN:END -->
