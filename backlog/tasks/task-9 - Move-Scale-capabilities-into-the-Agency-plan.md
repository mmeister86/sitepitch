---
id: TASK-9
title: Move Scale capabilities into the Agency plan
status: In Progress
assignee: []
created_date: '2026-07-17 08:19'
updated_date: '2026-07-17 08:27'
labels: []
dependencies: []
priority: high
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose Custom Domain, API, and Webhooks consistently as Agency-plan capabilities across pricing surfaces and technical entitlement gates, without inventing undefined higher limits.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Public pricing tables list Custom Domain, API, and Webhooks under Agency
- [x] #2 Workspace billing presents the same Agency capabilities
- [x] #3 Agency workspaces pass the corresponding implemented entitlement gates
- [x] #4 Relevant automated tests pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inventory pricing surfaces and current Scale-only gates
2. Update Agency feature messaging and entitlements
3. Adjust focused tests
4. Run verification and document results
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Agency is now the sellable top tier. Public pricing and workspace billing share PRICING_CATALOG. Agency inherits the existing Scale API, webhook, and batch entitlements; Scale remains accepted as a legacy schema value. Custom Domain was already Agency-gated. Verification: 69 Vitest files / 569 tests passed; pnpm typecheck passed; public homepage and /pricing visually checked at 1280px without horizontal overflow. Authenticated billing could not be browser-checked in the isolated QA session.
<!-- SECTION:NOTES:END -->
