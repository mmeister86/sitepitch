# PRD.md — SitePitch

**Produktname:** SitePitch  
**Domain:** trysitepitch.com  
**Arbeitstitel / bisheriger Name:** Pitchfast  
**Dokumenttyp:** Product Requirements Document  
**Version:** 1.0  
**Stand:** 2026-06-16  
**Owner:** Matthias  
**Primäre Zielgruppe:** Webdesigner, Webflow-/WordPress-Freelancer, kleine Webagenturen und Local-SEO-Anbieter  
**MVP-Ziel:** Innerhalb von ca. 2 Wochen ein verkaufbares Micro-SaaS bauen, das aus potenziellen Kundenwebsites gebrandete Website-Audits und Outreach-Texte erzeugt.

---

## 1. Executive Summary

SitePitch ist ein Sales-Enablement-Tool für Webdesigner und kleine Agenturen. Das Produkt hilft ihnen, potenzielle Kunden nicht mit generischen Cold-Outreach-Nachrichten anzusprechen, sondern mit einem konkreten, öffentlich nachvollziehbaren Website-Audit.

Der Nutzer gibt entweder eine einzelne Website-URL ein oder sucht nach lokalen Unternehmen über Branche + Stadt. SitePitch analysiert die Website anhand öffentlich zugänglicher Daten, erstellt einen verständlichen Audit-Report mit Stärken, Schwächen, konkreten Chancen und einem Gesamtscore und generiert anschließend Outreach-Texte für E-Mail, LinkedIn, Kontaktformular oder Telefonnotiz.

Der Kernnutzen ist nicht „Website analysieren“, sondern:

> **Aus einer verbesserungswürdigen Website einen konkreten Gesprächsanlass machen.**

SitePitch soll in der ersten Version bewusst klein und fokussiert bleiben: keine vollständige CRM-Suite, keine Massen-E-Mail-Automation, kein laufendes Monitoring und kein komplexes Rank-Tracking. Der MVP soll einen klaren Workflow hervorragend lösen:

```text
Lead finden → Website auditieren → gebrandeten Report teilen → besseren Gesprächseinstieg nutzen
```

---

## 2. Problem

Webdesigner und kleine Agenturen haben häufig Schwierigkeiten, neue Kunden zu gewinnen. Klassische Kaltakquise klingt austauschbar:

```text
Hallo, ich bin Webdesigner. Brauchen Sie eine neue Website?
```

Diese Ansprache ist schwach, weil sie keinen konkreten Anlass liefert. Potenzielle Kunden sehen oft keinen akuten Bedarf, auch wenn ihre Website objektiv Schwächen hat: schlechte mobile Darstellung, fehlende lokale Suchmaschinenoptimierung, unklare Kontaktwege, langsame Ladezeiten, veraltetes Design oder wenig Vertrauen durch fehlende Referenzen.

Viele Webdesigner könnten bessere Akquise betreiben, wenn sie vor dem Erstkontakt schnell einen individuellen Audit hätten. Manuell dauert ein solcher Audit aber zu lange. Außerdem ist es schwierig, technische Website-Probleme so zu formulieren, dass lokale Unternehmer sie verstehen.

### Kernproblem

Webdesigner brauchen einen schnellen Weg, um aus öffentlich sichtbaren Website-Schwächen einen glaubwürdigen, freundlichen und konkreten Gesprächseinstieg zu erzeugen.

---

## 3. Zielgruppe

### 3.1 Primäre Zielgruppe

**Solo-Webdesigner und kleine Webagenturen**, die lokale Dienstleister, Handwerker, Praxen, Restaurants, Coaches, Kanzleien oder kleine Unternehmen als Kunden gewinnen möchten.

Typische Merkmale:

- 1–10 Personen
- verkaufen Websites, Relaunches, Wartung, SEO-Basispakete oder Conversion-Optimierung
- akquirieren über LinkedIn, E-Mail, Telefon, lokale Netzwerke oder manuelle Recherche
- haben wenig Zeit für individuelle Vorab-Audits
- brauchen konkrete Gesprächsanlässe
- sind bereit, für ein Tool zu zahlen, wenn ein einziger gewonnener Kunde die Kosten mehrfach deckt

### 3.2 Sekundäre Zielgruppen

- Local-SEO-Freelancer
- WordPress-Wartungsanbieter
- Webflow-Freelancer
- Agenturen mit outbound-lastigem Vertrieb
- SaaS-/Marketingberater, die lokale Unternehmen beraten
- Template-Verkäufer oder Website-as-a-Service-Anbieter

### 3.3 Nicht-Zielgruppen für den MVP

- Enterprise-Agenturen mit eigenem Sales-Tech-Stack
- große SEO-Agenturen mit komplexem Rank-Tracking-Bedarf
- reine E-Mail-Outreach-Agenturen
- Nutzer, die Massen-Spam automatisieren wollen
- Unternehmen, die ihre eigene Website auditieren wollen, aber keine Webdesign-Leads gewinnen möchten

---

## 4. Positionierung

### 4.1 Kurzpositionierung

> **SitePitch erstellt gebrandete Website-Audits für Webdesigner, damit sie potenzielle Kunden mit konkreten Verbesserungsvorschlägen statt generischen Kaltakquise-Nachrichten ansprechen können.**

### 4.2 One-Liner

Deutsch:

> **Erstelle Website-Audits, die Kundengespräche starten.**

Englisch:

> **Turn weak websites into warm outreach.**

### 4.3 Hero-Copy

```text
Finde Website-Schwächen. Erstelle gebrandete Audits. Starte bessere Kundengespräche.

SitePitch analysiert potenzielle Kunden-Websites und generiert daraus verständliche Audit-Reports, konkrete Verbesserungschancen und Outreach-Texte für Webdesigner.
```

### 4.4 Nutzenversprechen

Für Webdesigner:

- bessere Gesprächseinstiege
- weniger generischer Cold Outreach
- schnellerer Vorab-Audit
- professioneller Eindruck durch gebrandete Reports
- konkrete Argumente für Relaunch, Optimierung oder Wartungsvertrag
- strukturierter Akquiseprozess

Für potenzielle Endkunden:

- verständlicher Überblick über Website-Stärken und -Schwächen
- konkrete Verbesserungsvorschläge
- keine rein technische Fachsprache
- freundlicher Ton ohne Bloßstellung

---

## 5. Produktziele

### 5.1 Business-Ziele

1. Innerhalb von 2 Wochen MVP launchen.
2. Innerhalb von 30 Tagen erste zahlende Nutzer gewinnen.
3. Ein klares Credit-basiertes Pricing validieren.
4. Eine saubere MRR-/Usage-Struktur aufbauen, damit das Produkt später marketplace-tauglich ist.
5. Den Nutzen auf einen Satz reduzieren können: „Webdesigner gewinnen bessere Gespräche durch individuelle Website-Audits.“

### 5.2 Produktziele

1. Nutzer kann in unter 3 Minuten einen Website-Audit starten.
2. Nutzer erhält einen präsentablen, öffentlichen Audit-Link.
3. Nutzer erhält konkrete Outreach-Texte.
4. Audit-Reports sind verständlich, freundlich und verkaufsfähig.
5. Das System speichert Nutzung, Credits, Kosten und Status sauber.
6. Das Produkt funktioniert auch ohne Lead-Suche durch manuelle URL-Eingabe.

### 5.3 Technische Ziele

1. Stabile Job-Pipeline statt langer synchroner Requests.
2. Trennung zwischen Produkt-App und Audit-Engine.
3. Anbieter für Business Data, Screenshots und Content Extraction austauschbar halten.
4. Kosten pro Audit messbar machen.
5. Deterministische Checks und KI-Auswertung sauber trennen.
6. DSGVO-freundliche Datenminimierung und Löschlogik vorbereiten.

---

## 6. Nicht-Ziele

Diese Dinge gehören ausdrücklich nicht in den MVP:

- vollständiges CRM
- automatisierter Massen-E-Mail-Versand
- Inbox-/Reply-Management
- komplexes Rank-Tracking
- laufendes Website-Monitoring
- Team- und Rollenverwaltung auf Enterprise-Niveau
- White-Label Custom Domains
- Browser Extension
- tiefer Crawl mit hunderten Unterseiten
- automatisches Umgehen von Bot-Protection
- Scraping hinter Login
- automatische Bewertung rechtlicher Vollständigkeit von Impressum/Datenschutz als Rechtsberatung
- vollständige Barrierefreiheitsprüfung nach WCAG
- vollständiger Security-Scan
- vollautomatische Lead-Anreicherung mit personenbezogenen Daten

---

## 7. MVP-Scope

### 7.1 Muss enthalten sein

| Bereich | Funktion | Priorität |
|---|---|---|
| Auth | Registrierung/Login | P0 |
| Workspace | Nutzer hat einen Workspace | P0 |
| Audit | Einzelne URL auditieren | P0 |
| Audit Status | Fortschritt live anzeigen | P0 |
| Report | Öffentliche Report-Seite mit Share-Link | P0 |
| Scoring | Gesamtscore und Kategorie-Scores | P0 |
| Findings | Stärken, Schwächen, Chancen | P0 |
| Outreach | E-Mail-, LinkedIn-/Kontaktformular- und Telefonnotiz generieren | P0 |
| Branding | Agenturname, Logo, Akzentfarbe im Report | P0 |
| Credits | Audits verbrauchen Credits | P0 |
| Billing | Paid Plan oder Credit-Paket | P0 |
| Rate Limiting | Schutz für Audit-Erstellung | P0 |
| Analytics | Kern-Events tracken | P0 |
| Error Handling | fehlgeschlagene Audits sichtbar machen | P0 |

### 7.2 Sollte enthalten sein

