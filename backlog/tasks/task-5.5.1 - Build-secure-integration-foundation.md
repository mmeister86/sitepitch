---
id: TASK-5.5.1
title: Build secure integration foundation
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
ordinal: 55000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add owner-only plan-gated integration connections, encrypted credentials, OAuth state, durable runs, feature flags, and safe DTOs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Connections can be listed, connected, reconnected, and disconnected without exposing credentials.
- [x] #2 Credentials use versioned authenticated encryption and OAuth state is expiring and single-use.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented owner-only plan gates, safe DTOs, AES-256-GCM keyring credentials, one-time OAuth state, disconnect cancellation, feature/provider switches, and durable runs.
<!-- SECTION:NOTES:END -->
