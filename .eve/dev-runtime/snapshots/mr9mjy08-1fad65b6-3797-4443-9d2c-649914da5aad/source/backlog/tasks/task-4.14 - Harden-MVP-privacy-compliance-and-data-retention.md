---
id: TASK-4.14
title: 'Harden MVP privacy, compliance, and data retention'
status: To Do
assignee: []
created_date: '2026-07-03 20:04'
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
- [ ] #1 Workspace data, audit data, and reports are authorized server-side; public reports are accessible only through high-entropy slugs and enabled report state.
- [ ] #2 No API keys, secrets, provider payloads, internal IDs, or sensitive logs are exposed to the browser or public report HTML.
- [ ] #3 SSRF and unsafe URL protections cover localhost, loopback, private IP ranges, link-local ranges, unsupported schemes, oversized responses, redirect limits, and provider timeouts.
- [ ] #4 Retention rules are implemented or explicitly documented for screenshots, raw HTML, extracted markdown, provider logs, report view IP/user-agent hashes, usage events, and billing events.
- [ ] #5 Users can delete or disable at least audits, public reports, branding data, and workspace/account data through UI or documented support workflow.
- [ ] #6 Report and outreach copy avoids legal/security/guaranteed-revenue claims and includes appropriate disclaimer or responsibility language for manual outreach.
<!-- AC:END -->