| Bereich | Funktion | Priorität |
|---|---|---|
| Lead Search | Stadt + Branche → lokale Unternehmen finden | P1 |
| Lead-Liste | Leads speichern und Audit starten | P1 |
| PDF | Report druckbar / als PDF speicherbar | P1 |
| Report Views | Anzahl Report-Aufrufe messen | P1 |
| Demo Audit | öffentlicher Demo-Flow ohne Account | P1 |
| CSV Export | Leads/Audits exportieren | P1 |
| Mehrsprachigkeit | Report-Sprache Deutsch/Englisch | P1 |

### 7.3 Später

| Bereich | Funktion | Priorität |
|---|---|---|
| CRM | Pipeline-Status, Follow-ups, Notizen | P2 |
| Integrationen | HubSpot, Pipedrive, Gmail Drafts | P2 |
| Custom Domain | White-Label Reports auf eigener Domain | P2 |
| Monitoring | Re-Audit nach 30 Tagen | P2 |
| Batch Audits | 50+ Websites in einem Lauf | P2 |
| API | Public API für Agenturen | P3 |
| Browser Extension | Audit direkt aus Browser starten | P3 |

---

## 8. User Personas

### 8.1 Persona A: Solo-Webdesigner

**Name:** Felix  
**Alter:** 32  
**Tätigkeit:** WordPress-/Webflow-Freelancer  
**Problem:** Er will lokale Unternehmen akquirieren, aber seine Kaltakquise wirkt generisch.  
**Ziel:** Er möchte jedem potenziellen Kunden einen konkreten Anlass schicken.  
**Erfolg:** Er generiert 20 Audits, kontaktiert 20 Unternehmen und bekommt 2–3 Rückmeldungen.

### 8.2 Persona B: Kleine Webagentur

**Name:** Laura  
**Alter:** 39  
**Tätigkeit:** Inhaberin einer 4-Personen-Agentur  
**Problem:** Ihr Team braucht systematischeres Outbound-Material.  
**Ziel:** Praktikant oder Junior kann Leads recherchieren, SitePitch erstellt Reports und Outreach-Vorschläge.  
**Erfolg:** Die Agentur gewinnt aus 100 Audits 3 Erstgespräche.

### 8.3 Persona C: Local-SEO-Berater

**Name:** Cem  
**Alter:** 36  
**Tätigkeit:** SEO-Freelancer für lokale Unternehmen  
**Problem:** Er braucht schnelle Vorab-Analysen für Friseure, Praxen und Handwerker.  
**Ziel:** Er möchte Local-SEO-Schwächen in verständliche Chancen übersetzen.  
**Erfolg:** Er nutzt Reports als Lead-Magnet und verkauft monatliche SEO-Basispakete.

---

## 9. Kern-User-Flows

### 9.1 Flow 1: Erster Audit per URL

```text
User registriert sich
    ↓
User gibt Website-URL ein
    ↓
System validiert URL
    ↓
System erstellt Audit-Job
    ↓
UI zeigt Fortschritt
    ↓
System sammelt Website-Daten
    ↓
System erstellt Scores und Findings
    ↓
System generiert Outreach-Texte
    ↓
User sieht Audit-Report
    ↓
User kopiert Outreach-Text oder teilt Report-Link
```

### 9.2 Flow 2: Lead Search → Audit

```text
User gibt Stadt + Branche ein
    ↓
System ruft Business-Data-Provider auf
    ↓
User sieht Liste potenzieller Unternehmen
    ↓
User wählt einen Lead aus
    ↓
User startet Audit
    ↓
Report und Outreach werden erzeugt
```

### 9.3 Flow 3: Gebrandeter Report

```text
User hinterlegt Agenturname, Logo und Akzentfarbe
    ↓
User erstellt Audit
    ↓
Report zeigt Branding des Users
    ↓
Public Report URL kann im Outreach verwendet werden
```

### 9.4 Flow 4: Credit-Limit

```text
User startet Audit
    ↓
System prüft Credit-Guthaben
    ↓
Falls genug Credits: Audit startet
    ↓
Falls keine Credits: Upgrade/Buy Credits CTA
```

### 9.5 Flow 5: Fehlgeschlagener Audit

```text
Audit startet
    ↓
Provider timeout / Website blockiert / Screenshot schlägt fehl
    ↓
System speichert partiellen Status
    ↓
User sieht verständliche Fehlermeldung
    ↓
User kann Audit erneut versuchen oder URL prüfen
```

---

## 10. Funktionale Anforderungen

## 10.1 Auth und Account

### Anforderungen

- Nutzer können sich registrieren und einloggen.
- MVP-Auth bevorzugt über Clerk.
- Alternativ: Better Auth, falls mehr Ownership gewünscht ist.
- Jeder Nutzer bekommt automatisch einen Workspace.
- Später sollen mehrere Nutzer pro Workspace möglich sein, aber nicht im MVP zwingend.

### Akzeptanzkriterien

- User kann Account erstellen.
- User kann sich einloggen und ausloggen.
- Convex-Funktionen erkennen den authentifizierten User.
- Jeder Audit ist einem Workspace zugeordnet.
- Unauthentifizierte Nutzer können keine bezahlten Audits erstellen.

---

## 10.2 Workspace und Branding

### Anforderungen

Nutzer können für ihren Workspace folgende Angaben hinterlegen:

- Agentur-/Freelancername
- Logo
- Akzentfarbe
- Website
- Kontakt-E-Mail
- CTA-Text
- CTA-Link
- Report-Sprache: Deutsch oder Englisch

### Akzeptanzkriterien

- Branding erscheint auf Audit-Reports.
- Reports funktionieren auch ohne Logo.
- Akzentfarbe darf Report nicht unlesbar machen.
- CTA-Link wird validiert.
- Report-Sprache beeinflusst Summary, Findings und Outreach-Texte.

---

## 10.3 Audit-Erstellung per URL

### Anforderungen

Der Nutzer kann eine öffentlich erreichbare Website-URL eingeben.

Das System soll:

1. URL normalisieren.
2. Protokoll ergänzen, falls nötig.
3. Domain validieren.
4. offensichtliche lokale/private URLs blockieren.
5. Credit-Verfügbarkeit prüfen.
6. Audit-Job erstellen.
7. Status in Echtzeit anzeigen.

### URL-Regeln

Akzeptiert:

```text
https://example.com
example.com
www.example.com
https://www.example.com/leistungen
```

Abgelehnt:

```text
localhost
127.0.0.1
10.x.x.x
192.168.x.x
interne IPs
file://
javascript:
ungültige URLs
```

### Akzeptanzkriterien

- Ungültige URL erzeugt klare Fehlermeldung.
- Gültige URL startet Audit-Job.
- Der Nutzer sieht den Job-Status.
- Credits werden nicht endgültig verbraucht, wenn die URL schon vor Start ungültig ist.
- Bei technischem Fehler wird der Audit als `failed` markiert.

---

## 10.4 Lead Search

### Anforderungen

Nutzer können lokale Unternehmen suchen über:

- Branche
- Stadt
- Land
- optional Keyword
- optional Radius

Beispiel:

```text
Branche: Zahnarzt
Stadt: Leipzig
Land: Deutschland
```

Das System ruft einen Business-Data-Provider auf und speichert Leads mit:

- Unternehmensname
- Website
- Kategorie
- Adresse
- Telefonnummer, falls verfügbar
- Business-Data-Provider
- Provider-ID
- Quelle
- Erstellungszeitpunkt

### Akzeptanzkriterien

- Nutzer kann Suche starten.
- Suche kostet optional Credits oder ist pro Plan limitiert.
- Ergebnisse ohne Website werden markiert, aber für Audits deaktiviert.
- Nutzer kann einen Lead speichern.
- Nutzer kann aus einem Lead direkt einen Audit starten.
- Provider-Fehler werden verständlich angezeigt.

### MVP-Abgrenzung

- Keine garantierte Vollständigkeit der Leads.
- Keine personenbezogene E-Mail-Anreicherung.
- Keine automatisierte Kontaktaufnahme.
- Keine rechtliche Bewertung, ob ein bestimmter Kontaktweg zulässig ist.

---

## 10.5 Audit-Datenbeschaffung

### Datenquellen im MVP

1. HTML-Fetch der Startseite
2. Jina Reader oder vergleichbarer Content-Extraction-Service
3. ScreenshotOne für Desktop- und Mobile-Screenshots
4. PageSpeed Insights API für Performance-Daten
5. Optional: Local Business Data API via RapidAPI oder Google Places
6. Optional: manuelle Ergänzung durch Nutzer

### Zu erfassende Rohdaten

- HTTP-Status
- Redirect-Ziel
- Seitentitel
- Meta Description
- H1/H2-Struktur
- Canonical URL
- robots.txt vorhanden
- sitemap.xml vorhanden
- schema.org/JSON-LD vorhanden
- Open Graph Tags
- Telefonnummern
- E-Mail-Adressen, falls öffentlich sichtbar
- Kontaktlinks
- Impressum-Link
- Datenschutz-Link
- sichtbare CTA-Texte
- interne Links
- ausgewählte Seiteninhalte
- Mobile Screenshot
- Desktop Screenshot
- PageSpeed Mobile
- PageSpeed Desktop

### Seiten, die bevorzugt gecrawlt werden

MVP maximal 5 Seiten:

```text
/
Kontakt
Leistungen
Über uns
Impressum
```

Heuristiken für Pfade:

```text
/contact
/kontakt
/leistungen
/services
/about
/ueber-uns
/über-uns
/impressum
/datenschutz
/privacy
```

### Akzeptanzkriterien

