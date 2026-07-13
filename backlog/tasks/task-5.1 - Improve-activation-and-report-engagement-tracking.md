---
id: TASK-5.1
title: Improve activation and report engagement tracking
status: Done
assignee: []
created_date: '2026-07-03 20:04'
updated_date: '2026-07-13 08:35'
labels:
  - post-mvp
  - activation
  - engagement
dependencies:
  - TASK-4
references:
  - .docs/PRD-SitePitch-Post-MVP.md
documentation:
  - .docs/PRD-SitePitch-Post-MVP.md
parent_task_id: TASK-5
priority: medium
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Post-MVP Phase 6: sharpen the first-use workflow and close the report engagement loop. The goal is to help new users understand the full acquisition workflow quickly and know whether shared reports produce real engagement.

Scope includes audit inbox, improved empty states, onboarding checklist, example audits, saved outreach templates, report engagement events, simple notifications, lead-specific CTAs, and manual lead status.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 New users can understand the full workflow within five minutes through onboarding, empty states, example audits, and next-action prompts.
- [x] #2 Audit inbox shows status, score, lead, report views, outreach status, and manual lead status.
- [x] #3 Lead status supports new, audited, contacted, follow_up, interested, won, and lost.
- [x] #4 Report engagement tracks opened, reopened, CTA clicked, PDF downloaded where available, and first shared report milestone.
- [x] #5 Workspace outreach templates can be customized and reused without losing evidence/claim-safety constraints.
- [x] #6 Activation funnel metrics cover Signup -> Branding -> First Audit -> Outreach Copied -> First Shared Report.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. TASK-5.1.1 — Extend activation and engagement data
2. TASK-5.1.2 — Track report engagement and notifications
3. TASK-5.1.3 — Add lead workflow controls to the audit inbox
4. TASK-5.1.4 — Add safe outreach templates and report CTA snapshots
5. TASK-5.1.5 — Complete onboarding, examples, funnel reporting, and QA
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation started on branch codex/task-5-1-activation-engagement. TASK-4 launch validation remains the release gate. Parent and subtasks stay In Progress until explicit manual confirmation.

Implementation complete on codex/task-5-1-activation-engagement through commit 1216cb9. All five subtasks passed task-specific reviews and the final branch review is Ready with no P0-P3 findings. Commit-index verification: 393/393 tests; full working tree: 397/397; schema contract, typecheck, Convex codegen, and production build pass. AC #1 remains open pending the manual five-minute onboarding test. Production migrations remain unrun and must follow the documented dry-run/status/verification gates. Manual browser/network QA is also pending. Parent status remains In Progress until explicit user confirmation.

Statusabgleich 2026-07-13: Nutzer bestätigt TASK-5.1.1, TASK-5.1.3 und TASK-5.1.4 als Done. Parent bleibt In Progress, solange TASK-5.1.2.1 und TASK-5.1.5 offen sind.
<!-- SECTION:NOTES:END -->
