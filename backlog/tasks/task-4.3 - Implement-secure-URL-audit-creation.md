---
id: TASK-4.3
title: Implement secure URL audit creation
status: Done
assignee: []
created_date: '2026-07-03 20:03'
updated_date: '2026-07-13 08:35'
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
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the user-facing and server-side flow for starting a single website audit from a URL. The workflow must normalize and validate URLs, block private and local targets, check workspace authorization, check credits and rate limits before enqueueing work, and create an audit record with live status available to the UI.

This task covers audit start only, not the full provider collection or report generation. Treat SSRF prevention and no-credit-on-invalid-URL behavior as core requirements.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The new audit UI accepts valid public URLs with or without protocol and rejects invalid, private, local, file, javascript, ftp, gopher, and internal IP targets.
- [x] #2 Valid audit creation creates a workspace-scoped audit job with normalized URL, domain, initial status, and public slug metadata.
- [x] #3 Invalid URLs show a clear error and do not reserve or consume credits.
- [x] #4 Audit start checks authentication, workspace access, credit availability, and rate limits before enqueueing costly work.
- [x] #5 The audit detail UI can subscribe to and display status changes nearly in real time.
- [x] #6 Unit tests cover URL normalization, private IP blocking, redirect or protocol edge cases, and invalid URL error behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Split shared auth and credit helpers
2. Add secure audit-start backend flow
3. Wire frontend dialog and detail to live Convex data
4. Add URL and Convex tests
5. Run verification and clean up
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented secure URL audit creation with centralized normalization, SSRF/public-IP screening, credit/rate-limit preflight, queued audit creation, and live audit detail subscription. Verified with typecheck, schema contract test, full vitest run, and pnpm exec convex dev.
<!-- SECTION:FINAL_SUMMARY:END -->