- Das System kann eine einfache Unternehmenswebsite analysieren.
- Das System bricht nicht ab, wenn einzelne Seiten fehlen.
- Ein Audit kann auch mit partiellen Daten erstellt werden.
- Jeder Datenpunkt bekommt eine Quelle.
- Provider-Timeouts werden protokolliert.

---

## 10.6 Screenshot-Erstellung

### Anforderungen

Für jeden Audit sollen möglichst erstellt werden:

- Desktop Above-the-Fold Screenshot
- Mobile Above-the-Fold Screenshot
- optional Full-Page Screenshot

### Verwendung im Report

Screenshots dienen als Evidenz:

- erster Eindruck
- sichtbarer CTA
- mobile Lesbarkeit
- veraltetes Layout
- Hero-Bereich
- Kontaktmöglichkeit Above-the-Fold

### Akzeptanzkriterien

- Report zeigt mindestens einen Screenshot, sofern Screenshot-Provider erfolgreich war.
- Wenn Screenshot-Erstellung fehlschlägt, wird der Audit trotzdem mit Warnung erstellt.
- Screenshots werden gespeichert und einer Retention-Regel unterworfen.
- Screenshots dürfen nicht öffentlich erratbar sein, außer sie sind Teil eines öffentlichen Report-Links.

---

## 10.7 Performance-Prüfung

### Anforderungen

Das System soll Performance-Daten erfassen:

- Mobile Performance Score
- Desktop Performance Score
- Core Web Vitals, falls verfügbar
- wichtigste Optimierungshinweise
- Largest Contentful Paint
- Cumulative Layout Shift
- First Contentful Paint
- Speed Index

### Akzeptanzkriterien

- Scores werden getrennt für Mobile und Desktop gespeichert.
- Report übersetzt technische Performance-Probleme in Kundensprache.
- Performance ist nur eine Kategorie, nicht der gesamte Audit.
- Fehler der Performance-API blockieren den Audit nicht vollständig.

---

## 10.8 Deterministische Checks

SitePitch soll nicht ausschließlich auf KI-Bewertungen basieren. Die Basis bilden reproduzierbare Checks.

### Technische Checks

- HTTPS aktiv
- HTTP-Status 200
- Weiterleitung von http zu https
- Title vorhanden
- Meta Description vorhanden
- H1 vorhanden
- nicht mehrere widersprüchliche H1s
- robots.txt erreichbar
- sitemap.xml erreichbar
- Canonical vorhanden
- Bilder mit Alt-Attributen grob prüfen
- sichtbares Impressum gefunden
- Datenschutz-Link gefunden
- Kontaktseite gefunden

### SEO-Basics

- Title-Länge plausibel
- Meta Description-Länge plausibel
- Keyword/Stadt im Title, falls bekannt
- Keyword/Stadt in H1 oder Haupttext, falls bekannt
- strukturierte Daten vorhanden
- Open Graph Tags vorhanden
- interne Links zu Leistungsseiten vorhanden

### Local-SEO

- Stadt/Region sichtbar genannt
- Adresse sichtbar
- Telefonnummer sichtbar
- Telefonnummer klickbar
- Öffnungszeiten sichtbar
- LocalBusiness Schema vorhanden
- Google-Business-Daten optional vorhanden
- Bewertungen/Testimonials sichtbar

### Conversion

- Primärer CTA sichtbar
- Kontaktbutton vorhanden
- Kontaktformular vorhanden
- Telefonnummer im Header/Footer sichtbar
- Leistungen klar benannt
- Trust-Elemente vorhanden
- Referenzen/Reviews sichtbar
- eindeutiges Nutzenversprechen im Hero-Bereich
- Angebot in 5 Sekunden verständlich

### Mobile UX

- Mobile Screenshot verfügbar
- Textgrößen grob plausibel
- CTA auf Mobilgerät sichtbar
- Telefonnummer klickbar
- keine offensichtliche horizontale Überbreite
- PageSpeed Mobile berücksichtigt

### Akzeptanzkriterien

- Checks erzeugen strukturierte Rohbefunde.
- Jeder Check kann `passed`, `failed`, `warning`, `not_applicable` oder `unknown` sein.
- Checks sind einzeln testbar.
- LLM darf Ergebnisse erklären, aber nicht die einzige Quelle für Scores sein.

---

## 10.9 Scoring-Modell

### Ziel

Der Score soll Webdesignern helfen, Leads zu priorisieren und im Report eine verständliche Einschätzung zu zeigen.

### Kategorien und Gewichtung

| Kategorie | Gewicht |
|---|---:|
| Conversion | 25 % |
| SEO Basics | 20 % |
| Local SEO | 20 % |
| Performance | 15 % |
| Mobile UX | 10 % |
| Trust & Credibility | 10 % |
| **Gesamt** | **100 %** |

### Score-Berechnung

Jede Kategorie erhält einen Score von 0–100. Der Gesamtscore ist gewichteter Durchschnitt.

Beispiel:

```text
Conversion: 55
SEO Basics: 70
Local SEO: 45
Performance: 62
Mobile UX: 58
Trust: 50

Gesamt = 57
```

### Score-Interpretation

| Score | Label | Bedeutung |
|---:|---|---|
| 0–39 | Kritisch | viele offensichtliche Schwächen |
| 40–59 | Ausbaufähig | gute Akquise-Chance |
| 60–74 | Solide, aber optimierbar | einige konkrete Verbesserungen |
| 75–89 | Stark | nur punktuelle Chancen |
| 90–100 | Sehr stark | kein idealer Webdesign-Outreach-Lead |

### Wichtige Produktlogik

Für SitePitch ist ein niedriger Score nicht „schlecht“, sondern eine potenzielle Chance für den Webdesigner. Der Report soll aber respektvoll formuliert sein.

### Akzeptanzkriterien

- Scores sind reproduzierbar.
- Kategorie-Scores werden im Report erklärt.
- Gesamtscore darf nicht allein aus LLM-Ausgabe stammen.
- Scores können versioniert werden.
- Das Scoring-Modell ist in Code und Doku nachvollziehbar.

---

## 10.10 KI-Auswertung

### Rolle der KI

KI soll nicht blind bewerten, sondern strukturierte Rohdaten in verständliche, verkaufsfähige Sprache übersetzen.

Die agentische KI-Auswertung wird über **Eve** als Audit-Agent-Layer orchestriert. Eve übernimmt nicht die deterministische Bewertung selbst, sondern koordiniert Skills, Tools und optionale Subagents, die strukturierte Audit-Daten in Findings, Zusammenfassungen, Chancen, Outreach-Texte und QA-Ergebnisse übersetzen.

### KI-Aufgaben

- Executive Summary erzeugen
- Stärken formulieren
- Schwächen formulieren
- Chancen priorisieren
- technische Findings in Kundensprache übersetzen
- Outreach-Texte erzeugen
- Telefonnotiz erzeugen
- Betreffzeilen erzeugen
- freundlichen, nicht-beschämenden Ton sicherstellen
- Findings auf Evidenzbezug prüfen
- riskante oder übertriebene Aussagen entschärfen

### Eve Audit-Agent-Aufgaben

Eve soll in der ersten Implementierung für folgende Agentenaufgaben genutzt werden:

- Audit-Kontext aus Convex laden
- strukturierte Checks, Scores, Screenshots und Content-Auszüge zu einem kompakten Audit-Kontext bündeln
- spezialisierte Skills für Conversion, SEO Basics, Local SEO, Mobile UX, Trust und Outreach anwenden
- Findings, Summary und Outreach gegen Zod-Schemas validieren
- eine Claim-Safety-Prüfung durchführen, bevor Texte gespeichert werden

Eve soll keine Credits abbuchen, keine Auth-Entscheidungen treffen, keine Public Reports ausliefern und keine Rohdaten dauerhaft speichern. Diese Verantwortlichkeiten bleiben bei Convex und der Produkt-App.

### Strukturierte Outputs

KI-Ausgaben müssen gegen ein Schema validiert werden.

Beispielstruktur:

```ts
type AuditFinding = {
  category: "conversion" | "seo" | "local_seo" | "performance" | "mobile" | "trust" | "technical";
  severity: "low" | "medium" | "high";
  title: string;
  evidence: string;
  explanation: string;
  recommendation: string;
  salesAngle: string;
};
```

### Tonalität

Vermeiden:

```text
Ihre Website ist schlecht.
Diese Seite wirkt unprofessionell.
Sie verlieren massiv Kunden.
```

Bevorzugen:

```text
Die Website macht grundsätzlich einen soliden Eindruck, verschenkt aber Potenzial bei der mobilen Kontaktaufnahme.
Ein klarerer Kontaktbereich könnte Interessenten schneller zur Anfrage führen.
Die lokale Auffindbarkeit ließe sich mit wenigen strukturellen Anpassungen verbessern.
```

### Akzeptanzkriterien

- KI-Ausgaben sind strukturiert validiert.
- Unvollständige KI-Ausgaben werden erneut generiert oder sauber abgefangen.
- Der Report enthält keine übertriebenen oder rechtlich riskanten Behauptungen.
- Findings beziehen sich auf vorhandene Evidenz.
- Outreach-Texte sind kurz, freundlich und nicht aggressiv.
- Eve-Agentenläufe sind einem Audit zuordenbar und speichern nur validierte Outputs zurück.
- Ein Audit bleibt auch dann nachvollziehbar, wenn Eve ausfällt oder nur partielle Ergebnisse liefert.

---

## 10.11 Audit-Report

### Report-Typen

1. Interner Report im Dashboard
2. Öffentlicher Share-Report
3. Druck-/PDF-Ansicht

### Public Report URL

Format:

```text
https://trysitepitch.com/r/[publicSlug]
```

### Report-Struktur

