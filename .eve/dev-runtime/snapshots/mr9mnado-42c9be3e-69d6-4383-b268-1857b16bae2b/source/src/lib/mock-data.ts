import type {
  Audit,
  Lead,
  Campaign,
  Activity,
  Workspace,
  CategoryScore,
  CategoryKey,
} from "./types"

const now = Date.now()
const h = 3600_000
const d = 24 * h
const ago = (ms: number) => new Date(now - ms).toISOString()

const CATEGORY_META: { key: CategoryKey; label: string; weight: number }[] = [
  { key: "conversion", label: "Conversion", weight: 25 },
  { key: "seoBasics", label: "SEO Basics", weight: 20 },
  { key: "localSeo", label: "Local SEO", weight: 20 },
  { key: "performance", label: "Performance", weight: 15 },
  { key: "mobileUx", label: "Mobile UX", weight: 10 },
  { key: "trust", label: "Trust", weight: 10 },
]

function cats(values: Record<CategoryKey, number>): CategoryScore[] {
  return CATEGORY_META.map((c) => ({ ...c, score: values[c.key] }))
}

function overall(scores: CategoryScore[]): number {
  const total = scores.reduce((sum, c) => sum + c.score * c.weight, 0)
  return Math.round(total / 100)
}

export const workspace: Workspace = {
  name: "Nordpixel Studio",
  plan: "agency",
  accentColor: "#5b5bd6",
  website: "nordpixel.studio",
  contactEmail: "hallo@nordpixel.studio",
  ctaText: "Kostenloses Erstgespräch buchen",
  ctaUrl: "https://cal.com/nordpixel/audit",
  language: "de",
  showPoweredBy: false,
  monthlyCredits: 300,
  usedCredits: 187,
  seats: [
    { name: "Jana Roth", email: "jana@nordpixel.studio", role: "owner", initials: "JR" },
    { name: "Tim Krause", email: "tim@nordpixel.studio", role: "member", initials: "TK" },
    { name: "Lea Sommer", email: "lea@nordpixel.studio", role: "member", initials: "LS" },
    { name: "Ben Vogel", email: "ben@nordpixel.studio", role: "viewer", initials: "BV" },
  ],
  templates: [
    { id: "tpl_1", name: "Erstkontakt Zahnärzte", channel: "email", tone: "Freundlich", usageCount: 24, updatedAt: ago(6 * d) },
    { id: "tpl_2", name: "Follow-up nach Report-View", channel: "email", tone: "Beratend", usageCount: 11, updatedAt: ago(2 * d) },
    { id: "tpl_3", name: "LinkedIn Direktnachricht", channel: "linkedin", tone: "Direkt", usageCount: 8, updatedAt: ago(9 * d) },
    { id: "tpl_4", name: "Telefonnotiz Handwerk", channel: "phone_note", tone: "Freundlich", usageCount: 5, updatedAt: ago(14 * d) },
  ],
}

export const campaigns: Campaign[] = [
  {
    id: "cmp_1",
    name: "Zahnärzte Leipzig",
    targetIndustry: "Zahnarzt",
    targetCity: "Leipzig",
    offerType: "relaunch",
    language: "de",
    status: "active",
    leadCount: 38,
    auditCount: 24,
    outreachCopied: 19,
    reportViews: 61,
    won: 2,
    lost: 4,
    createdAt: ago(21 * d),
  },
  {
    id: "cmp_2",
    name: "Restaurants Prenzlauer Berg",
    targetIndustry: "Restaurant",
    targetCity: "Berlin",
    offerType: "conversion",
    language: "de",
    status: "active",
    leadCount: 27,
    auditCount: 18,
    outreachCopied: 12,
    reportViews: 44,
    won: 1,
    lost: 2,
    createdAt: ago(12 * d),
  },
  {
    id: "cmp_3",
    name: "Handwerker München",
    targetIndustry: "SHK / Handwerk",
    targetCity: "München",
    offerType: "seo",
    language: "de",
    status: "paused",
    leadCount: 44,
    auditCount: 9,
    outreachCopied: 5,
    reportViews: 13,
    won: 0,
    lost: 1,
    createdAt: ago(30 * d),
  },
  {
    id: "cmp_4",
    name: "Steuerkanzleien DACH",
    targetIndustry: "Steuerberatung",
    targetCity: "Hamburg",
    offerType: "maintenance",
    language: "de",
    status: "draft",
    leadCount: 12,
    auditCount: 0,
    outreachCopied: 0,
    reportViews: 0,
    won: 0,
    lost: 0,
    createdAt: ago(2 * d),
  },
]

