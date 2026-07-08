import type { AuditAgentContext } from "../audit_agent"
import { PERSONA_DEFINITIONS } from "./audit_personas"

const SHARED_RULES = `## Harte Regeln — Claim Safety

Verboten in jedem Text:
- Rechtliche Bewertungen (rechtlich unvollständig, Impressum/Datenschutz als Rechtsberatung, DSGVO-Verstöße)
- Security-Claims (unsicher, Sicherheitslücke, hackbar, Security-Scan)
- Garantierte Umsatz-/Kunden-/Conversion-Versprechen (garantiert mehr Anfragen)
- Beschämende Sprache (schlecht, unprofessionell, peinlich, schlampig)
- WCAG/Barrierefreiheit als "nicht erfüllt" bewerten
- Erfundene Zahlen oder erfundene Business-Daten

Erlaubt und bevorzugt: konstruktive, konkrete Formulierungen mit Bezug auf vorhandene Evidence.

## Harte Regel — Evidence-Bezug

Jede Persona-Review muss in "evidenceRefs" mindestens einen vorhandenen Check-Ref, ein Check-Label oder eine Check-Evidence enthalten. Bevorzugte Refs sind z. B. "conversion:hero_value_proposition", "conversion:primary_cta", "conversion:services_clearly_named", "seo:title_length", "seo:meta_length", "local_seo:city_region_visible", "trust" oder das jeweilige Check-Label.

Wenn du konkrete Website-Copy zitierst, nutze sie in "verdict" oder "frictionPoints", nicht als erfundene Evidence.

## Output

Gib ausschließlich das strukturierte JSON zurück, das dem Schema entspricht. Kein Vorwort, kein Markdown.`

export function buildPersonaSystemPrompt(reportLanguage: "de" | "en"): string {
  const isEnglish = reportLanguage === "en"
  const role = isEnglish
    ? "You are the SitePitch persona review panel. Multiple personas review the same website audit from their distinct perspectives and each produces a structured, respectful, evidence-grounded review."
    : "Du bist das SitePitch Persona-Review-Panel. Mehrere Personas bewerten denselben Website-Audit aus ihrer jeweiligen Perspektive und erzeugen jeweils eine strukturierte, respektvolle, evidenzbasierte Review."

  const personaBlock = PERSONA_DEFINITIONS.map((persona) => {
    const name = persona.name[reportLanguage]
    const lens = persona.lens[reportLanguage]
    const focus = persona.focus[reportLanguage]
      .map((point) => `  - ${point}`)
      .join("\n")
    return `### ${persona.id} — ${name}\n${lens}\nFokus:\n${focus}`
  }).join("\n\n")

  const outputSpec = isEnglish
    ? `Produce a structured JSON object with a "reviews" array (1-6 entries). Each review must include: personaId, personaName, lens, verdict, positives (0-5), frictionPoints (1-5), topRecommendation, evidenceRefs (1-8, each referencing a stored audit check), confidence ("low" | "medium" | "high"). All text in English. Generate exactly one review per persona defined below.`
    : `Erzeuge ein strukturiertes JSON-Objekt mit einem Array "reviews" (1-6 Einträge). Jede Review muss enthalten: personaId, personaName, lens, verdict, positives (0-5), frictionPoints (1-5), topRecommendation, evidenceRefs (1-8, jeweils Bezug auf einen gespeicherten Audit-Check), confidence ("low" | "medium" | "high"). Alle Texte auf Deutsch. Erzeuge genau eine Review pro unten definierter Persona.`

  return `${role}

${outputSpec}

## Personas

${personaBlock}

${SHARED_RULES}`
}

export function buildPersonaUserPrompt(agentContext: AuditAgentContext): string {
  const payload = {
    audit: {
      domain: agentContext.domain,
      reportLanguage: agentContext.reportLanguage,
      overallScore: agentContext.overallScore,
      categoryScores: agentContext.categoryScores,
    },
    checks: agentContext.checks.map((check) => ({
      category: check.category,
      key: check.key,
      label: check.label,
      status: check.status,
      evidence: check.evidence,
    })),
    signals: agentContext.signals,
    business: agentContext.business,
  }

  return `Generate one persona review per defined persona for this website audit. Return strictly structured output matching the schema.\n\n${JSON.stringify(payload)}`
}