1. Header mit Branding
2. Website-Name / Domain
3. Gesamtscore
4. Kurzfazit
5. Screenshot
6. Top 5 Chancen
7. Kategorie-Scores
8. Stärken
9. Schwächen
10. Detail-Findings
11. Empfohlene nächste Schritte
12. CTA des Webdesigners
13. optional „Powered by SitePitch“

### Beispiel-Kurzfazit

```text
Die Website macht grundsätzlich einen seriösen Eindruck, verschenkt aber Potenzial bei mobiler Kontaktaufnahme, lokaler Auffindbarkeit und Vertrauensaufbau. Besonders auf Smartphones könnte ein klarerer Kontaktbereich helfen, mehr Anfragen aus bestehenden Besuchern zu gewinnen.
```

### Akzeptanzkriterien

- Report ist ohne Login per Link erreichbar, falls vom Nutzer freigegeben.
- Nutzer kann Report deaktivieren.
- Report zeigt Branding.
- Report ist auf Mobilgeräten lesbar.
- Report kann gedruckt oder als PDF gespeichert werden.
- Report enthält keine internen Rohdaten oder API-Keys.
- Report lädt innerhalb akzeptabler Zeit.

---

## 10.12 Outreach-Texte

### Texttypen

SitePitch soll mindestens erzeugen:

1. kurze E-Mail
2. LinkedIn-/Kontaktformular-Text
3. Telefonnotiz
4. 3 Betreffzeilen
5. Follow-up-Text optional

### Beispiel E-Mail

```text
Betreff: Kurzer Website-Audit zu [Unternehmen]

Hallo [Name/Team],

ich bin bei der Suche nach [Branche] in [Stadt] auf Ihre Website gestoßen und habe mir kurz angeschaut, wie gut sie aktuell für neue Kundenanfragen vorbereitet ist.

Dabei sind mir ein paar konkrete Punkte aufgefallen — unter anderem bei mobiler Kontaktaufnahme, lokaler Auffindbarkeit und der Darstellung Ihrer Leistungen.

Ich habe daraus einen kurzen Audit erstellt:
[Audit-Link]

Vielleicht ist das für Sie interessant, unabhängig davon, ob Sie gerade aktiv über Ihre Website nachdenken.

Viele Grüße
[Absender]
```

### Anforderungen

- Texte sind editierbar.
- Texte enthalten optional den Report-Link.
- Texte vermeiden falsche Behauptungen.
- Texte vermeiden aggressive Dringlichkeit.
- Texte enthalten keine automatisierte rechtliche Aussage zur Zulässigkeit von Kontaktaufnahme.
- Nutzer muss Texte manuell kopieren.

### Akzeptanzkriterien

- User kann Texte kopieren.
- Text ist auf Report und Lead zugeschnitten.
- Text wird in der gewählten Sprache erzeugt.
- Keine automatische Massenversendung im MVP.

---

## 10.13 Credit- und Billing-System

### Pricing-Vorschlag

| Plan | Preis | Inhalt |
|---|---:|---|
| Free | 0 € | 3 Audits einmalig, SitePitch Branding |
| Starter | 19 €/Monat | 25 Audits/Monat |
| Pro | 49 €/Monat | 100 Audits/Monat, Branding, PDF |
| Agency | 99 €/Monat | 300 Audits/Monat, White-Label Light |
| Extra Credits | 10 € | 25 zusätzliche Audits |

### Credit-Regeln

- Jeder gestartete Audit reserviert 1 Credit.
- Bei sofortiger URL-Validierungsablehnung wird kein Credit verbraucht.
- Bei Provider-Fehler nach Start kann Credit entweder verbraucht, erstattet oder als `failed_refunded` markiert werden.
- Für MVP empfohlen: Credit erst nach erfolgreichem Abschluss endgültig verbrauchen, aber gegen Abuse mit Rate Limits schützen.
- Lead Search kann separat limitiert werden.

### Billing-Anbieter

Empfehlung:

- Lemon Squeezy für schnellen Start und Merchant-of-Record-Vorteile
- Stripe als Alternative für maximale Kontrolle

### Akzeptanzkriterien

- User sieht verbleibende Credits.
- System blockiert Audits ohne Credits.
- Webhooks aktualisieren Subscription-Status.
- Usage Events werden gespeichert.
- Admin kann Credits manuell anpassen.

---

## 10.14 Rate Limiting und Abuse Protection

### Zu schützende Aktionen

- Demo-Audit
- Audit-Erstellung
- Lead Search
- Screenshot-Erstellung
- LLM-Generierung
- PDF-Export
- Public Report View Tracking

### Regeln für MVP

Nicht eingeloggt:

```text
1 Demo-Audit pro IP pro Tag
Turnstile erforderlich
kein PDF
Report enthält SitePitch Branding
```

Free User:

```text
max. 3 Audits insgesamt
max. 3 Audits pro Stunde
```

Paid User:

```text
abhängig von Credits
zusätzlich Burst-Limit, z.B. 10 Audits pro Stunde
```

### Technische Umsetzung

- Convex Rate Limiter als primärer Application-Limiter für Demo-Audit, Audit-Erstellung, Lead Search, Provider-Aufrufe, LLM-Generierung, PDF-Export und Public Report View Tracking
- Fixed-Window-Limits für UI-/User-Aktionen wie Demo-Audit und Audit-Start; Token-Bucket-Limits für kosten- oder volumenrelevante Provider- und LLM-Nutzung
- Limits müssen nach Workspace, User, IP, Provider und Plan unterscheidbar sein
- Convex Workpool begrenzt zusätzlich die parallele Ausführung kostenrelevanter Actions pro Provider und Job-Typ, z.B. Screenshot, PageSpeed, Business Data, LLM und PDF
- Redis / Upstash Redis nur optional für Edge-nahe, kurzlebige Abuse-Signale oder Idempotency Locks, nicht als primäre Business-Wahrheit
- Cloudflare Turnstile für öffentliche Formulare
- Provider-spezifische Limits zusätzlich beachten

### Akzeptanzkriterien

- Abuse kann nicht unlimitiert Kosten verursachen.
- Rate-Limit-Fehler sind verständlich.
- Limits sind pro Workspace, User und IP möglich.
- Admin kann Limits konfigurieren.

---

## 11. Technische Architektur

## 11.1 Vorgeschlagener Stack

### Frontend

- Next.js 16
- React
- TypeScript
- Tailwind CSS 4
- shadcn/ui
- React Hook Form
- Zod
- TanStack Table
- Recharts oder Tremor für Scores

### Backend

- Convex
- Convex Queries
- Convex Mutations
- Convex Actions
- Convex Scheduler / Cron
- Convex HTTP Actions für Webhooks
- Convex File Storage oder Cloudflare R2
- Convex Workpool für Audit-, Provider-, LLM- und PDF-Jobs mit konfigurierter Parallelität, Retry-Strategie und Completion-Callbacks
- Convex Rate Limiter für Workspace-, User-, IP-, Provider- und Plan-Limits
- Convex Runtime für Queries/Mutations und leichtgewichtige Actions; Node.js Runtime für Actions mit externen SDKs, Provider-Aufrufen, Eve-/AI-SDK-Läufen und PDF-Erzeugung

### Auth

- Clerk + Convex Integration
- Alternative: Better Auth

### Billing

- Lemon Squeezy
- Alternative: Stripe

### Rate Limiting

- Convex Rate Limiter
- Convex Workpool `maxParallelism` pro Provider/Job-Typ als Durchsatzbremse für externe APIs
- optional Redis / Upstash Redis für Edge-nahe, kurzlebige Abuse-Signale
- Cloudflare Turnstile für Demo- und Public-Formulare

### Datenquellen

- Jina Reader für Website-Text/Markdown
- ScreenshotOne für Screenshots
- PageSpeed Insights API für Performance
- Local Business Data API via RapidAPI
- optional Google Places / SerpApi / DataForSEO / Apify als austauschbare Provider

### KI

- Eve als Audit-Agent-Framework
- Vercel AI SDK
- OpenAI oder Anthropic
- strukturierte JSON-/Zod-Outputs
- agentische Skills/Subagents für Findings, Summary, Outreach und QA

### E-Mail

- Resend für transaktionale E-Mails
- kein Cold-Outreach-Versand im MVP

### Analytics / Monitoring

- PostHog EU, Umami oder OpenPanel
- Sentry für Errors, Traces und Provider-Fehler

---

## 11.2 Systemarchitektur

```text
Browser / Next.js App
        ↓
Convex Queries/Mutations
        ↓
Convex Rate Limiter + Credit Reservation
        ↓
Audit Job in Convex
        ↓
Convex Workpool
        ↓
Convex Action / Worker
        ↓
Provider Layer
  ├─ HTML Fetch
  ├─ Jina / Firecrawl
  ├─ ScreenshotOne
  ├─ PageSpeed Insights
  └─ Business Data Provider
        ↓
Deterministic Checks + Scoring Engine
        ↓
Eve Audit Agent
  ├─ Audit Skills
  ├─ Audit Tools
  ├─ Optional Subagents
  └─ LLM Provider via AI SDK
        ↓
Report Generator
        ↓
Convex DB + File Storage/R2
        ↓
Next.js Report Page
```

### Architekturprinzip

```text
Product App ≠ Audit Engine
```

Next.js zeigt UI und Reports. Convex hält Daten, Status und orchestriert Jobs. Provider-Aufrufe und Audit-Auswertung laufen in Actions oder später in dedizierten Workern. Kosten- und providerrelevante Arbeit wird über Convex Workpool eingeplant, damit parallele Ausführung kontrolliert, Retry-Verhalten zentral definiert und externe Rate Limits respektiert werden.

Convex Rate Limiter schützt alle Einstiegspunkte, die Kosten oder Abuse verursachen können. Rate Limits werden vor Credit-Reservierung und Job-Enqueue geprüft; provider- oder tokenbezogene Limits werden zusätzlich unmittelbar vor dem externen Aufruf geprüft.