// ---- Featured audit: fully detailed ----
const dentalScores = cats({
  conversion: 44,
  seoBasics: 61,
  localSeo: 38,
  performance: 55,
  mobileUx: 47,
  trust: 52,
})

const dentalAudit: Audit = {
  id: "aud_1001",
  businessName: "Zahnarztpraxis Dr. Weber",
  url: "https://zahnarzt-weber-leipzig.de",
  domain: "zahnarzt-weber-leipzig.de",
  city: "Leipzig",
  industry: "Zahnarzt",
  status: "completed",
  progress: 100,
  overallScore: overall(dentalScores),
  categoryScores: dentalScores,
  summary: {
    short:
      "Die Website macht grundsätzlich einen seriösen Eindruck, verschenkt aber Potenzial bei der mobilen Kontaktaufnahme, der lokalen Auffindbarkeit und dem Vertrauensaufbau. Besonders auf Smartphones könnte ein klarerer Kontaktbereich helfen, mehr Anfragen aus bestehenden Besuchern zu gewinnen.",
    strengths: [
      "HTTPS ist aktiv und die Startseite lädt zuverlässig",
      "Ein aussagekräftiger Seitentitel ist vorhanden",
      "Leistungen sind grundsätzlich benannt",
    ],
    weaknesses: [
      "Der Kontaktbereich ist auf dem Smartphone nicht sofort sichtbar",
      "Lokale Suchbegriffe fehlen prominent auf der Startseite",
      "Es fehlen sichtbare Bewertungen oder Referenzen",
    ],
    topOpportunities: [
      "Klickbare Telefonnummer im mobilen Header ergänzen",
      "LocalBusiness-Schema für bessere lokale Auffindbarkeit einbauen",
      "Patientenstimmen sichtbar oberhalb der Faltung platzieren",
      "Primären Kontakt-CTA im Hero-Bereich hervorheben",
      "Meta Description mit Stadt und Leistung optimieren",
    ],
  },
  findings: [
    {
      id: "f1",
      category: "mobile",
      severity: "high",
      title: "Kontaktaufnahme auf dem Smartphone erschwert",
      evidence: "Im mobilen Screenshot ist kein klickbarer Kontakt-Button im ersten sichtbaren Bereich erkennbar.",
      explanation:
        "Viele Patienten suchen unterwegs nach einem Zahnarzt. Wenn Telefon oder Termin-Button nicht sofort sichtbar sind, springen Interessenten häufiger ab.",
      recommendation:
        "Eine klickbare Telefonnummer und einen Termin-Button fest im mobilen Header verankern.",
      salesAngle:
        "Ein klarerer Kontaktbereich könnte Interessenten schneller zur Anfrage führen — ein konkreter, schnell umsetzbarer Hebel.",
    },
    {
      id: "f2",
      category: "local_seo",
      severity: "high",
      title: "Lokale Signale nur schwach ausgeprägt",
      evidence: "LocalBusiness-Schema wurde nicht gefunden; die Stadt wird auf der Startseite nur beiläufig genannt.",
      explanation:
        "Suchmaschinen ordnen lokale Anbieter besser ein, wenn Ort, Adresse und strukturierte Daten klar hinterlegt sind.",
      recommendation:
        "LocalBusiness-Schema ergänzen und 'Zahnarzt Leipzig' prominent in Titel und H1 aufnehmen.",
      salesAngle:
        "Die lokale Auffindbarkeit ließe sich mit wenigen strukturellen Anpassungen verbessern.",
    },
    {
      id: "f3",
      category: "trust",
      severity: "medium",
      title: "Vertrauenselemente sind kaum sichtbar",
      evidence: "Auf der Startseite wurden keine Bewertungen, Siegel oder Patientenstimmen erkannt.",
      explanation:
        "Gerade im Gesundheitsbereich entscheidet Vertrauen. Sichtbare Referenzen senken die Hemmschwelle für eine Anfrage.",
      recommendation:
        "Zwei bis drei kurze Patientenstimmen oder eine Google-Bewertungssumme oberhalb der Faltung einbinden.",
      salesAngle:
        "Ein sichtbarer Vertrauensbereich macht aus Besuchern eher Anfragen.",
    },
    {
      id: "f4",
      category: "conversion",
      severity: "medium",
      title: "Kein eindeutiger primärer Call-to-Action",
      evidence: "Im Hero-Bereich konkurrieren mehrere Links, ohne dass ein Hauptziel erkennbar ist.",
      explanation:
        "Wenn Besucher nicht sofort wissen, was der nächste Schritt ist, sinkt die Anfrage-Rate.",
      recommendation:
        "Einen dominanten 'Termin vereinbaren'-Button setzen und sekundäre Links visuell zurücknehmen.",
      salesAngle:
        "Ein klarer nächster Schritt kann die Zahl der Terminanfragen spürbar erhöhen.",
    },
    {
      id: "f5",
      category: "performance",
      severity: "medium",
      title: "Mobile Ladezeit ausbaufähig",
      evidence: "PageSpeed Mobile liegt bei 55; große, unkomprimierte Bilder verzögern den ersten Seiteninhalt.",
      explanation:
        "Langsame Seiten führen mobil zu höheren Absprüngen, besonders bei unterwegs suchenden Nutzern.",
      recommendation:
        "Hero-Bilder komprimieren und modernes Bildformat sowie Lazy-Loading einsetzen.",
      salesAngle:
        "Eine flottere mobile Seite hält mehr Besucher — mit vergleichsweise geringem Aufwand.",
    },
    {
      id: "f6",
      category: "seo",
      severity: "low",
      title: "Meta Description ohne lokalen Bezug",
      evidence: "Die Meta Description enthält keinen Stadt- oder Leistungsbezug.",
      explanation:
        "Eine präzise Beschreibung verbessert die Klickrate aus den Suchergebnissen.",
      recommendation:
        "Meta Description mit 'Zahnarzt in Leipzig' und Kernleistung neu formulieren.",
      salesAngle:
        "Kleine Textanpassung mit direktem Effekt auf die Sichtbarkeit.",
    },
  ],
  checks: [
    { key: "https", label: "HTTPS aktiv", status: "passed", category: "technical" },
    { key: "title", label: "Seitentitel vorhanden", status: "passed", category: "seo" },
    { key: "meta_desc", label: "Meta Description optimiert", status: "warning", category: "seo" },
    { key: "h1", label: "Eindeutige H1", status: "passed", category: "seo" },
    { key: "schema_local", label: "LocalBusiness-Schema", status: "failed", category: "local_seo" },
    { key: "phone_clickable", label: "Telefonnummer klickbar (mobil)", status: "failed", category: "mobile" },
    { key: "cta_hero", label: "Primärer CTA im Hero", status: "warning", category: "conversion" },
    { key: "reviews", label: "Bewertungen sichtbar", status: "failed", category: "trust" },
    { key: "imprint", label: "Impressum gefunden", status: "passed", category: "technical" },
    { key: "sitemap", label: "sitemap.xml erreichbar", status: "passed", category: "technical" },
  ],
  outreach: [
    {
      type: "email",
      label: "E-Mail",
      subject: "Kurzer Website-Audit zu Ihrer Praxis",
      body: `Hallo Team der Praxis Dr. Weber,

ich bin bei der Suche nach Zahnärzten in Leipzig auf Ihre Website gestoßen und habe kurz geprüft, wie gut sie aktuell auf neue Patientenanfragen vorbereitet ist.

Dabei sind mir ein paar konkrete Punkte aufgefallen — unter anderem bei der mobilen Kontaktaufnahme, der lokalen Auffindbarkeit und sichtbaren Patientenstimmen.

Ich habe daraus einen kurzen, verständlichen Audit erstellt:
https://trysitepitch.com/r/zw-leipzig-8f2a

Vielleicht ist das für Sie interessant — unabhängig davon, ob Sie gerade aktiv über Ihre Website nachdenken.

Viele Grüße
Jana Roth
Nordpixel Studio`,
    },
    {
      type: "linkedin",
      label: "LinkedIn / Kontaktformular",
      body: `Hallo, ich habe mir Ihre Praxis-Website kurz angesehen und einen kompakten Audit erstellt. Aufgefallen sind mir vor allem die mobile Kontaktaufnahme und die lokale Auffindbarkeit — beides gut verbesserbar. Falls interessant, teile ich den Report gern.`,
    },
    {
      type: "phone_note",
      label: "Telefonnotiz",
      body: `• Einstieg: Website in Leipzig-Suche gefunden, kurzer Audit erstellt
• Hauptpunkt: Kontakt auf Smartphone schwer auffindbar
• Zweiter Punkt: lokale Auffindbarkeit ausbaufähig (Schema, Stadt im Titel)
• Angebot: kurzes Erstgespräch, Report als Grundlage
• Ton: freundlich, keine Dringlichkeit`,
    },
  ],
  outreachStatus: "copied",
  leadStatus: "contacted",
  campaignId: "cmp_1",
  engagement: { views: 4, reopened: true, ctaClicks: 1, pdfDownloads: 1, lastViewedAt: ago(5 * h) },
  screenshotDesktop: "/audit-dental-desktop.webp",
  screenshotMobile: "/audit-dental-mobile.webp",
  isPublic: true,
  publicSlug: "zw-leipzig-8f2a",
  createdAt: ago(2 * d),
  completedAt: ago(2 * d - 3 * h),
}

