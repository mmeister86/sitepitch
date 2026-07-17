---
id: TASK-8
title: Verbessere Layout des Credit-Hinweises
status: Done
assignee: []
created_date: '2026-07-15 19:32'
updated_date: '2026-07-16 20:20'
labels: []
dependencies: []
priority: high
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Den Hinweis zur Credit-Reservierung im Neuen-Audit-Dialog kompakter und klarer gestalten.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Credit-Reservierung und verbleibende Credits sind ohne störende Umbrüche verständlich
- [x] #2 Hinweis bleibt auf kleinen Viewports gut lesbar
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Bestehenden Credit-Hinweis prüfen
2. Responsive Layout mit klarer Informationshierarchie umsetzen
3. Lint und Darstellung verifizieren
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Credit-Hinweis in zwei zusammengehörige, responsive Informationsgruppen aufgeteilt. Auf Mobilgeräten wird die zweite Gruppe durch einen Divider getrennt unterhalb dargestellt. TypeScript-Check erfolgreich.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Credit-Hinweis im Neuen-Audit-Dialog als responsive, klar getrennte Informationsgruppen umgesetzt und durch Nutzer bestätigt.
<!-- SECTION:FINAL_SUMMARY:END -->
