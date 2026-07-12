---
id: TASK-4.14
title: 'Harden MVP privacy, compliance, and data retention'
status: Done
assignee: []
created_date: '2026-07-03 20:04'
updated_date: '2026-07-12 08:37'
labels:
  - mvp
  - privacy
  - security
dependencies:
  - TASK-4.7
references:
  - .docs/PRD-SitePitch.md
documentation:
  - .docs/PRD-SitePitch.md
parent_task_id: TASK-4
priority: high
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the MVP privacy, compliance, and security safeguards described in the PRD. SitePitch processes public website data, but still needs data minimization, deletion paths, safe report content, report noindex defaults, SSRF protection, webhook signature checks, and retention rules.

This task is about product safety and compliance boundaries, not legal advice. Keep language and UI clear that SitePitch does not assess legal compliance and does not send cold outreach automatically.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Workspace data, audit data, and reports are authorized server-side; public reports are accessible only through high-entropy slugs and enabled report state.
- [x] #2 No API keys, secrets, provider payloads, internal IDs, or sensitive logs are exposed to the browser or public report HTML.
- [x] #3 SSRF and unsafe URL protections cover localhost, loopback, private IP ranges, link-local ranges, unsupported schemes, oversized responses, redirect limits, and provider timeouts.
- [x] #4 Retention rules are implemented or explicitly documented for screenshots, raw HTML, extracted markdown, provider logs, report view IP/user-agent hashes, usage events, and billing events.
- [x] #5 Users can delete or disable at least audits, public reports, branding data, and workspace/account data through UI or documented support workflow.
- [x] #6 Report and outreach copy avoids legal/security/guaranteed-revenue claims and includes appropriate disclaimer or responsibility language for manual outreach.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Close authorization and browser-data leaks
2. Harden SSRF, webhooks, and uploads
3. Implement retention preferences, retention jobs, and aggregated report views
4. Implement resumable audit/workspace/account deletion
5. Add UI disclaimers, settings controls, and documentation
6. Verify tests, typecheck, schema, build, and acceptance criteria
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented authorization hardening, safe browser/public DTOs, SSRF port and provider revalidation, bounded signed webhooks, retention modes and recursive cleanup, anonymous report aggregates, resumable audit/workspace/account deletion, Better Auth delete hooks, branding storage validation, report/outreach disclaimers, and the privacy-retention runbook.
Adversarial review fixes include inert prepared account-deletion jobs with verified recovery, pipeline write guards during deletion, paid-subscription period-end blocking, signed-body webhook deduplication, normalized viewer hashes with slug-wide limits, and browser URL secret stripping.
Fixed Convex query-runtime compatibility by reconstructing safe display URLs from read-only URL components instead of unsupported setters.
Verification: pnpm typecheck; pnpm test:schema; pnpm test (295 passing); pnpm build; git diff --check. All acceptance criteria were confirmed and TASK-4.14 was closed on explicit user approval.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped MVP privacy and security hardening: server-side authorization, safe report/browser DTOs, SSRF and webhook protections, standard/extended retention controls, anonymous report-view aggregates, resumable audit/workspace/account deletion, validated branding storage, claim-safety disclaimers, operational documentation, and comprehensive regression coverage. Verified with 295 tests, schema contract, typecheck, production build, and adversarial security review.
<!-- SECTION:FINAL_SUMMARY:END -->
