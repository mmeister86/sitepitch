---
id: TASK-5.6
title: Add monitoring and scheduled re-audits
status: In Progress
assignee: []
created_date: '2026-07-03 20:05'
updated_date: '2026-07-16 19:58'
labels:
  - post-mvp
  - monitoring
  - re-audits
dependencies:
  - TASK-5.2
references:
  - .docs/PRD-SitePitch-Post-MVP.md
documentation:
  - .docs/PRD-SitePitch-Post-MVP.md
parent_task_id: TASK-5
priority: low
ordinal: 61000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Post-MVP Phase 11: support recurring customer relationships and retainer workflows through opt-in monitoring and scheduled re-audits. The feature should compare public website data over time without silently monitoring every prospect.

Scope includes scheduled re-audits after 30/60/90 days, before/after comparisons, selected-check monitoring, score and finding deltas, reminders, retainer-style reports, credit visibility, and disable controls.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 User can schedule a re-audit for 30, 60, or 90 days for a selected audit or customer context.
- [ ] #2 Monitoring is explicitly opt-in per audit or lead and can be disabled by the user.
- [ ] #3 Re-audits consume credits only after the user can see or has agreed to the expected monitoring cost rules.
- [ ] #4 Before/after report shows score changes, finding changes, and which public data was newly collected.
- [ ] #5 Reminders surface visible improvements or regressions without claiming legal, security, or revenue impact.
- [ ] #6 Retention and purpose limits for monitoring data are documented and enforceable.
<!-- AC:END -->
