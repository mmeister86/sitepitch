---
id: TASK-4.5
title: Implement deterministic checks and scoring
status: Done
assignee: []
created_date: '2026-07-03 20:03'
updated_date: '2026-07-06 19:09'
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
- [x] #1 Each deterministic check returns one of passed, failed, warning, not_applicable, or unknown with a label, category, source or evidence, and optional weight.
- [x] #2 Checks cover the PRD MVP lists for technical basics, SEO basics, local SEO, conversion, mobile UX, trust/credibility, and performance.
- [x] #3 Category scores use the PRD weights: conversion 25%, SEO basics 20%, local SEO 20%, performance 15%, mobile UX 10%, and trust 10%.
- [x] #4 Overall score and category scores are reproducible from stored raw data and checks, not from free-form LLM output.
- [x] #5 Score labels map to the PRD ranges from critical through very strong and are phrased respectfully as sales opportunities.
- [x] #6 Unit tests cover representative pass/fail/warning/unknown cases, score weighting, missing provider data, and scoring version changes.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the deterministic scoring layer in convex/lib/audit_scoring.ts (pure helpers: check definitions, PRD weights, status points, category/overall score math, PRD score bands and respectful opportunity labels) and convex/audit_scoring.ts (internal mutation processDeterministicScoring that gathers raw data, pages, assets, performance and business data, evaluates ~45 checks across all seven categories, writes auditChecks + versioned auditScores, patches audits.overallScore and advances status to generating_findings).

Extended HTML extraction (convex/lib/audit_pipeline.ts) with imageCount/imagesMissingAltCount, phoneLinkFound, contactFormFound and viewportMetaFound; added these fields to auditRawData schema and upsertAuditRawData. Added auditChecks index by_auditId_and_category_and_key and auditScores index by_auditId_and_scoringVersion for idempotent versioned upserts.

Connected the pipeline handoff: processAuditPipeline now schedules internal.audit_scoring.processDeterministicScoring after finishAuditPipeline succeeds.

Verified with pnpm test (35 passing), pnpm typecheck, and pnpm test:schema.

Confirmed end-to-end in dev deployment: pipeline schedules scoring, processDeterministicScoring evaluates 52 checks, writes auditChecks + auditScores with overallScore 76, and advances status to generating_findings.
<!-- SECTION:NOTES:END -->
