---
id: TASK-5.1.2.1
title: Add progressive activity exploration
status: Done
assignee: []
created_date: '2026-07-12 14:09'
updated_date: '2026-07-16 07:51'
labels: []
dependencies: []
modified_files:
  - src/views/dashboard.tsx
  - src/components/activity-feed.tsx
  - src/views/activity.tsx
  - app/app/activity/page.tsx
  - src/lib/router.tsx
  - src/components/app-shell.tsx
  - convex/schema.ts
  - convex/reports.ts
  - convex/audit_agent.ts
  - convex/migrations.ts
  - convex/reports.test.ts
  - convex/activation_migrations.test.ts
  - convex/audit_agent.integration.test.ts
  - convex/schema.contract.test.ts
parent_task_id: TASK-5.1.2
priority: medium
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the dashboard activity scroll region with progressive disclosure: five recent activities by default, a wide-screen 15-item expansion, and a dedicated paginated activity page for the retained history.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Dashboard shows five recent activities without an internal scrollbar and exposes progressive actions only when more data exists.
- [x] #2 Below 2xl the more action routes directly to a dedicated /app/activity page.
- [x] #3 The activity page paginates retained workspace activity in 25-item batches with loading, empty, load-more, and exhausted states.
- [x] #4 Activity reads are workspace-scoped, index-backed, ordered newest-first, and existing eligible usage events can be backfilled resumably.
- [ ] #5 No task is marked Done until manual user confirmation after responsive and accessibility testing.
- [x] #6 At 2xl the engagement and activity cards resize smoothly between 8/4 and 5/7 columns via coordinated Motion layout animation with reduced-motion fallback.
- [x] #7 The expand/collapse action stays in the card's upper-right action slot and collapsing never causes transient vertical overflow or movement of the following dashboard row.
- [x] #8 The engagement and activity cards keep the same shared height in compact and expanded states, including intermediate Motion frames and feeds with 6–14 entries.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add an indexed activity-feed discriminator and resumable backfill.
2. Extend engagement APIs for 15-item dashboard data and paginated history.
3. Build the reusable feed, responsive dashboard expansion, and activity route.
4. Run focused backend tests, full verification, and responsive accessibility review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The previously implemented 220px scroll region was rejected after UX review and is being replaced by progressive disclosure.

Implemented progressive activity exploration: five compact dashboard rows, 2xl 8/4-to-5/7 expansion with a 3x5 feed, direct smaller-viewport routing, and /app/activity pagination in 25-item batches. Added a shared feed component, accessible controls, reduced-motion handling, and route/title integration.
Added optional usageEvents.isFeedActivity, the workspace/discriminator/time index, all seven producer writes, a resumable backfill migration, 15+hasMore dashboard data, and authenticated paginated history with shared enrichment. Preserved the existing 40-event engagement-total semantics in a separate bounded query.
Verification: 69 focused Activity/Convex tests pass; schema contract passes; typecheck passes; production build passes and includes /app/activity; git diff --check passes. The current full suite has 8 unrelated failures in concurrent report CTA validation tests. The backfill definition is implemented and tested but must be run against the target Convex deployment after schema/writer deployment. Manual responsive confirmation remains required before Done.

Motion refinement requested after manual review: move the toggle into the CardAction slot, animate the 8/4-to-5/7 resize with Motion layout, and prevent exiting activity items from causing transient Y overflow.

Motion refinement implemented: CardAction keeps the responsive controls in the upper-right; engagement/activity grid items now use coordinated Motion layout FLIP (360ms tween); ActivityFeed uses popLayout with 200ms enter and 130ms exit; overflow clipping and reduced-motion handling prevent transient Y overflow.
Live Arc QA confirmed the collapsed and expanded endpoints, upper-right control placement, correct accessible labels, stable following dashboard row, and the 3-column expanded feed. Verification: 35 test files / 382 tests pass, typecheck passes, production build passes, and git diff --check passes. next-env.d.ts build output was restored to its prior state. Task remains In Progress pending explicit user confirmation.

Nutzerbestätigung 2026-07-13: Task bleibt In Progress; dezidierte manuelle Responsive- und Accessibility-Abnahme steht noch aus.

Follow-up requested on 2026-07-15: expansion must change only the horizontal proportions; the engagement/activity row height and the following dashboard row must remain stationary.

Fixed the engagement/activity row height at the existing 220px content anchor and normalized compact feed rows to 44px, so five compact rows and five expanded grid rows fit exactly without clipping. Live Arc QA with 8 events confirmed identical top/bottom card edges and an unmoved following dashboard row across expand/collapse. Verification: 57 test files / 498 tests pass, typecheck passes, production build passes, and git diff --check passes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Progressive Aktivitätsansicht, responsive Dashboard-Erweiterung und paginierte Verlaufseite wurden umgesetzt und durch Nutzer bestätigt.
<!-- SECTION:FINAL_SUMMARY:END -->
