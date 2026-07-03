---
id: TASK-4.6
title: 'Generate Eve findings, summaries, and outreach drafts'
status: To Do
assignee: []
created_date: '2026-07-03 20:03'
labels:
  - mvp
  - eve
  - ai
  - outreach
dependencies:
  - TASK-4.5
references:
  - .docs/PRD-SitePitch.md
documentation:
  - .docs/PRD-SitePitch.md
parent_task_id: TASK-4
priority: high
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Integrate Eve as the audit-agent layer for the MVP language outputs. Eve should transform structured audit context into validated, respectful, evidence-grounded findings, summaries, opportunities, and outreach drafts. Convex remains responsible for auth, billing, credits, public reports, and stored state.

Scope includes the agent folder structure, audit context tools, save tools, category skills, respectful outreach, claim-safety rules, Zod validation, retry/fallback handling, and auditAgentRuns logging.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Eve receives only the minimum necessary audit context from Convex and never owns credit decisions, auth decisions, public report delivery, or raw provider persistence.
- [ ] #2 Structured outputs are validated for audit findings, summary, strengths, weaknesses, top opportunities, next steps, email draft, LinkedIn/contact-form draft, phone note, and subject lines.
- [ ] #3 Every public-facing finding references stored evidence and avoids invented data, unsupported legal claims, security claims, guaranteed revenue claims, and shaming language.
- [ ] #4 Outreach drafts are short, friendly, manually copyable, generated in the selected report language, and optionally include the report link.
- [ ] #5 Invalid Eve output is retried or converted into a clear fallback/error state without losing deterministic audit data.
- [ ] #6 Agent runs store audit ID, workspace ID, purpose, provider/model, status, token usage where available, skill versions where available, and safe error details.
<!-- AC:END -->
