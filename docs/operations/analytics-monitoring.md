# Analytics, Monitoring und Operations

## Übersicht

SitePitch verwendet drei getrennte Ebenen für Analytics, Fehler-Monitoring und Support-Sichtbarkeit.

| Ebene | Zweck | System |
|---|---|---|
| Produktanalyse | Anonyme Nutzungstrends, Funnel, UI-Interaktionen | Selbst gehostetes Rybbit |
| Operative Telemetrie | Verlässliche Audit-, Provider-, Credit- und Kostenwerte | Convex (usageEvents, providerCalls, providerCosts) |
| Support und Fehleranalyse | Sichere Einsicht und auditable Eingriffe | Convex Admin-Oberfläche |

---

## 1. Rybbit (Produktanalyse)

### Hosting

Rybbit wird selbst gehostet unter `https://rybbit.matthias.lol`.

### Integration

- Das Tracking-Script wird über Next.js Rewrites von der eigenen Domain geladen (`/analytics/script.js`, `/analytics/track`), um Ad-Blocker zu umgehen.
- Das Script wird im Root-Layout (`app/layout.tsx`) via `next/script` mit `strategy="afterInteractive"` geladen.
- Wenn `NEXT_PUBLIC_RYBBIT_SITE_ID` nicht gesetzt ist, wird kein Script geladen.

### Umgebungsvariablen

| Variable | Beschreibung |
|---|---|
| `NEXT_PUBLIC_RYBBIT_HOST` | Basis-URL der Rybbit-Instanz (z. B. `https://rybbit.matthias.lol`) |
| `NEXT_PUBLIC_RYBBIT_SITE_ID` | Site-ID aus der Rybbit-Konfiguration; leer = deaktiviert |

### Datenschutz

- Rybbit verwendet **keine Cookies**.
- Rybbit identifiziert Nutzer über einen IP+UA-Hash, nicht über persistenten `localStorage`.
- Es wird **kein** `window.rybbit.identify()` aufgerufen.
- Es werden **keine** E-Mail-Adressen, Namen, URLs, Domains, Audit-IDs, Workspace-IDs oder Rohfehler an Rybbit übermittelt.
- Erlaubte Properties: `audit_type`, `report_language`, `draft_type`, `source`, `provider`, `failure_code`, `plan`, `result_count`.

### Event-Katalog

| Rybbit-Event | Auslöser | Properties |
|---|---|---|
| `signed_up` | Registrierung erfolgreich | keine |
| `branding_completed` | Branding erstmals vollständig gespeichert | `report_language` |
| `lead_search_started` | Lead-Suche gestartet | `provider` |
| `lead_saved` | Neuer Lead gespeichert | `source` |
| `audit_started` | Audit erfolgreich eingereiht | `audit_type`, `report_language` |
| `audit_completed` | Audit abgeschlossen | `audit_type` |
| `audit_failed` | Audit fehlgeschlagen | `failure_code` |
| `report_opened` | Öffentlicher Report wird sichtbar | `source` |
| `public_link_copied` | Öffentlichen Link kopiert | `source` |
| `outreach_copied` | Outreach-Text kopiert | `draft_type` |
| `pdf_exported` | PDF-/Druck-Export | `source` |
| `credits_exhausted` | Audit wegen fehlender Credits abgelehnt | `plan` |
| `upgrade_clicked` | Upgrade-CTA geklickt | `plan` |
| `checkout_started` | Checkout gestartet (sobald Billing verfügbar) | `plan` |
| `subscription_started` | Subscription aktiv (sobald Billing verfügbar) | `plan` |

### Adapter

Der zentrale Adapter in `src/lib/analytics.ts` (`trackRybbitEvent`) sorgt dafür, dass:
- das Script nicht geladen wurde → kein Fehler.
- das Script blockiert wurde → kein Fehler.
- nur String- und Number-Properties gesendet werden.
- Booleans in `"true"`/`"false"` umgewandelt werden.
- `undefined`/`null`/Objekte/Arrays entfernt werden.

---

## 2. Operative Telemetrie (Convex)

Convex bleibt die autoritative Quelle für alle auditierbaren und betriebskritischen Metriken.

### usageEvents

Ereignistypen: `signed_up`, `workspace_created`, `branding_completed`, `lead_search_started`, `lead_saved`, `audit_started`, `audit_completed`, `audit_failed`, `first_shared_report`, `report_opened`, `report_reopened`, `report_cta_clicked`, `outreach_copied`, `public_link_copied`, `pdf_exported`, `credits_consumed`, `credits_exhausted`, `upgrade_clicked`, `checkout_started`, `subscription_started`.

