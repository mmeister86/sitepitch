export const SCORING_VERSION = "2026.07.1"

export type CheckStatus = "passed" | "failed" | "warning" | "not_applicable" | "unknown"

export type CheckCategory =
  | "technical"
  | "seo"
  | "local_seo"
  | "conversion"
  | "mobile"
  | "trust"
  | "performance"

export interface CheckInput {
  category: CheckCategory
  key: string
  label: string
  status: CheckStatus
  evidence?: string
  source?: string
  weight?: number
}

export interface CategoryWeights {
  conversion: number
  seo: number
  local_seo: number
  performance: number
  mobile: number
  trust: number
}

export const CATEGORY_WEIGHTS: CategoryWeights = {
  conversion: 0.25,
  seo: 0.2,
  local_seo: 0.2,
  performance: 0.15,
  mobile: 0.1,
  trust: 0.1,
}

const STATUS_POINTS: Record<CheckStatus, number | null> = {
  passed: 1,
  warning: 0.5,
  failed: 0,
  unknown: 0.5,
  not_applicable: null,
}

export const NEUTRAL_CATEGORY_SCORE = 50

export function computeCategoryScore(checks: CheckInput[]): number {
  let totalWeightedPoints = 0
  let totalWeight = 0

  for (const check of checks) {
    const points = STATUS_POINTS[check.status]
    if (points === null) {
      continue
    }
    const weight = check.weight ?? 1
    totalWeightedPoints += points * weight
    totalWeight += weight
  }

  if (totalWeight === 0) {
    return NEUTRAL_CATEGORY_SCORE
  }

  return clampScore((totalWeightedPoints / totalWeight) * 100)
}

export interface CategoryScores {
  conversion: number
  seo: number
  local_seo: number
  performance: number
  mobile: number
  trust: number
}

export function computeOverallScore(scores: CategoryScores): number {
  const overall =
    scores.conversion * CATEGORY_WEIGHTS.conversion +
    scores.seo * CATEGORY_WEIGHTS.seo +
    scores.local_seo * CATEGORY_WEIGHTS.local_seo +
    scores.performance * CATEGORY_WEIGHTS.performance +
    scores.mobile * CATEGORY_WEIGHTS.mobile +
    scores.trust * CATEGORY_WEIGHTS.trust

  return clampScore(overall)
}

export type ScoreBand = "critical" | "weak" | "solid" | "strong" | "very_strong"

export function scoreBand(score: number): ScoreBand {
  if (score < 40) return "critical"
  if (score < 60) return "weak"
  if (score < 75) return "solid"
  if (score < 90) return "strong"
  return "very_strong"
}

export function scoreLabel(score: number): string {
  switch (scoreBand(score)) {
    case "critical":
      return "Kritisch"
    case "weak":
      return "Ausbaufähig"
    case "solid":
      return "Solide, aber optimierbar"
    case "strong":
      return "Stark"
    case "very_strong":
      return "Sehr stark"
  }
}

export function scoreOpportunity(score: number): string {
  switch (scoreBand(score)) {
    case "critical":
      return "Hohe Akquise-Chance: mehrere konkrete, schnell wirksame Verbesserungen erkennbar."
    case "weak":
      return "Gute Akquise-Chance: klare, nachvollziehbare Optimierungspunkte vorhanden."
    case "solid":
      return "Solider Auftritt mit einzelnen konkreten Verbesserungschancen."
    case "strong":
      return "Starker Auftritt mit nur punktuellen Optimierungsmöglichkeiten."
    case "very_strong":
      return "Sehr starker Auftritt – weniger idealer Outreach-Lead."
  }
}

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) {
    return NEUTRAL_CATEGORY_SCORE
  }
  return Math.max(0, Math.min(100, Math.round(score)))
}

export interface AuditCheckData {
  domain: string
  auditType: "quick" | "standard" | "local"
  httpStatus?: number
  finalUrl?: string
  title?: string
  metaDescription?: string
  openGraphTitle?: string
  openGraphDescription?: string
  openGraphImage?: string
  h1Texts?: string[]
  h2Texts?: string[]
  canonicalUrl?: string
  robotsFound?: boolean
  sitemapFound?: boolean
  schemaTypes?: string[]
  phoneNumbers?: string[]
  emailAddresses?: string[]
  contactLinks?: string[]
  internalLinks?: string[]
  externalLinks?: string[]
  privacyLinkFound?: boolean
  imprintLinkFound?: boolean
  ctaCandidates?: string[]
  extractedMarkdown?: string
  imageCount?: number
  imagesMissingAltCount?: number
  phoneLinkFound?: boolean
  contactFormFound?: boolean
  viewportMetaFound?: boolean
  hasContactPage?: boolean
  hasServicesPage?: boolean
  hasMobileScreenshot?: boolean
  hasDesktopScreenshot?: boolean
  mobilePerformanceScore?: number
  mobileAccessibilityScore?: number
  desktopPerformanceScore?: number
  lcp?: number
  cls?: number
  fcp?: number
  hasBusinessData?: boolean
  businessAddress?: string
  businessPhone?: string
  businessCity?: string
  businessRating?: number
  businessReviewCount?: number
  leadCity?: string
  leadCategory?: string
}

