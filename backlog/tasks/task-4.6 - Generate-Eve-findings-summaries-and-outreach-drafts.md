---
id: TASK-4.6
title: 'Generate Eve findings, summaries, and outreach drafts'
status: Done
assignee: []
created_date: '2026-07-03 20:03'
updated_date: '2026-07-06 21:40'
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
- [x] #1 Eve receives only the minimum necessary audit context from Convex and never owns credit decisions, auth decisions, public report delivery, or raw provider persistence.
- [x] #2 Structured outputs are validated for audit findings, summary, strengths, weaknesses, top opportunities, next steps, email draft, LinkedIn/contact-form draft, phone note, and subject lines.
- [x] #3 Every public-facing finding references stored evidence and avoids invented data, unsupported legal claims, security claims, guaranteed revenue claims, and shaming language.
- [x] #4 Outreach drafts are short, friendly, manually copyable, generated in the selected report language, and optionally include the report link.
- [x] #5 Invalid Eve output is retried or converted into a clear fallback/error state without losing deterministic audit data.
- [x] #6 Agent runs store audit ID, workspace ID, purpose, provider/model, status, token usage where available, skill versions where available, and safe error details.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Integrated Eve (0.20.0) as the filesystem-first audit-agent layer and wired it into the Convex pipeline with a deterministic fallback so audits complete reliably with or without a running Eve server.

**Eve agent surface (agent/):** agent.ts (gpt-4.1-mini via gateway, with input/output token limits), instructions.md (role, claim-safety rules, evidence rule, tonality), category skills (conversion, seo-basics, local-seo, mobile-ux, trust), respectful-outreach and claim-safety skills, and tools get_audit_context + save_audit_output documenting the agent contract for standalone-server use.

**Convex orchestration:**
- convex/lib/audit_agent_schemas.ts: Zod contract for findings, summary, outreach drafts, and subject lines; safeParseAgentOutput helper.
- convex/lib/audit_agent_evidence.ts: builds evidence refs from stored checks; validates every finding references stored label/evidence/category.
- convex/lib/audit_agent_claim_safety.ts: regex review blocking legal claims, security claims, revenue guarantees, shaming language, and unsupported WCAG claims across all public text.
- convex/lib/audit_agent_fallback.ts: deterministic de/en generator from checks/scores producing schema-valid, claim-safe, evidence-grounded output.
- convex/audit_agent.ts: minimal context query (audit + workspace + scores + checks + compact signals + performance + business), idempotent save mutations (delete-then-insert for findings/outreach, upsert for summary), auditAgentRuns start/finish logging, setAuditAgentStage status helper, completeAuditFromAgent (idempotent audit_completed usage event), markAuditAgentFailed.
- convex/audit_agent_action.ts: Node action processAuditAgentOutputs. Loads minimal context, calls Eve via eve/client when EVE_AGENT_URL configured (outputSchema-validated), retries once on validation/safety failure, falls back to deterministic generator otherwise, logs every run, advances generating_findings -> generating_outreach -> completed.

**Pipeline handoff:** processDeterministicScoring now schedules internal.audit_agent_action.processAuditAgentOutputs after writing checks/scores, keeping deterministic data intact regardless of Eve outcome.

**Schema:** added outreachDrafts.subjectLines (optional string[]) so email drafts carry the required multiple subject lines.

**Env (convex.config.ts):** EVE_AGENT_URL and EVE_AGENT_MODEL (optional); SITE_URL reused for report links.

Verified with pnpm typecheck, pnpm test (60 passing across 7 files), and pnpm test:schema.
<!-- SECTION:NOTES:END -->