Einmalige Server-Meilensteine sind über `idempotencyKey` oder dedizierte Index-Prüfungen idempotent. Interaktionsereignisse wie Outreach-/Link-Kopien und Report-Aktionen sind bewusst append-only, können mehrfach vorkommen und werden bei der Auswertung nach Workspace bzw. Audit dedupliziert; öffentliche Aktionen sind zusätzlich rate-limitiert.

### Aktivierungsereignisse und Source of Truth

Die Aktivierungs-Checkliste und der globale Funnel verwenden ausschließlich serverseitig gespeicherte Convex-Ereignisse. Rybbit, Workspace-`updatedAt`, der aktuelle Kalendermonat und der momentane `isPublic`-Wert sind dafür keine Quelle.

| Meilenstein | Server-Auslöser | Semantik |
|---|---|---|
| `signed_up` | Workspace wird angelegt bzw. idempotent initialisiert | Workspace-Start; bleibt Funnel-Schritt, zählt aber nicht zu den vier Checklistenschritten |
| `branding_completed` | Branding wird erstmals vollständig gespeichert | erster vollständiger Branding-Zustand |
| `audit_completed` | Audit-Pipeline schließt erfolgreich ab | erster abgeschlossener Audit des Workspace |
| `outreach_copied` | Nutzer kopiert einen Outreach-Entwurf | unabhängig davon, ob bereits ein Report geteilt wurde |
| `first_shared_report` | Nutzer kopiert erstmals erfolgreich einen öffentlichen Report-Link | idempotenter Workspace-Meilenstein ohne Audit-Bezug; entsteht in derselben Transaktion wie die erste Link-Kopie |
| `public_link_copied` | Link eines öffentlichen Reports wird kopiert | Basis für die Open-Rate-Stichprobe; kann mehrfach vorkommen und behält den Audit-Bezug |

Das Veröffentlichen allein erfüllt den Share-Meilenstein nicht. Wiederholtes Kopieren – auch nach Deaktivieren und erneutem Veröffentlichen – erzeugt keinen zweiten `first_shared_report`-Meilenstein. Legacy-Daten werden über `backfillSignedUpEvents` ergänzt; die Migration ist operativ separat auszuführen und wird durch diese Dokumentation nicht als bereits gelaufen dargestellt.

### Report geöffnet und erneut geöffnet

`recordPublicReportView` ist die serverseitige Quelle für Views. Der erste akzeptierte View eines Audits schreibt `report_opened`; jeder weitere akzeptierte View schreibt `report_reopened`. Rate Limits und die browserseitige Session-Deduplizierung reduzieren Reload-Rauschen. Öffentliche Report-Seiten tracken normale Views, CTA-Klicks, PDF-Exporte und Rybbit-Seitenaufrufe immer; Query-Parameter können Telemetrie nicht deaktivieren. Interne Report-Vorschau erfolgt ausschließlich im Report-Tab der Audit-Detailansicht und navigiert nicht auf die öffentliche Route. `/examples/*` wird als vollständiges statisches HTML-Dokument von einem providerfreien Route Handler ausgeliefert und läuft damit außerhalb von React Root Layout, Auth-/Convex-Providern und dem Rybbit-Script-Pfad. Beispielnavigation aus der App verwendet bewusst normale `<a href>`-Links für einen vollständigen Dokumentwechsel; der Route Handler selbst führt keine Convex-Query oder -Mutation aus.

Während des Legacy-Backfills sind `reportViews` die autoritative View-Quelle. Eine `reportViewStats`-Zeile mit `viewAggregationState: "pending"` darf Action-Aggregate enthalten, ihre View-Zähler werden von Readern aber noch nicht als vollständig behandelt. Neue View-Zeilen werden atomar mit `includedInStats: true` geschrieben. Der resumierbare Backfill markiert jede Legacy-Zeile in derselben Transaktion wie ihre Aggregation; erst der Finalizer setzt den Audit auf `accurate`.

### Funnel und Raten

`activation.getActivationFunnel` ist nur über den bestehenden Support-Admin-Allowlist-Mechanismus erreichbar. Normale Workspace-Owner können ausschließlich ihren eigenen Aktivierungsstatus lesen.

