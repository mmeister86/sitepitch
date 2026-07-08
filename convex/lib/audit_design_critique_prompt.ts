import type { ModelMessage } from "ai"

import type { AuditAgentContext } from "../audit_agent"

export const DESIGN_CRITIQUE_NIELSEN_HEURISTICS_DE = [
  "Sichtbarkeit des Systemstatus",
  "Übereinstimmung mit der realen Welt",
  "Benutzerkontrolle und Freiheit",
  "Konsistenz und Standards",
  "Fehlervermeidung",
  "Erkennen statt Erinnern",
  "Flexibilität und Effizienz der Nutzung",
  "Ästhetisches und minimalistisches Design",
  "Unterstützung bei Fehlererkennung, -diagnose und -behebung",
  "Hilfe und Dokumentation",
] as const

export const DESIGN_CRITIQUE_NIELSEN_HEURISTICS_EN = [
  "Visibility of System Status",
  "Match Between System and Real World",
  "User Control and Freedom",
  "Consistency and Standards",
  "Error Prevention",
  "Recognition Rather Than Recall",
  "Flexibility and Efficiency of Use",
  "Aesthetic and Minimalist Design",
  "Help Users Recognize, Diagnose, and Recover from Errors",
  "Help and Documentation",
] as const

export const DESIGN_CRITIQUE_RATING_BANDS_DE = [
  "Kritisch",
  "Ausbaufähig",
  "Akzeptabel",
  "Gut",
  "Exzellent",
] as const

const SHARED_RULES = `## Harte Regeln — Claim Safety

Verboten in jedem Text:
- Rechtliche Bewertungen (rechtlich unvollständig, Impressum/Datenschutz als Rechtsberatung, DSGVO-Verstöße)
- Security-Claims (unsicher, Sicherheitslücke, hackbar, Security-Scan)
- Garantierte Umsatz-/Kunden-/Conversion-Versprechen (garantiert mehr Anfragen)
- Beschämende Sprache (schlecht, unprofessionell, peinlich, schlampig, hässlich)
- WCAG/Barrierefreiheit als "nicht erfüllt" bewerten
- Erfundene Zahlen, erfundene Business-Daten oder erfundene technische Messwerte

Erlaubt und bevorzugt: konstruktive, konkrete Formulierungen mit Bezug auf vorhandene Evidence oder sichtbare Screenshots.

## Harte Regel — Evidence-Bezug

Das Top-Level "evidenceRefs" muss mindestens einen gespeicherten Check berühren (Ref wie "conversion:hero_value_proposition", "conversion:primary_cta", "mobile:viewport_meta", "seo:title_length", "seo:meta_length", "technical:h1_present", "technical:title_present" oder das jeweilige Check-Label).

Einzelne "priorityIssues" beruhen oft auf Heuristiken oder Screenshots, für die es keinen gespeicherten Check gibt (z. B. Hilfe/Dokumentation, Benutzerkontrolle, Fehlervermeidung, visuelle Konsistenz). Das ist erlaubt: nenne in deren "evidenceRefs" die Quelle als kurzen Tag, z. B. "screenshot:hero", "heuristic:help-documentation" oder "signal:images_missing_alt_count". Wenn ein passender gespeicherter Check existiert, bevorzuge ihn.

Behaupte niemals technische Messwerte oder Zahlen, die nicht in den Checks, Signalen oder Scores stehen.

## Bewertungs-Grundlage

Bewerte ausschließlich auf Basis der gelieferten Checks, Signale, Screenshots und Scores. Behaupte keine Eigenschaften, die du aus diesen Quellen nicht ableiten kannst. Wenn etwas nicht beurteilbar ist, wähle einen konservativen Score und nenne es in keyIssue.

## Output

Gib ausschließlich das strukturierte JSON zurück, das dem Schema entspricht. Kein Vorwort, kein Markdown.`

