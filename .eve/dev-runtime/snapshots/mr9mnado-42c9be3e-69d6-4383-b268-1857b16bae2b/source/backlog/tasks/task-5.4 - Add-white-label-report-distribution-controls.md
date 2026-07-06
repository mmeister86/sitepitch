---
id: TASK-5.4
title: Add white-label report distribution controls
status: To Do
assignee: []
created_date: '2026-07-03 20:05'
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
ordinal: 24000
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