const restaurantScores = cats({
  conversion: 72,
  seoBasics: 68,
  localSeo: 74,
  performance: 66,
  mobileUx: 78,
  trust: 70,
})

const restaurantAudit: Audit = {
  id: "aud_1002",
  businessName: "Ristorante Bella Vista",
  url: "https://bellavista-berlin.de",
  domain: "bellavista-berlin.de",
  city: "Berlin",
  industry: "Restaurant",
  status: "completed",
  progress: 100,
  overallScore: overall(restaurantScores),
  categoryScores: restaurantScores,
  summary: {
    short:
      "Ein moderner, ansprechender Auftritt mit klarer Reservierungsoption. Potenzial liegt vor allem in schnelleren Ladezeiten und einer strukturierteren lokalen Darstellung, um noch mehr Reservierungen aus der lokalen Suche zu gewinnen.",
    strengths: [
      "Klare Reservierungs-Buttons sind gut sichtbar",
      "Mobile Darstellung ist sauber und lesbar",
      "Appetitliche Bildsprache stärkt den ersten Eindruck",
    ],
    weaknesses: [
      "Ladezeit durch große Bilder verbesserbar",
      "Öffnungszeiten nicht strukturiert ausgezeichnet",
      "Speisekarte nur als PDF, nicht als Text",
    ],
    topOpportunities: [
      "Bilder für schnelleres Laden optimieren",
      "Öffnungszeiten mit Schema auszeichnen",
      "Speisekarte als HTML-Text für SEO ergänzen",
      "Google-Bewertungen sichtbar einbinden",
      "Reservierungs-CTA auch im Footer wiederholen",
    ],
  },
  findings: [
    {
      id: "rf1",
      category: "performance",
      severity: "medium",
      title: "Große Bilder verzögern das Laden",
      evidence: "Der Hero-Bereich lädt mehrere unkomprimierte Fotos über 1 MB.",
      explanation: "Auf Mobilgeräten kann das den ersten Eindruck verzögern.",
      recommendation: "Bilder komprimieren und in modernem Format ausliefern.",
      salesAngle: "Schnelleres Laden hält mehr hungrige Gäste auf der Seite.",
    },
    {
      id: "rf2",
      category: "local_seo",
      severity: "medium",
      title: "Öffnungszeiten nicht strukturiert",
      evidence: "Öffnungszeiten stehen im Text, aber ohne strukturierte Auszeichnung.",
      explanation: "Ausgezeichnete Zeiten erscheinen direkt in Google und Maps.",
      recommendation: "Öffnungszeiten per Schema hinterlegen.",
      salesAngle: "Bessere Sichtbarkeit direkt im Suchergebnis.",
    },
    {
      id: "rf3",
      category: "seo",
      severity: "low",
      title: "Speisekarte nur als PDF",
      evidence: "Die Karte ist ausschließlich als PDF eingebunden.",
      explanation: "Suchmaschinen lesen HTML-Text besser als PDFs.",
      recommendation: "Karte zusätzlich als HTML-Seite anbieten.",
      salesAngle: "Mehr relevante Inhalte für lokale Suchanfragen.",
    },
  ],
  checks: [
    { key: "https", label: "HTTPS aktiv", status: "passed", category: "technical" },
    { key: "cta_hero", label: "Primärer CTA im Hero", status: "passed", category: "conversion" },
    { key: "mobile", label: "Mobile Darstellung sauber", status: "passed", category: "mobile" },
    { key: "images", label: "Bilder optimiert", status: "failed", category: "performance" },
    { key: "hours_schema", label: "Öffnungszeiten ausgezeichnet", status: "warning", category: "local_seo" },
    { key: "menu_html", label: "Speisekarte als Text", status: "warning", category: "seo" },
  ],
  outreach: [
    {
      type: "email",
      label: "E-Mail",
      subject: "Kleiner Blick auf Ihre Restaurant-Website",
      body: `Hallo Team vom Bella Vista,

Ihre Website macht wirklich Appetit — sehr schöner Auftritt. Ich habe mir kurz angeschaut, wie gut sie für Reservierungen aus der lokalen Suche aufgestellt ist, und einen kompakten Audit erstellt:
https://trysitepitch.com/r/bella-berlin-4c1d

Zwei, drei Punkte ließen sich mit wenig Aufwand verbessern — etwa Ladezeit und strukturierte Öffnungszeiten.

Viele Grüße
Jana Roth`,
    },
    {
      type: "linkedin",
      label: "LinkedIn / Kontaktformular",
      body: `Hallo! Sehr schöner Website-Auftritt. Ich habe einen kurzen Audit gemacht — kleine Hebel bei Ladezeit und lokaler Sichtbarkeit. Teile ich gern.`,
    },
    {
      type: "phone_note",
      label: "Telefonnotiz",
      body: `• Kompliment: moderner Auftritt, gute Bilder
• Punkt 1: Ladezeit durch Bilder
• Punkt 2: Öffnungszeiten strukturiert auszeichnen
• Angebot: kurzer Performance-Check`,
    },
  ],
  outreachStatus: "copied",
  leadStatus: "interested",
  campaignId: "cmp_2",
  engagement: { views: 7, reopened: true, ctaClicks: 2, pdfDownloads: 0, lastViewedAt: ago(20 * h) },
  history: [
    { overallScore: 63, label: "Erst-Audit", at: ago(24 * d) },
    { overallScore: 71, label: "Re-Audit", at: ago(4 * d) },
  ],
  screenshotDesktop: "/audit-restaurant-desktop.webp",
  isPublic: true,
  publicSlug: "bella-berlin-4c1d",
  createdAt: ago(4 * d),
  completedAt: ago(4 * d - 2 * h),
}

