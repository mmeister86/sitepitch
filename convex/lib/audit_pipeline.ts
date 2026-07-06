export type AuditPipelineTier = "quick" | "standard" | "local"

export type AuditPageKind =
  | "primary"
  | "contact"
  | "about"
  | "privacy"
  | "imprint"
  | "services"
  | "other"

export type AuditPipelinePlan = {
  maxPages: number
  screenshotViewports: Array<"desktop" | "mobile">
  performanceStrategies: Array<"desktop" | "mobile">
  useBusinessData: boolean
}

export type PageCandidate = {
  url: string
  normalizedUrl: string
  kind: AuditPageKind
  score: number
}

export type ExtractedPageSignals = {
  title?: string
  metaDescription?: string
  openGraphTitle?: string
  openGraphDescription?: string
  openGraphImage?: string
  h1Texts: string[]
  h2Texts: string[]
  canonicalUrl?: string
  robotsFound: boolean
  sitemapFound: boolean
  schemaTypes: string[]
  phoneNumbers: string[]
  emailAddresses: string[]
  contactLinks: string[]
  internalLinks: string[]
  externalLinks: string[]
  privacyLinkFound: boolean
  imprintLinkFound: boolean
  ctaCandidates: string[]
  extractedMarkdown: string
}

const PAGE_PLAN: Record<AuditPipelineTier, AuditPipelinePlan> = {
  quick: {
    maxPages: 1,
    screenshotViewports: ["desktop"],
    performanceStrategies: ["mobile"],
    useBusinessData: false,
  },
  standard: {
    maxPages: 5,
    screenshotViewports: ["desktop", "mobile"],
    performanceStrategies: ["mobile", "desktop"],
    useBusinessData: false,
  },
  local: {
    maxPages: 5,
    screenshotViewports: ["desktop", "mobile"],
    performanceStrategies: ["mobile", "desktop"],
    useBusinessData: true,
  },
}

const PRIORITY_PATTERNS: Array<{ kind: AuditPageKind; patterns: RegExp[]; bonus: number }> = [
  { kind: "contact", patterns: [/kontakt/i, /contact/i, /reach/i, /anfrage/i, /termin/i], bonus: 30 },
  { kind: "privacy", patterns: [/datenschutz/i, /privacy/i, /gdpr/i], bonus: 25 },
  { kind: "imprint", patterns: [/impressum/i, /imprint/i], bonus: 24 },
  { kind: "about", patterns: [/ueber/i, /about/i, /team/i, /company/i], bonus: 18 },
  { kind: "services", patterns: [/leistung/i, /service/i, /angebote/i, /angebot/i], bonus: 16 },
]

export function getAuditPipelinePlan(auditType: AuditPipelineTier): AuditPipelinePlan {
  return PAGE_PLAN[auditType]
}

export function normalizeUrlForAudit(input: string) {
  const url = new URL(input)
  url.hash = ""
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = ""
  }
  return url.toString()
}

export function sameOrigin(a: URL, b: URL) {
  return a.protocol === b.protocol && a.hostname === b.hostname && effectivePort(a) === effectivePort(b)
}

export function effectivePort(url: URL) {
  if (url.port) {
    return url.port
  }
  return url.protocol === "https:" ? "443" : "80"
}

