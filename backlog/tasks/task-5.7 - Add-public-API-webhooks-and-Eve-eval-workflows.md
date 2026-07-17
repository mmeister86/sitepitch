---
id: TASK-5.7
title: 'Add public API, webhooks, and Eve eval workflows'
status: In Progress
assignee: []
created_date: '2026-07-03 20:05'
updated_date: '2026-07-17 08:12'
labels:
  - post-mvp
  - api
  - eve
  - evals
dependencies:
  - TASK-5.3
references:
  - .docs/PRD-SitePitch-Post-MVP.md
documentation:
  - .docs/PRD-SitePitch-Post-MVP.md
parent_task_id: TASK-5
priority: low
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Post-MVP Phase 12: expose controlled programmatic access for advanced agencies and improve internal AI quality workflows. The public API and agentic workflows must use the same authorization, credit, rate-limit, and claim-safety boundaries as the app.

Scope includes API keys, audit creation/status/report endpoints, webhook lifecycle delivery, API rate limits, key rotation/revocation, versioning, Eve eval suites, prompt/skill output versioning, internal QA/recovery tools, and quality trend dashboards.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Workspace admins can create, rotate, and revoke scoped API keys without exposing raw key values after creation.
- [x] #2 API clients can start an audit, check audit status, and retrieve report metadata while consuming credits and respecting plan rate limits.
- [x] #3 Webhook delivery supports audit lifecycle events with retry limits, safe payloads, and visible delivery failures.
- [x] #4 API, UI, webhook, and integration paths all use shared audit/credit/rate-limit use cases and cannot bypass workspace authorization.
- [x] #5 Eve outputs store prompt or skill version, model/provider, evidence references, and validation status per run.
- [x] #6 Eval dashboards show quality trends for summary, findings, outreach tone, evidence grounding, and claim safety, including regression failures before prompt/skill changes ship.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Gemeinsame Principal-, API- und Versionierungsgrundlage schaffen
2. API-Keys, REST v1 und Lifecycle-Webhooks liefern
3. Eve als produktiven Agent-Layer mit immutable Outputversionen einführen
4. Striktes Eval-Gate, Ingestion, Dashboard und Recovery ergänzen
5. Widen–Migrate–Narrow vorbereiten und automatisiert verifizieren
6. Manuelle Abnahme dokumentieren; erst nach Nutzerbestätigung schließen
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-5.5 wird als technische Basis weiterverwendet; vorhandene uncommittete Änderungen aus TASK-5.5/5.6 bleiben erhalten.
Defaults: Eve Primary mit AI-SDK-Recovery, publish_report opt-in, striktes Eval-Gate, 24h Key-Rotation.

Implementation complete across TASK-5.7.1–5.7.6 and automated gates are green. Parent and subtasks intentionally remain In Progress until explicit user confirmation after manual acceptance. Outstanding manual checks require a deployed Convex/Next environment, real webhook targets and judge credentials.

Goey-Toast/Turbopack-Stabilisierung (2026-07-17): Diagnose bestätigt den offiziellen Import goey-toast/styles.css und ein korrekt installiertes Paket. Ursache ist ein persistenter .next/dev-Graph bei falsch inferiertem Workspace-Root /Users/matthias. Umsetzungsplan: 1. turbopack.root in next.config.ts auf process.cwd() setzen und withEve/Rewrites erhalten. 2. Dev-Server stoppen und nur .next/dev erneuern. 3. Resolver, Dev-Routen, Toast-Darstellung und Production-Build verifizieren. Keine Dependency-, Lockfile- oder öffentliche API-Änderung.

Verifikation Goey-Toast/Turbopack (2026-07-17): next.config.ts setzt turbopack.root auf process.cwd(); Rybbit-Rewrites und withEve bleiben erhalten. Nach Stopp des Dev-Servers wurde ausschließlich .next/dev entfernt. Frischer pnpm-dev-Start: Next.js 16.2.10 bereit in 283 ms, keine falsche Workspace-Root-Warnung und kein neuer goey-toast/styles.css-Auflösungsfehler. Resolver-Test: goey-toast/styles.css -> goey-toast@0.5.0/dist/index.css. Dev-Routen /login, /app/settings/api und /app/admin/evals jeweils HTTP 200. pnpm exec next build erfolgreich einschließlich TypeScript und 32 statischer Seiten. UI-Test: Success- und Error-Toast sichtbar unten rechts; Übergänge 0,2–0,4 s aktiv; Light- und Dark-Seite geprüft. Follow-up-Hinweis außerhalb des freigegebenen Fix-Scopes: Im Dark-Mode bleibt der interne Gooey-Wrapper data-theme=light, weil der Toast-Wrapper next-themes nutzt, während die App den eigenen ThemeProvider verwendet. Gemäß Plan wurde der zentrale Toast-Wrapper nicht geändert. TASK-5.7 bleibt bis zur manuellen Nutzerbestätigung In Progress.
<!-- SECTION:NOTES:END -->