Runtime-Regel: Queries und Mutations bleiben in der Standard-Convex-Runtime und enthalten keine langsamen Provider-Aufrufe. Actions, die externe SDKs, AI SDK/Eve, Screenshots, PDF-Erzeugung oder Node-spezifische APIs brauchen, laufen in der Node.js Runtime. Jede Runtime-Grenze muss explizit dokumentieren, welche Daten gelesen, geschrieben und geloggt werden.

Eve wird als spezialisierte Agentenschicht innerhalb oder neben der Next.js-App integriert. Convex bleibt Source of Truth für Audit-Status, Credits, Rohdaten, Scores und gespeicherte Outputs. Eve erhält pro Lauf nur den notwendigen Audit-Kontext, erzeugt validierte KI-Ausgaben und schreibt diese über interne Tools zurück.

---

## 11.3 Audit Job Lifecycle

### Statuswerte

```ts
type AuditStatus =
  | "draft"
  | "queued"
  | "validating_url"
  | "fetching_html"
  | "extracting_content"
  | "taking_screenshots"
  | "running_performance_checks"
  | "fetching_business_data"
  | "running_deterministic_checks"
  | "calculating_scores"
  | "generating_findings"
  | "generating_outreach"
  | "completed"
  | "failed"
  | "cancelled";
```

### Fehlerstrategie

Jeder Schritt kann:

- erfolgreich sein
- Warnung erzeugen
- fehlschlagen, aber Audit fortsetzen
- kritisch fehlschlagen und Audit abbrechen

Beispiele:

| Fehler | Verhalten |
|---|---|
| ScreenshotOne Timeout | Audit ohne Screenshot fortsetzen |
| PageSpeed Timeout | Audit ohne Performance-Score fortsetzen |
| HTML nicht erreichbar | Audit abbrechen |
| LLM Validation Failed | Retry mit kompakterem Prompt |
| Eve Agent Timeout | Audit mit deterministischen Checks und Fallback-Text fortsetzen oder als `failed` markieren, falls keine brauchbare Summary erzeugt werden kann |
| Business Data Fehler | Audit ohne Business-Daten fortsetzen |

---

## 11.4 Provider-Abstraktion

### Business Data Interface

```ts
export interface BusinessDataProvider {
  searchBusinesses(input: {
    query: string;
    city: string;
    country: string;
    category?: string;
    limit?: number;
  }): Promise<BusinessLead[]>;
}
```

### Content Extraction Interface

```ts
export interface ContentExtractor {
  extract(input: {
    url: string;
    maxPages?: number;
  }): Promise<ExtractedSiteContent>;
}
```

### Screenshot Interface

```ts
export interface ScreenshotProvider {
  capture(input: {
    url: string;
    viewport: "desktop" | "mobile";
    fullPage?: boolean;
  }): Promise<ScreenshotResult>;
}
```

### Performance Interface

```ts
export interface PerformanceProvider {
  analyze(input: {
    url: string;
    strategy: "mobile" | "desktop";
  }): Promise<PerformanceResult>;
}
```

### LLM Interface

```ts
export interface AuditAiProvider {
  generateFindings(input: AuditContext): Promise<AuditFinding[]>;
  generateSummary(input: AuditContext): Promise<AuditSummary>;
  generateOutreach(input: OutreachContext): Promise<OutreachDrafts>;
}
```

## 11.5 Eve Audit-Agent-Layer

### Ziel

Eve soll die agentischen Bestandteile der Audit-Erstellung filesystem-first strukturieren. Die Produkt-App bekommt dadurch klare Orte für Instructions, Skills, Tools, Subagents und spätere Evals, statt Audit-Prompts und LLM-Logik lose in Backend-Actions zu verteilen.

### Geplante Struktur

```text
agent/
  agent.ts
  instructions.md
  tools/
    get_audit_context.ts
    save_audit_findings.ts
    save_audit_summary.ts
    save_outreach_drafts.ts
  skills/
    conversion-audit.md
    seo-basics-audit.md
    local-seo-audit.md
    mobile-ux-audit.md
    trust-audit.md
    respectful-outreach.md
    claim-safety.md
  subagents/
    conversion-reviewer/
    seo-reviewer/
    local-seo-reviewer/
    outreach-writer/
    claim-safety-reviewer/
  evals/
    audit-quality.eval.ts
    outreach-tone.eval.ts
```

### Verantwortlichkeiten

Eve ist verantwortlich für:

- agentische Auswertung nach abgeschlossenen deterministischen Checks
- strukturierte Textgenerierung für Findings, Summary und Outreach
- Anwendung von Tonalitäts-, Evidenz- und Claim-Safety-Regeln
- optionale Subagent-Prüfungen pro Audit-Kategorie
- spätere Evals zur Qualität von Audit- und Outreach-Ausgaben

Eve ist nicht verantwortlich für:

- Auth, Workspace-Zugriff oder Billing
- Credit-Reservierung oder Credit-Verbrauch
- URL-Normalisierung, SSRF-Schutz oder Rate Limiting
- Rohdatenbeschaffung von externen Providern, sofern diese bereits im Audit-Kontext vorliegt
- Public Report Rendering

### Integration

Für den MVP soll Eve in die Next.js-App integriert werden. Die Next-Konfiguration wird mit Eve erweitert, und Convex Actions stoßen Eve-Läufe für `generating_findings` und `generating_outreach` an. Eve-Tools dürfen nur über interne, validierte Schnittstellen auf Convex-Daten zugreifen und müssen die Workspace-/Audit-Grenzen respektieren.

### Qualitätsregeln

- Jeder Eve-Output muss gegen ein Zod-Schema validiert werden.
- Jeder Finding-Text muss auf mindestens eine vorhandene Evidenz verweisen.
- Claim-Safety läuft vor dem Speichern öffentlicher Report-Texte.
- Agentenläufe werden mit Audit-ID, Modell, Prompt-/Skill-Version und Status protokolliert.
- Bei Eve-Fehlern bleibt der deterministische Audit-Kontext erhalten und der Nutzer sieht eine verständliche Fehlermeldung oder einen Fallback-Report.

---

## 12. Datenmodell

Die folgenden Schemas sind konzeptionell für Convex gedacht und müssen bei Implementierung in `convex/schema.ts` konkretisiert werden.

### 12.1 users

```ts
{
  clerkUserId: string;
  email: string;
  name?: string;
  createdAt: number;
  lastSeenAt?: number;
}
```

### 12.2 workspaces

```ts
{
  name: string;
  ownerUserId: Id<"users">;
  logoStorageId?: Id<"_storage">;
  accentColor?: string;
  website?: string;
  contactEmail?: string;
  ctaText?: string;
  ctaUrl?: string;
  reportLanguage: "de" | "en";
  createdAt: number;
  updatedAt: number;
}
```

### 12.3 workspaceMembers

```ts
{
  workspaceId: Id<"workspaces">;
  userId: Id<"users">;
  role: "owner" | "admin" | "member";
  createdAt: number;
}
```

MVP kann nur `owner` unterstützen.

### 12.4 subscriptions

```ts
{
  workspaceId: Id<"workspaces">;
  provider: "lemonsqueezy" | "stripe";
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  plan: "free" | "starter" | "pro" | "agency";
  status: "active" | "trialing" | "past_due" | "cancelled" | "expired";
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  createdAt: number;
  updatedAt: number;
}
```

### 12.5 creditBalances

```ts
{
  workspaceId: Id<"workspaces">;
  monthlyCredits: number;
  extraCredits: number;
  usedMonthlyCredits: number;
  periodStart: number;
  periodEnd: number;
  updatedAt: number;
}
```

### 12.6 creditLedger

```ts
{
  workspaceId: Id<"workspaces">;
  auditId?: Id<"audits">;
  type: "grant" | "reserve" | "consume" | "refund" | "expire" | "manual_adjustment";
  amount: number;
  reason?: string;
  createdAt: number;
}
```

### 12.7 leads

```ts
{
  workspaceId: Id<"workspaces">;
  businessName: string;
  websiteUrl?: string;
  category?: string;
  city?: string;
  country?: string;
  address?: string;
  phone?: string;
  sourceProvider: "manual" | "rapidapi" | "google_places" | "serpapi" | "dataforseo" | "apify";
  sourceId?: string;
  status: "new" | "audited" | "contacted" | "interested" | "not_interested" | "won" | "lost";
  createdAt: number;
  updatedAt: number;
}
```

### 12.8 audits

```ts
{
  workspaceId: Id<"workspaces">;
  leadId?: Id<"leads">;
  createdBy: Id<"users">;
  url: string;
  normalizedUrl: string;
  domain: string;
  status: AuditStatus;
  statusMessage?: string;
  publicSlug: string;
  isPublic: boolean;
  reportVersion: string;
  overallScore?: number;
  completedAt?: number;
  failedAt?: number;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}
```

### 12.9 auditRawData

```ts
{
  auditId: Id<"audits">;
  httpStatus?: number;
  finalUrl?: string;
  title?: string;
  metaDescription?: string;
  h1Texts?: string[];
  h2Texts?: string[];
  canonicalUrl?: string;
  robotsFound?: boolean;
  sitemapFound?: boolean;
  schemaTypes?: string[];
  phoneNumbers?: string[];
  emailAddresses?: string[];
  contactLinks?: string[];
  privacyLinkFound?: boolean;
  imprintLinkFound?: boolean;
  ctaCandidates?: string[];
  extractedMarkdown?: string;
  providerPayloadRefs?: string[];
  createdAt: number;
}
```

### 12.10 auditAssets

