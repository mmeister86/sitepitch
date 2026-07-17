---
id: TASK-5.5.2
title: Add manual CRM lead push
status: In Progress
assignee: []
created_date: '2026-07-16 11:47'
updated_date: '2026-07-16 12:23'
labels: []
dependencies: []
references:
  - .docs/PRD-SitePitch-Post-MVP.md
documentation:
  - .docs/PRD-SitePitch-Post-MVP.md
parent_task_id: TASK-5.5
priority: low
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add explicit one-way HubSpot Company and Pipedrive Organization upserts for audited campaign leads.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A completed campaign lead can be manually pushed to either connected CRM with score, public report URL, and selected outcome.
- [x] #2 CRM failures remain visible and retryable without changing audit state or overwriting unrelated remote fields.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented manual HubSpot Company and Pipedrive Organization upserts, explicit field setup confirmation, allowlisted payloads, persistent run status, idempotency, and failure isolation.
<!-- SECTION:NOTES:END -->
