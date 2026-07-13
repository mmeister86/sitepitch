---
id: TASK-4.8
title: Implement outreach copy workflows
status: Done
assignee: []
created_date: '2026-07-03 20:03'
updated_date: '2026-07-13 08:35'
labels:
  - mvp
  - outreach
  - frontend
dependencies:
  - TASK-4.6
references:
  - .docs/PRD-SitePitch.md
documentation:
  - .docs/PRD-SitePitch.md
parent_task_id: TASK-4
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose the generated outreach outputs as practical, manually controlled sales material for the user. The MVP should help web designers start better conversations without becoming a mass-email or sequencing tool.

Scope includes UI for generated email, LinkedIn/contact-form copy, phone note, subject lines, optional follow-up text, editability where appropriate, copy-to-clipboard events, optional report-link insertion, and anti-spam/compliance messaging.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 User can view and copy at least a short email, LinkedIn/contact-form text, phone note, and three subject lines for a completed audit.
- [x] #2 Outreach text is tailored to the audited website, selected language, workspace branding, and available report link.
- [x] #3 Generated copy remains manually controlled: no automatic sending, no bulk send, and no hidden contact enrichment is introduced.
- [x] #4 User can edit drafts before copying or reuse the generated text as a starting point without losing the original stored output.
- [x] #5 Copy actions emit analytics or usage events for email, LinkedIn/contact-form, phone note, and public link copy.
- [x] #6 UI includes a concise responsibility reminder that the user is responsible for lawful contact, without blocking normal copy workflows.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built the manual outreach workflow on top of the Eve-generated drafts (TASK-4.6) and the internal report (TASK-4.7). Outreach drafts stay read-only in `outreachDrafts`; editing happens client-side as a working copy, with a reset option that restores the original. No sending, bulk, or contact enrichment was introduced.

**Backend (convex/reports.ts):**
- `recordReportCopyEvent`: authenticated, owner-gated mutation writing a `usageEvents` row. Supports `kind: "outreach"` (records `outreach_copied` with `metadata: { draftType, edited, includedReportLink }`, requires `draftType`) and `kind: "public_link"` (records `public_link_copied`, requires `audit.isPublic === true`, else `REPORT_NOT_PUBLIC`). Returns `{ recorded: true }`.
- Added `public_link_copied` to `usageEventTypeValidator` (src/lib/convex-schema-values.ts) and the frontend `Activity` type.

**Frontend (src/components/outreach-workflows.tsx):**
- `OutreachWorkflows` renders every stored draft (email, LinkedIn/contact-form, phone note, follow-up) with editable subject (Input) and body (Textarea) working copies. E-Mail drafts show all `subjectLines` as selectable chips that set the active subject.
- Per-draft reset button restores the original stored text (only visible when the working copy diverges). Inline hint clarifies the original remains stored.
- Report-link handling: when the report is public, a "Report-Link einfügen" button appends the share URL to the body (disabled once present); a dedicated link card offers a standalone copy. When the report is private, a CTA routes to the public enable flow.
- Copy actions fire `recordReportCopyEvent` with `edited`/`includedReportLink`/`draftType`; analytics failures never block clipboard feedback.
- Compliance card states the user is responsible for lawful contact, plus badges (manuell kopierbar / kein Massenversand / keine Kontaktanreicherung) and the claim-safety note.

**Frontend wiring (src/views/audit-detail.tsx + copy-button.tsx):**
- `CopyButton` gained an optional `onCopied` callback invoked after the clipboard write.
- `LiveCompletedReport` replaced the read-only outreach tab with `OutreachWorkflows`, passes `shareUrl`/`isPublic`/`onEnablePublic`, and connected the header "Link kopieren" button to `recordReportCopyEvent` (`public_link`).
- Removed the now-unused local `outreachTypeLabels` map (labels live in the new component).

**Tests:** 6 new Convex tests in `convex/reports.test.ts` covering outreach copy metadata, public-link copy, non-public rejection, missing draftType rejection, unauthenticated rejection, and cross-workspace FORBIDDEN. Verified with `pnpm typecheck`, `pnpm test` (78 passing across 8 files), `pnpm test:schema`, and `pnpm build`.
<!-- SECTION:NOTES:END -->
