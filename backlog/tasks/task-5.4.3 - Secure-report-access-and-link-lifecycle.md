---
id: TASK-5.4.3
title: Secure report access and link lifecycle
status: Done
assignee: []
created_date: '2026-07-14 21:52'
updated_date: '2026-07-16 20:20'
labels: []
dependencies:
  - TASK-5.4.1
references:
  - .docs/PRD-SitePitch-Post-MVP.md
parent_task_id: TASK-5.4
priority: high
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the shared public access resolver, password grants, expiry, disable/reactivate behavior, link rotation, guarded telemetry, and permanent noindex responses.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Password, expiry, disable, and regenerated-link checks protect every public read and event path.
- [ ] #2 Link rotation invalidates the old slug and all access grants while preserving the report snapshot.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented shared public access resolver, scrypt password grants with Turnstile/rate limiting, expiry, telemetry protection, disable/reactivate, and atomic link rotation. Automated tests pass; manual QA pending.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Sicherer Report-Zugriff und Link-Lebenszyklus abgeschlossen und durch Nutzer bestätigt.
<!-- SECTION:FINAL_SUMMARY:END -->
