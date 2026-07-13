---
id: TASK-4.11
title: Build MVP lead search and lead list
status: Done
assignee: []
created_date: '2026-07-03 20:03'
updated_date: '2026-07-13 08:35'
labels:
  - mvp
  - lead-search
dependencies:
  - TASK-4.2
references:
  - .docs/PRD-SitePitch.md
documentation:
  - .docs/PRD-SitePitch.md
parent_task_id: TASK-4
priority: medium
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the PRD P1 lead-search workflow for local businesses while preserving the MVP anti-spam boundaries. Users should be able to search by industry and city, save leads, see which leads have websites, and start audits from saved leads.

This task should keep the business-data provider replaceable, avoid personal email enrichment, and not automate contact. If schedule pressure requires deferring lead search, leave the feature flaggable and document the launch impact.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 User can search local businesses by industry, city, country, and optional keyword or radius.
- [x] #2 Search results show business name, website when available, category, address, phone when available, provider/source metadata, and whether the result is audit-ready.
- [x] #3 Results without a website can be saved but cannot start an audit until a website URL is added.
- [x] #4 User can save a lead and start an audit from a lead without re-entering the URL.
- [x] #5 Provider errors and plan or credit/limit restrictions are shown clearly without losing existing leads.
- [x] #6 No personal email enrichment, automated contact, or legal-contact-validity claim is introduced.
<!-- AC:END -->
