---
id: TASK-4.12
title: Build the MVP app shell and dashboard views
status: Done
assignee: []
created_date: '2026-07-03 20:04'
labels:
  - mvp
  - frontend
  - dashboard
dependencies:
  - TASK-4.1
references:
  - .docs/PRD-SitePitch.md
documentation:
  - .docs/PRD-SitePitch.md
parent_task_id: TASK-4
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the core in-app navigation and dashboard screens for the MVP workflow. The UI should make repeated audit creation efficient and show the user what to do next without turning the product into a CRM.

Scope includes /app, audit list, new audit page, audit detail/status, leads/search entry points if enabled, settings, branding, billing, empty/loading/error states, and dashboard widgets from the PRD.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Authenticated users land in an app dashboard with credits remaining, audits this month, completed audits, report views, recent audits, New Audit CTA, and Search Leads CTA when lead search is available.
- [x] #2 Audit list and detail pages let users find recent audits, inspect status, open reports, copy links, and identify failed audits.
- [x] #3 New audit page includes URL input, optional lead selection, language, audit type if implemented, credit notice, validation errors, and start button.
- [x] #4 Settings pages cover branding and billing entry points without exposing unrelated internal configuration.
- [x] #5 Empty states guide users toward branding, first audit, report sharing, or outreach copy as the next action.
- [x] #6 Layouts are responsive, accessible, and avoid overlapping text or controls on common desktop and mobile viewports.
<!-- AC:END -->
