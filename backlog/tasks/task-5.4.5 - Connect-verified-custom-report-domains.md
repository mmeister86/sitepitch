---
id: TASK-5.4.5
title: Connect verified custom report domains
status: Done
assignee: []
created_date: '2026-07-14 21:52'
updated_date: '2026-07-16 07:51'
labels: []
dependencies:
  - TASK-5.4.1
  - TASK-5.4.3
references:
  - .docs/PRD-SitePitch-Post-MVP.md
parent_task_id: TASK-5.4
priority: medium
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add provider-neutral CNAME/TXT verification, manual hosting activation, safe domain disable/suspension, canonical report URLs, and root-slug host rewrites.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Only verified and manually provisioned Agency subdomains become active.
- [ ] #2 Custom-domain requests are workspace-bound and safely fall back to SitePitch after disable or downgrade.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented Agency-only CNAME domains, TXT/CNAME verification, pending-host manual activation, host routing, fallback URLs, daily rechecks, suspension, and noindex responses. Automated tests/build pass; live DNS/TLS QA pending.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Verifizierte Custom-Report-Domains abgeschlossen und durch Nutzer bestätigt.
<!-- SECTION:FINAL_SUMMARY:END -->
