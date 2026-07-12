import { normalizeStrictCtaTarget } from "./cta-target-validation"

export type ReportCtaBranding = {
  ctaUrl?: string
  ctaSnapshotted: boolean
  website?: string
  contactEmail?: string
}

function safeHttpUrl(value: string | undefined): string | null {
  const normalized = normalizeStrictCtaTarget(value)
  return normalized && /^https?:/i.test(normalized) ? normalized : null
}

function safeCtaUrl(value: string | undefined): string | null {
  return normalizeStrictCtaTarget(value) ?? null
}

export function resolveCtaHref(branding: ReportCtaBranding): string | null {
  const ctaUrl = safeCtaUrl(branding.ctaUrl)
  if (ctaUrl) return ctaUrl
  if (branding.ctaSnapshotted) return null

  const website = safeHttpUrl(branding.website)
  if (website) return website
  const contactEmail = safeCtaUrl(
    branding.contactEmail ? `mailto:${branding.contactEmail}` : undefined,
  )
  if (contactEmail) return contactEmail
  return null
}
