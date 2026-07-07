---
id: TASK-4.10
title: 'Add rate limiting, workpool controls, and abuse protection'
status: In Progress
assignee: []
created_date: '2026-07-03 20:03'
updated_date: '2026-07-07 19:58'
labels:
  - mvp
  - security
  - rate-limits
dependencies:
  - TASK-4.3
references:
  - .docs/PRD-SitePitch.md
documentation:
  - .docs/PRD-SitePitch.md
parent_task_id: TASK-4
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Protect SitePitch from unbounded provider cost and public-form abuse. The MVP must use Convex Rate Limiter as the primary application limiter and Convex Workpool or equivalent queue controls for provider/job parallelism. Public/demo surfaces should use Turnstile where appropriate.

Scope includes limits for demo audit, authenticated audit creation, lead search, screenshot creation, LLM generation, PDF/export behavior, and public report view tracking. Redis/Upstash may be used only for short-lived edge or idempotency signals, not as business truth.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Rate limits can be applied by workspace, user, IP, provider, and plan for all cost-generating entry points.
- [ ] #2 Provider/job workpools enforce documented max parallelism, retry policy, and backoff for screenshot, PageSpeed, content extraction, business data, LLM, and PDF-like work.
- [ ] #3 Rate-limit errors are user-friendly in the UI and safe in logs.
- [ ] #4 Demo or public forms are protected with Turnstile or an equivalent explicit anti-abuse gate.
- [ ] #5 Provider-specific limits and failures can be tuned without disabling the entire audit pipeline.
- [ ] #6 Tests or controlled simulations prove repeated audit starts, demo audits, and provider calls cannot create unlimited cost.
<!-- AC:END -->

## Implementation Notes

### What shipped

- **Workpool registration** (`convex/workpools.ts`, `convex/convex.config.ts`): four pools registered via `app.use(workpool, { name })`.
  - `auditWorkpool` — `maxParallelism: 2`, `retryActionsByDefault: true`, `defaultRetryBehavior: { maxAttempts: 2, initialBackoffMs: 5_000, base: 2 }`.
  - `providerWorkpool` — `maxParallelism: 4`, `retryActionsByDefault: false` (provider-level retries handled inside `runProviderAttempt`).
  - `llmWorkpool` — `maxParallelism: 2`, `retryActionsByDefault: true`, `defaultRetryBehavior: { maxAttempts: 2, initialBackoffMs: 10_000, base: 2 }`.
  - `pdfWorkpool` — `maxParallelism: 1`, `retryActionsByDefault: false`.
  - Audit pipeline enqueued in `convex/audits.ts:createQueuedAudit` (via `auditWorkpool.enqueueAction(..., { retry: true })`); deterministic scoring enqueues LLM generation in `convex/audit_scoring.ts:processDeterministicScoring` (via `llmWorkpool.enqueueAction(..., { retry: true })`).
- **Rate limits** (`convex/lib/audit_rate_limit.ts`): named limits registered on a single `RateLimiter(components.rateLimiter, ...)`:
  - Audit-start: `auditStartsFree` (3/hr), `auditStartsPaid` (10/hr), `auditStartsByWorkspace` (10/hr).
  - Public surfaces: `demoAuditByIp` (1/day), `publicReportViewsByViewer` (30/hr).
  - Reserved for not-yet-built flows: `leadSearchByWorkspace` (10/hr), `pdfExportsByWorkspace` (10/hr).
  - Per-provider token buckets (global per provider name): `screenshotProviderCalls` (20/min), `pagespeedProviderCalls` (10/min), `contentProviderCalls` (60/min), `businessDataProviderCalls` (20/min), `llmGenerations` (10/min).
- **Audit-start enforcement** (`convex/audits.ts:startAudit`): `checkAuditStartLimits` is called after normalization and idempotency dedupe, but before the credit check and DNS validation — binding ordering is: normalize → idempotency → rate limit (plan + workspace) → credit → DNS → create. Plan is resolved through `convex/lib/workspace.ts:getWorkspacePlan` and surfaced on `ensureCurrentWorkspace`, `getWorkspaceAuditContext`, and `getWorkspaceAuditContextByOwner`.
- **Provider gating** (`convex/audit_pipeline.ts:runProviderAttempt`, `convex/audit_agent_action.ts:processAuditAgentOutputs`): `checkProviderLimit` is invoked before every external provider call and before each LLM attempt. `runProviderAttempt` marks non-fatal providers `{ optional: true }` so a single provider failure cannot kill the whole pipeline.
- **Public report view limiting** (`convex/reports.ts:recordPublicReportView`): throttled via `publicReportViewsByViewer` keyed by `${slug}:${userAgentHash}`; never throws — returns `{ recorded: false, reason: "rate_limited" }` when over budget.
- **Turnstile helper** (`convex/lib/turnstile.ts`): `verifyTurnstileToken(token, remoteIp?)` posts to Cloudflare's siteverify endpoint using `env.TURNSTILE_SECRET_KEY`; returns `{ ok: true }` or `{ ok: false, reason: "TURNSTILE_NOT_CONFIGURED" | "TURNSTILE_FAILED" }`. `TURNSTILE_SECRET_KEY` is declared as `v.optional(v.string())` in `convex/convex.config.ts`. No demo/public audit form exists yet, so the helper is not invoked from any mutation.
- **UI** (`src/components/new-audit-dialog.tsx`): `RATE_LIMITED` is mapped to a friendly German message; when `retryAfter > 0` the dialog shows the wait time in whole minutes (`Math.max(1, Math.round(retryAfter / 60000))`).
- **Safe logging**: `throwRateLimited` (`convex/lib/rate_limit_helpers.ts`) raises a `ConvexError` whose payload is only `{ code, message, retryAfter }` — no PII; pipeline logs route through `redactSensitiveText` before any `console.warn`/`console.error`.