function quickAudit(
  id: string,
  businessName: string,
  domain: string,
  city: string,
  industry: string,
  scoreMap: Record<CategoryKey, number>,
  opts: Partial<Audit> = {}
): Audit {
  const cs = cats(scoreMap)
  return {
    id,
    businessName,
    url: `https://${domain}`,
    domain,
    city,
    industry,
    status: "completed",
    progress: 100,
    overallScore: overall(cs),
    categoryScores: cs,
    summary: {
      short: "",
      strengths: [],
      weaknesses: [],
      topOpportunities: [],
    },
    findings: [],
    checks: [],
    outreach: [],
    outreachStatus: "not_started",
    leadStatus: "audited",
    engagement: { views: 0, reopened: false, ctaClicks: 0, pdfDownloads: 0 },
    isPublic: true,
    publicSlug: id,
    createdAt: ago(6 * d),
    completedAt: ago(6 * d - 2 * h),
    ...opts,
  }
}

export const audits: Audit[] = [
  dentalAudit,
  restaurantAudit,
  quickAudit("aud_1003", "Praxis Dr. Lindemann", "zahnarzt-lindemann.de", "Leipzig", "Zahnarzt",
    { conversion: 31, seoBasics: 42, localSeo: 28, performance: 48, mobileUx: 35, trust: 30 },
    { leadStatus: "new", outreachStatus: "not_started", campaignId: "cmp_1", engagement: { views: 0, reopened: false, ctaClicks: 0, pdfDownloads: 0 }, createdAt: ago(1 * d) }),
  quickAudit("aud_1004", "Dental Konzept Leipzig", "dentalkonzept-le.de", "Leipzig", "Zahnarzt",
    { conversion: 58, seoBasics: 64, localSeo: 55, performance: 70, mobileUx: 62, trust: 60 },
    { leadStatus: "contacted", outreachStatus: "copied", campaignId: "cmp_1", engagement: { views: 3, reopened: false, ctaClicks: 0, pdfDownloads: 0, lastViewedAt: ago(2 * d) }, createdAt: ago(3 * d) }),
  quickAudit("aud_1005", "Trattoria Sole", "trattoria-sole.de", "Berlin", "Restaurant",
    { conversion: 66, seoBasics: 60, localSeo: 71, performance: 58, mobileUx: 72, trust: 64 },
    { leadStatus: "won", outreachStatus: "sent", campaignId: "cmp_2", engagement: { views: 9, reopened: true, ctaClicks: 3, pdfDownloads: 1, lastViewedAt: ago(30 * h) }, history: [{ overallScore: 48, label: "Erst-Audit", at: ago(40 * d) }, { overallScore: 57, label: "Re-Audit", at: ago(20 * d) }, { overallScore: 65, label: "Nach Relaunch", at: ago(8 * d) }], createdAt: ago(8 * d) }),
  quickAudit("aud_1006", "SHK Bauer & Söhne", "shk-bauer.de", "München", "SHK / Handwerk",
    { conversion: 40, seoBasics: 38, localSeo: 44, performance: 52, mobileUx: 41, trust: 46 },
    { leadStatus: "follow_up", outreachStatus: "copied", campaignId: "cmp_3", engagement: { views: 2, reopened: false, ctaClicks: 0, pdfDownloads: 0, lastViewedAt: ago(4 * d) }, createdAt: ago(5 * d) }),
  quickAudit("aud_1007", "Café Morgenrot", "cafe-morgenrot.de", "Berlin", "Café",
    { conversion: 82, seoBasics: 78, localSeo: 80, performance: 74, mobileUx: 85, trust: 79 },
    { leadStatus: "lost", outreachStatus: "sent", campaignId: "cmp_2", engagement: { views: 5, reopened: false, ctaClicks: 1, pdfDownloads: 0, lastViewedAt: ago(6 * d) }, createdAt: ago(9 * d) }),
  {
    ...quickAudit("aud_1008", "Elektro Sturm GmbH", "elektro-sturm.de", "München", "Handwerk",
      { conversion: 0, seoBasics: 0, localSeo: 0, performance: 0, mobileUx: 0, trust: 0 }),
    status: "running",
    progress: 62,
    overallScore: undefined,
    leadStatus: "audited",
    createdAt: ago(6 * 60000),
  },
  {
    ...quickAudit("aud_1009", "Kanzlei Hoffmann", "kanzlei-hoffmann.de", "Hamburg", "Steuerberatung",
      { conversion: 0, seoBasics: 0, localSeo: 0, performance: 0, mobileUx: 0, trust: 0 }),
    status: "failed",
    progress: 40,
    overallScore: undefined,
    leadStatus: "new",
    errorMessage: "Website hat den Zugriff blockiert (403). Bitte URL prüfen oder erneut versuchen.",
    createdAt: ago(3 * h),
    completedAt: undefined,
  },
]

