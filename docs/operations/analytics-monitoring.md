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

Ereignistypen: `signed_up`, `workspace_created`, `branding_completed`, `lead_search_started`, `lead_saved`, `audit_started`, `audit_completed`, `audit_failed`, `report_opened`, `report_cta_clicked`, `outreach_copied`, `public_link_copied`, `pdf_exported`, `credits_consumed`, `credits_exhausted`, `upgrade_clicked`, `checkout_started`, `subscription_started`.

Jedes Ereignis ist idempotent über `idempotencyKey` oder dedizierte Index-Prüfungen.

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
