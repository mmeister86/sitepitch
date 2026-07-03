---
id: TASK-4.1
title: 'Build auth, workspace, and branding foundation'
status: To Do
assignee: []
created_date: '2026-07-03 20:02'
labels:
  - mvp
  - foundation
dependencies:
  - TASK-1
references:
  - .docs/PRD-SitePitch.md
documentation:
  - .docs/PRD-SitePitch.md
parent_task_id: TASK-4
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the authenticated account foundation for SitePitch MVP. A user must be able to sign up, log in, get a workspace automatically, and configure the agency branding used by reports and outreach. Use the PRD constraints: MVP may support only a single owner per workspace, but all data must still be workspace-scoped for later team expansion.

Scope includes account/session integration, user/workspace persistence, workspace membership or ownership, branding settings, and server-side authorization for Convex functions. Do not build enterprise roles or team invitations in this MVP task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A user can create an account, log in, log out, and return to the app with their workspace loaded.
- [ ] #2 A workspace is created automatically for each new user and all core entities can be associated with that workspace.
- [ ] #3 The user can save agency or freelancer name, optional logo, accent color, website, contact email, CTA text, CTA URL, and report language.
- [ ] #4 Reports and outreach-ready data can read workspace branding, while reports still work when no logo is configured.
- [ ] #5 Convex queries, mutations, and actions reject unauthenticated access to paid audit functionality and enforce workspace ownership server-side.
- [ ] #6 CTA URL and contact email are validated, and invalid branding inputs show clear user-facing errors.
<!-- AC:END -->
