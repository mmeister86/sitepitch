---
id: TASK-5.8
title: Add team roles and agency workspace controls
status: To Do
assignee: []
created_date: '2026-07-03 20:05'
labels:
  - post-mvp
  - teams
  - permissions
dependencies:
  - TASK-5.2
references:
  - .docs/PRD-SitePitch-Post-MVP.md
documentation:
  - .docs/PRD-SitePitch-Post-MVP.md
parent_task_id: TASK-5
priority: medium
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the Post-MVP team model for small agencies. The goal is to support owner/admin/member/viewer collaboration and plan-gated cost controls without introducing enterprise SSO or procurement complexity.

Scope includes invitations, member removal, role assignment, server-side authorization checks, viewer read-only access, plan-based restrictions for cost-generating actions, and audit logs for sensitive workspace actions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Owner can invite, remove, and change roles for workspace members.
- [ ] #2 Roles support owner, admin, member, and viewer with permissions aligned to the Post-MVP PRD.
- [ ] #3 Viewer cannot start audits, batch jobs, billing changes, integration syncs, or other cost-generating actions.
- [ ] #4 Admin can manage workspace settings, campaigns, and audits but cannot bypass owner-only billing or ownership controls if restricted.
- [ ] #5 All workspace, audit, campaign, billing, and integration actions are checked server-side, not only hidden in the UI.
- [ ] #6 Sensitive role and cost-control changes are recorded in an audit/activity trail.
<!-- AC:END -->