export const leads: Lead[] = [
  { id: "ld_1", businessName: "Zahnarztpraxis Dr. Weber", websiteUrl: "zahnarzt-weber-leipzig.de", category: "Zahnarzt", city: "Leipzig", phone: "+49 341 1234567", address: "Karl-Liebknecht-Str. 12, Leipzig", status: "contacted", campaignId: "cmp_1", auditId: "aud_1001", score: dentalAudit.overallScore, lastContactedAt: ago(1 * d), note: "Report geöffnet, Rückmeldung abwarten.", createdAt: ago(2 * d) },
  { id: "ld_2", businessName: "Praxis Dr. Lindemann", websiteUrl: "zahnarzt-lindemann.de", category: "Zahnarzt", city: "Leipzig", phone: "+49 341 9988776", status: "new", campaignId: "cmp_1", auditId: "aud_1003", score: 34, createdAt: ago(1 * d) },
  { id: "ld_3", businessName: "Dental Konzept Leipzig", websiteUrl: "dentalkonzept-le.de", category: "Zahnarzt", city: "Leipzig", status: "contacted", campaignId: "cmp_1", auditId: "aud_1004", score: 60, lastContactedAt: ago(3 * d), createdAt: ago(3 * d) },
  { id: "ld_4", businessName: "Zahnzentrum Süd", category: "Zahnarzt", city: "Leipzig", phone: "+49 341 5544332", status: "new", campaignId: "cmp_1", note: "Keine Website — nicht auditierbar.", createdAt: ago(1 * d) },
  { id: "ld_5", businessName: "Ristorante Bella Vista", websiteUrl: "bellavista-berlin.de", category: "Restaurant", city: "Berlin", phone: "+49 30 4433221", status: "interested", campaignId: "cmp_2", auditId: "aud_1002", score: restaurantAudit.overallScore, followUpAt: ago(-2 * d), lastContactedAt: ago(4 * d), note: "Will Angebot für Performance-Optimierung.", createdAt: ago(4 * d) },
  { id: "ld_6", businessName: "Trattoria Sole", websiteUrl: "trattoria-sole.de", category: "Restaurant", city: "Berlin", status: "won", campaignId: "cmp_2", auditId: "aud_1005", score: 66, lastContactedAt: ago(8 * d), note: "Relaunch beauftragt.", createdAt: ago(8 * d) },
  { id: "ld_7", businessName: "SHK Bauer & Söhne", websiteUrl: "shk-bauer.de", category: "SHK / Handwerk", city: "München", phone: "+49 89 2211334", status: "follow_up", campaignId: "cmp_3", auditId: "aud_1006", score: 43, followUpAt: ago(-1 * d), lastContactedAt: ago(4 * d), createdAt: ago(5 * d) },
  { id: "ld_8", businessName: "Café Morgenrot", websiteUrl: "cafe-morgenrot.de", category: "Café", city: "Berlin", status: "lost", campaignId: "cmp_2", auditId: "aud_1007", score: 80, note: "Zufrieden mit aktueller Seite.", createdAt: ago(9 * d) },
  { id: "ld_9", businessName: "Kanzlei Hoffmann", websiteUrl: "kanzlei-hoffmann.de", category: "Steuerberatung", city: "Hamburg", status: "new", campaignId: "cmp_4", createdAt: ago(2 * h) },
  { id: "ld_10", businessName: "Elektro Sturm GmbH", websiteUrl: "elektro-sturm.de", category: "Handwerk", city: "München", status: "audited", campaignId: "cmp_3", auditId: "aud_1008", createdAt: ago(10 * 60000) },
]

export const activities: Activity[] = [
  { id: "ac1", type: "report_viewed", business: "Ristorante Bella Vista", detail: "Report erneut geöffnet · CTA geklickt", at: ago(20 * h) },
  { id: "ac2", type: "report_viewed", business: "Zahnarztpraxis Dr. Weber", detail: "Report geöffnet · PDF heruntergeladen", at: ago(5 * h) },
  { id: "ac3", type: "outreach_copied", business: "Dental Konzept Leipzig", detail: "E-Mail-Text kopiert", at: ago(2 * d) },
  { id: "ac4", type: "status_changed", business: "Trattoria Sole", detail: "Status auf »Gewonnen« gesetzt", at: ago(30 * h) },
  { id: "ac5", type: "audit_completed", business: "SHK Bauer & Söhne", detail: "Audit abgeschlossen · Score 43", at: ago(5 * d) },
  { id: "ac6", type: "follow_up_scheduled", business: "SHK Bauer & Söhne", detail: "Follow-up für morgen geplant", at: ago(4 * d) },
]

export const auditById = (id: string) => audits.find((a) => a.id === id)
export const campaignById = (id: string) => campaigns.find((c) => c.id === id)
