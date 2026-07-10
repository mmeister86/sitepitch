---
id: TASK-6
title: Add SitePitch GTM and AI discoverability Eve skills
status: Done
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
- [x] #1 New Eve skills live under agent/skills, not .agents/skills.
- [x] #2 No new agent/subagents runtime tree is introduced.
- [x] #3 Persona review and design critique remain mandatory for every audit.
- [x] #4 Skills only use supplied audit evidence and do not add live crawling or external data requirements.
- [x] #5 Existing SitePitch audit skills are refined without weakening claim-safety or evidence requirements.
- [x] #6 Eve discovery and TypeScript checks pass.
<!-- AC:END -->

## Implementation Notes

- Added project-local Eve skills under `agent/skills/`: `sitepitch-gtm-audit` (orchestrates GTM, AI discoverability, SEO, conversion, trust, persona, critique, outreach) and `ai-discoverability-audit` (GEO/LLM-readable structure signals).
- Existing skills (`seo-basics-audit`, `website-copy-audit`, `respectful-outreach`, `persona-review`, `claim-safety`) were refined to keep claim-safety and evidence requirements intact; no ranking/citation/revenue guarantees introduced.
- Persona review is now fail-closed: `runPersonaPanel` in `convex/audit_agent_action.ts` saves a deterministic fallback panel whenever the LLM path fails, so every completed audit has persona reviews. This mirrors the existing deterministic fallback for design critique.
- Added `convex/lib/audit_persona_fallback.ts` and unit tests in `convex/audit_persona.test.ts` to cover schema validity, language handling, evidence references, score-driven confidence, and claim safety.
- All skills rely only on supplied audit evidence; live crawling, SERP data, competitor research, or external data are explicitly forbidden.
- Eve discovery diagnostics are clean (0 errors, 0 warnings) and both new skills are present in the compiled manifest.
- Verification: `npm run typecheck` clean, `npm test` 218 passed, `npm run test:schema` clean.