- Funnel: `Signup → Branding → First Audit → Outreach Copied → First Shared Report`. Gezählt werden eindeutige Workspaces anhand ihres jeweils ersten Ereignis-Zeitpunkts. Ein späterer Schritt zählt nur, wenn sein Zeitstempel mindestens dem vorherigen Schritt entspricht. Der letzte Schritt ist ausschließlich die erste erfolgreiche öffentliche Link-Kopie.
- 24h-First-Share-Rate: Nenner sind eindeutige Workspaces mit `signed_up` im gewählten Fenster. Zähler sind diese Workspaces, deren erster Share zwischen Signup und einschließlich `signup + 24h` liegt.
- Shared-Report-Open-Rate: Nenner sind eindeutige Audit-IDs mit `public_link_copied` im Fenster. Zähler sind diese Audits mit mindestens einem externen View. Vor Abschluss des Stats-Backfills wird dafür auf Legacy-Views zurückgefallen; erst `accurate`-Aggregate sind autoritativ. Mehrfaches Link-Kopieren desselben Audits erhöht den Nenner nicht.
- Bei Nenner 0 ist `rate: null`; es wird keine künstliche Division oder Prozentzahl geliefert.

Das Abfragefenster ist auf 90 Tage begrenzt. Pro Ereignistyp werden höchstens 1.000 Zeilen ausgewertet. Sobald eine Quelle darüber liegt, liefert die Antwort `truncated: true`; Dashboards und Exporte müssen dann die Kennzahl als unvollständig markieren oder ein kleineres Fenster abfragen.

### providerCalls

Jeder externe Provider-Aufruf wird mit Status, Latenz, Retry-Zahl, Fehlercode und bereinigter Fehlermeldung protokolliert. Sensitive Daten werden vor Speicherung redigiert.

### providerCosts

Append-only Tabelle für geschätzte und tatsächliche Kosten pro Provider-Aufruf.

### adminActions

Append-only Audit-Trail für alle Support-Aktionen (Credit-Anpassung, Report-Deaktivierung, Audit-Re-Run).

---

## 3. Fehler-Monitoring und Sentry

Sentry ist aktuell **nicht** installiert. Die Fehlerbehandlung wurde jedoch vorbereitet:

- Alle Fehler werden über `sanitizeError()` in `convex/lib/telemetry_safety.ts` bereinigt.
- Die Funktion entfernt: API-Keys, Bearer-Tokens, Cookies, Authorization-Header, E-Mail-Adressen, Query-Parameter, Response-Bodies und kürzt Fehlermeldungen auf 500 Zeichen.
- Eine spätere Sentry-Integration darf nur den bereinigten `SafeTelemetryError`-Typ senden.
- Tags: `provider`, `operation`, `errorCode`, `auditId` (opaque), `workspaceId` (opaque).
- Keine Session-Replays, keine Request-Bodies, keine personenbezogenen Daten.

---

## 4. Support-Zugang

### Konfiguration

| Variable | Beschreibung |
|---|---|
| `SUPPORT_ADMIN_EMAILS` | Komma-separierte Liste der berechtigten E-Mail-Adressen (nur Server-seitig) |

Eine leere Liste bedeutet: kein Support-Zugang für niemanden.

### Route

`/app/admin/operations` – nur sichtbar für berechtigte Accounts.

### Funktionen

- KPI-Übersicht: Completion-Rate, Failure-Rate, Dauer, Kosten, Outreach-Copy-Rate, Report-Views.
- Provider-Failure-Raten nach Provider.
- Liste fehlgeschlagener Audits mit Domain, Workspace und Fehlercode.
- Audit-Trace mit Pipeline-Status, Provider-Calls, Agent-Runs und Credit-Ledger.
- Credit-Status pro Workspace.
- Support-Aktionen: Credits anpassen, Public Report deaktivieren, Audit Re-Run.
- Jede Aktion erfordert einen Grund und wird in `adminActions` protokolliert.

### Support-Runbook

1. **Fehlgeschlagenen Audit finden**: Liste unter "Failed Audits" prüfen.
2. **Trace lesen**: "Details" klicken, um Pipeline-Status, Provider-Calls und Fehlermeldungen zu sehen.
3. **Credits anpassen**: Betrag eingeben, Grund angeben, "Anpassen" klicken.
4. **Report deaktivieren**: Grund angeben, "Report Deaktivieren" klicken.
5. **Audit erneut starten**: Nur für `failed` Audits. Grund angeben, "Audit Re-Run" klicken. Es wird ein neuer Audit erstellt, der alte bleibt als historischer Trace erhalten.

---

## 5. Datenretention

