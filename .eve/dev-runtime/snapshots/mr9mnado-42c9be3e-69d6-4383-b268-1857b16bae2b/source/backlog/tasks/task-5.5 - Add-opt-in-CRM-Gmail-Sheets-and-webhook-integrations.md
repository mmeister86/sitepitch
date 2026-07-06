---
id: TASK-5.5
title: 'Add opt-in CRM, Gmail, Sheets, and webhook integrations'
status: To Do
assignee: []
created_date: '2026-07-03 20:05'
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
- [ ] #1 User can connect and disconnect supported integrations per workspace with visible status and safe error handling.
- [ ] #2 Leads, audit links, scores, and selected outcomes can be sent to HubSpot or Pipedrive without blocking audits if sync fails.
- [ ] #3 User can prepare a Gmail outreach draft only after explicit confirmation; no automatic cold-email sequence is introduced.
- [ ] #4 CSV or Google Sheets sync can import/export lead lists while preserving duplicate handling and audit-ready state.
- [ ] #5 Webhooks can be configured for audit_completed, report_viewed, and outreach_copied with minimal non-sensitive payloads and retry limits.
- [ ] #6 OAuth tokens and integration secrets are encrypted or stored via a secure credential reference, never exposed to frontend or logs.
<!-- AC:END -->
