export type PersonaId = "busy_owner" | "mobile_customer" | "skeptical_buyer" | "search_visitor"

export interface PersonaDefinition {
  id: PersonaId
  name: { de: string; en: string }
  lens: { de: string; en: string }
  focus: { de: string[]; en: string[] }
  sortOrder: number
}

export const PERSONA_DEFINITIONS: PersonaDefinition[] = [
  {
    id: "busy_owner",
    sortOrder: 0,
    name: {
      de: "Vielbeschäftigte:r Geschäftsinhaber:in",
      en: "Busy business owner",
    },
    lens: {
      de: "Hat wenig Zeit und entscheidet schnell, ob sich ein Gespräch lohnt.",
      en: "Has little time and decides quickly whether a conversation is worth it.",
    },
    focus: {
      de: [
        "Wird in wenigen Sekunden klar, was angeboten wird?",
        "Ist sofort erkennbar, für wen das Angebot gedacht ist?",
        "Gibt es einen klaren nächsten Schritt oder Kontaktweg?",
        "Wirkt die Seite vertrauenswürdig auf den ersten Blick?",
      ],
      en: [
        "Is it clear within seconds what is being offered?",
        "Is it obvious who the offer is for?",
        "Is there a clear next step or contact option?",
        "Does the page feel trustworthy at first glance?",
      ],
    },
  },
  {
    id: "mobile_customer",
    sortOrder: 1,
    name: {
      de: "Smartphone-Nutzer:in mit konkretem Bedarf",
      en: "Mobile user with a concrete need",
    },
    lens: {
      de: "Nutzt die Website auf dem Handy und möchte schnell handeln.",
      en: "Uses the website on a phone and wants to act quickly.",
    },
    focus: {
      de: [
        "Lassen sich Kontakt und CTA auf dem Smartphone gut erreichen?",
        "Ist die Telefonnummer klickbar und prominent?",
        "Gibt es mobile Friktion bei Texten, Layout oder Bedienung?",
        "Ist der wichtigste Inhalt ohne Scrollen sichtbar?",
      ],
      en: [
        "Are contact and CTA easy to reach on a smartphone?",
        "Is the phone number clickable and prominent?",
        "Is there mobile friction in text, layout, or usability?",
        "Is the most important content visible without scrolling?",
      ],
    },
  },
  {
    id: "skeptical_buyer",
    sortOrder: 2,
    name: {
      de: "Skeptische:r Interessent:in",
      en: "Skeptical prospect",
    },
    lens: {
      de: "Prüft kritisch auf Glaubwürdigkeit, Belege und Transparenz.",
      en: "Critically checks for credibility, evidence, and transparency.",
    },
    focus: {
      de: [
        "Sind Referenzen, Bewertungen oder nachvollziehbare Ergebnisse sichtbar?",
        "Wirken die Aussagen konkret oder nur werblich?",
        "Sind Impressum, Datenschutz und Kontaktwege auffindbar?",
        "Gibt es nachvollziehbare Informationen über das Unternehmen?",
      ],
      en: [
        "Are references, reviews, or traceable results visible?",
        "Do the claims feel concrete or merely promotional?",
        "Are imprint, privacy policy, and contact options findable?",
        "Is there verifiable information about the company?",
      ],
    },
  },
  {
    id: "search_visitor",
    sortOrder: 3,
    name: {
      de: "Suchende:r Besucher:in aus Google/Maps",
      en: "Search visitor from Google/Maps",
    },
    lens: {
      de: "Kommt über eine lokale Suche und vergleicht schnell.",
      en: "Arrives via a local search and compares quickly.",
    },
    focus: {
      de: [
        "Stimmen Snippet-Erwartung und Seiteninhalt überein?",
        "Sind Stadt, Region und Leistungsbezug klar erkennbar?",
        "Passen Title und Meta Description zur Suchintention?",
        "Wird das Angebot schnell im lokalen Kontext verständlich?",
      ],
      en: [
        "Do snippet expectations match the page content?",
        "Are city, region, and service relevance clear?",
        "Do title and meta description match the search intent?",
        "Is the offer quickly understood in a local context?",
      ],
    },
  },
]

export const PERSONA_IDS: PersonaId[] = PERSONA_DEFINITIONS.map((p) => p.id)

export function getPersonaDefinition(id: PersonaId): PersonaDefinition {
  const def = PERSONA_DEFINITIONS.find((p) => p.id === id)
  if (!def) {
    throw new Error(`Unknown persona: ${id}`)
  }
  return def
}
