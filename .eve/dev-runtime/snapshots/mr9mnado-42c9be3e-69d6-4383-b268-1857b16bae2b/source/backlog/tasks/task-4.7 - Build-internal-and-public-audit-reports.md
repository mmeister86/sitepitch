---
id: TASK-4.7
title: Build internal and public audit reports
status: To Do
assignee: []
created_date: '2026-07-03 20:03'
labels:
  - mvp
  - report
  - frontend
dependencies:
  - TASK-4.6
references:
  - .docs/PRD-SitePitch.md
documentation:
  - .docs/PRD-SitePitch.md
parent_task_id: TASK-4
priority: high
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the report experience for completed audits. Users need an internal dashboard report and a shareable public report that turns the audit into a professional, branded sales asset. Public reports must be readable on mobile, default to noindex, and avoid leaking internal raw data.

Scope includes report layout, score presentation, screenshots, top opportunities, strengths, weaknesses, detail findings, next steps, workspace CTA, public slug routing, report deactivate/reactivate behavior, print/PDF-friendly styling, and report view tracking.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Internal audit detail shows status, overall score, category scores, report preview, findings, warnings, assets, outreach drafts, copy buttons, and error states.
- [ ] #2 Public report is reachable without login only through the public slug when the report is enabled.
- [ ] #3 Public report includes workspace branding, domain/site identity, overall score, short summary, screenshot when available, top 5 opportunities, category scores, strengths, weaknesses, detail findings, next steps, and CTA.
- [ ] #4 Public reports default to noindex, expose no internal IDs/API keys/provider payloads, and continue to render if screenshots or performance data are missing.
- [ ] #5 Users can deactivate a public report so the public URL no longer shows the report content.
- [ ] #6 Report view tracking records privacy-conscious view events and the report can be printed or saved as PDF with acceptable layout.
<!-- AC:END -->
