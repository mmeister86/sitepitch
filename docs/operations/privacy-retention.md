# Privacy, retention, and deletion runbook

This document describes SitePitch's product behavior and operational safeguards. It is
not legal advice. The currently implemented policy version is `2026-07-11`.

## Data boundaries

- SitePitch audits public website content. Raw HTML is processed transiently and is not
  retained as a durable product record.
- Workspace data is server-authorized. Public reports are available only while the audit
  is complete and its high-entropy public link is enabled.
- Browser and public-report DTOs must not contain provider payloads, API credentials,
  internal request evidence, raw errors, query strings, URL fragments, or internal IDs.
- Uploaded branding files are limited to PNG, JPEG, and WebP, at most 2 MiB, and are
  confirmed as belonging to the authenticated workspace before use.

## Retention modes

New and existing workspaces default to `standard`. Owners can explicitly choose
`extended` in Settings. The decision, consent timestamp, and policy version are stored
server-side and preference changes are logged without copying user content.

| Data | Standard | Extended |
| --- | --- | --- |
| Raw HTML | Not retained | Not retained |
| Extracted Markdown | 30 days | Until explicit deletion or consent withdrawal |
| Screenshots | 90 days | Until explicit deletion or consent withdrawal |
| Provider calls and agent runs | 30 days | Until explicit deletion or consent withdrawal |
| Identifying public-report views | 30 days | 30 days (no exception) |
| Anonymous aggregated report counts | Until audit deletion | Until audit deletion |
| Usage events, provider costs, admin actions | 24 months | Until explicit deletion or consent withdrawal |
| Reports, scores, findings | Until explicit deletion | Until explicit deletion |
| Billing events | Statutory retention; no automatic deletion | Statutory retention; no exception |

Extended retention applies to data that still exists when consent is granted and to data
created afterwards. It cannot restore data already deleted and is not a backup or a
guarantee of perpetual service availability.

When consent is withdrawn, standard periods are recalculated from each record's original
creation time. Records already beyond their deadline are removed by the next retention
run. Explicit audit, workspace, or account deletion always overrides extended retention.

## Deletion behavior

- Deleting an audit immediately disables its public report and hides it from product
  lists. A resumable background job deletes its report content, findings, screenshots,
  provider/agent data, views, outreach drafts, and storage objects.
- Account deletion is initiated in Settings with the exact confirmation phrase and the
  current password. Active paid subscriptions must first be ended through the billing
  portal; deletion becomes available after the paid access period has ended.
- Account deletion immediately disables public reports, then removes workspace branding,
  audits, leads, campaigns, product telemetry, storage objects, memberships, and the app
  user. Billing records that must be retained are detached from the workspace/user.
- Deletion jobs are batched, idempotent, and resumable. The scheduled recovery job must
  pick up stale jobs after an interrupted deployment or transient failure.

## Operational checks

1. Monitor scheduled retention and deletion jobs for repeated failures or stale jobs.
2. For a deletion incident, record only the deletion-job ID and failure phase; never copy
   deleted content into support tickets or logs.
3. Retry through the existing idempotent job processor. Do not delete database rows or
   storage objects ad hoc unless an incident procedure explicitly requires it.
4. For a data-access or export request, authenticate the workspace owner before providing
   data. Until a self-service export exists, use the documented support channel and keep
   the export encrypted and time-limited.
5. After policy changes, increment the policy version, update this matrix and Settings
   copy, and verify whether renewed consent is required before changing stored consent.

## Product disclaimers

Every internal and public report, including print/PDF output, states that it assesses
publicly visible signals at the audit time, is not legal, privacy, or security advice, and
does not guarantee revenue or business outcomes. Outreach content is an editable draft;
SitePitch does not send it automatically or establish a lawful basis for contact. Users
remain responsible for review, sending, recipient choice, and legal compliance.
