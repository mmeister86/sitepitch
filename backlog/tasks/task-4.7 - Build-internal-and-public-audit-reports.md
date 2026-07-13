---
id: TASK-4.7
title: Build internal and public audit reports
status: Done
assignee: []
created_date: '2026-07-03 20:03'
updated_date: '2026-07-13 08:35'
labels:
  - mvp
  - report
  - frontend
dependencies:
  - TASK-4.6
references:
  - .docs/PRD-SitePitch.md
documentation:
  - .docs/PRD-SitePitch.md
parent_task_id: TASK-4
priority: high
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the report experience for completed audits. Users need an internal dashboard report and a shareable public report that turns the audit into a professional, branded sales asset. Public reports must be readable on mobile, default to noindex, and avoid leaking internal raw data.

Scope includes report layout, score presentation, screenshots, top opportunities, strengths, weaknesses, detail findings, next steps, workspace CTA, public slug routing, report deactivate/reactivate behavior, print/PDF-friendly styling, and report view tracking.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Internal audit detail shows status, overall score, category scores, report preview, findings, warnings, assets, outreach drafts, copy buttons, and error states.
- [x] #2 Public report is reachable without login only through the public slug when the report is enabled.
- [x] #3 Public report includes workspace branding, domain/site identity, overall score, short summary, screenshot when available, top 5 opportunities, category scores, strengths, weaknesses, detail findings, next steps, and CTA.
- [x] #4 Public reports default to noindex, expose no internal IDs/API keys/provider payloads, and continue to render if screenshots or performance data are missing.
- [x] #5 Users can deactivate a public report so the public URL no longer shows the report content.
- [x] #6 Report view tracking records privacy-conscious view events and the report can be printed or saved as PDF with acceptable layout.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built the full report experience with a shared presentational component, authenticated internal report query, sanitized public report query, public-link toggle, privacy-conscious view tracking, and print-friendly CSS.

**Backend (convex/reports.ts):**
- `getInternalReportById`: authenticated aggregate query returning audit status, overall/category scores, summary, findings (with sales-angle), checks, outreach drafts, performance data, resolved screenshot URLs, view count, workspace branding, and computed warnings for missing data. Auth derived server-side via `ctx.auth.getUserIdentity()` + `findAppUser`; ownership verified against `audit.workspaceId`.
- `getPublicReportBySlug`: sanitized public query with no auth. Only returns data when `isPublic === true` and `status === "completed"`. DTO exposes no `_id`, `workspaceId`, `storageId`, `salesAngle`, `idempotencyKey`, raw checks, or outreach drafts. Missing screenshots/performance render as null/empty without breaking the page.
- `setPublicReportEnabled`: owner-gated mutation with completed-audit guard (`REPORT_NOT_READY` when enabling non-completed audits). Patches `audits.isPublic` and `updatedAt`.
- `recordPublicReportView`: public mutation writing to `reportViews` + `usageEvents` (event: `report_viewed`). Truncates referrer to 200 chars; no IP collection. Returns null silently for disabled/non-public reports so the tracking call doesn't leak state.

**Shared UI (src/components/audit-report.tsx):**
- Single `AuditReport` component with `variant: "public" | "internal"` prop. Renders branded header (accent color bar + workspace initial), ScoreRing, category scores with weighted progress bars, short summary, top 5 opportunities, strengths/weaknesses, desktop/mobile screenshots with fallback, detail findings (sales-angle only in internal variant), next steps, and workspace CTA. CTA resolves `ctaUrl → website → mailto:` fallback chain.

**Internal detail (src/views/audit-detail.tsx):**
- `LiveAuditDetail` now uses `getInternalReportById` and routes to `LiveProgressReport` (running audits), `LiveFailedReport` (error state), or `LiveCompletedReport` (full report). Completed view shows public-link enable/disable controls, copy/open/print buttons, engagement strip, warning indicators, and tabs for report/findings/outreach/checks.

**Public route (app/r/[slug]/page.tsx):**
- Next.js 16 App Router Server Component (Context7-verified pattern: `params: Promise<{ slug: string }>`, `await params`). Exports `metadata.robots: { index: false, follow: false }`. Renders `PublicReportView` client component outside the `/app` protected layout. Disabled/missing reports show a neutral no-leak "Report nicht verfügbar" page.

**View tracking:** `PublicReportView` calls `recordPublicReportView` on first load per browser session (sessionStorage dedup key `sp:view:{slug}`).

**Print CSS:** `@media print` in `src/index.css` hides `.no-print` elements, forces white background, removes card shadows, preserves colors (`print-color-adjust: exact`), and prevents page breaks inside finding cards.

**Tests:** 12 new Convex tests in `convex/reports.test.ts` covering public query sanitisation (JSON scan for `_id`/`workspaceId`/`storageId`/`salesAngle`/`idempotencyKey`), disabled/running guards, internal report auth + ownership, toggle mutation access control, and view tracking. Verified with `pnpm typecheck`, `pnpm test` (72 passing across 8 files), and `pnpm test:schema`.

**Mock-data removal across all app views:**
- `listMyAudits` query added to `convex/audits.ts`: fetches workspace audits ordered by createdAt with score, lead info, view count, and outreach flag.
- Audit inbox (`/app/audits`): replaced mock-data table with `useQuery(api.audits.listMyAudits)`, real status filters (running/completed/failed), domain search, and audit deletion with `deleteAudit` cascade mutation + AlertDialog confirmation.
- Sidebar badge: real audit count from `listMyAudits.total` (Convex React caches the shared subscription).
- Dashboard (`/app`): real KPIs (audit count, completed, views, credits), dynamic activation checklist, recent audits from live data. Engagement chart and activity feed kept as branded placeholders.
- Leads (`/app/leads`) and Campaigns (`/app/campaigns`): mock data replaced with empty states explaining features are planned (tasks 4.11 / 5.2).
<!-- SECTION:NOTES:END -->