```ts
{
  auditId: Id<"audits">;
  type: "desktop_screenshot" | "mobile_screenshot" | "fullpage_screenshot" | "pdf";
  storageProvider: "convex" | "r2" | "external";
  storageId?: Id<"_storage">;
  url?: string;
  createdAt: number;
}
```

### 12.11 auditPerformance

```ts
{
  auditId: Id<"audits">;
  strategy: "mobile" | "desktop";
  performanceScore?: number;
  accessibilityScore?: number;
  bestPracticesScore?: number;
  seoScore?: number;
  lcp?: number;
  cls?: number;
  fcp?: number;
  speedIndex?: number;
  rawProviderRef?: string;
  createdAt: number;
}
```

### 12.12 auditChecks

```ts
{
  auditId: Id<"audits">;
  category: "technical" | "seo" | "local_seo" | "conversion" | "mobile" | "trust" | "performance";
  key: string;
  status: "passed" | "failed" | "warning" | "not_applicable" | "unknown";
  label: string;
  evidence?: string;
  weight?: number;
  createdAt: number;
}
```

### 12.13 auditScores

```ts
{
  auditId: Id<"audits">;
  conversionScore: number;
  seoBasicsScore: number;
  localSeoScore: number;
  performanceScore: number;
  mobileUxScore: number;
  trustScore: number;
  overallScore: number;
  scoringVersion: string;
  createdAt: number;
}
```

### 12.14 auditFindings

```ts
{
  auditId: Id<"audits">;
  category: "conversion" | "seo" | "local_seo" | "performance" | "mobile" | "trust" | "technical";
  severity: "low" | "medium" | "high";
  title: string;
  evidence: string;
  explanation: string;
  recommendation: string;
  salesAngle: string;
  sortOrder: number;
  createdAt: number;
}
```

### 12.15 auditSummaries

```ts
{
  auditId: Id<"audits">;
  shortSummary: string;
  strengths: string[];
  weaknesses: string[];
  topOpportunities: string[];
  nextSteps: string[];
  createdAt: number;
}
```

### 12.16 outreachDrafts

```ts
{
  auditId: Id<"audits">;
  type: "email" | "linkedin" | "contact_form" | "phone_note" | "follow_up";
  subject?: string;
  body: string;
  createdAt: number;
}
```

### 12.17 reportViews

```ts
{
  auditId: Id<"audits">;
  viewerIpHash?: string;
  userAgentHash?: string;
  referrer?: string;
  viewedAt: number;
}
```

### 12.18 usageEvents

```ts
{
  workspaceId: Id<"workspaces">;
  userId?: Id<"users">;
  auditId?: Id<"audits">;
  event:
    | "audit_started"
    | "audit_completed"
    | "audit_failed"
    | "lead_search_started"
    | "report_viewed"
    | "outreach_copied"
    | "pdf_exported"
    | "credits_consumed"
    | "upgrade_clicked";
  metadata?: Record<string, unknown>;
  createdAt: number;
}
```

### 12.19 providerCosts

```ts
{
  workspaceId: Id<"workspaces">;
  auditId?: Id<"audits">;
  provider: "jina" | "screenshotone" | "pagespeed" | "openai" | "anthropic" | "rapidapi" | "other";
  operation: string;
  estimatedCostUsd?: number;
  tokensIn?: number;
  tokensOut?: number;
  requestCount?: number;
  createdAt: number;
}
```

### 12.20 auditAgentRuns

```ts
{
  auditId: Id<"audits">;
  workspaceId: Id<"workspaces">;
  provider: "openai" | "anthropic" | "other";
  model: string;
  purpose: "findings" | "summary" | "outreach" | "qa";
  status: "started" | "completed" | "failed";
  skillVersions?: Record<string, string>;
  tokensIn?: number;
  tokensOut?: number;
  errorMessage?: string;
  startedAt: number;
  completedAt?: number;
}
```

---

## 13. Seiten und UI

## 13.1 Marketing Website

### Seiten

```text
/
 /pricing
 /demo
 /examples
 /login
 /signup
 /privacy
 /terms
 /imprint
```

### Homepage-Struktur

1. Hero
2. Problem
3. Demo-Screenshot
4. Workflow: Find → Audit → Pitch
5. Beispiel-Report
6. Features
7. Pricing
8. FAQ
9. CTA

### Hero

```text
Erstelle Website-Audits, die Kundengespräche starten.

SitePitch analysiert potenzielle Kunden-Websites und generiert daraus gebrandete Audit-Reports, konkrete Verbesserungschancen und Outreach-Texte für Webdesigner.
```

CTA:

```text
Create your first audit
```

oder Deutsch:

```text
Ersten Audit erstellen
```

---

## 13.2 App Dashboard

### Seiten

```text
/app
/app/audits
/app/audits/new
/app/audits/[id]
/app/leads
/app/leads/search
/app/settings
/app/settings/branding
/app/settings/billing
```

### Dashboard Widgets

- Credits remaining
- Audits this month
- Completed audits
- Report views
- Recent audits
- CTA: New Audit
- CTA: Search Leads

---

## 13.3 New Audit Page

### Komponenten

- URL Input
- optional Lead-Auswahl
- Sprache
- Audit-Typ: Standard / Local / Quick
- Credit-Hinweis
- Start Button

### Validierung

- URL erforderlich
- Domain gültig
- kein localhost/private IP
- Credits vorhanden
- Rate Limit nicht überschritten

---

## 13.4 Audit Detail Page

### Statusansicht

Während der Audit läuft:

```text
✓ URL validiert
✓ Website geladen
✓ Inhalte extrahiert
⏳ Screenshots werden erstellt
⏳ Performance wird geprüft
⏳ Audit wird geschrieben
```

Nach Abschluss:

- Overall Score
- Report Preview
- Public Link
- Copy Link Button
- Outreach Drafts
- Findings
- Asset Downloads
- Error/Warnungen

---

## 13.5 Public Report Page

### Anforderungen

- Ohne Login erreichbar, wenn öffentlich aktiviert.
- SEO für Reports optional `noindex`, um unerwünschte Indexierung zu vermeiden.
- Branding des Users sichtbar.
- SitePitch Branding abhängig vom Plan.
- Report kann deaktiviert werden.
- Views werden gezählt.

### `noindex` Empfehlung

MVP: Public Reports standardmäßig auf `noindex`, weil es sich um Akquise-Unterlagen handelt und nicht um öffentliche SEO-Landingpages.

---

## 14. API- und Integrationsstrategie

### 14.1 Provider austauschbar halten

Alle externen Services sollen hinter internen Interfaces liegen.

Ziel:

```text
Heute ScreenshotOne, morgen Playwright Worker.
Heute RapidAPI, morgen Google Places.
Heute Jina, morgen Firecrawl.
```

### 14.2 Env Vars

Beispiel:

```env
NEXT_PUBLIC_APP_URL=https://trysitepitch.com

CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=

LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_WEBHOOK_SECRET=
LEMONSQUEEZY_STORE_ID=

OPENAI_API_KEY=
ANTHROPIC_API_KEY=
EVE_INTERNAL_SECRET=
EVE_DEFAULT_MODEL=
VERCEL_USE_EXPERIMENTAL_FRAMEWORKS=1

SCREENSHOTONE_ACCESS_KEY=
JINA_API_KEY=
GOOGLE_PAGESPEED_API_KEY=
RAPIDAPI_KEY=

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

RESEND_API_KEY=
SENTRY_DSN=
POSTHOG_KEY=
POSTHOG_HOST=
```

### 14.3 Webhooks

Benötigte Webhooks:

- Billing subscription created
- Billing subscription updated
- Billing subscription cancelled
- Payment succeeded
- Payment failed
- Order created for credit packs

Webhooks werden über Convex HTTP Actions verarbeitet.

---

## 15. Datenschutz, Recht und Compliance

## 15.1 Grundsätze

SitePitch verarbeitet öffentlich zugängliche Website-Daten. Trotzdem muss das Produkt DSGVO-freundlich aufgebaut sein.

Prinzipien:

- Datenminimierung
- Zweckbindung
- transparente Datenschutzerklärung
- Löschmöglichkeit
- keine unnötige Speicherung personenbezogener Daten
- keine automatische Massenkontaktaufnahme
- keine sensiblen Daten anreichern
- keine Rechtsberatung durch Audits

## 15.2 Cold Outreach

SitePitch soll im MVP keine E-Mails im Namen der Nutzer versenden.

Stattdessen:

- Outreach-Texte generieren
- Copy-to-Clipboard
- Nutzer entscheidet selbst über Kontaktweg
- Hinweis im Produkt: Nutzer ist für rechtmäßige Kontaktaufnahme verantwortlich

## 15.3 Report-Inhalte

Vermeiden:

- verleumderische Formulierungen
- rechtliche Bewertungen wie „nicht DSGVO-konform“
- harte Umsatzverlust-Behauptungen
- personenbezogene Bewertung
- Security-Behauptungen ohne Grundlage

Erlaubt:

- „Impressum-Link wurde nicht gefunden“
- „Kontaktbutton ist im ersten sichtbaren Bereich nicht erkennbar“
- „Die mobile Ladezeit könnte verbessert werden“
- „Lokale Suchbegriffe sind auf der Startseite nicht prominent sichtbar“

## 15.4 Datenretention

Vorschlag MVP:

| Datentyp | Retention |
|---|---:|
| Audit-Report | bis Nutzer löscht |
| Screenshots | 90 Tage, später konfigurierbar |
| Roh-HTML | maximal 30 Tage oder gar nicht dauerhaft |
| Extracted Markdown | maximal 30–90 Tage |
| Scores/Findings | bis Nutzer löscht |
| Provider Logs | 30 Tage |
| Usage Events | 24 Monate |
| Billing Events | nach steuerlichen Pflichten |
| Report View IP Hashes | maximal 30 Tage |