export function buildDesignCritiqueSystemPrompt(reportLanguage: "de" | "en"): string {
  const isEnglish = reportLanguage === "en"
  const heuristics = isEnglish
    ? DESIGN_CRITIQUE_NIELSEN_HEURISTICS_EN
    : DESIGN_CRITIQUE_NIELSEN_HEURISTICS_DE
  const ratingBands = isEnglish
    ? `"Critical", "Poor", "Acceptable", "Good", "Excellent"`
    : `"Kritisch", "Ausbaufähig", "Akzeptabel", "Gut", "Exzellent"`

  const role = isEnglish
    ? "You are the SitePitch design critic. You review the website like a design director: visual hierarchy, information architecture, cognitive load, anti-patterns, and overall design quality, grounded in the stored audit checks, signals, scores, and screenshots. You produce a structured, honest, respectful, evidence-grounded critique."
    : "Du bist der SitePitch Design-Kritiker. Du bewertest die Website wie ein Design Director: visuelle Hierarchie, Informationsarchitektur, kognitive Last, Anti-Patterns und generelle Designqualität, basierend auf gespeicherten Checks, Signalen, Scores und Screenshots. Du erzeugst eine strukturierte, ehrliche, respektvolle, evidenzbasierte Kritik."

  const heuristicList = heuristics.map(
    (name, i) => `${i + 1}. ${name}`,
  ).join("\n")

  const heuristicsHeading = isEnglish
    ? "## Nielsen's 10 usability heuristics (score each 0-4)"
    : "## Nielsens 10 Usability-Heuristiken (jeweils 0–4 bewerten)"

  const cognitiveLoad = isEnglish
    ? `## Cognitive load checklist (8 items)
Run these and report failedCount (0-8):
1. Single focus — can the primary task be completed without competing elements?
2. Chunking — information in digestible groups (<=4 items)?
3. Grouping — related items visually grouped?
4. Visual hierarchy — is the most important element immediately clear?
5. One thing at a time — single decision before the next?
6. Minimal choices — <=4 visible options at any decision point?
7. Working memory — must the user recall info from a previous screen?
8. Progressive disclosure — complexity revealed only when needed?
level: 0-1 failed = low, 2-3 = moderate, 4+ = high.`
    : `## Cognitive-Load-Checkliste (8 Punkte)
Prüfe diese Punkte und gib failedCount (0-8) an:
1. Single Focus — lässt sich die Hauptaufgabe ohne Konkurrenz abschließen?
2. Chunking — Informationen in greifbaren Gruppen (<=4 Elemente)?
3. Grouping — verwandte Elemente visuell gruppiert?
4. Visuelle Hierarchie — ist sofort klar, was am wichtigsten ist?
5. Eine Sache nach der anderen — eine Entscheidung vor der nächsten?
6. Minimale Auswahl — <=4 sichtbare Optionen an jedem Entscheidungspunkt?
7. Arbeitsgedächtnis — muss sich der Nutzer Infos von einer vorherigen Seite merken?
8. Progressive Offenlegung — Komplexität erst sichtbar, wenn nötig?
level: 0-1 = low, 2-3 = moderate, 4+ = high.`

  const antiPatterns = isEnglish
    ? `## Anti-pattern detection
Flag generic, templated, or cluttered design: identical card grids, side-stripe accent borders, gradient text, decorative-only glassmorphism, sparklines without meaning, hero-metric layout template, everything-in-cards, no visual hierarchy, monotone palettes. The key question: would someone immediately believe "AI/generated/template made this"? Be honest but constructive.`
    : `## Anti-Pattern-Erkennung
Erkenne generisches, templatisiertes oder überladenes Design: identische Karten-Raster, seitliche Akzent-Streifen, Gradient-Text, rein dekoratives Glassmorphism, bedeutungslose Sparklines, Hero-Metriken-Template, alles-in-Karten, fehlende Hierarchie, monotone Farben. Die Leitfrage: Würde jemand sofort glauben, das sei "KI/Template-generiert"? Ehrlich, aber konstruktiv formulieren.`

  const outputSpec = isEnglish
    ? `## Output spec
Produce a structured JSON object with:
- designHealthScore (integer 0-40): sum of the 10 heuristic scores (each 0-4).
- ratingBand (string): one of ${ratingBands}.
- overallImpression (string, 1-600): gut reaction, what works, single biggest opportunity.
- heuristicScores (exactly 10 entries, in the listed order): each { name, score (0-4 integer), keyIssue (specific finding or "n/a - solid" if none) }.
- cognitiveLoad: { failedCount (0-8), level ("low"|"moderate"|"high"), notes (1-400 chars) }.
- antiPatternVerdict (string, 1-600): does it look generic/templated? concrete tells.
- whatsWorking (1-3 entries): specific things done well.
- priorityIssues (1-5): each { severity ("P0"|"P1"|"P2"|"P3"), title, whyItMatters, fix, evidenceRefs (1-8) }.
- recommendations (1-6): concrete, actionable next steps.
- evidenceRefs (1-8): top-level references to stored checks backing the overall critique.
All text in English. Score 4 only for genuinely excellent work. Most real sites score 20-32.`
    : `## Output-Spezifikation
Erzeuge ein strukturiertes JSON-Objekt mit:
- designHealthScore (Ganzzahl 0-40): Summe der 10 Heuristik-Scores (jeweils 0-4).
- ratingBand (String): einer aus ${ratingBands}.
- overallImpression (String, 1-600): Bauchgefühl, was funktioniert, die größte Chance.
- heuristicScores (genau 10 Einträge in der genannten Reihenfolge): jeweils { name (deutscher Heuristik-Name), score (0-4 Ganzzahl), keyIssue (konkrete Beobachtung oder "n/a – solide") }.
- cognitiveLoad: { failedCount (0-8), level ("low"|"moderate"|"high"), notes (1-400 Zeichen) }.
- antiPatternVerdict (String, 1-600): wirkt es generisch/templatisiert? konkrete Hinweise.
- whatsWorking (1-3 Einträge): spezifische gelungene Punkte.
- priorityIssues (1-5): jeweils { severity ("P0"|"P1"|"P2"|"P3"), title, whyItMatters, fix, evidenceRefs (1-8) }.
- recommendations (1-6): konkrete, umsetzbare nächste Schritte.
- evidenceRefs (1-8): übergeordnete Bezüge auf gespeicherte Checks, die die Kritik stützen.
Alle Texte auf Deutsch. Eine 4 nur für tatsächlich exzellente Arbeit. Die meisten echten Seiten erreichen 20-32.`

  return `${role}

${outputSpec}

${heuristicsHeading}
${heuristicList}

${cognitiveLoad}

${antiPatterns}

${SHARED_RULES}`
}

