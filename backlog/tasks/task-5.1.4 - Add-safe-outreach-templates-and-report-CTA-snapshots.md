---
id: TASK-5.1.4
title: Add safe outreach templates and report CTA snapshots
status: In Progress
assignee: []
created_date: '2026-07-12 13:18'
updated_date: '2026-07-12 15:29'
labels:
  - post-mvp
  - outreach
  - claim-safety
dependencies:
  - TASK-5.1.1
parent_task_id: TASK-5.1
priority: medium
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add reusable workspace outreach templates with constrained placeholders and claim-safety validation, plus stable lead-derived CTA snapshots for public reports.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Workspace templates support authorized create, list, update, delete, save-from-draft, and apply flows.
- [x] #2 Only business_name, domain, score, and report_url placeholders are accepted.
- [x] #3 Templates and rendered output are checked with existing claim-safety rules.
- [x] #4 Publishing snapshots Lead CTA over Workspace CTA and public reports remain stable until explicit refresh.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add template APIs and safety validation
2. Add template controls to outreach UI
3. Add lead CTA editing and report snapshot behavior
4. Test authorization, validation, and snapshot stability
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in commits 483585b, 1b6bc09, and 8397db8. Principal/security review approved after canonical SITE_URL rendering, public-only refresh, strict snapshot fallbacks, legacy backfill migration, reachable update UI, language filtering, and shared strict mailto/tel grammar. Evidence: 375/375 tests, schema contract, typecheck, codegen, and production build pass. Migration is defined/tested but not run; perform dry-run then explicit target deployment execution. Status remains In Progress pending manual confirmation.
<!-- SECTION:NOTES:END -->