function hasValue(value: string | undefined | null): value is string {
  return Boolean(value && value.trim().length > 0)
}

function hasAny(values: string[] | undefined): boolean {
  return Boolean(values && values.length > 0)
}

function schemaMentions(schemaTypes: string[] | undefined, needle: string): boolean {
  return Boolean(schemaTypes?.some((entry) => entry.toLowerCase().includes(needle)))
}

function markdownMentions(markdown: string | undefined, ...needles: string[]): boolean {
  if (!hasValue(markdown)) {
    return false
  }
  const lower = markdown.toLowerCase()
  return needles.some((needle) => lower.includes(needle))
}

const TITLE_MIN = 30
const TITLE_MAX = 60
const META_MIN = 70
const META_MAX = 160
const LCP_GOOD_MS = 2500
const LCP_OK_MS = 4000
const CLS_GOOD = 0.1
const CLS_OK = 0.25
const FCP_GOOD_MS = 1800
const FCP_OK_MS = 3000

export function evaluateChecks(data: AuditCheckData): CheckInput[] {
  const checks: CheckInput[] = []

  const httpsActive = data.finalUrl?.startsWith("https://") ?? false
  const httpUrl = data.finalUrl?.startsWith("http://") ?? false

  checks.push({
    category: "technical",
    key: "https_active",
    label: "HTTPS aktiv",
    status: httpsActive ? "passed" : httpUrl ? "failed" : "unknown",
    evidence: httpsActive ? "Final URL nutzt HTTPS" : httpUrl ? "Final URL nutzt HTTP" : undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "technical",
    key: "http_status_200",
    label: "HTTP-Status 200",
    status: data.httpStatus === 200 ? "passed" : data.httpStatus ? "warning" : "unknown",
    evidence: data.httpStatus ? `HTTP ${data.httpStatus}` : undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "technical",
    key: "title_present",
    label: "Title-Tag vorhanden",
    status: hasValue(data.title) ? "passed" : "failed",
    evidence: data.title,
    source: "audit_raw_data",
  })

  checks.push({
    category: "technical",
    key: "meta_description_present",
    label: "Meta Description vorhanden",
    status: hasValue(data.metaDescription) ? "passed" : "failed",
    evidence: data.metaDescription,
    source: "audit_raw_data",
  })

  const h1Count = data.h1Texts?.length ?? 0
  checks.push({
    category: "technical",
    key: "h1_present",
    label: "Genau eine H1-Überschrift",
    status: h1Count === 1 ? "passed" : h1Count > 1 ? "warning" : "failed",
    evidence: h1Count ? `${h1Count} H1 gefunden` : undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "technical",
    key: "canonical_present",
    label: "Canonical-Tag vorhanden",
    status: hasValue(data.canonicalUrl) ? "passed" : "warning",
    evidence: data.canonicalUrl,
    source: "audit_raw_data",
  })

  const robotsKnown = data.robotsFound !== undefined
  checks.push({
    category: "technical",
    key: "robots_signal",
    label: "Robots-Meta erkennbar",
    status: robotsKnown ? "passed" : "unknown",
    evidence: data.robotsFound ? "Robots-Meta gefunden" : "Keine Robots-Meta gefunden",
    source: "audit_raw_data",
  })

  const sitemapKnown = data.sitemapFound !== undefined
  checks.push({
    category: "technical",
    key: "sitemap_signal",
    label: "Sitemap-Signal erkennbar",
    status: sitemapKnown ? "passed" : "unknown",
    evidence: data.sitemapFound ? "Sitemap-Hinweis gefunden" : "Kein Sitemap-Hinweis gefunden",
    source: "audit_raw_data",
  })

  const imageCount = data.imageCount ?? 0
  const missingAlt = data.imagesMissingAltCount ?? 0
  if (imageCount > 0) {
    const ratio = missingAlt / imageCount
    checks.push({
      category: "technical",
      key: "image_alt_coverage",
      label: "Bilder mit Alt-Attributen",
      status: ratio === 0 ? "passed" : ratio <= 0.3 ? "warning" : "failed",
      evidence: `${imageCount - missingAlt}/${imageCount} Bilder mit Alt-Attribut`,
      source: "audit_raw_data",
    })
  } else {
    checks.push({
      category: "technical",
      key: "image_alt_coverage",
      label: "Bilder mit Alt-Attributen",
      status: "unknown",
      source: "audit_raw_data",
    })
  }

  checks.push({
    category: "technical",
    key: "imprint_found",
    label: "Impressum verlinkt",
    status: data.imprintLinkFound ? "passed" : "warning",
    evidence: data.imprintLinkFound ? "Impressum-Link erkannt" : undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "technical",
    key: "privacy_found",
    label: "Datenschutz verlinkt",
    status: data.privacyLinkFound ? "passed" : "warning",
    evidence: data.privacyLinkFound ? "Datenschutz-Link erkannt" : undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "technical",
    key: "contact_page_found",
    label: "Kontaktseite verlinkt",
    status: data.hasContactPage || hasAny(data.contactLinks) ? "passed" : "warning",
    evidence: hasAny(data.contactLinks) ? `${data.contactLinks!.length} Kontakt-Link(s)` : undefined,
    source: "audit_raw_data",
  })

  const titleLen = data.title?.trim().length ?? 0
  checks.push({
    category: "seo",
    key: "title_length",
    label: "Title-Länge plausibel",
    status:
      titleLen === 0
        ? "failed"
        : titleLen >= TITLE_MIN && titleLen <= TITLE_MAX
          ? "passed"
          : "warning",
    evidence: titleLen ? `${titleLen} Zeichen` : undefined,
    source: "audit_raw_data",
  })

  const metaLen = data.metaDescription?.trim().length ?? 0
  checks.push({
    category: "seo",
    key: "meta_length",
    label: "Meta-Description-Länge plausibel",
    status:
      metaLen === 0
        ? "failed"
        : metaLen >= META_MIN && metaLen <= META_MAX
          ? "passed"
          : "warning",
    evidence: metaLen ? `${metaLen} Zeichen` : undefined,
    source: "audit_raw_data",
  })

  const cityHint = data.leadCity ?? data.businessCity
  checks.push({
    category: "seo",
    key: "keyword_city_in_title",
    label: "Stadt/Keyword im Title, falls bekannt",
    status: cityHint
      ? data.title?.toLowerCase().includes(cityHint.toLowerCase())
        ? "passed"
        : "warning"
      : "not_applicable",
    evidence: cityHint ? `Stadt-Hinweis: ${cityHint}` : undefined,
    source: "audit_raw_data",
  })

  const heroText = [data.h1Texts?.[0], data.extractedMarkdown?.slice(0, 600)].filter(Boolean).join(" ")
  checks.push({
    category: "seo",
    key: "keyword_city_in_content",
    label: "Stadt/Keyword in H1 oder Haupttext, falls bekannt",
    status: cityHint
      ? heroText.toLowerCase().includes(cityHint.toLowerCase())
        ? "passed"
        : "warning"
      : "not_applicable",
    evidence: cityHint ? `Stadt-Hinweis: ${cityHint}` : undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "seo",
    key: "structured_data",
    label: "Strukturierte Daten vorhanden",
    status: hasAny(data.schemaTypes) ? "passed" : "warning",
    evidence: hasAny(data.schemaTypes) ? `${data.schemaTypes!.length} Schema-Blöcke` : undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "seo",
    key: "open_graph_tags",
    label: "Open Graph Tags vorhanden",
    status: hasValue(data.openGraphTitle) || hasValue(data.openGraphImage)
      ? "passed"
      : "warning",
    evidence: hasValue(data.openGraphImage) ? "OG-Image gesetzt" : undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "seo",
    key: "internal_service_links",
    label: "Interne Links zu Leistungsseiten",
    status: data.hasServicesPage ? "passed" : hasAny(data.internalLinks) ? "warning" : "unknown",
    evidence: data.hasServicesPage ? "Leistungsseite verlinkt" : undefined,
    source: "audit_pages",
  })

  const addressLike = markdownMentions(data.extractedMarkdown, "straße", "str.", "platz", "weg", "allee", "ring", "gasse", "address", "street")
  checks.push({
    category: "local_seo",
    key: "city_region_visible",
    label: "Stadt/Region sichtbar genannt",
    status: cityHint
      ? markdownMentions(data.extractedMarkdown, cityHint.toLowerCase())
        ? "passed"
        : "warning"
      : addressLike
        ? "passed"
        : "unknown",
    evidence: cityHint ? `Stadt-Hinweis: ${cityHint}` : undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "local_seo",
    key: "address_visible",
    label: "Adresse sichtbar",
    status: hasValue(data.businessAddress) || addressLike ? "passed" : "warning",
    evidence: data.businessAddress ?? undefined,
    source: data.businessAddress ? "audit_business_data" : "audit_raw_data",
  })

  checks.push({
    category: "local_seo",
    key: "phone_visible",
    label: "Telefonnummer sichtbar",
    status: hasAny(data.phoneNumbers) || hasValue(data.businessPhone) ? "passed" : "warning",
    evidence: data.phoneNumbers?.[0] ?? data.businessPhone,
    source: "audit_raw_data",
  })

  checks.push({
    category: "local_seo",
    key: "phone_clickable",
    label: "Telefonnummer klickbar",
    status: data.phoneLinkFound ? "passed" : "warning",
    evidence: data.phoneLinkFound ? "tel:-Link erkannt" : undefined,
    source: "audit_raw_data",
  })

  const hoursLike = markdownMentions(
    data.extractedMarkdown,
    "öffnungszeiten",
    "öffnungzeiten",
    "mo-fr",
    "mo - fr",
    "montag",
    "dienstag",
    "opening hours",
    "open",
  )
  checks.push({
    category: "local_seo",
    key: "opening_hours_visible",
    label: "Öffnungszeiten sichtbar",
    status: hoursLike ? "passed" : "warning",
    evidence: hoursLike ? "Öffnungszeiten-Hinweis erkannt" : undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "local_seo",
    key: "local_business_schema",
    label: "LocalBusiness Schema vorhanden",
    status: schemaMentions(data.schemaTypes, "localbusiness") ? "passed" : "warning",
    evidence: hasAny(data.schemaTypes) ? data.schemaTypes!.join(", ") : undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "local_seo",
    key: "business_data_available",
    label: "Google-Business-Daten verfügbar",
    status: data.hasBusinessData ? "passed" : data.auditType === "local" ? "warning" : "not_applicable",
    evidence: data.businessRating ? `Rating ${data.businessRating}` : undefined,
    source: "audit_business_data",
  })

  const reviewsLike =
    markdownMentions(data.extractedMarkdown, "bewertung", "review", "testimonial", "referenz", "kundenstimme", "erfahrung") ||
    (data.businessReviewCount ?? 0) > 0
  checks.push({
    category: "local_seo",
    key: "reviews_testimonials_visible",
    label: "Bewertungen/Testimonials sichtbar",
    status: reviewsLike ? "passed" : "warning",
    evidence: (data.businessReviewCount ?? 0) > 0 ? `${data.businessReviewCount} Bewertungen` : undefined,
    source: "audit_raw_data",
  })

  const genericCtaPattern = /^(mehr erfahren|mehr|weiter|homepage|start|home|klick|hier| hier|los|ok|go|weiterlesen|read more|more|click here|enter|start)$/i
  const primaryCta = data.ctaCandidates?.[0]
  const primaryCtaGeneric = primaryCta ? genericCtaPattern.test(primaryCta.trim()) : false
  checks.push({
    category: "conversion",
    key: "primary_cta",
    label: "Primärer Call-to-Action sichtbar",
    status: !hasAny(data.ctaCandidates)
      ? "warning"
      : primaryCtaGeneric
        ? "warning"
        : "passed",
    evidence: primaryCta ?? (hasAny(data.ctaCandidates) ? `${data.ctaCandidates!.length} CTA-Kandidaten` : undefined),
    source: "audit_raw_data",
  })

  checks.push({
    category: "conversion",
    key: "contact_button",
    label: "Kontakt-Möglichkeit vorhanden",
    status: data.hasContactPage || hasAny(data.contactLinks) || hasAny(data.emailAddresses) ? "passed" : "warning",
    evidence: hasAny(data.contactLinks) ? "Kontakt-Link erkannt" : undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "conversion",
    key: "contact_form",
    label: "Kontaktformular vorhanden",
    status: data.contactFormFound ? "passed" : "warning",
    evidence: data.contactFormFound ? "Formular erkannt" : undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "conversion",
    key: "phone_in_header_footer",
    label: "Telefonnummer prominent platziert",
    status: hasAny(data.phoneNumbers) ? "passed" : "warning",
    evidence: data.phoneNumbers?.[0],
    source: "audit_raw_data",
  })

  const servicesLike =
    data.hasServicesPage ||
    markdownMentions(data.extractedMarkdown, "leistung", "service", "angebot", "leistung", "pakete", "leistungen")
  checks.push({
    category: "conversion",
    key: "services_clearly_named",
    label: "Leistungen klar benannt",
    status: servicesLike ? "passed" : "warning",
    evidence: data.hasServicesPage ? "Leistungsseite verlinkt" : undefined,
    source: "audit_pages",
  })

  const trustSignals =
    markdownMentions(data.extractedMarkdown, "referenz", "kunde", "projekt", "portfolio", "zertifiziert", "zertifikat", "garantie", "auszeichnung", "award") ||
    reviewsLike
  checks.push({
    category: "conversion",
    key: "trust_elements",
    label: "Trust-Elemente vorhanden",
    status: trustSignals ? "passed" : "warning",
    evidence: trustSignals ? "Trust-Signale erkannt" : undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "conversion",
    key: "references_reviews",
    label: "Referenzen/Reviews sichtbar",
    status: reviewsLike ? "passed" : "warning",
    evidence: undefined,
    source: "audit_raw_data",
  })

  const heroTextShort = [data.h1Texts?.[0], data.title].filter(Boolean).join(" ").trim()
  const heroOfferLike = markdownMentions(heroTextShort, "web", "design", "entwickl", "agentur", "studio", "dienstleis", "service", "leist", "berat", "handwerk", "prax", "kanzlei", "restaur", "café", "shop", "produkt", "lösung", "software", "app", "onlin", "marketing", "seo", "repair", "bau", "maler", "schloss", "sanitär", "elektr", "dach", "friseur")
  checks.push({
    category: "conversion",
    key: "hero_value_proposition",
    label: "Eindeutiges Nutzenversprechen im Hero",
    status:
      heroTextShort.length === 0
        ? "warning"
        : heroTextShort.length < 10 || !heroOfferLike
          ? "warning"
          : "passed",
    evidence: heroTextShort || undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "conversion",
    key: "offer_quickly_understandable",
    label: "Angebot in 5 Sekunden verständlich",
    status: hasValue(data.title) && hasValue(data.metaDescription) ? "passed" : "warning",
    evidence: hasValue(data.title) ? `Title: ${data.title}` : undefined,
    source: "audit_raw_data",
    weight: 0.5,
  })

  checks.push({
    category: "mobile",
    key: "mobile_screenshot_available",
    label: "Mobile Screenshot verfügbar",
    status: data.hasMobileScreenshot ? "passed" : "warning",
    evidence: data.hasMobileScreenshot ? "Mobile Screenshot gespeichert" : undefined,
    source: "audit_assets",
  })

  checks.push({
    category: "mobile",
    key: "viewport_meta",
    label: "Viewport-Meta-Tag gesetzt",
    status: data.viewportMetaFound ? "passed" : data.viewportMetaFound === false ? "failed" : "unknown",
    evidence: data.viewportMetaFound ? "Viewport-Meta erkannt" : undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "mobile",
    key: "mobile_cta_visible",
    label: "CTA auf Mobilgerät sichtbar",
    status: hasAny(data.ctaCandidates) ? "passed" : "warning",
    evidence: data.ctaCandidates?.[0],
    source: "audit_raw_data",
  })

  checks.push({
    category: "mobile",
    key: "mobile_phone_clickable",
    label: "Telefonnummer auf Mobilgerät klickbar",
    status: data.phoneLinkFound ? "passed" : "warning",
    evidence: data.phoneLinkFound ? "tel:-Link erkannt" : undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "mobile",
    key: "no_horizontal_overflow",
    label: "Keine offensichtliche horizontale Überbreite",
    status: "unknown",
    evidence: "Layout-Analyse im MVP nicht deterministisch ermittelbar",
    source: "audit_assets",
  })

  checks.push({
    category: "mobile",
    key: "mobile_pagespeed",
    label: "PageSpeed Mobile berücksichtigt",
    status: data.mobilePerformanceScore !== undefined ? "passed" : "warning",
    evidence: data.mobilePerformanceScore !== undefined ? `Mobile Performance ${data.mobilePerformanceScore}` : undefined,
    source: "audit_performance",
  })

  checks.push({
    category: "trust",
    key: "imprint_present",
    label: "Impressum vorhanden",
    status: data.imprintLinkFound ? "passed" : "failed",
    evidence: data.imprintLinkFound ? "Impressum-Link erkannt" : undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "trust",
    key: "privacy_present",
    label: "Datenschutz vorhanden",
    status: data.privacyLinkFound ? "passed" : "failed",
    evidence: data.privacyLinkFound ? "Datenschutz-Link erkannt" : undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "trust",
    key: "contact_options",
    label: "Klar erreichbare Kontaktmöglichkeiten",
    status: hasAny(data.emailAddresses) || hasAny(data.phoneNumbers) || data.hasContactPage
      ? "passed"
      : "warning",
    evidence: hasAny(data.emailAddresses) ? data.emailAddresses!.join(", ") : undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "trust",
    key: "reviews_visible",
    label: "Bewertungen/Referenzen sichtbar",
    status: reviewsLike ? "passed" : "warning",
    evidence: undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "trust",
    key: "organization_schema",
    label: "Organisation-/Schema-Daten vorhanden",
    status: hasAny(data.schemaTypes) ? "passed" : "warning",
    evidence: hasAny(data.schemaTypes) ? data.schemaTypes!.join(", ") : undefined,
    source: "audit_raw_data",
  })

  const externalTrustSignals = markdownMentions(
    data.extractedMarkdown,
    "google",
    "trusted",
    "sicher",
    "verschlüsselt",
    "ssl",
    "tuv",
    "tüv",
    "dsgvo",
    "gdpr",
  )
  checks.push({
    category: "trust",
    key: "external_trust_signals",
    label: "Externe/soziale Vertrauenssignale",
    status: externalTrustSignals || hasAny(data.externalLinks) ? "passed" : "warning",
    evidence: undefined,
    source: "audit_raw_data",
  })

  checks.push({
    category: "performance",
    key: "mobile_performance_score",
    label: "PageSpeed Mobile Performance-Score",
    status: performanceScoreStatus(data.mobilePerformanceScore),
    evidence: data.mobilePerformanceScore !== undefined ? `Score ${data.mobilePerformanceScore}` : undefined,
    source: "audit_performance",
  })

  checks.push({
    category: "performance",
    key: "lcp_in_range",
    label: "LCP im grünen Bereich",
    status: metricStatus(data.lcp, LCP_GOOD_MS, LCP_OK_MS, true),
    evidence: data.lcp !== undefined ? `${data.lcp.toFixed(0)} ms` : undefined,
    source: "audit_performance",
  })

  checks.push({
    category: "performance",
    key: "cls_in_range",
    label: "CLS im grünen Bereich",
    status: metricStatus(data.cls, CLS_GOOD, CLS_OK, true),
    evidence: data.cls !== undefined ? data.cls.toFixed(3) : undefined,
    source: "audit_performance",
  })

  checks.push({
    category: "performance",
    key: "fcp_in_range",
    label: "FCP im grünen Bereich",
    status: metricStatus(data.fcp, FCP_GOOD_MS, FCP_OK_MS, true),
    evidence: data.fcp !== undefined ? `${data.fcp.toFixed(0)} ms` : undefined,
    source: "audit_performance",
  })

  return checks
}

function performanceScoreStatus(score: number | undefined): CheckStatus {
  if (score === undefined) {
    return "unknown"
  }
  if (score >= 90) return "passed"
  if (score >= 50) return "warning"
  return "failed"
}

function metricStatus(
  value: number | undefined,
  good: number,
  ok: number,
  lowerIsBetter: boolean,
): CheckStatus {
  if (value === undefined || !Number.isFinite(value)) {
    return "unknown"
  }
  if (lowerIsBetter) {
    if (value <= good) return "passed"
    if (value <= ok) return "warning"
    return "failed"
  }
  if (value >= good) return "passed"
  if (value >= ok) return "warning"
  return "failed"
}

export function summarizeCategoryScores(checks: CheckInput[]): CategoryScores {
  const byCategory = (category: CheckCategory) => checks.filter((check) => check.category === category)

  return {
    conversion: computeCategoryScore(byCategory("conversion")),
    seo: computeCategoryScore(byCategory("seo")),
    local_seo: computeCategoryScore(byCategory("local_seo")),
    performance: computeCategoryScore(byCategory("performance")),
    mobile: computeCategoryScore(byCategory("mobile")),
    trust: computeCategoryScore(byCategory("trust")),
  }
}
