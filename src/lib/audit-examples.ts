import type { AuditReportData } from "@/components/audit-report"

export type AuditExampleSlug = "zahnarzt" | "restaurant" | "handwerk"

export interface AuditExample {
  slug: AuditExampleSlug
  title: string
  industry: string
  readOnly: true
  tracking: "disabled"
  report: AuditReportData
}

const scores = (values: [number, number, number, number, number, number]) => [
  { key: "conversion", label: "Conversion", score: values[0], weight: 25 },
  { key: "seoBasics", label: "SEO-Basics", score: values[1], weight: 15 },
  { key: "localSeo", label: "Local SEO", score: values[2], weight: 20 },
  { key: "performance", label: "Performance", score: values[3], weight: 15 },
  { key: "mobileUx", label: "Mobile UX", score: values[4], weight: 15 },
  { key: "trust", label: "Vertrauen", score: values[5], weight: 10 },
]

function example(
  slug: AuditExampleSlug,
  title: string,
  industry: string,
  domain: string,
  overallScore: number,
  categoryScores: ReturnType<typeof scores>,
  summary: AuditReportData["summary"],
  findings: AuditReportData["findings"],
): AuditExample {
  return {
    slug,
    title,
    industry,
    readOnly: true,
    tracking: "disabled",
    report: {
      domain,
      reportLanguage: "de",
      overallScore,
      categoryScores,
      summary,
      findings,
      nextSteps: summary?.nextSteps ?? [],
      screenshots: { desktop: null, mobile: null },
      branding: {
        name: "SitePitch Beispielreport",
        accentColor: "#5b5bd6",
        ctaSnapshotted: false,
      },
    },
  }
}

export const auditExamples: readonly AuditExample[] = [
  example(
    "zahnarzt",
    "Zahnarztpraxis",
    "Gesundheit",
    "praxis-am-park.example",
    62,
    scores([52, 66, 58, 74, 63, 71]),
    {
      shortSummary: "Die Praxis wirkt professionell, führt neue Patient:innen aber noch nicht schnell genug zu Termin und Anfahrt.",
      strengths: ["Ruhige, vertrauenswürdige Gestaltung", "Leistungen sind verständlich erklärt"],
      weaknesses: ["Termin-CTA ist mobil zu unauffällig", "Lokale Signale fehlen auf wichtigen Seiten"],
      topOpportunities: ["Terminbuchung prominent platzieren", "Standort und Öffnungszeiten konsistent auszeichnen"],
      nextSteps: ["Mobilen Termin-CTA ergänzen", "LocalBusiness-Daten prüfen"],
    },
    [
      { category: "conversion", severity: "high", title: "Terminbuchung ist nicht der klare nächste Schritt", evidence: "Im sichtbaren Startbereich fehlt ein primärer Termin-CTA.", explanation: "Interessierte müssen selbst nach dem Kontaktweg suchen.", recommendation: "Termin-CTA im Header und nach den wichtigsten Leistungen wiederholen.", sortOrder: 1 },
      { category: "local_seo", severity: "medium", title: "Standortsignale sind uneinheitlich", evidence: "Öffnungszeiten und Einzugsgebiet sind nicht zentral gebündelt.", explanation: "Suchmaschinen können den lokalen Bezug schlechter einordnen.", recommendation: "Standortblock und strukturierte Unternehmensdaten ergänzen.", sortOrder: 2 },
    ],
  ),
  example(
    "restaurant",
    "Restaurant",
    "Gastronomie",
    "tisch-und-thymian.example",
    57,
    scores([48, 61, 55, 50, 59, 72]),
    {
      shortSummary: "Das Restaurant vermittelt Atmosphäre, verliert auf dem Smartphone aber Gäste zwischen Speisekarte, Öffnungszeiten und Reservierung.",
      strengths: ["Eigenständige Bildsprache", "Angebot und Küchenstil sind klar"],
      weaknesses: ["Speisekarte lädt langsam", "Reservierung ist erst spät sichtbar"],
      topOpportunities: ["Reservierung dauerhaft erreichbar machen", "Speisekarte mobil und schnell ausliefern"],
      nextSteps: ["Sticky Reservieren-Button testen", "Speisekarten-PDF durch HTML ersetzen"],
    },
    [
      { category: "mobile", severity: "high", title: "Reservierung verschwindet auf kleinen Displays", evidence: "Der Reservierungslink liegt unterhalb langer Inhaltsbereiche.", explanation: "Mobile Gäste brechen den Weg zur Buchung eher ab.", recommendation: "Eine dauerhaft sichtbare, kurze Reservierungsaktion anbieten.", sortOrder: 1 },
      { category: "performance", severity: "medium", title: "Speisekarte bremst den Erstaufruf", evidence: "Die große PDF-Datei wird als primärer Menüweg angeboten.", explanation: "Das erhöht Ladezeit und erschwert die mobile Nutzung.", recommendation: "Kernkarte als zugängliches HTML zeigen und PDF optional lassen.", sortOrder: 2 },
    ],
  ),
  example(
    "handwerk",
    "Handwerksbetrieb",
    "Handwerk",
    "werkstatt-nord.example",
    65,
    scores([56, 68, 63, 79, 66, 58]),
    {
      shortSummary: "Der Betrieb zeigt seine Leistungen solide, kann Vertrauen und qualifizierte Angebotsanfragen jedoch deutlich stärker führen.",
      strengths: ["Schnelle technische Basis", "Leistungsgebiete sind klar gegliedert"],
      weaknesses: ["Referenzen bleiben zu allgemein", "Anfrageformular qualifiziert Projekte kaum"],
      topOpportunities: ["Konkrete Projekte mit Ergebnissen zeigen", "Anfrage nach Leistung, Ort und Zeitrahmen strukturieren"],
      nextSteps: ["Drei Referenzfälle ergänzen", "Formular um Projektfragen erweitern"],
    },
    [
      { category: "trust", severity: "high", title: "Referenzen belegen die Qualität nicht", evidence: "Projektbilder enthalten weder Aufgabe noch Ergebnis.", explanation: "Interessierte können Erfahrung und Passung schwer einschätzen.", recommendation: "Referenzfälle mit Ausgangslage, Leistung und Resultat beschreiben.", sortOrder: 1 },
      { category: "conversion", severity: "medium", title: "Anfragen kommen ohne Projektkontext an", evidence: "Das Formular fragt nur Name, E-Mail und Nachricht ab.", explanation: "Rückfragen verlängern die Qualifizierung.", recommendation: "Leistungsart, Projektort und gewünschten Zeitraum abfragen.", sortOrder: 2 },
    ],
  ),
] as const

export function getAuditExample(slug: string): AuditExample | null {
  return auditExamples.find((item) => item.slug === slug) ?? null
}
