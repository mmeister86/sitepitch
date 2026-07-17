---
id: TASK-5.5
title: 'Add opt-in CRM, Gmail, Sheets, and webhook integrations'
status: In Progress
assignee: []
created_date: '2026-07-03 20:05'
updated_date: '2026-07-16 12:25'
labels:
  - post-mvp
  - integrations
dependencies:
  - TASK-5.2
references:
  - .docs/PRD-SitePitch-Post-MVP.md
documentation:
  - .docs/PRD-SitePitch-Post-MVP.md
parent_task_id: TASK-5
priority: low
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Post-MVP Phase 10: connect SitePitch to existing agency workflows without making SitePitch the system of record or enabling automated cold-email campaigns. Integrations must be opt-in, consentful, failure-tolerant, and scoped.

Prioritized integrations are HubSpot, Pipedrive, Gmail Drafts, Google Sheets, Zapier/Make, and generic webhooks. OAuth credentials must be encrypted, and Gmail actions must create drafts only after explicit user confirmation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 User can connect and disconnect supported integrations per workspace with visible status and safe error handling.
- [x] #2 Leads, audit links, scores, and selected outcomes can be sent to HubSpot or Pipedrive without blocking audits if sync fails.
- [x] #3 User can prepare a Gmail outreach draft only after explicit confirmation; no automatic cold-email sequence is introduced.
- [x] #4 CSV or Google Sheets sync can import/export lead lists while preserving duplicate handling and audit-ready state.
- [x] #5 Webhooks can be configured for audit_completed, report_viewed, and outreach_copied with minimal non-sensitive payloads and retry limits.
- [x] #6 OAuth tokens and integration secrets are encrypted or stored via a secure credential reference, never exposed to frontend or logs.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add secure integration foundation and OAuth lifecycle
2. Add manual HubSpot and Pipedrive lead push
3. Add explicitly confirmed Gmail draft creation
4. Add manual Google Sheets import and export
5. Add signed retry-limited webhooks and Zapier/Make presets
6. Harden deletion, retention, operations, tests, and manual acceptance
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Technical implementation complete and kept In Progress for manual acceptance. Verified TASK-5.5 with 28 targeted tests, 521 pre-existing/full regression tests excluding the unrelated in-progress TASK-4.15 launch suite, schema contract, Convex codegen, targeted TypeScript, diff check, and a successful production build before concurrent TASK-4.15 files entered the workspace. Real HubSpot, Pipedrive, Gmail, Sheets, and webhook test-account scenarios remain for user validation.
<!-- SECTION:NOTES:END -->
