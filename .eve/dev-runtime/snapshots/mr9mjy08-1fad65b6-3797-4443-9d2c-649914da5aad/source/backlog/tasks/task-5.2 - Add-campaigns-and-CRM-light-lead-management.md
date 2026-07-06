---
id: TASK-5.2
title: Add campaigns and CRM-light lead management
status: To Do
assignee: []
created_date: '2026-07-03 20:04'
labels:
  - post-mvp
  - campaigns
  - crm-light
dependencies:
  - TASK-5.1
references:
  - .docs/PRD-SitePitch-Post-MVP.md
documentation:
  - .docs/PRD-SitePitch-Post-MVP.md
parent_task_id: TASK-5
priority: medium
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Post-MVP Phase 7: organize multiple leads and audits into lightweight acquisition campaigns without becoming a full CRM. Users should be able to plan a campaign such as Zahnärzte Leipzig, import leads, prioritize audits, record manual contact state, and track simple outcomes.

Scope includes campaigns, campaign-lead associations, notes, follow-up reminders, CSV import/export, filters, duplicate detection, activity history, and campaign metrics. Follow-ups are reminders only, not automatic sends.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 User can create a campaign with name, target industry, city, country, language, and target offer.
- [ ] #2 User can assign leads to campaigns, including leads created manually, by search, by CSV, or later by integration.
- [ ] #3 CSV import can process at least 50 leads, detect duplicate domains, and preserve leads without websites as non-auditable until completed.
- [ ] #4 Lead list supports filters for industry, city, score, status, report opened, and last contact.
- [ ] #5 Users can add notes, schedule follow-up reminders, and manually record contacted, interested, won, lost, or follow-up states.
- [ ] #6 Campaign metrics show leads, audits, outreach copied, report views, and won/lost outcomes without automated contact.
<!-- AC:END -->