export function extractSignalsFromHtml(html: string, pageUrl: string, siteOrigin: string): ExtractedPageSignals {
  const normalizedHtml = html.replace(/\u0000/g, "")
  const stripped = normalizedHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")

  const title = firstMatch(stripped, /<title[^>]*>([\s\S]*?)<\/title>/i)
  const metaDescription = firstMetaContent(stripped, /<meta[^>]+name=["']description["'][^>]*>/i)
  const openGraphTitle = firstMetaContent(stripped, /<meta[^>]+property=["']og:title["'][^>]*>/i)
  const openGraphDescription = firstMetaContent(stripped, /<meta[^>]+property=["']og:description["'][^>]*>/i)
  const openGraphImage = firstMetaContent(stripped, /<meta[^>]+property=["']og:image["'][^>]*>/i)
  const canonicalUrl = firstHref(stripped, /<link[^>]+rel=["']canonical["'][^>]*>/i)
  const robotsFound = /<meta[^>]+name=["']robots["'][^>]*>/i.test(stripped)
  const sitemapFound = /sitemap/i.test(stripped)
  const schemaTypes = Array.from(
    stripped.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
    (match) => match[1]?.trim() ?? "",
  ).filter(Boolean)

  const page = new URL(pageUrl)
  const links = Array.from(stripped.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))
  const internalLinks = new Set<string>()
  const externalLinks = new Set<string>()
  const contactLinks = new Set<string>()
  const ctaCandidates = new Set<string>()

  for (const match of links) {
    const href = match[1]?.trim()
    const text = collapseWhitespace(stripTags(match[2] ?? ""))
    if (!href) {
      continue
    }
    const resolved = resolveUrl(page, href)
    if (!resolved) {
      continue
    }
    if (sameOrigin(page, resolved)) {
      internalLinks.add(normalizeUrlForAudit(resolved.toString()))
      if (isContactLike(resolved, text)) {
        contactLinks.add(normalizeUrlForAudit(resolved.toString()))
      }
      if (isCtaLike(text)) {
        ctaCandidates.add(text)
      }
    } else {
      externalLinks.add(normalizeUrlForAudit(resolved.toString()))
    }
  }

  return {
    title: cleanText(title),
    metaDescription: cleanText(metaDescription),
    openGraphTitle: cleanText(openGraphTitle),
    openGraphDescription: cleanText(openGraphDescription),
    openGraphImage: normalizeOptionalUrl(openGraphImage, page),
    h1Texts: extractHeadingTexts(stripped, "h1"),
    h2Texts: extractHeadingTexts(stripped, "h2"),
    canonicalUrl: normalizeOptionalUrl(canonicalUrl, page),
    robotsFound,
    sitemapFound,
    schemaTypes,
    phoneNumbers: extractPhoneNumbers(stripped),
    emailAddresses: extractEmailAddresses(stripped),
    contactLinks: Array.from(contactLinks),
    internalLinks: Array.from(internalLinks),
    externalLinks: Array.from(externalLinks),
    privacyLinkFound: /datenschutz|privacy/i.test(stripped),
    imprintLinkFound: /impressum|imprint/i.test(stripped),
    ctaCandidates: Array.from(ctaCandidates),
    extractedMarkdown: extractReadableMarkdown(stripped, siteOrigin),
  }
}

export function extractSignalsFromMarkdown(markdown: string, siteOrigin: string): ExtractedPageSignals {
  const lines = markdown.split(/\r?\n/).map((line) => line.trim())
  const h1Texts = unique(
    lines
      .filter((line) => /^#\s+/.test(line))
      .map((line) => line.replace(/^#\s+/, "").trim())
      .filter(Boolean),
  )
  const h2Texts = unique(
    lines
      .filter((line) => /^##\s+/.test(line))
      .map((line) => line.replace(/^##\s+/, "").trim())
      .filter(Boolean),
  )
  const title = h1Texts[0] ?? lines.find((line) => line.length > 0)?.replace(/^#+\s*/, "")
  const links = Array.from(markdown.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi))
  const externalLinks = unique(links.map((match) => match[2]).filter((value): value is string => Boolean(value)))

  return {
    title,
    metaDescription: lines.find((line) => line.length > 0 && !line.startsWith("#"))?.slice(0, 200),
    openGraphTitle: title,
    openGraphDescription: undefined,
    openGraphImage: undefined,
    h1Texts,
    h2Texts,
    canonicalUrl: undefined,
    robotsFound: false,
    sitemapFound: false,
    schemaTypes: [],
    phoneNumbers: extractPhoneNumbers(markdown),
    emailAddresses: extractEmailAddresses(markdown),
    contactLinks: externalLinks.filter((link) => /kontakt|contact/i.test(link)),
    internalLinks: [],
    externalLinks,
    privacyLinkFound: /datenschutz|privacy/i.test(markdown),
    imprintLinkFound: /impressum|imprint/i.test(markdown),
    ctaCandidates: unique(lines.filter((line) => isCtaLike(line))),
    extractedMarkdown: collapseWhitespace(markdown).slice(0, 20_000) + `\n\nSource: ${siteOrigin}`,
  }
}

export function pickPriorityPages(homepageUrl: string, internalLinks: string[], maxPages: number): PageCandidate[] {
  const homepage = new URL(homepageUrl)
  const homepageCandidate: PageCandidate = {
    url: homepage.toString(),
    normalizedUrl: normalizeUrlForAudit(homepage.toString()),
    kind: "primary",
    score: 100,
  }

  const candidates = new Map<string, PageCandidate>()
  candidates.set(homepageCandidate.normalizedUrl, homepageCandidate)

  for (const link of internalLinks) {
    const resolved = resolveUrl(homepage, link)
    if (!resolved || !sameOrigin(homepage, resolved)) {
      continue
    }
    const normalizedUrl = normalizeUrlForAudit(resolved.toString())
    if (candidates.has(normalizedUrl)) {
      continue
    }
    const path = `${resolved.pathname}${resolved.search}`.toLowerCase()
    const kind = classifyPageKind(path)
    const score = scorePageCandidate(path, kind)
    candidates.set(normalizedUrl, {
      url: resolved.toString(),
      normalizedUrl,
      kind,
      score,
    })
  }

  return Array.from(candidates.values())
    .sort((left, right) => right.score - left.score || left.normalizedUrl.localeCompare(right.normalizedUrl))
    .slice(0, maxPages)
    .map((candidate, index) => ({
      ...candidate,
      score: candidate.score - index * 0.001,
    }))
}

export function redactSensitiveText(input: string) {
  return collapseWhitespace(
    input
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
      .replace(/api[_-]?key\s*[:=]\s*['"]?[^'"\s]+/gi, "api_key=[redacted]")
      .replace(/access[_-]?key\s*[:=]\s*['"]?[^'"\s]+/gi, "access_key=[redacted]")
      .replace(/secret\s*[:=]\s*['"]?[^'"\s]+/gi, "secret=[redacted]"),
  )
}

function classifyPageKind(path: string): AuditPageKind {
  if (/kontakt|contact|reach|anfrage/i.test(path)) {
    return "contact"
  }
  if (/datenschutz|privacy/i.test(path)) {
    return "privacy"
  }
  if (/impressum|imprint/i.test(path)) {
    return "imprint"
  }
  if (/ueber|about|team|company/i.test(path)) {
    return "about"
  }
  if (/leistung|service|angebot|angebote/i.test(path)) {
    return "services"
  }
  return "other"
}

function scorePageCandidate(path: string, kind: AuditPageKind) {
  const base = kind === "primary" ? 100 : 10
  const keywordBonus = PRIORITY_PATTERNS.find((entry) => entry.kind === kind)?.bonus ?? 0
  const pathBonus = Math.max(0, 8 - path.split("/").filter(Boolean).length)
  return base + keywordBonus + pathBonus
}

function resolveUrl(base: URL, href: string) {
  try {
    const resolved = new URL(href, base)
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null
    }
    resolved.hash = ""
    if ((resolved.protocol === "https:" && resolved.port === "443") || (resolved.protocol === "http:" && resolved.port === "80")) {
      resolved.port = ""
    }
    return resolved
  } catch {
    return null
  }
}

function normalizeOptionalUrl(value: string | undefined, base: URL) {
  if (!value) {
    return undefined
  }
  const resolved = resolveUrl(base, value)
  return resolved ? normalizeUrlForAudit(resolved.toString()) : undefined
}

function firstMatch(input: string, pattern: RegExp) {
  const match = input.match(pattern)
  return match?.[1] ? cleanText(match[1]) : undefined
}

function firstMetaContent(input: string, pattern: RegExp) {
  const match = input.match(pattern)
  if (!match?.[0]) {
    return undefined
  }
  const content = match[0].match(/content=["']([^"']+)["']/i)?.[1]
  return content ? cleanText(content) : undefined
}

function firstHref(input: string, pattern: RegExp) {
  const match = input.match(pattern)
  if (!match?.[0]) {
    return undefined
  }
  const href = match[0].match(/href=["']([^"']+)["']/i)?.[1]
  return href ? cleanText(href) : undefined
}

function extractHeadingTexts(input: string, tag: "h1" | "h2") {
  return Array.from(input.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi")), (match) =>
    cleanText(stripTags(match[1] ?? "")),
  ).filter((value): value is string => Boolean(value))
}

function extractPhoneNumbers(input: string) {
  return unique(
    Array.from(input.matchAll(/(?:\+?\d[\d\s().-]{6,}\d)/g), (match) => cleanText(match[0] ?? "")).filter(
      (value): value is string => Boolean(value),
    ),
  )
}

function extractEmailAddresses(input: string) {
  return unique(
    Array.from(input.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi), (match) => match[0].toLowerCase()).filter(
      (value): value is string => Boolean(value),
    ),
  )
}

function extractReadableMarkdown(input: string, siteOrigin: string) {
  const withoutTags = input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h1>/gi, "\n\n")
    .replace(/<\/h2>/gi, "\n\n")
    .replace(/<li>/gi, "\n- ")
    .replace(/<[^>]+>/g, " ")
  return collapseWhitespace(withoutTags.replace(/\s+\n/g, "\n")).slice(0, 20_000) + `\n\nSource: ${siteOrigin}`
}

function stripTags(input: string) {
  return input.replace(/<[^>]+>/g, " ")
}

function collapseWhitespace(input: string) {
  return input.replace(/\s+/g, " ").trim()
}

function cleanText(input?: string) {
  if (!input) {
    return undefined
  }
  const text = collapseWhitespace(stripTags(input))
  return text || undefined
}

function isContactLike(url: URL, text: string) {
  return /kontakt|contact|reach|anfrage|termin|buch/i.test(`${url.pathname} ${text}`)
}

function isCtaLike(text: string) {
  return /jetzt|angebot|kostenlos|termin|kontakt|buch|anfrage|start/i.test(text)
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}
