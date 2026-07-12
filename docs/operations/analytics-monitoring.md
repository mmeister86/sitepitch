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
| `first_shared_report` | ein zuvor nicht öffentlicher, abgeschlossener Report wird erstmals veröffentlicht | idempotenter Workspace-Meilenstein; entsteht beim Publish, nicht erst beim Kopieren des Links |
| `public_link_copied` | Link eines öffentlichen Reports wird kopiert | Basis für die Open-Rate-Stichprobe; kann nach dem Publish mehrfach vorkommen |

Ein deaktivierter und später erneut veröffentlichter Report erzeugt keinen zweiten `first_shared_report`-Meilenstein. Legacy-Daten werden über `backfillSignedUpEvents` ergänzt; die Migration ist operativ separat auszuführen und wird durch diese Dokumentation nicht als bereits gelaufen dargestellt.

### Report geöffnet und erneut geöffnet

`recordPublicReportView` ist die serverseitige Quelle für Views. Der erste akzeptierte View eines Audits erhöht `reportViewStats.totalViews` auf 1 und schreibt `report_opened`; jeder weitere akzeptierte View schreibt `report_reopened` und erhöht den Reopen-Zähler. Rate Limits und die browserseitige Session-Deduplizierung reduzieren Reload-Rauschen. `?preview=1` löst weder die View-Mutation noch Rybbit-Events, CTA-Events oder PDF-Events aus. `/examples/*` wird als vollständiges statisches HTML-Dokument von einem providerfreien Route Handler ausgeliefert und läuft damit außerhalb von React Root Layout, Auth-/Convex-Providern und dem Rybbit-Script-Pfad. Beispielnavigation aus der App verwendet bewusst normale `<a href>`-Links für einen vollständigen Dokumentwechsel; der Route Handler selbst führt keine Convex-Query oder -Mutation aus.

### Funnel und Raten

`activation.getActivationFunnel` ist nur über den bestehenden Support-Admin-Allowlist-Mechanismus erreichbar. Normale Workspace-Owner können ausschließlich ihren eigenen Aktivierungsstatus lesen.

- Funnel: `Signup → Branding → First Audit → Outreach Copied → First Shared Report`. Gezählt werden eindeutige Workspaces anhand ihres jeweils ersten Ereignis-Zeitpunkts. Ein späterer Schritt zählt nur, wenn sein Zeitstempel mindestens dem vorherigen Schritt entspricht. Deshalb kann ein vor Outreach geteilter Report in der Checkliste als erreicht gelten, zählt im sequentiellen Funnel aber nicht als letzter Schritt.
- 24h-First-Share-Rate: Nenner sind eindeutige Workspaces mit `signed_up` im gewählten Fenster. Zähler sind diese Workspaces, deren erster Share zwischen Signup und einschließlich `signup + 24h` liegt.
- Shared-Report-Open-Rate: Nenner sind eindeutige Audit-IDs mit `public_link_copied` im Fenster. Zähler sind diese Audits mit `reportViewStats.totalViews > 0`. Mehrfaches Link-Kopieren desselben Audits erhöht den Nenner nicht.
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

Die Retention wird über tägliche Cron-Jobs in `convex/crons.ts` in gebatchten Löschmutationen ausgeführt.

Aktivierungs- und Funnel-Auswertungen enthalten nur opaque Workspace-/Audit-Bezüge und aggregierte Zähler; sie geben keine Domains, Namen oder E-Mail-Adressen zurück. Nach Ablauf der 24-monatigen `usageEvents`-Retention können historische Funnel-Fenster nicht rekonstruiert werden. Die Open-Rate liest den langlebigen Aggregatwert `reportViewStats.totalViews`, nicht die nach 30 Tagen gelöschten einzelnen IP-/UA-Hashes.

## 6. Rollout, Migration und Rollback

1. Schema und Code deployen, damit der neue zusammengesetzte Usage-Event-Index verfügbar ist.
2. Migration zuerst als Dry-Run prüfen: `npx convex run migrations:backfillSignedUpEvents '{"dryRun": true}'` (für Produktion zusätzlich `--prod`).
3. Erst nach Prüfung mit `npx convex run migrations:backfillSignedUpEvents` (Produktion: `--prod`) starten und den Status mit `npx convex run --component migrations lib:getStatus --watch` beobachten. Diese Schritte sind hier nur beschrieben; es wird nicht behauptet, dass sie ausgeführt wurden.
4. Aktivierungsstatus mit einem Test-Workspace und Admin-Funnel mit einem kleinen Zeitfenster prüfen; `truncated` explizit überwachen.

Rollback/Disable: Die Dashboard-Query kann auf Deployment-Ebene auf die vorherige UI zurückgerollt werden; die Admin-Funnel-Abfrage wird durch Entfernen des UI-Aufrufs bzw. Leeren von `SUPPORT_ADMIN_EMAILS` effektiv deaktiviert. Neue Events und der zusätzliche Index sind rückwärtskompatibel und sollten bei einem UI-Rollback zunächst erhalten bleiben. Keine Usage-Events löschen, solange Metrik- oder Compliance-Prüfungen laufen.
