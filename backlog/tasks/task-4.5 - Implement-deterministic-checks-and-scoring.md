---
id: TASK-4.5
title: Implement deterministic checks and scoring
status: To Do
assignee: []
created_date: '2026-07-03 20:03'
labels:
  - mvp
  - audit
  - scoring
dependencies:
  - TASK-4.4
references:
  - .docs/PRD-SitePitch.md
documentation:
  - .docs/PRD-SitePitch.md
parent_task_id: TASK-4
priority: high
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the deterministic audit evaluation layer and scoring model. SitePitch must not rely on AI as the sole source of truth for scores or claims; reproducible checks should produce structured findings that Eve can later explain in customer-friendly language.

Scope includes technical, SEO basics, local SEO, conversion, mobile UX, trust, and performance checks; category scores; overall weighted score; score labels; versioning; and tests for the scoring model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each deterministic check returns one of passed, failed, warning, not_applicable, or unknown with a label, category, source or evidence, and optional weight.
- [ ] #2 Checks cover the PRD MVP lists for technical basics, SEO basics, local SEO, conversion, mobile UX, trust/credibility, and performance.
- [ ] #3 Category scores use the PRD weights: conversion 25%, SEO basics 20%, local SEO 20%, performance 15%, mobile UX 10%, and trust 10%.
- [ ] #4 Overall score and category scores are reproducible from stored raw data and checks, not from free-form LLM output.
- [ ] #5 Score labels map to the PRD ranges from critical through very strong and are phrased respectfully as sales opportunities.
- [ ] #6 Unit tests cover representative pass/fail/warning/unknown cases, score weighting, missing provider data, and scoring version changes.
<!-- AC:END -->