### Acceptance-criteria mapping

| AC | Text | Evidence | Status |
|----|------|----------|--------|
| #1 | Rate limits by workspace, user, IP, provider, and plan for cost-generating entry points | `convex/lib/audit_rate_limit.ts:checkAuditStartLimits` (workspace + plan/user); `checkProviderLimit` (per-provider); `demoAuditByIp` (IP, reserved); plan resolved in `convex/lib/workspace.ts:getWorkspacePlan` and surfaced via `ensureCurrentWorkspace` / `getWorkspaceAuditContext*`; enforced in `convex/audits.ts:startAudit` | Done — IP limit (`demoAuditByIp`) reserved pending demo flow |
| #2 | Provider/job workpools enforce documented max parallelism, retry policy, and backoff | `convex/workpools.ts` (audit/provider/llm/pdf pools with documented parallelism + retry + backoff); registered in `convex/convex.config.ts:28-31`; consumed in `convex/audits.ts:createQueuedAudit` and `convex/audit_scoring.ts:processDeterministicScoring` | Done |
| #3 | Rate-limit errors are user-friendly in the UI and safe in logs | `convex/lib/rate_limit_helpers.ts:throwRateLimited` (PII-free `ConvexError`); `src/components/new-audit-dialog.tsx:117-124` (RATE_LIMITED → German message + retry-after minutes); `redactSensitiveText` used on every pipeline log | Done |
| #4 | Demo or public forms protected with Turnstile or equivalent | Helper + env ready: `convex/lib/turnstile.ts:verifyTurnstileToken`, `TURNSTILE_SECRET_KEY` in `convex/convex.config.ts` | **Infra ready, awaiting flow** — no demo/public form exists yet; checkbox intentionally left UNCHECKED |
| #5 | Provider-specific limits and failures tunable without disabling the audit pipeline | Per-provider limit names in `checkProviderLimit`; `runProviderAttempt` `{ optional: true }` for screenshot/pagespeed/business-data so a single provider outage cannot kill the run; rates live in one map in `convex/lib/audit_rate_limit.ts` for tuning | Done |
| #6 | Tests or controlled simulations prove repeated audit starts, demo audits, and provider calls cannot create unlimited cost | `convex/audits.test.ts` "returns rate limit failures before DNS lookups" + "rate limit fires before the credit check" + "refuses unsafe targets after rate preflight" (audit-start ordering); `convex/reports.test.ts` "skips recording and returns rate_limited when over the limit" (public report view throttle); `convex/lib/turnstile.test.ts` (helper correctness) | Code-complete for audit-start + public report view; demo/lead-search/PDF simulations awaiting their flows |

### Checkbox policy

All six AC checkboxes are intentionally left **unchecked**. Per the task brief, an AC may only be flipped to `[x]` once its end-to-end flow is wired and verified. Current state:

- **Code-complete (flow live, tests green)**: AC #1, #2, #3, #5 are implemented and covered by `npm test` / `npm run typecheck` / `npm run test:schema`, but are held unchecked for unified sign-off.
- **Infra ready, awaiting flow**: AC #4 (Turnstile) — helper and env var are in place but no demo/public audit form exists yet, so the gate is not enforced anywhere. Stays UNCHECKED.
- **Partially awaiting flows**: AC #6 — audit-start and public-report-view paths have tests; demo-audit, lead-search, and PDF-export simulations cannot exist until those features ship.

### Reserved limit names (wired when the feature ships)

- `demoAuditByIp` — demo/public audit form (also unblocks AC #4).
- `leadSearchByWorkspace` — lead search entry point.
- `pdfExportsByWorkspace` — PDF/export entry point.

### Verification (Task 6 run)

- `npm test` → **90/90 passed** across 10 files.
- `npm run typecheck` → clean (`tsc --noEmit` exits 0).
- `npm run test:schema` → 1/1 passed (schema contract test).
- No pre-existing tests required adjustment; the new optional `plan` field on audit-context queries is consumed via `?? "free"` and the test mocks for `ensureCurrentWorkspace` continue to satisfy `startAudit`.
