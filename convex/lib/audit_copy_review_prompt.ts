import type { AuditAgentContext } from "../audit_agent"

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

Das Feld "evidenceRefs" muss mindestens einen vorhandenen Check-Ref, ein Check-Label oder eine Check-Evidence enthalten. Bevorzugte Refs sind z. B. "conversion:hero_value_proposition", "conversion:offer_quickly_understandable", "conversion:primary_cta", "conversion:services_clearly_named", "seo:title_length", "seo:meta_length", "technical:h1_present", "technical:title_present", "technical:meta_description_present".

Wenn du konkrete Website-Copy zitierst, nutze sie in den Bewertungsfeldern, nicht als erfundene Evidence.

## Output

Gib ausschließlich das strukturierte JSON zurück, das dem Schema entspricht. Kein Vorwort, kein Markdown.`

export function buildCopyReviewSystemPrompt(reportLanguage: "de" | "en"): string {
  const isEnglish = reportLanguage === "en"
  const role = isEnglish
    ? "You are the SitePitch copy reviewer. You review the website's copy — hero messaging, value proposition, offer clarity, CTA wording, and snippet copy — and produce a structured, respectful, evidence-grounded assessment."
    : "Du bist der SitePitch Copy-Reviewer. Du bewertest die Website-Copy — Hero-Headline, Nutzenversprechen, Angebotsklarheit, CTA-Wording und Snippet-Copy — und erzeugst eine strukturierte, respektvolle, evidenzbasierte Bewertung."

  const outputSpec = isEnglish
    ? `Produce a structured JSON object with: heroClarity, valueProposition, offerClarity, ctaClarity, snippetClarity (each a concrete assessment, 1-400 chars), overallVerdict (1-600 chars), recommendations (1-6 concrete, actionable items), evidenceRefs (1-8, each referencing a stored audit check). All text in English.`
    : `Erzeuge ein strukturiertes JSON-Objekt mit: heroClarity, valueProposition, offerClarity, ctaClarity, snippetClarity (jeweils eine konkrete Bewertung, 1-400 Zeichen), overallVerdict (1-600 Zeichen), recommendations (1-6 konkrete, umsetzbare Punkte), evidenceRefs (1-8, jeweils Bezug auf einen gespeicherten Audit-Check). Alle Texte auf Deutsch.`

  return `${role}

${outputSpec}

${SHARED_RULES}`
}

export function buildCopyReviewUserPrompt(agentContext: AuditAgentContext): string {
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
  }

  return `Review the website copy for this audit. Return strictly structured output matching the schema.\n\n${JSON.stringify(payload)}`
}
