---
id: TASK-6
title: Add SitePitch GTM and AI discoverability Eve skills
status: In Progress
assignee: []
created_date: '2026-07-09 18:26'
labels: []
dependencies: []
priority: medium
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add project-local Eve skills under agent/skills to adapt GTM, GEO, AI-discoverability, landing-page, and outreach patterns for SitePitch audits while preserving mandatory persona and critique passes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 New Eve skills live under agent/skills, not .agents/skills.
- [ ] #2 No new agent/subagents runtime tree is introduced.
- [ ] #3 Persona review and design critique remain mandatory for every audit.
- [ ] #4 Skills only use supplied audit evidence and do not add live crawling or external data requirements.
- [ ] #5 Existing SitePitch audit skills are refined without weakening claim-safety or evidence requirements.
- [ ] #6 Eve discovery and TypeScript checks pass.
<!-- AC:END -->
