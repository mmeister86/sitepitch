---
id: TASK-4.3
title: Implement secure URL audit creation
status: To Do
assignee: []
created_date: '2026-07-03 20:03'
labels:
  - mvp
  - audit
  - security
dependencies:
  - TASK-4.2
references:
  - .docs/PRD-SitePitch.md
documentation:
  - .docs/PRD-SitePitch.md
parent_task_id: TASK-4
priority: high
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the user-facing and server-side flow for starting a single website audit from a URL. The workflow must normalize and validate URLs, block private and local targets, check workspace authorization, check credits and rate limits before enqueueing work, and create an audit record with live status available to the UI.

This task covers audit start only, not the full provider collection or report generation. Treat SSRF prevention and no-credit-on-invalid-URL behavior as core requirements.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The new audit UI accepts valid public URLs with or without protocol and rejects invalid, private, local, file, javascript, ftp, gopher, and internal IP targets.
- [ ] #2 Valid audit creation creates a workspace-scoped audit job with normalized URL, domain, initial status, and public slug metadata.
- [ ] #3 Invalid URLs show a clear error and do not reserve or consume credits.
- [ ] #4 Audit start checks authentication, workspace access, credit availability, and rate limits before enqueueing costly work.
- [ ] #5 The audit detail UI can subscribe to and display status changes nearly in real time.
- [ ] #6 Unit tests cover URL normalization, private IP blocking, redirect or protocol edge cases, and invalid URL error behavior.
<!-- AC:END -->
