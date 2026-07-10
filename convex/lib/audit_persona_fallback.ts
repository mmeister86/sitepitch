import type { AuditAgentContext, AuditAgentContextCheck } from "../audit_agent"
import { PERSONA_DEFINITIONS, type PersonaId } from "./audit_personas"
import type { PersonaPanelOutput, PersonaReviewOutput } from "./audit_persona_schemas"

export const FALLBACK_PROVIDER = "deterministic"
export const FALLBACK_MODEL = "none"

function pickEvidenceRefs(checks: AuditAgentContextCheck[], personaId: PersonaId): string[] {
  const refs: string[] = []

  const add = (category: string, key?: string) => {
    if (key) {
      refs.push(`${category}:${key}`)
    } else {
      refs.push(category)
    }
  }

  const hasCheck = (category: string, key?: string) => {
    if (key) {
      return checks.some((c) => c.category === category && c.key === key)
    }
    return checks.some((c) => c.category === category)
  }

  const failedOrWarning = (category: string) =>
    checks.some((c) => c.category === category && (c.status === "failed" || c.status === "warning"))

  switch (personaId) {
    case "busy_owner":
      if (hasCheck("conversion", "hero_value_proposition")) add("conversion", "hero_value_proposition")
      if (hasCheck("conversion", "primary_cta")) add("conversion", "primary_cta")
      if (hasCheck("conversion", "services_clearly_named")) add("conversion", "services_clearly_named")
      if (failedOrWarning("conversion")) add("conversion")
      if (hasCheck("trust")) add("trust")
      break
    case "mobile_customer":
      if (hasCheck("mobile", "phone_link_clickable")) add("mobile", "phone_link_clickable")
      if (hasCheck("mobile", "viewport_meta")) add("mobile", "viewport_meta")
      if (failedOrWarning("mobile")) add("mobile")
      if (hasCheck("conversion", "primary_cta")) add("conversion", "primary_cta")
      break
    case "skeptical_buyer":
      if (hasCheck("trust", "proof_elements")) add("trust", "proof_elements")
      if (hasCheck("trust", "contact_visible")) add("trust", "contact_visible")
      if (failedOrWarning("trust")) add("trust")
      if (hasCheck("conversion", "offer_quickly_understandable")) add("conversion", "offer_quickly_understandable")
      break
    case "search_visitor":
      if (hasCheck("seo", "title_length")) add("seo", "title_length")
      if (hasCheck("seo", "meta_length")) add("seo", "meta_length")
      if (hasCheck("local_seo", "city_region_visible")) add("local_seo", "city_region_visible")
      if (failedOrWarning("seo")) add("seo")
      if (failedOrWarning("local_seo")) add("local_seo")
      break
  }

  if (refs.length === 0) {
    add("conversion")
  }

  return refs.slice(0, 8)
}

