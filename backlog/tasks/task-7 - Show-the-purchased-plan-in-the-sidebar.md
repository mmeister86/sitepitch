---
id: TASK-7
title: Show the purchased plan in the sidebar
status: In Progress
assignee: []
created_date: '2026-07-13 20:32'
updated_date: '2026-07-13 20:34'
labels: []
dependencies: []
priority: high
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ensure the sidebar plan widget reflects the workspace's active purchased or trial plan instead of the Free Plan fallback after checkout.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An active Agency plan in test mode is displayed as Agency in the sidebar
- [x] #2 Free workspaces continue to display the Free plan
- [x] #3 Plan state updates after billing synchronization without requiring stale fallback data
- [x] #4 Regression coverage verifies paid and free plan labels
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Trace checkout and billing synchronization
2. Trace sidebar plan data and fallbacks
3. Implement the smallest consistent fix
4. Add regression coverage
5. Run targeted verification
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: sidebar label was hardcoded although getMyWorkspace already exposed subscription data.
Implemented a reactive effective plan field using getWorkspacePlan, mapped free/starter/pro/agency/scale labels, and added a loading label to avoid a false Free flash.
Verification: npm run typecheck passed; src/plan-display.test.ts and convex/privacy_retention.test.ts passed (18 tests).
Manual browser verification remains for the user-authenticated Arc session because the isolated browser session redirected to login.
<!-- SECTION:NOTES:END -->
