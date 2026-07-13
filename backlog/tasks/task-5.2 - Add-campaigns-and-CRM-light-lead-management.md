---
id: TASK-5.2
title: Add campaigns and CRM-light lead management
status: Done
assignee: []
created_date: '2026-07-03 20:04'
updated_date: '2026-07-13 17:31'
labels:
  - post-mvp
  - campaigns
  - crm-light
dependencies:
  - TASK-5.1
references:
  - .docs/PRD-SitePitch-Post-MVP.md
documentation:
  - .docs/PRD-SitePitch-Post-MVP.md
parent_task_id: TASK-5
priority: medium
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Post-MVP Phase 7: organize multiple leads and audits into lightweight acquisition campaigns without becoming a full CRM. Users should be able to plan a campaign such as Zahnärzte Leipzig, import leads, prioritize audits, record manual contact state, and track simple outcomes.

Scope includes campaigns, campaign-lead associations, notes, follow-up reminders, CSV import/export, filters, duplicate detection, activity history, and campaign metrics. Follow-ups are reminders only, not automatic sends.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 User can create a campaign with name, target industry, city, country, language, and target offer.
- [x] #2 User can assign leads to campaigns, including leads created manually, by search, by CSV, or later by integration.
- [x] #3 CSV import can process at least 50 leads, detect duplicate domains, and preserve leads without websites as non-auditable until completed.
- [x] #4 Lead list supports filters for industry, city, score, status, report opened, and last contact.
- [x] #5 Users can add notes, schedule follow-up reminders, and manually record contacted, interested, won, lost, or follow-up states.
- [x] #6 Campaign metrics show leads, audits, outreach copied, report views, and won/lost outcomes without automated contact.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve and regression-test the campaign CRUD, search, audit, notes, follow-up, status, and base metrics delivered during TASK-4.
2. Add canonical workspace-domain identity, explicit campaign audit attribution, safe backfills, and corrected campaign metrics.
3. Add manual/existing lead assignment plus CSV preview, idempotent import, duplicate handling, and filtered export.
4. Complete the campaign lead worklist with the required filters, prioritization, outcome details, visible activity, and accessible states.
5. Run schema, Convex, unit, typecheck, build, and manual acceptance checks; keep the task In Progress until user confirmation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation started after confirming most campaign foundations were already shipped during TASK-4. Existing behavior will be reused instead of rebuilt.

Implementation verification: 43 Vitest files / 424 tests passed, schema contract passed, npm run typecheck passed, npx convex codegen passed, npm run build passed, and git diff --check passed. Task and subtasks intentionally remain In Progress until explicit user confirmation after manual testing.

Follow-up TASK-5.2.4 closes the lead-list assignment gap: saved leads can now be attached to eligible campaigns directly from /app/leads. Automated and live read-only UI verification passed on 2026-07-13.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped Campaigns and CRM-light lead management by extending the Task 4 foundation: canonical lead identity, campaign attribution, migrations, assignment, CSV import/export, worklist filters, reminders, notes, outcomes, activity, metrics, and direct assignment from the saved-leads list. Final verification: 43 Vitest files / 426 tests, schema contract, TypeScript, Convex codegen, Next.js production build, git diff check, live Arc UI check, and explicit user acceptance.
<!-- SECTION:FINAL_SUMMARY:END -->
