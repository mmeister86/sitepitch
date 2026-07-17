---
id: TASK-5.1.2.2
title: Match recent audits height to activation
status: Done
assignee: []
created_date: '2026-07-15 19:23'
updated_date: '2026-07-16 20:20'
labels: []
dependencies: []
modified_files:
  - src/views/dashboard.tsx
parent_task_id: TASK-5.1.2
priority: medium
ordinal: 55000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the Activation card define the desktop dashboard row height and fit Recent Audits to the same height without internal scrolling or hidden audit rows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 At lg and above, Activation determines the shared row height and Recent Audits matches it.
- [x] #2 All five recent audits remain fully visible without an internal scrollbar or clipping.
- [x] #3 Below lg, both cards keep their natural stacked responsive layout.
- [x] #4 Empty and completed-activation states remain usable and do not overflow.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Decouple Recent Audits intrinsic height from the desktop grid row.
2. Compact the recent-audit rows to fit the Activation reference height.
3. Verify desktop, responsive, empty, and completed states.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented intrinsic desktop sizing: corrected the Recent Audits header to use CardAction, reduced only desktop card/list spacing to five 44px audit rows, compacted the desktop empty state, and kept a meaningful completion footer so Activation remains the row-height reference after onboarding completes. Live Arc QA confirmed equal card edges, all five audits visible, and no internal scroll. Verification: 57 test files / 498 tests pass, typecheck passes, production build passes, and git diff --check passes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Matched Recent Audits to the Activation-controlled desktop row height without fixed card sizing or internal scrolling. Corrected the header action placement, preserved all five audits with 44px desktop rows, kept responsive and empty states usable, and added a stable completion footer. Live Arc QA, 498 tests, typecheck, production build, and diff checks passed.
<!-- SECTION:FINAL_SUMMARY:END -->
