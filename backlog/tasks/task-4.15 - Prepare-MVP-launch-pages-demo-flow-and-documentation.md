---
id: TASK-4.15
title: 'Prepare MVP launch pages, demo flow, and documentation'
status: In Progress
assignee: []
created_date: '2026-07-03 20:04'
updated_date: '2026-07-16 12:30'
labels:
  - mvp
  - launch
  - docs
dependencies:
  - TASK-4.7
  - TASK-4.9
  - TASK-4.13
references:
  - .docs/PRD-SitePitch.md
documentation:
  - .docs/PRD-SitePitch.md
parent_task_id: TASK-4
priority: high
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prepare SitePitch for MVP launch beyond the logged-in product flow. The PRD requires a clear positioning site, pricing, demo audit, legal pages, setup documentation, demo data, analytics, and marketplace-readiness documentation.

Scope includes public marketing pages, demo audit behavior, pricing page, legal pages, environment/setup docs, provider-cost docs, Eve-agent docs, marketing playbook, demo account or seed data, and manual launch QA.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Marketing homepage communicates the PRD positioning: Website-Audits that start customer conversations, with workflow, example report, features, pricing, FAQ, and CTA.
- [ ] #2 Pricing page reflects the MVP plans and credit model clearly enough for test-mode checkout or upgrade CTAs.
- [ ] #3 Demo audit or demo report is available without a full paid workflow, protected from abuse, branded appropriately, and does not permit unlimited provider cost.
- [ ] #4 Privacy, terms, and imprint/legal pages exist and avoid claiming legal advice or automated outreach compliance.
- [ ] #5 README, SETUP, ENV, PROVIDER_COSTS, EVE_AGENT, and MARKETING_PLAYBOOK documentation or equivalent sections exist and are accurate for local development and operations.
- [ ] #6 Launch QA covers at least 10 real websites, key edge cases from the PRD, test-mode billing, public report sharing, outreach copy, provider cost measurement, and no-secret exposure checks.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Persist design context and import the selected shadcnblocks scaffold
2. Build public marketing, pricing, examples, demo, and legal routes
3. Add the rate-limited live quick-demo audit flow with seven-day retention
4. Add launch, environment, provider-cost, Eve, and marketing documentation
5. Add automated coverage and run typecheck, tests, schema checks, build, and launch QA
6. Await explicit user confirmation before marking Done
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Frontend scaffold completed: public homepage, pricing, demo shell, examples index, and shared legal pages implemented with adapted @shadcnblocks structures. Shared pricing truth and focused route/state/legal/CTA contracts added.
Verification: 25 focused/relevant Vitest tests passed, pnpm typecheck passed, and pnpm build passed outside the sandbox. Live demo backend, operator values, docs, launch QA, and explicit user confirmation remain pending; task intentionally stays In Progress.
<!-- SECTION:NOTES:END -->
