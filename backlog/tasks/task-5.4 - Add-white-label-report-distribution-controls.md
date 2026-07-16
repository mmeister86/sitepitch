---
id: TASK-5.4
title: Add white-label report distribution controls
status: Done
assignee: []
created_date: '2026-07-03 20:05'
updated_date: '2026-07-16 07:51'
labels:
  - post-mvp
  - white-label
  - reports
dependencies:
  - TASK-5.1
references:
  - .docs/PRD-SitePitch-Post-MVP.md
documentation:
  - .docs/PRD-SitePitch-Post-MVP.md
parent_task_id: TASK-5
priority: medium
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Post-MVP Phase 9: make reports feel more professional and agency-branded while preserving sender identity, safety, and public-report privacy. Distribution features should be plan-gated and reversible.

Scope includes white-label-light branding, report themes, custom domains, password/expiry controls, PDF export with branding, section toggles, campaign-specific intro and CTA, report disable/regenerate behavior, and noindex defaults.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Agency users can configure report theme, logo, colors, CTA, language, visible sections, custom intro, and campaign-specific CTA where enabled.
- [ ] #2 Plan-gated Powered by SitePitch visibility behaves according to configured plan rules.
- [ ] #3 Custom report domains can be connected only after verification and can be disabled safely.
- [ ] #4 Reports can require password access or expire automatically when configured.
- [ ] #5 PDF exports match the public report structure closely and contain no internal IDs, API data, provider payloads, or private metadata.
- [ ] #6 Deactivated, expired, or regenerated reports behave predictably and public reports remain noindex by default.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. TASK-5.4.1 — Report policy and snapshot data model
2. TASK-5.4.2 — Report configuration and renderer
3. TASK-5.4.3 — Secure report access and link lifecycle
4. TASK-5.4.4 — Sanitized branded PDF exports
5. TASK-5.4.5 — Verified custom report domains
6. TASK-5.4.6 — Migration, retention, and release QA
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation started on branch codex/task-5-4-white-label-reports. Parent remains In Progress until explicit manual confirmation.

Implementation complete for automated scope on codex/task-5-4-white-label-reports: Convex codegen, typecheck, 57 Vitest files / 498 tests, schema contract, git diff check, and production build pass. Parent acceptance criteria and Done status remain pending the specified five-report manual QA and explicit user confirmation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
White-Label-Report-Verteilung einschließlich aller Unteraufgaben abgeschlossen und durch Nutzer bestätigt.
<!-- SECTION:FINAL_SUMMARY:END -->
