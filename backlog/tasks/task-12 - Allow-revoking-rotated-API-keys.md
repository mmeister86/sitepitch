---
id: TASK-12
title: Allow revoking rotated API keys
status: In Progress
assignee: []
created_date: '2026-07-17 19:59'
updated_date: '2026-07-17 20:01'
labels: []
dependencies: []
priority: high
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose and verify immediate revocation for API keys in the rotation grace period so users can remove an old rotated key before its grace expiry.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A grace-period API key offers a revoke action in the workspace API settings
- [x] #2 Revoking a grace-period key immediately removes it from the visible key list and invalidates authentication
- [x] #3 Active-key rotation and existing revoked-key hiding behavior remain unchanged
- [x] #4 Frontend and backend regression tests cover the lifecycle
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect API-key state handling in UI and backend
2. Expose revoke for grace-period keys and preserve rotation behavior
3. Add lifecycle regression tests
4. Run typecheck and focused/full tests
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: frontend rendered all actions only for active keys; backend already accepted grace-key revocation. UI now renders revoke for active and grace, while rotate stays active-only. Backend regression now revokes the original grace key, verifies it disappears, stores revokedAt, rejects the old raw key, and leaves replacement active. Verification: pnpm typecheck; pnpm test (74 files, 587 tests); git diff --check.
<!-- SECTION:NOTES:END -->
