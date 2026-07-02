---
id: TASK-3
title: Show user settings in sidebar account popup
status: In Progress
assignee: []
created_date: '2026-07-02 12:37'
updated_date: '2026-07-02 12:38'
labels: []
dependencies: []
priority: medium
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Move account-related settings into a popup opened from the sidebar user avatar/name area, keeping navigation and visual treatment consistent with the dashboard.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking the user avatar/name area opens an account/settings popup.
- [x] #2 The popup contains account/workspace actions and a clear way to reach full Branding & Team settings.
- [x] #3 The sidebar footer remains usable and readable in light and dark modes.
- [x] #4 Type checking and production build still pass.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect existing sidebar footer and available popup primitives.
2. Replace static account footer with a dropdown trigger and account/settings actions.
3. Remove the separate settings navigation group from the sidebar.
4. Verify typecheck/build and record results.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Replaced the static sidebar account footer with a DropdownMenu trigger. Removed the separate settings sidebar group. The popup now exposes Branding & Team, Team einladen, Vorlagen & Outreach, and a disabled Abmelden action. Verified npm run typecheck and npm run build successfully.
<!-- SECTION:NOTES:END -->
