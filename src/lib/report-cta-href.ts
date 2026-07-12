export type ReportCtaBranding = {
  ctaUrl?: string
  ctaSnapshotted: boolean
  website?: string
  contactEmail?: string
}

function decodeRepeatedly(value: string): string | null {
  let decoded = value
  try {
    for (let i = 0; i <= value.length; i++) {
      const next = decodeURIComponent(decoded)
      if (next === decoded) return decoded
      decoded = next
    }
  } catch {
    return null
  }
  return null
}

function safeHttpUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    if (/[\u0000-\u0020\u007f]/.test(value)) return null
    const decoded = decodeRepeatedly(value)
    if (!decoded || /[\r\n]|%0[ad]/i.test(decoded)) return null
    const url = new URL(value)
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return null
    return value
  } catch {
    return null
  }
}

function safeCtaUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    if (/[\u0000-\u0020\u007f]/.test(value)) return null
    const decoded = decodeRepeatedly(value)
    if (!decoded || /[\r\n]|%0[ad]/i.test(decoded)) return null
    const url = new URL(value)
    if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) return null
    if ((url.protocol === "http:" || url.protocol === "https:") && (url.username || url.password)) return null
    if (url.protocol === "mailto:") {
      const address = decodeRepeatedly(url.pathname)
      if (!address || url.search || url.hash || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return null
    }
    if (url.protocol === "tel:") {
      const phone = decodeRepeatedly(url.pathname)
      if (!phone || url.search || url.hash || !/^\+?[0-9().-]+$/.test(phone)) return null
    }
    return value
  } catch {
    return null
  }
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
