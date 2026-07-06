# SitePitch Convex Data Model

## Summary

This schema captures the MVP data surfaces for auth, workspaces, subscriptions, credits, leads, audits, public reports, outreach drafts, usage analytics, provider cost tracking, and Eve runs.

## Key decisions

- Every workspace-owned business entity stores `workspaceId` directly so server-side authorization can query by workspace without walking parent chains.
- `publicSlug` is the only public report identifier; internal audit IDs never appear in public URLs.
- Ledger, usage, report-view, provider-cost, and agent-run tables are append-only by convention.
- `workspaceMembers` supports `owner | admin | member`, but the MVP currently writes only `owner`.
- Audit status is modeled as the full PRD lifecycle from `draft` through `cancelled`.

## Tables

- `users`, `workspaces`, and `workspaceMembers` cover auth and ownership.
- `subscriptions`, `creditBalances`, and `creditLedger` cover billing and credit reconstruction.
- `leads` and `audits` store the top-level product objects.
- `auditRawData`, `auditAssets`, `auditPerformance`, `auditChecks`, `auditScores`, `auditFindings`, `auditSummaries`, and `outreachDrafts` store the audit output pipeline.
- `reportViews`, `usageEvents`, `providerCosts`, and `auditAgentRuns` capture operational telemetry.

## Intentional MVP omissions

- No campaign, team invitation, CRM, or integration tables yet.
- No separate billing webhook event log yet.
- No migration layer or seed fixtures are added in this task.
- No query or mutation helpers are added here; later tasks own behavior on top of the schema.
