---
id: TASK-4.6
title: 'Generate Eve findings, summaries, and outreach drafts'
status: Done
assignee: []
created_date: '2026-07-03 20:03'
updated_date: '2026-07-13 08:35'
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
ordinal: 13000
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
Integrated Eve (0.20.0) as the filesystem-first audit-agent layer and wired it into the Convex pipeline with a deterministic fallback so audits complete reliably even when the LLM is unavailable or returns invalid output. Verified live end-to-end against OpenRouter (gpt-4.1-mini): a real audit produced 17 findings in ~27s with usedFallback=false.

**Eve agent surface (agent/):** agent.ts (gpt-4.1-mini, input/output token limits), instructions.md (role, claim-safety rules, evidence rule, tonality), category skills (conversion, seo-basics, local-seo, mobile-ux, trust), respectful-outreach and claim-safety skills, and tools get_audit_context + save_audit_output documenting the agent contract for standalone `eve dev` use.

**Convex orchestration (LLM call runs inside Convex):** because the OpenRouter key lives in the Convex deployment env, the agent action calls the model directly via the Vercel AI SDK instead of requiring a separate Eve HTTP server.
- convex/lib/audit_agent_schemas.ts: Zod storage contract (findings, summary, outreach, subject lines) plus a strict-compatible auditAgentGenerationSchema (nullable fields) with generationToStorage mapper, so OpenAI structured outputs (strict JSON schema) accept the request; safeParseAgentOutput helper.
- convex/lib/audit_agent_evidence.ts: builds evidence refs from stored checks; validates every finding references stored label/evidence/category.
- convex/lib/audit_agent_claim_safety.ts: regex review blocking legal claims, security claims, revenue guarantees, shaming language, and unsupported WCAG claims across all public text.
- convex/lib/audit_agent_fallback.ts: deterministic de/en generator from checks/scores producing schema-valid, claim-safe, evidence-grounded output.
- convex/lib/audit_agent_prompt.ts: system/user prompt builder mirroring the Eve instructions and skills (deployable inside the Convex runtime).
- convex/audit_agent.ts: minimal context query (audit + workspace + scores + checks + compact signals + performance + business), idempotent save mutations (delete-then-insert for findings/outreach, upsert for summary), auditAgentRuns start/finish logging, setAuditAgentStage status helper, completeAuditFromAgent (idempotent audit_completed usage event), markAuditAgentFailed.
- convex/audit_agent_action.ts: Node action processAuditAgentOutputs. Loads minimal context, calls generateObject from the AI SDK against OpenRouter (OPENROUTER_API_KEY + OPENROUTER_MODEL), validates output + claim-safety, retries once on validation/safety failure, falls back to the deterministic generator otherwise, logs every run with responseBody/responseStatus on failure, advances generating_findings -> generating_outreach -> completed.

**Pipeline handoff:** processDeterministicScoring now schedules internal.audit_agent_action.processAuditAgentOutputs after writing checks/scores, keeping deterministic data intact regardless of LLM outcome.

**Schema:** added outreachDrafts.subjectLines (optional string[]) so email drafts carry the required multiple subject lines.

**Deps:** added eve@0.20, ai@7, @ai-sdk/openai@4. **Env (convex.config.ts):** OPENROUTER_MODEL, EVE_AGENT_URL/EVE_AGENT_MODEL (optional, for standalone Eve server); SITE_URL reused for report links.

Verified with pnpm typecheck, pnpm test (60 passing across 7 files), pnpm test:schema, and a live OpenRouter reproduction with a 52-check payload.
<!-- SECTION:NOTES:END -->