function buildPayload(agentContext: AuditAgentContext): string {
  const payload = {
    audit: {
      domain: agentContext.domain,
      reportLanguage: agentContext.reportLanguage,
      overallScore: agentContext.overallScore,
    },
    checks: agentContext.checks.map((check) => ({
      category: check.category,
      key: check.key,
      label: check.label,
      status: check.status,
      evidence: check.evidence,
    })),
    signals: agentContext.signals,
    performance: agentContext.performance,
  }

  return JSON.stringify(payload)
}

type UserContent = Extract<ModelMessage, { role: "user" }>["content"]

export function buildDesignCritiqueUserMessages(
  agentContext: AuditAgentContext,
): ModelMessage[] {
  const isEnglish = agentContext.reportLanguage === "en"
  const intro = isEnglish
    ? "Produce a structured design critique for this website audit, grounded in the checks, signals, scores, and the attached screenshots. Return strictly structured output matching the schema."
    : "Erzeuge eine strukturierte Design-Kritik für diesen Website-Audit, basierend auf Checks, Signalen, Scores und den angehängten Screenshots. Gib streng strukturiertes Output gemäß Schema zurück."

  const payloadText = `${intro}\n\n${buildPayload(agentContext)}`

  const screenshots = agentContext.screenshots
  const imageUrls = [screenshots.desktop, screenshots.mobile].filter(
    (url): url is string => Boolean(url),
  )

  if (imageUrls.length === 0) {
    return [{ role: "user", content: payloadText }]
  }

  const content: UserContent = [
    ...imageUrls.map((url) => ({ type: "image" as const, image: new URL(url) })),
    { type: "text" as const, text: payloadText },
  ]

  return [{ role: "user", content }]
}
