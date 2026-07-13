---
id: TASK-5.2.4
title: Assign saved leads to campaigns from the lead list
status: Done
assignee: []
created_date: '2026-07-13 15:58'
updated_date: '2026-07-13 17:31'
labels: []
dependencies: []
parent_task_id: TASK-5.2
priority: high
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a clear campaign-assignment action to the global saved-leads list so an existing lead can be attached to one or more eligible campaigns without navigating into each campaign first.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each saved lead exposes an accessible action to choose an eligible draft or active campaign.
- [x] #2 Campaigns already linked to the lead are excluded and duplicate assignment remains idempotent.
- [x] #3 Successful assignment updates campaign badges immediately and offers navigation to the campaign.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a lightweight workspace-scoped campaign option query.
2. Add a reusable assignment dialog to the saved lead actions.
3. Verify empty, loading, success, duplicate, and permission states.
4. Run focused tests, typecheck, and build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented workspace-scoped listAssignableCampaigns query and reusable lead assignment dialog.
Integrated Zu Kampagne hinzufügen into expanded saved-lead actions.
Verified 2026-07-13: 426 Vitest tests, schema contract, TypeScript, git diff check, and Next.js production build all pass.
Arc live check: action and eligible-campaign dialog render correctly; dialog closed without assigning live data.
Files: convex/campaigns.ts, convex/campaigns.test.ts, src/components/lead-campaign-assignment-dialog.tsx, src/views/leads.tsx.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped direct campaign assignment from the global saved-leads list, eligible-campaign filtering, duplicate-safe assignment, reactive badges, and campaign navigation. Verified with automated tests, production build, and a live Arc UI check; accepted by the user.
<!-- SECTION:FINAL_SUMMARY:END -->
