export const HOME_SECTION_ORDER = [
  "hero",
  "vergleich",
  "workflow",
  "beispiel-report",
  "funktionen",
  "preise",
  "faq",
  "start",
] as const

export const publicNavigation = {
  features: [
    { label: "Website-Audits", description: "Conversion, SEO, Mobile UX und Vertrauen prüfen", href: "/#funktionen" },
    { label: "Gebrandete Reports", description: "Belege und Empfehlungen professionell teilen", href: "/#beispiel-report" },
    { label: "Outreach-Entwürfe", description: "Konkrete Ansprache für passende Kanäle vorbereiten", href: "/#funktionen" },
    { label: "Lead-Priorisierung", description: "Websites mit erkennbarem Potenzial fokussieren", href: "/#workflow" },
    { label: "Demo-Audit", description: "Den begrenzten öffentlichen Ablauf testen", href: "/demo" },
    { label: "Beispielreports", description: "Drei statische Reports ohne Anbieteraufrufe ansehen", href: "/examples" },
  ],
  links: [
    { label: "So funktioniert's", href: "/#workflow" },
    { label: "Beispiele", href: "/examples" },
    { label: "Preise", href: "/pricing" },
    { label: "FAQ", href: "/#faq" },
  ],
  login: { label: "Einloggen", href: "/login" },
  primaryCta: { label: "Demo-Audit starten", href: "/demo" },
} as const

export const PRICING_CATALOG = {
  trial: {
    name: "Testguthaben",
    credits: 3,
    description: "Einmalig 3 Audits zum Kennenlernen. Danach ist ein Plan oder Credit-Paket erforderlich.",
  },
  plans: [
    {
      id: "starter",
      name: "Starter",
      monthlyPriceEuro: 19,
      credits: 25,
      description: "Für den regelmäßigen Einstieg in audit-gestützte Akquise.",
      features: ["25 Audits pro Monat", "Gebrandete Online-Reports", "Outreach-Texte"],
      ctaLabel: "Starter testen",
      ctaHref: "/signup",
      featured: false,
    },
    {
      id: "pro",
      name: "Pro",
      monthlyPriceEuro: 49,
      credits: 100,
      description: "Für Webdesigner mit einem wiederholbaren Akquise-Rhythmus.",
      features: ["100 Audits pro Monat", "Eigenes Branding", "PDF-Export"],
      ctaLabel: "Pro testen",
      ctaHref: "/signup",
      featured: true,
    },
    {
      id: "agency",
      name: "Agency",
      monthlyPriceEuro: 99,
      credits: 300,
      description: "Für kleine Agenturen mit größerem Lead-Volumen.",
      features: [
        "300 Audits pro Monat",
        "Batch-Audits mit bis zu 100 URLs",
        "White-Label Light und Custom Domain",
        "Eigenes Branding und PDF",
        "Public API und Webhooks",
      ],
      ctaLabel: "Agency testen",
      ctaHref: "/signup",
      featured: false,
    },
  ],
  extraPack: {
    name: "Extra-Credits",
    priceEuro: 10,
    credits: 25,
    description: "Einmalige 25 zusätzliche Audits; Extra-Credits verfallen nicht am Monatsende.",
    ctaLabel: "Im Workspace kaufen",
    ctaHref: "/app/settings/billing",
  },
} as const

export const workflowSteps = [
  {
    number: "01",
    title: "Find",
    description: "Sammle passende Unternehmen und priorisiere Websites mit sichtbarem Verbesserungspotenzial.",
  },
  {
    number: "02",
    title: "Audit",
    description: "Prüfe Conversion, SEO-Basics, Local SEO, Performance, Mobile UX und Vertrauen.",
  },
  {
    number: "03",
    title: "Pitch",
    description: "Teile einen gebrandeten Report und formuliere eine konkrete, respektvolle Ansprache.",
  },
] as const

export const capabilityItems = [
  {
    title: "Konkrete Findings",
    description: "Jede Chance verbindet nachvollziehbaren Beleg, Auswirkung und Empfehlung.",
  },
  {
    title: "Gebrandete Reports",
    description: "Teile deine Analyse als fokussierten Online-Report statt als lose Notizen.",
  },
  {
    title: "Outreach-Entwürfe",
    description: "Erzeuge passende Entwürfe für E-Mail, LinkedIn und Kontaktformulare.",
  },
  {
    title: "Lead-Priorisierung",
    description: "Konzentriere dich auf Websites, bei denen dein Angebot konkret helfen kann.",
  },
  {
    title: "Credit-Kontrolle",
    description: "Sieh vor kostenrelevanten Aktionen, welche Credits benötigt werden.",
  },
] as const

export const faqItems = [
  {
    question: "Für wen ist SitePitch gedacht?",
    answer: "Für deutschsprachige Webdesigner und kleine Agenturen, die potenzielle Kunden mit konkreten Website-Chancen statt mit generischen Kaltakquise-Nachrichten ansprechen möchten.",
  },
  {
    question: "Versendet SitePitch Nachrichten automatisch?",
    answer: "Nein. SitePitch erstellt Outreach-Entwürfe, versendet im MVP aber keine automatischen Massenmails. Du prüfst und entscheidest selbst über jede Kontaktaufnahme.",
  },
  {
    question: "Was kostet ein Audit?",
    answer: "Ein erfolgreich abgeschlossener Audit verbraucht einen Credit. Bei einer sofort abgelehnten URL wird kein Credit verbraucht; fehlgeschlagene Läufe werden nach der Produktregel erstattet.",
  },
  {
    question: "Kann ich einen Report vorab ansehen?",
    answer: "Ja. Unter Beispiele findest du drei statische, schreibgeschützte Reports ohne Anbieteraufrufe, Authentifizierung oder Analytics.",
  },
  {
    question: "Garantiert ein Audit neue Kunden?",
    answer: "Nein. SitePitch liefert ein fundiertes Gesprächsangebot, aber keine Reichweiten-, Antwort- oder Abschlussgarantie.",
  },
] as const

export const footerNavigation = [
  {
    title: "Produkt",
    links: [
      { label: "Demo", href: "/demo" },
      { label: "Beispiele", href: "/examples" },
      { label: "Preise", href: "/pricing" },
    ],
  },
  {
    title: "Unternehmen",
    links: [
      { label: "So funktioniert's", href: "/#workflow" },
      { label: "FAQ", href: "/#faq" },
      { label: "Registrieren", href: "/signup" },
      { label: "Einloggen", href: "/login" },
    ],
  },
  {
    title: "Rechtliches",
    links: [
      { label: "Datenschutz", href: "/privacy" },
      { label: "Nutzungsbedingungen", href: "/terms" },
      { label: "Impressum", href: "/imprint" },
    ],
  },
] as const
