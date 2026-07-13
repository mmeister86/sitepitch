---
id: TASK-5.2.1
title: Harden campaign attribution and domain identity
status: Done
assignee: []
created_date: '2026-07-13 13:45'
updated_date: '2026-07-13 17:31'
labels: []
dependencies: []
modified_files:
  - convex/schema.ts
  - convex/lib/lead_search.ts
  - convex/leads.ts
  - convex/audits.ts
  - convex/campaigns.ts
  - convex/audit_agent.ts
  - convex/migrations.ts
parent_task_id: TASK-5.2
priority: high
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add canonical domain identity, explicit campaign audit attribution, migration support, and correct bounded campaign metrics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Leads are deduplicated by canonical workspace domain across search, manual, and CSV sources.
- [x] #2 Campaign audits, views, outreach, and outcomes are attributed to the correct campaign, including multiple audits per lead.
- [x] #3 Existing data is handled through a dry-run-capable resumable migration.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented normalized workspace-domain identity, CSV source support, safe backfills, explicit campaign audit attribution, completion-time status promotion, and bounded multi-audit campaign metrics. Verified by campaign, lead, audit, migration, schema, typecheck, and build checks.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped canonical workspace-domain identity, explicit campaign/audit attribution, dry-run-capable resumable migrations, and corrected bounded campaign metrics. Verified through the full automated suite, schema contract, typecheck, codegen, build, and user acceptance.
<!-- SECTION:FINAL_SUMMARY:END -->