## 15.5 Nutzerrechte

MVP sollte ermöglichen:

- Workspace löschen
- Audit löschen
- Public Report deaktivieren
- Branding ändern
- Export auf Anfrage
- Löschung auf Anfrage

---

## 16. Security Requirements

### 16.1 App Security

- Alle Workspace-Daten serverseitig autorisieren.
- Convex Queries/Mutations prüfen Workspace-Zugriff.
- Public Reports nur über schwer erratbare Slugs.
- Keine API-Keys im Frontend.
- Webhooks mit Signatur prüfen.
- Rate Limiting auf kostenrelevante Endpunkte.
- Input validieren und normalisieren.
- Private IPs / SSRF-Risiken blockieren.
- Redirects begrenzen.
- Maximale Crawl-Tiefe und Seitenanzahl.
- Maximale Response-Größe für HTML Fetches.
- Timeouts für Provider-Aufrufe.

### 16.2 SSRF-Schutz

Blockieren:

```text
localhost
127.0.0.1
0.0.0.0
::1
10.0.0.0/8
172.16.0.0/12
192.168.0.0/16
169.254.0.0/16
file://
ftp://
gopher://
```

### 16.3 Public Reports

- Slugs mit ausreichend Entropie.
- Optional Report deaktivieren.
- Keine Rohdaten im Public Report.
- Keine internen IDs im HTML.
- `noindex` als Default.

---

## 17. Analytics und Produktmetriken

## 17.1 North Star Metric

```text
Completed branded audits per active workspace
```

Besser noch:

```text
Copied outreach drafts per completed audit
```

Denn SitePitch soll nicht nur Audits erzeugen, sondern Outreach verbessern.

## 17.2 Kern-Events

```text
signed_up
workspace_created
branding_completed
lead_search_started
lead_saved
audit_started
audit_completed
audit_failed
report_opened
public_link_copied
outreach_email_copied
outreach_linkedin_copied
pdf_exported
upgrade_clicked
checkout_started
subscription_started
credits_exhausted
```

## 17.3 Wichtige Kennzahlen

- Signup → first audit conversion
- audit started → audit completed rate
- average audit generation time
- average provider cost per audit
- completed audits per user
- outreach copied per audit
- public report views per audit
- free → paid conversion
- MRR
- churn
- gross margin per plan
- failed audit rate
- average credit consumption per workspace

---

## 18. Performance Requirements

### App

- Dashboard initial load unter 2 Sekunden bei normalen Datenmengen
- Audit-Detailseite aktualisiert Status nahezu in Echtzeit
- Public Report lädt schnell genug für Outreach-Empfänger

### Audit Job

Zielwerte MVP:

| Schritt | Ziel |
|---|---:|
| URL validation | < 3 Sekunden |
| HTML fetch | < 10 Sekunden |
| Content extraction | < 30 Sekunden |
| Screenshots | < 45 Sekunden |
| PageSpeed | < 90 Sekunden |
| LLM-Auswertung | < 60 Sekunden |
| Gesamt-Audit | 1–4 Minuten |

### Erwartung im UI

Der Audit darf länger dauern, wenn der Fortschritt klar angezeigt wird. Wichtig ist nicht absolute Geschwindigkeit, sondern Transparenz.

---

## 19. Fehler- und Edge-Case-Verhalten

### Website nicht erreichbar

- Audit failed
- klare Fehlermeldung
- Credit erstatten oder nicht verbrauchen

### Website blockiert Bot

- Versuch mit normalem Fetch
- Versuch über Content Provider
- wenn blockiert: Fehler anzeigen
- optional Screenshot trotzdem versuchen

### Keine Business-Daten

- Audit ohne Business-Daten fortsetzen
- Local-SEO-Checks als `unknown` oder `not_applicable`

### Keine Screenshots

- Audit fortsetzen
- Report zeigt Hinweis
- Finding auf Screenshot-Basis nicht erzeugen

### PageSpeed API schlägt fehl

- Performance Score als `unknown`
- Gesamt-Score normalisieren oder Kategorie neutral behandeln
- Report transparent machen

### LLM-Ausgabe ungültig

- Retry mit vereinfachtem Prompt
- danach fallback summary generieren
- Fehler loggen

---

## 20. Admin Requirements

MVP Admin kann zunächst über Convex Dashboard oder einfache Admin-Seite erfolgen.

### Spätere Admin-Seite

```text
/admin/users
/admin/workspaces
/admin/audits
/admin/provider-costs
/admin/failed-jobs
```

### Admin-Funktionen

- Audit einsehen
- Audit erneut starten
- Credits anpassen
- Workspace sperren
- Provider-Fehler prüfen
- Kosten pro Provider sehen
- User-Support erleichtern

---

## 21. Marketplace-Readiness

Da das Produkt perspektivisch auf einem Marketplace verkauft werden könnte, muss es als Asset sauber geführt werden.

### Anforderungen

- saubere Revenue-Verifikation über Billing Provider
- MRR eindeutig sichtbar
- klare Kosten pro Audit
- klare Usage-Metriken
- Dokumentation der Akquise-Strategie
- keine manuelle Hidden-Arbeit im Kernprozess
- Setup-Doku
- Env-Vars dokumentiert
- Provider-Layer austauschbar
- Eve-Agent-Struktur, Skills und Agentenläufe dokumentiert
- Seed-/Demo-Daten
- Demo-Account
- einfache lokale Entwicklung
- klare Produktpositionierung

### Zu dokumentieren

```text
README.md
SETUP.md
ENV.md
PROVIDER_COSTS.md
EVE_AGENT.md
MARKETING_PLAYBOOK.md
```

### Marketplace Story

```text
SitePitch helps web designers turn weak local websites into branded audits and outreach-ready sales angles.
```

---

## 22. Roadmap

### Phase 0 — Setup

- Next.js App initialisieren
- Tailwind + shadcn/ui
- Convex Setup
- Convex Workpool und Convex Rate Limiter Setup
- Runtime-Policy für Convex Actions festlegen
- Eve Setup mit `agent/`-Struktur und Next.js-Integration
- Auth Setup
- Basisschema
- Landingpage Rohversion

### Phase 1 — Core Audit

- URL-Eingabe
- Audit-Job erstellen
- HTML Fetch
- Content Extraction
- ScreenshotOne
- PageSpeed
- deterministische Checks
- Scoring
- Report Page

### Phase 2 — KI und Outreach

- Eve Audit-Agent aktivieren
- Audit-Skills für Conversion, SEO, Local SEO, Mobile UX, Trust und Outreach erstellen
- Eve-Tools für Audit-Kontext und validiertes Speichern anbinden
- strukturierte Findings
- Summary
- Top Opportunities
- E-Mail Draft
- LinkedIn/Kontaktformular Draft
- Telefonnotiz
- Copy Buttons
- Claim-Safety-QA vor öffentlichem Report speichern

### Phase 3 — Billing und Credits

- Lemon Squeezy / Stripe
- Planlogik
- Credit Ledger
- Rate Limits
- Upgrade CTAs

### Phase 4 — Lead Search

- Business Data Provider
- Stadt + Branche Suche
- Lead speichern
- Audit aus Lead starten

### Phase 5 — Launch

- Demo Audit
- Pricing Page
- Datenschutz/Impressum/Terms
- Analytics
- Error Monitoring
- 20–50 manuelle Outreach-Tests

---

## 23. Zwei-Wochen-Implementierungsplan

### Woche 1

#### Tag 1: Projektbasis

- Next.js 16 Setup
- Tailwind 4
- shadcn/ui
- Convex Setup
- Convex Workpool und Convex Rate Limiter einrichten
- Runtime-Policy für Convex- und Node.js-Actions dokumentieren
- Auth Setup
- Grundlayout
- Landingpage Skeleton

#### Tag 2: Datenmodell und Dashboard

- Convex Schema
- Workspace-Erstellung
- Audits Tabelle
- New Audit Page
- URL-Validierung

#### Tag 3: Audit Job Pipeline

- Audit Statusmodell
- Convex Action für Audit
- Audit-Start mit Convex Rate Limiter und Credit-Reservierung schützen
- Audit-Ausführung über Convex Workpool einplanen
- HTML Fetch
- Basic Metadata Extraction
- Audit Detail Page mit Live-Status

#### Tag 4: Content + Screenshots

- Jina Reader Integration
- ScreenshotOne Integration
- Asset Storage
- Screenshot im Report anzeigen

#### Tag 5: PageSpeed + Checks

- PageSpeed API Integration
- technische Checks
- SEO Checks
- Conversion Checks
- Score-Berechnung

#### Tag 6: KI Findings

- Prompting
- strukturierte Outputs mit Zod
- Summary
- Stärken/Schwächen
- Top Chancen

#### Tag 7: Public Report

- Public Slug
- Report Layout
- Branding Light
- Print/PDF CSS
- Report deaktivieren

### Woche 2

#### Tag 8: Outreach

- E-Mail Draft
- LinkedIn/Kontaktformular Draft
- Telefonnotiz
- Copy Buttons
- Public Link Copy

#### Tag 9: Credits

- Credit Balance
- Credit Ledger
- Audit-Gating
- Free Trial Limit

#### Tag 10: Billing

- Lemon Squeezy oder Stripe
- Checkout
- Webhooks
- Subscription Status
- Upgrade CTAs

#### Tag 11: Rate Limiting + Security

- Convex Rate Limiter
- Workpool-Provider-Limits prüfen
- optional Redis/Upstash für Edge-nahe Abuse-Signale
- Turnstile für Demo
- SSRF-Schutz
- Provider Timeouts
- Error Logging

#### Tag 12: Lead Search

