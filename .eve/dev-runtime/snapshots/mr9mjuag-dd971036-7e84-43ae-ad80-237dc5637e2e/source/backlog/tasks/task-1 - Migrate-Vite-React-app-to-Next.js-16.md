---
id: TASK-1
title: Migrate Vite React app to Next.js 16
status: Done
assignee: []
created_date: '2026-07-02 12:05'
updated_date: '2026-07-03 20:06'
labels: []
dependencies: []
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the current Vite React single-page application setup with a Next.js 16 application while preserving the existing UI, routes, styling, and developer workflows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Next.js 16 is installed and Vite-specific tooling is removed from active scripts and config.
- [x] #2 Existing app views are available through Next.js app routes with the current shell and navigation preserved.
- [x] #3 Tailwind CSS and theme behavior continue to work in the Next.js app.
- [x] #4 Type checking and production build complete successfully.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Fetch current Next.js 16 migration/setup docs with Context7.
2. Audit Vite entrypoints, routing, styling, and client-only components.
3. Replace package scripts/dependencies/config with Next.js equivalents.
4. Add Next.js app router files and adapt existing routes/views.
5. Run typecheck/build and fix migration fallout.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Migrated from Vite SPA to Next.js 16.2.10 App Router. Added app routes for /, /audits, /audits/[id], /leads, /campaigns, and /settings. Replaced hash navigation with Next navigation compatibility hook. Added Tailwind v4 PostCSS config and SSR-safe theme initialization. Verified npm run typecheck and npm run build. Smoke-tested /, /audits, /audits/aud_1001, /leads, /campaigns, and /settings with 200 OK from the dev server.
<!-- SECTION:NOTES:END -->
