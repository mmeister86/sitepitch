export type ReportLanguage = "de" | "en"

export interface BrandingInput {
  name: string
  logoStorageId: string | null
  accentColor: string
  website: string
  contactEmail: string
  ctaText: string
  ctaUrl: string
  reportLanguage: string
}

export interface BrandingValue {
  name: string
  logoStorageId: string | null
  accentColor: string
  website: string | null
  contactEmail: string | null
  ctaText: string | null
  ctaUrl: string | null
  reportLanguage: ReportLanguage
}

export type BrandingFieldErrors = Partial<Record<keyof BrandingInput, string>>

export type BrandingParseResult =
  | { ok: true; value: BrandingValue }
  | { ok: false; fieldErrors: BrandingFieldErrors }

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeHttpUrl(value: string): string | null {
  const trimmed = emptyToNull(value)
  if (!trimmed) return null

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const parsed = new URL(withProtocol)
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Unsupported protocol")
  }
  return parsed.toString().replace(/\/$/, "")
}

export function parseBrandingInput(input: BrandingInput): BrandingParseResult {
  const fieldErrors: BrandingFieldErrors = {}
  const name = input.name.trim()
  const ctaText = emptyToNull(input.ctaText)
  const contactEmail = emptyToNull(input.contactEmail)
  let website: string | null = null
  let ctaUrl: string | null = null

  if (name.length < 2) {
    fieldErrors.name = "Bitte gib einen Namen mit mindestens 2 Zeichen ein."
  } else if (name.length > 80) {
    fieldErrors.name = "Der Name darf maximal 80 Zeichen lang sein."
  }

  if (!HEX_COLOR_RE.test(input.accentColor.trim())) {
    fieldErrors.accentColor = "Bitte wähle eine gültige Hex-Farbe wie #5b5bd6."
  }

  try {
    website = normalizeHttpUrl(input.website)
  } catch {
    fieldErrors.website = "Bitte gib eine gültige Website-URL ein."
  }

  if (contactEmail && !EMAIL_RE.test(contactEmail)) {
    fieldErrors.contactEmail = "Bitte gib eine gültige Kontakt-E-Mail ein."
  }

  if (ctaText && ctaText.length > 80) {
    fieldErrors.ctaText = "Der CTA-Text darf maximal 80 Zeichen lang sein."
  }

  try {
    ctaUrl = normalizeHttpUrl(input.ctaUrl)
  } catch {
    fieldErrors.ctaUrl = "Bitte gib eine gültige CTA-URL ein."
  }

  if (input.reportLanguage !== "de" && input.reportLanguage !== "en") {
    fieldErrors.reportLanguage = "Bitte wähle Deutsch oder Englisch."
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors }
  }

  return {
    ok: true,
    value: {
      name,
      logoStorageId: input.logoStorageId,
      accentColor: input.accentColor.trim().toLowerCase(),
      website,
      contactEmail,
      ctaText,
      ctaUrl,
      reportLanguage: input.reportLanguage as ReportLanguage,
    },
  }
}