- Provider Interface
- RapidAPI/Google Places Integration
- Stadt + Branche Suche
- Leads speichern
- Audit aus Lead starten

#### Tag 13: Polishing

- Demo Audit
- Pricing Page
- Settings
- Empty States
- Loading States
- Error States

#### Tag 14: Launch Prep

- Datenschutz
- Impressum
- Terms
- Sentry
- Analytics Events
- Demo-Account
- 10 Beispiel-Audits
- Outreach an erste Webdesigner

---

## 24. Akzeptanzkriterien für MVP-Launch

SitePitch gilt als MVP-launchfähig, wenn:

1. Ein neuer Nutzer sich registrieren kann.
2. Der Nutzer seine Agenturmarke hinterlegen kann.
3. Der Nutzer eine Website-URL eingeben kann.
4. Das System einen Audit-Job startet.
5. Der Audit mindestens HTML, Screenshot, Performance und Basischecks verarbeitet.
6. Das System einen Gesamtscore erzeugt.
7. Der Report mindestens 5 konkrete Chancen enthält.
8. Der Report über einen öffentlichen Link teilbar ist.
9. Der Nutzer mindestens eine Outreach-Mail kopieren kann.
10. Credits werden korrekt geprüft.
11. Bezahlsystem funktioniert im Testmodus.
12. Rate Limiting verhindert offensichtlichen Abuse.
13. Fehler werden verständlich angezeigt.
14. Keine API-Keys gelangen ins Frontend.
15. Public Reports zeigen keine sensiblen Rohdaten.
16. Ein Demo-Audit kann auf der Landingpage gezeigt werden.
17. Die App hat Impressum und Datenschutzerklärung.
18. Mindestens 10 reale Websites wurden testweise auditiert.
19. Durchschnittliche Audit-Kosten sind grob messbar.
20. Der gesamte Flow ist in unter 5 Minuten verständlich.

---

## 25. Prompt-Strategie

## 25.1 Audit Summary Prompt

Input:

- Rohdaten
- Scores
- Top Checks
- Screenshot-Beschreibung optional
- Business Kontext
- Sprache
- gewünschter Ton

Output:

```ts
{
  shortSummary: string;
  strengths: string[];
  weaknesses: string[];
  topOpportunities: string[];
  nextSteps: string[];
}
```

### Regeln

- freundlich
- konkret
- keine Übertreibung
- keine rechtliche Beratung
- keine garantierten Umsatzversprechen
- verständlich für lokale Unternehmer

---

## 25.2 Findings Prompt

Output:

```ts
{
  findings: Array<{
    category: string;
    severity: string;
    title: string;
    evidence: string;
    explanation: string;
    recommendation: string;
    salesAngle: string;
  }>
}
```

### Regeln

- maximal 12 Findings
- mindestens 5 Findings, falls genügend Daten vorhanden
- jedes Finding braucht Evidenz
- keine erfundenen Daten
- technische Begriffe erklären

---

## 25.3 Outreach Prompt

Output:

```ts
{
  email: {
    subject: string;
    body: string;
  };
  linkedin: {
    body: string;
  };
  contactForm: {
    body: string;
  };
  phoneNote: {
    bullets: string[];
  };
  subjectLines: string[];
}
```

### Regeln

- kurz
- respektvoll
- nicht aggressiv
- keine falsche Vertrautheit
- kein Spam-Ton
- Report-Link optional einfügen
- konkrete Top-Chancen erwähnen

---

## 26. Report Copy Guidelines

### Gute Formulierungen

```text
verschenkt Potenzial
könnte klarer werden
ist aktuell nicht sofort erkennbar
lässt sich mit wenigen Anpassungen verbessern
macht grundsätzlich einen soliden Eindruck
für mobile Besucher könnte die Kontaktaufnahme einfacher sein
```

### Zu vermeiden

```text
schlecht
unprofessionell
katastrophal
rechtswidrig
DSGVO-Verstoß
Sie verlieren Kunden
Ihre Konkurrenz ist besser
sofortiger Handlungsbedarf
```

---

## 27. Testing

### 27.1 Unit Tests

- URL normalization
- private IP blocking
- score calculation
- credit calculation
- check evaluation
- slug generation
- provider response parsing

### 27.2 Integration Tests

- create audit
- run audit job with mocked providers
- generate report
- billing webhook
- credit consumption
- public report access

### 27.3 Manual Tests

Testseiten:

- moderne Agenturwebsite
- veraltete lokale Handwerkerwebsite
- WordPress-Seite
- Website ohne HTTPS
- Website ohne Meta Description
- Website ohne Kontaktseite
- Website mit Cookie Banner
- Website mit langsamer Performance
- Website, die Bot-Zugriffe blockiert

### 27.4 QA-Kriterien

- Kein Crash bei fehlenden Daten
- Report bleibt verständlich
- Scores wirken plausibel
- Outreach klingt natürlich
- Kosten pro Audit bleiben im Zielbereich
- UI zeigt klare Fehler

---

## 28. Kostenmodell

### Zu messende Kosten pro Audit

- ScreenshotOne Requests
- PageSpeed Requests
- Jina/Content Extraction
- LLM Input Tokens
- LLM Output Tokens
- Business Data Lookup
- Storage
- E-Mail/Transactional
- Convex Rate Limiter / optional Redis anteilig

### Ziel

Für MVP sollte ein Standard-Audit möglichst deutlich unter 0,50 € variablen Kosten bleiben. Je nach Provider und LLM-Modell kann dieser Zielwert angepasst werden.

### Produktregel

Teure Provider-Aufrufe sollten nur stattfinden, wenn:

- URL validiert ist
- User Credits hat
- Rate Limit bestanden
- Audit nicht bereits kürzlich für dieselbe URL erstellt wurde

---

## 29. Caching

### Warum

Viele Nutzer könnten dieselbe Website mehrfach testen. Caching reduziert Kosten und beschleunigt Audits.

### Caching-Regeln

- PageSpeed Ergebnisse 24–72 Stunden cachen
- Screenshots 24 Stunden wiederverwenden, wenn gleicher Audit-Typ
- Content Extraction 24 Stunden cachen
- Business Data Ergebnisse 7–30 Tage cachen
- LLM-Auswertung nicht blind wiederverwenden, wenn Branding/Sprache anders ist

### Akzeptanzkriterien

- Cache darf keine falschen Workspace-Daten mischen.
- Public Report bleibt stabil.
- Nutzer kann optional Re-Audit erzwingen.

---

## 30. Open Questions

Diese Fragen blockieren den MVP nicht, sollten aber früh entschieden werden:

1. Startet die UI auf Deutsch oder Englisch?
2. Wird Lemon Squeezy oder Stripe verwendet?
3. Soll Lead Search direkt in V1 enthalten sein oder erst nach URL-Audit-Validierung?
4. Welche Business-Data-API ist für DACH am zuverlässigsten?
5. Werden Screenshots dauerhaft gespeichert oder nach 90 Tagen gelöscht?
6. Soll Free Plan 3 Audits einmalig oder monatlich enthalten?
7. Soll Public Report standardmäßig aktiviert sein?
8. Soll der Report standardmäßig `noindex` sein?
9. Gibt es einen expliziten Disclaimer zur rechtmäßigen Kontaktaufnahme?
10. Soll der Score eher streng oder freundlich sein?

---

## 31. Initiale Produkttexte

### 31.1 Landingpage Headline

```text
Website-Audits, die Kundengespräche starten.
```

### 31.2 Subheadline

```text
SitePitch hilft Webdesignern, potenzielle Kunden-Websites zu analysieren und daraus gebrandete Audit-Reports, konkrete Verbesserungschancen und Outreach-Texte zu erstellen.
```

### 31.3 CTA

```text
Ersten Audit erstellen
```

### 31.4 Feature Bullets

```text
✓ Analysiere potenzielle Kunden-Websites in Minuten
✓ Erstelle gebrandete Reports mit konkreten Chancen
✓ Generiere Outreach-Texte für E-Mail, LinkedIn und Kontaktformulare
✓ Priorisiere Leads nach Website-Potenzial
✓ Teile Reports per öffentlichem Link
```

### 31.5 Pricing CTA

```text
Ein gewonnener Kunde zahlt SitePitch für Monate.
```

---

## 32. Erfolgskriterien nach 30 Tagen

Das Produkt gilt als validiert, wenn mindestens 3 der folgenden Kriterien erreicht werden:

- 10 zahlende Nutzer
- 300 erstellte Audits
- 100 kopierte Outreach-Texte
- mindestens 5 Nutzer erstellen mehr als 10 Audits
- mindestens 1 Nutzer berichtet von gewonnenem Erstgespräch
- Free → Paid Conversion über 5 %
- durchschnittliche variable Kosten pro Audit unter kalkuliertem Zielwert
- weniger als 10 % Audit-Failure-Rate bei normalen Websites

---

## 33. Zusammenfassung

SitePitch ist ein fokussiertes Micro-SaaS für Webdesigner und kleine Agenturen. Der MVP sollte nicht versuchen, ein vollständiges SEO-, CRM- oder Outreach-System zu sein. Der Wert entsteht durch einen klaren, wiederholbaren Workflow:

```text
Potenzielle Kundenwebsite → objektiver Audit → gebrandeter Report → besserer Gesprächseinstieg
```

Die technische Umsetzung sollte stabil, modular und kostenbewusst sein. Convex eignet sich als Realtime-Backend und Orchestrierungsschicht, Next.js als Produkt- und Report-Frontend, externe Provider liefern Screenshots, Content und Performance-Daten, und KI übersetzt strukturierte Befunde in verständliche Reports und Outreach-Texte.

Der wichtigste Grundsatz:

> **SitePitch verkauft keine Analyse. SitePitch verkauft bessere Akquise-Gespräche.**
