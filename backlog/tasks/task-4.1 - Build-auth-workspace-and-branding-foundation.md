---
id: TASK-4.1
title: 'Build auth, workspace, and branding foundation'
status: Done
assignee: []
created_date: '2026-07-03 20:02'
updated_date: '2026-07-05 19:42'
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
- [x] #1 A user can create an account, log in, log out, and return to the app with their workspace loaded.
- [x] #2 A workspace is created automatically for each new user and all core entities can be associated with that workspace.
- [x] #3 The user can save agency or freelancer name, optional logo, accent color, website, contact email, CTA text, CTA URL, and report language.
- [x] #4 Reports and outreach-ready data can read workspace branding, while reports still work when no logo is configured.
- [x] #5 Convex queries, mutations, and actions reject unauthenticated access to paid audit functionality and enforce workspace ownership server-side.
- [x] #6 CTA URL and contact email are validated, and invalid branding inputs show clear user-facing errors.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add Convex Better Auth component, auth config, HTTP routes, and schema tables for users/workspaces/workspaceMembers.
2. Add authenticated workspace helper APIs with server-side owner checks and branding validation.
3. Wire Next route handler, auth client/server utilities, Convex provider, and protected /app routing.
4. Replace mock settings branding with Convex-backed form, validation errors, optional logo handling, and logout.
5. Run npx convex codegen, npm run typecheck, npm run build, and update task notes without marking Done.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started implementation on branch codex-task-4.1-auth-foundation. Auth provider locked to Better Auth with local + production environment checks.

Implemented Better Auth + Convex foundation, protected /app routing, login/signup pages, workspace bootstrap, server-side owner checks, persisted branding settings, optional logo upload/clear, and shared branding validation. Verification run: npx convex codegen; npm run typecheck; custom branding validation compile + node test; npm run build; curl -I /login and /app against the existing dev server on localhost:3000. Build warning remains: Next inferred workspace root because multiple lockfiles exist. Task intentionally remains In Progress pending user manual confirmation before Done.

Replaced remaining user-name mock usage with authenticated identity data. Dashboard greeting now uses the current user first name; outreach email signatures are personalized from the current Convex/Better Auth user with email-prefix and neutral fallbacks. Added focused helper tests. Verification: helper test passes, npm run typecheck passes, npm run build passes, git diff --check passes. Browser automation could not attach to the user Arc tab, so visual confirmation remains manual.

Replaced the remaining mock studio branding in audit output. Report preview now uses the authenticated workspace name, accent color, and CTA; outreach signatures replace the legacy Nordpixel Studio value with the saved workspace name. Added regression coverage for combined user/workspace personalization. Verification: helper test, npm run typecheck, npm run build, and git diff --check pass.

Fixed login race causing ConvexError Unauthenticated. Root cause: ProtectedApp used Better Auth session readiness but invoked ensureCurrentWorkspace before ConvexBetterAuthProvider had finished attaching its token. ProtectedApp now gates bootstrap and child workspace queries on useConvexAuth isLoading/isAuthenticated. Added regression coverage for session-present/token-loading state. Verification: focused state test, npm run typecheck, npm run build, git diff --check, and live reload of authenticated /app/settings all pass.

Fixed accent selection being overwritten by settings form hydration. The form now rehydrates only when the persisted workspace updatedAt version changes, preserving local swatch selection until save/reset. Accent buttons now have explicit button type, aria-pressed state, and a clear selected border/background using the chosen color. Verification: hydration regression test, npm run typecheck, npm run build, and git diff --check pass. Arc automation could not reliably activate the web control, so final click/save/reload remains for manual confirmation.

Added immediate accent-color preview before saving. Swatch selection now applies workspace color tokens live across primary buttons, logo, focus/ring, sidebar, charts, and progress UI. Reset or leaving settings restores the persisted accent; saving keeps the selected value through Convex. Verified with a live unsaved Smaragd-to-Violett switch in Arc while Convex remained Smaragd, plus focused token test, typecheck, production build, and diff check.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped Better Auth and Convex authentication, automatic owner workspace provisioning, protected /app routing, persisted workspace branding with validation and optional logo storage, authenticated user and studio personalization, server-side workspace ownership checks, and live workspace accent theming. Manual authentication, branding persistence, and accent preview were confirmed by the user.
<!-- SECTION:FINAL_SUMMARY:END -->