| Datentyp | Retention |
|---|---|
| reportViews (IP/UA-Hashes) | 30 Tage |
| providerCalls | 30 Tage |
| usageEvents | 24 Monate |
| providerCosts | 24 Monate |
| adminActions | 24 Monate |
| Audit-Reports, Scores, Findings | bis Nutzer löscht |

Die Retention wird über tägliche Cron-Jobs in `convex/crons.ts` in gebatchten Löschmutationen ausgeführt. Noch nicht aggregierte Legacy-Views werden bis zum verifizierten Stats-Backfill nicht gelöscht.

Aktivierungs- und Funnel-Auswertungen enthalten nur opaque Workspace-/Audit-Bezüge und aggregierte Zähler; sie geben keine Domains, Namen oder E-Mail-Adressen zurück. Nach Ablauf der 24-monatigen `usageEvents`-Retention können historische Funnel-Fenster nicht rekonstruiert werden. Die Open-Rate liest den langlebigen Aggregatwert `reportViewStats.totalViews`, nicht die nach 30 Tagen gelöschten einzelnen IP-/UA-Hashes.

## 6. Rollout, Migration und Rollback

Die folgenden Befehle sind ein Runbook; diese Dokumentation behauptet **nicht**, dass eine Migration ausgeführt wurde. In Produktion erhält jeder `npx convex run`-Befehl zusätzlich `--prod`.

1. **Widen-Deploy:** Schema, Indizes und duale Reader/Writer deployen. Vorher keine Migration starten.
2. **Lead-Status:** `npx convex run migrations:canonicalizeLeadStatuses '{"dryRun":true}'`, Ergebnis prüfen, danach `npx convex run migrations:canonicalizeLeadStatuses`. Mit `npx convex run --component migrations lib:getStatus --watch` bis zum Abschluss beobachten und verifizieren, dass keine Leads mit `not_interested` verbleiben. **Release Gate:** Erst danach darf ein separater Narrow-Deploy den Legacy-Validator entfernen.
3. **Signup-Meilensteine:** `npx convex run migrations:backfillSignedUpEvents '{"dryRun":true}'`, danach `npx convex run migrations:backfillSignedUpEvents`, Status bis Abschluss beobachten und stichprobenartig genau ein `signed_up`-Event pro Legacy-Workspace mit `createdAt === workspace.createdAt` prüfen.
4. **Public-CTA-Snapshots:** `npx convex run migrations:backfillPublicReportCtaSnapshots '{"dryRun":true}'`, danach `npx convex run migrations:backfillPublicReportCtaSnapshots`, Status beobachten und prüfen, dass veröffentlichte Reports einen stabilen `reportCtaSnapshottedAt` besitzen.
5. **Legacy-View-Aggregate:** `npx convex run migrations:backfillLegacyReportViewStats '{"dryRun":true}'`, danach `npx convex run migrations:backfillLegacyReportViewStats` und bis zum vollständigen Status warten. Anschließend `npx convex run migrations:finalizeLegacyReportViewStats '{"dryRun":true}'`, danach `npx convex run migrations:finalizeLegacyReportViewStats` und erneut den Status beobachten.
6. **Stats-Verifikation:** `npx convex run migrations:verifyLegacyReportViewStats`. Nur `complete: true` ohne Sample-IDs besteht das Gate. Stichproben müssen exakte Anzahl, ersten/letzten View, `reopenCount = max(totalViews - 1, 0)` sowie unveränderte CTA-/PDF-Aggregate zeigen. Ein Reset oder erneuter Lauf darf die Zahlen nicht erhöhen.
7. **Aggregate Release Gate:** Erst nach erfolgreicher Verifikation dürfen Funnel, Dashboard, Inbox und Kampagnen die neuen Stats als vollständig betrachten. Bis dahin bleiben die dualen Reader und die 100/100+-Legacy-Anzeige aktiv. Aktivierungsstatus mit einem Test-Workspace und Admin-Funnel mit kleinem Zeitfenster prüfen; `truncated` explizit überwachen.

Rollback/Disable: Die Dashboard-Query kann auf Deployment-Ebene auf die vorherige UI zurückgerollt werden; die Admin-Funnel-Abfrage wird durch Entfernen des UI-Aufrufs bzw. Leeren von `SUPPORT_ADMIN_EMAILS` effektiv deaktiviert. Neue Events und der zusätzliche Index sind rückwärtskompatibel und sollten bei einem UI-Rollback zunächst erhalten bleiben. Keine Usage-Events löschen, solange Metrik- oder Compliance-Prüfungen laufen.
