---
id: TASK-4.8
title: Implement outreach copy workflows
status: In Progress
assignee: []
created_date: '2026-07-03 20:03'
updated_date: '2026-07-06 21:06'
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
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose the generated outreach outputs as practical, manually controlled sales material for the user. The MVP should help web designers start better conversations without becoming a mass-email or sequencing tool.

Scope includes UI for generated email, LinkedIn/contact-form copy, phone note, subject lines, optional follow-up text, editability where appropriate, copy-to-clipboard events, optional report-link insertion, and anti-spam/compliance messaging.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 User can view and copy at least a short email, LinkedIn/contact-form text, phone note, and three subject lines for a completed audit.
- [ ] #2 Outreach text is tailored to the audited website, selected language, workspace branding, and available report link.
- [ ] #3 Generated copy remains manually controlled: no automatic sending, no bulk send, and no hidden contact enrichment is introduced.
- [ ] #4 User can edit drafts before copying or reuse the generated text as a starting point without losing the original stored output.
- [ ] #5 Copy actions emit analytics or usage events for email, LinkedIn/contact-form, phone note, and public link copy.
- [ ] #6 UI includes a concise responsibility reminder that the user is responsible for lawful contact, without blocking normal copy workflows.
<!-- AC:END -->