function buildVerdict(
  personaId: PersonaId,
  context: AuditAgentContext,
): { verdict: string; positives: string[]; frictionPoints: string[]; topRecommendation: string; confidence: "low" | "medium" | "high" } {
  const lang = context.reportLanguage
  const isEnglish = lang === "en"
  const scores = context.categoryScores
  const checks = context.checks

  const failedByCategory = (category: string) =>
    checks.filter((c) => c.category === category && c.status === "failed").length

  const warningByCategory = (category: string) =>
    checks.filter((c) => c.category === category && c.status === "warning").length

  const positiveByCategory = (category: string) =>
    checks.filter((c) => c.category === category && c.status === "passed").length

  const domain = context.domain

  switch (personaId) {
    case "busy_owner": {
      const friction: string[] = []
      const positives: string[] = []
      if (failedByCategory("conversion") > 0) {
        friction.push(isEnglish
          ? "The offer and next step could be clearer for a quick decision."
          : "Angebot und nächster Schritt könnten für eine schnelle Entscheidung klarer sein.")
      } else {
        positives.push(isEnglish
          ? "The core offer and next step are easy to grasp."
          : "Kernangebot und nächster Schritt sind schnell erfassbar.")
      }
      if (failedByCategory("trust") > 0) {
        friction.push(isEnglish
          ? "Trust signals such as proof or contact details could be more prominent."
          : "Vertrauenssignale wie Belege oder Kontaktdaten könnten stärker zur Geltung kommen.")
      } else {
        positives.push(isEnglish
          ? "Trust signals look present at first glance."
          : "Vertrauenssignale scheinen auf den ersten Blick vorhanden zu sein.")
      }
      if (context.overallScore >= 70) {
        positives.push(isEnglish
          ? `The overall score of ${context.overallScore} suggests a solid foundation.`
          : `Der Gesamtscore von ${context.overallScore} deutet auf eine solide Basis hin.`)
      }
      return {
        verdict: isEnglish
          ? `A busy owner scanning ${domain} needs to grasp value and trust within seconds. The current page has a starting point, but the key message and next step could be sharpened.`
          : `Eine vielbeschäftigte Geschäftsinhaberin, die ${domain} scannt, muss Wert und Vertrauen innerhalb weniger Sekunden erfassen. Die aktuelle Seite hat einen Ansatz, aber Kernbotschaft und nächster Schritt ließen sich schärfen.`,
        positives: positives.slice(0, 5),
        frictionPoints: friction.slice(0, 5),
        topRecommendation: isEnglish
          ? "Clarify the hero value proposition and make the primary contact action impossible to miss."
          : "Die Hero-Wertversprechen klären und den primären Kontaktweg unübersehbar machen.",
        confidence: scores.conversion >= 70 ? "high" : scores.conversion >= 45 ? "medium" : "low",
      }
    }
    case "mobile_customer": {
      const friction: string[] = []
      const positives: string[] = []
      if (failedByCategory("mobile") > 0) {
        friction.push(isEnglish
          ? "Mobile experience signals suggest friction on smartphones."
          : "Die Mobile-Signale deuten auf Friktion auf Smartphones hin.")
      } else {
        positives.push(isEnglish
          ? "Mobile basics appear to be in place."
          : "Die Mobile-Grundlagen scheinen vorhanden zu sein.")
      }
      if (failedByCategory("conversion") > 0) {
        friction.push(isEnglish
          ? "Contact or CTA may be harder to reach on a small screen."
          : "Kontakt oder CTA könnten auf einem kleinen Bildschirm schwerer erreichbar sein.")
      } else {
        positives.push(isEnglish
          ? "A contact path is visible, which helps mobile users act quickly."
          : "Ein Kontaktweg ist sichtbar, was mobilen Nutzern ein schnelles Handeln erleichtert.")
      }
      return {
        verdict: isEnglish
          ? `Someone visiting ${domain} on a phone wants to act fast. The page shows the basics, but mobile-specific contact convenience could be stronger.`
          : `Jemand, der ${domain} auf dem Handy besucht, möchte schnell handeln. Die Seite zeigt die Grundlagen, aber die mobile Kontakt-Erreichbarkeit ließe sich stärken.`,
        positives: positives.slice(0, 5),
        frictionPoints: friction.slice(0, 5),
        topRecommendation: isEnglish
          ? "Make the phone number clickable and place the primary contact action in the thumb zone."
          : "Telefonnummer klickbar machen und den primären Kontaktweg in der Daumenzone platzieren.",
        confidence: scores.mobile >= 70 ? "high" : scores.mobile >= 45 ? "medium" : "low",
      }
    }
    case "skeptical_buyer": {
      const friction: string[] = []
      const positives: string[] = []
      if (failedByCategory("trust") > 0) {
        friction.push(isEnglish
          ? "Proof and credibility signals could be more visible."
          : "Belege und Glaubwürdigkeitssignale könnten stärker sichtbar sein.")
      } else {
        positives.push(isEnglish
          ? "Trust elements such as contact and proof appear to be present."
          : "Vertrauenselemente wie Kontakt und Belege scheinen vorhanden zu sein.")
      }
      if (failedByCategory("conversion") > 0) {
        friction.push(isEnglish
          ? "The offer is not as concrete as a skeptical visitor would like."
          : "Das Angebot ist nicht so konkret, wie ein skeptischer Besucher es sich wünschen würde.")
      }
      if (positiveByCategory("trust") > 0) {
        positives.push(isEnglish
          ? "Some trust checks passed, which helps reduce skepticism."
          : "Einige Trust-Checks sind bestanden, was die Skepsis reduziert.")
      }
      return {
        verdict: isEnglish
          ? `A skeptical buyer evaluating ${domain} looks for proof and transparency. The site has some building blocks, but credibility could be reinforced.`
          : `Ein skeptischer Interessent, der ${domain} prüft, achtet auf Belege und Transparenz. Die Seite hat einige Bausteine, aber die Glaubwürdigkeit ließe sich verstärken.`,
        positives: positives.slice(0, 5),
        frictionPoints: friction.slice(0, 5),
        topRecommendation: isEnglish
          ? "Add concrete proof near the offer and make contact details easy to verify."
          : "Konkrete Belege nah am Angebot platzieren und Kontaktdaten leicht verifizierbar machen.",
        confidence: scores.trust >= 70 ? "high" : scores.trust >= 45 ? "medium" : "low",
      }
    }
    case "search_visitor": {
      const friction: string[] = []
      const positives: string[] = []
      if (failedByCategory("seo") > 0 || warningByCategory("seo") > 0) {
        friction.push(isEnglish
          ? "Title, meta description, or snippet signals could be clearer."
          : "Title, Meta Description oder Snippet-Signale könnten klarer sein.")
      } else {
        positives.push(isEnglish
          ? "Basic SEO signals appear to be in place."
          : "Die Basis-SEO-Signale scheinen vorhanden zu sein.")
      }
      if (failedByCategory("local_seo") > 0) {
        friction.push(isEnglish
          ? "Local context such as city or region could be more explicit."
          : "Lokaler Kontext wie Stadt oder Region könnte deutlicher sein.")
      }
      if (positiveByCategory("seo") > 0) {
        positives.push(isEnglish
          ? "Some SEO checks passed, which helps search visitors match intent."
          : "Einige SEO-Checks sind bestanden, was Suchbesuchern hilft, die Intention zuzuordnen.")
      }
      return {
        verdict: isEnglish
          ? `A search visitor arriving at ${domain} from Google or Maps needs quick alignment between snippet and page. The match is plausible, but local and snippet clarity could be improved.`
          : `Ein Suchbesucher, der von Google oder Maps auf ${domain} landet, muss schnell zwischen Snippet und Seite eine Übereinstimmung erkennen. Der Match ist plausibel, aber lokale und Snippet-Klarheit ließen sich verbessern.`,
        positives: positives.slice(0, 5),
        frictionPoints: friction.slice(0, 5),
        topRecommendation: isEnglish
          ? "Align title and meta description with the offer and make local relevance explicit."
          : "Title und Meta Description auf das Angebot abstimmen und lokale Relevanz explizit machen.",
        confidence: scores.seo >= 70 ? "high" : scores.seo >= 45 ? "medium" : "low",
      }
    }
  }
}

export function generateDeterministicPersonaPanel(context: AuditAgentContext): PersonaPanelOutput {
  const lang = context.reportLanguage
  const reviews: PersonaReviewOutput[] = PERSONA_DEFINITIONS.map((def) => {
    const personaName = def.name[lang]
    const lens = def.lens[lang]
    const { verdict, positives, frictionPoints, topRecommendation, confidence } = buildVerdict(def.id, context)

    return {
      personaId: def.id,
      personaName,
      lens,
      verdict,
      positives,
      frictionPoints: frictionPoints.length > 0 ? frictionPoints : [lens],
      topRecommendation,
      evidenceRefs: pickEvidenceRefs(context.checks, def.id),
      confidence,
    }
  })

  return { reviews }
}
