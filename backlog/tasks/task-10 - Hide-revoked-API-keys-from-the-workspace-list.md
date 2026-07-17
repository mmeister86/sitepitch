---
id: TASK-10
title: Hide revoked API keys from the workspace list
status: In Progress
assignee: []
created_date: '2026-07-17 14:27'
updated_date: '2026-07-17 14:31'
labels: []
dependencies: []
priority: high
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Remove revoked API keys from the visible workspace key list while preserving revoked records for security history and invalid-key enforcement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Revoked API keys disappear reactively from the workspace UI
- [x] #2 Revoked key records remain stored and unusable
- [x] #3 API key lifecycle tests cover the visible-list behavior
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect API-key query and revoke flow
2. Exclude revoked keys from the visible reactive list
3. Add lifecycle regression coverage
4. Run focused and full verification
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed listApiKeys to query only active and grace statuses through the existing compound index, merge by createdAt, and keep revoked records out of the reactive UI payload. Revoke remains a soft delete for audit history and authentication safety. Verification: focused API-key tests passed, pnpm typecheck passed, full suite passed (69 files / 569 tests).

Extended the visibility fix to the one-time raw-key reveal: after a successful clipboard write, rawReveal is cleared immediately; on clipboard failure it remains visible so the only copy is not lost. Reused copyTextThen and added success-path cleanup coverage. Full verification remains green: 69 test files / 569 tests; typecheck passed.
<!-- SECTION:NOTES:END -->
