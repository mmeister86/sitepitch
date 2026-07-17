---
id: TASK-11
title: Add public audit listing and usage endpoints
status: In Progress
assignee: []
created_date: '2026-07-17 14:45'
updated_date: '2026-07-17 19:58'
labels: []
dependencies: []
priority: high
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add cursor-paginated workspace audit listing and a least-privilege usage endpoint with exact visible-audit counters, credit usage, OpenAPI documentation, migration coverage, and hardened API-key rate limiting.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GET /api/v1/audits lists all visible workspace audits with cursor pagination, status and time filters
- [x] #2 GET /api/v1/usage returns exact visible audit total, plan, period and credit snapshot behind usage:read
- [x] #3 All audit creation and deletion paths maintain an exact idempotent workspace counter
- [x] #4 Existing audit data can be backfilled and verified without double counting
- [x] #5 OpenAPI, API-key UI and automated tests cover the new contract and security boundaries
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add schema, external audit identities, exact counter dual-writes and resumable backfill
2. Implement audits list and usage internal queries, HTTP routes, scopes and cursor contract
3. Update API-key settings and OpenAPI contract
4. Add migration, HTTP, authorization and UI regression tests
5. Run typecheck, full tests and local API verification
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented GET /api/v1/audits with strict filters and filter-bound cursor pagination.
Implemented GET /api/v1/usage with usage:read, exact workspace counters, plan/period/credit snapshot.
Added atomic create/delete counter maintenance, resumable backfills, verification, OpenAPI 1.1.0, API-key UI scope, and HTTP/security/migration tests.
Verification: pnpm typecheck; pnpm test:schema; pnpm test (74 files, 586 tests).
Deployment order: initializeWorkspaceAuditCounters, then backfillWorkspaceAuditMetadataAndCounters, then verify before exposing routes.

Manual API check on 2026-07-17: configured deployment graceful-lemming-186.convex.site returns 404 No matching routes found for GET /api/v1/usage. The new HTTP routes have not yet been deployed there, so audit total and usage:read could not be verified remotely.

Fixed Convex push blocker by shortening audit list index names to 45/56 characters. Development push succeeded. Ran initializeWorkspaceAuditCounters (1 workspace), backfillWorkspaceAuditMetadataAndCounters (10 audits), and verifier returned complete=true. Remote GET /api/v1/audits succeeded with 10 items and has_more=false. The provided test key lacks usage:read, so GET /api/v1/usage correctly returned 403 insufficient_scope.

Second remote usage test succeeded: new key has usage:read; GET /api/v1/usage returned audits.total=10, agency active, 372 total credits, 9 used, 12 reserved, 351 remaining.
<!-- SECTION:NOTES:END -->
