---
id: TASK-5.5.5
title: Add signed integration webhooks
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
ordinal: 59000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add generic, Zapier, and Make webhook endpoints for the three approved events.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Webhook payloads contain only allowlisted non-sensitive fields and are HMAC signed.
- [x] #2 Deliveries reject unsafe targets and use stable IDs with bounded retry behavior.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented allowlisted v1 events, HMAC signatures, stable headers, DNS/public-IP checks with pinned HTTPS delivery, redirect rejection, response bounds, and four-attempt runs.
<!-- SECTION:NOTES:END -->
