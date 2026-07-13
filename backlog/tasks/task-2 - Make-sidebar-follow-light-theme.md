---
id: TASK-2
title: Make sidebar follow light theme
status: Done
assignee: []
created_date: '2026-07-02 12:30'
updated_date: '2026-07-13 08:35'
labels: []
dependencies: []
priority: medium
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Adjust the sidebar color tokens so the sidebar appears light when the rest of the app is in light mode, while preserving the dark sidebar treatment in dark mode.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Light mode sidebar uses light background, foreground, border, and accent tokens consistent with the page.
- [x] #2 Dark mode sidebar remains dark and readable.
- [x] #3 Type checking and production build still pass.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect current sidebar theme tokens.
2. Adjust only light-mode sidebar variables.
3. Verify typecheck/build and record the result.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Changed light-mode sidebar CSS variables in src/index.css so the sidebar uses light background, foreground, border, and accent colors. Left .dark sidebar tokens unchanged. Verified npm run typecheck and npm run build successfully.
<!-- SECTION:NOTES:END -->
