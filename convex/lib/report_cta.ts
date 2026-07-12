import { ConvexError } from "convex/values"
import type { Doc } from "../_generated/dataModel"

const CTA_TEXT_LIMIT = 80
const CTA_URL_LIMIT = 2_048

function invalid(message: string): never {
  throw new ConvexError({ code: "VALIDATION_ERROR", message })
}

function decodeRepeatedly(value: string): string {
  let decoded = value
  for (let i = 0; i <= value.length; i++) {
    const next = decodeURIComponent(decoded)
    if (next === decoded) return decoded
    decoded = next
  }
  invalid("Bitte gib eine eindeutig codierte CTA-URL ein.")
}

export function normalizeReportCtaText(value: string | undefined): string | undefined {
  const text = value?.trim() || undefined
  if (text && text.length > CTA_TEXT_LIMIT) {
    invalid(`Der Report-CTA darf höchstens ${CTA_TEXT_LIMIT} Zeichen lang sein.`)
  }
  return text
}

export function normalizeReportCtaUrl(value: string | undefined): string | undefined {
  const raw = value?.trim() || undefined
  if (!raw) return undefined
  if (raw.length > CTA_URL_LIMIT || /[\u0000-\u0020\u007f]/.test(raw)) {
    invalid("Bitte gib eine gültige CTA-URL ohne Leer- oder Steuerzeichen ein.")
  }
  try {
    const decodedRaw = decodeRepeatedly(raw)
    if (/[\r\n]|%0[ad]/i.test(decodedRaw)) {
      invalid("Bitte gib eine gültige CTA-URL ohne Steuerzeichen ein.")
    }
  } catch {
    invalid("Bitte gib eine gültig codierte CTA-URL ein.")
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    invalid("Bitte gib eine vollständige CTA-URL ein.")
  }
  if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) {
    invalid("CTA-URLs dürfen nur http, https, mailto oder tel verwenden.")
  }
  if ((url.protocol === "http:" || url.protocol === "https:") && (!url.hostname || url.username || url.password)) {
    invalid("Bitte gib eine gültige Web-URL ohne Zugangsdaten ein.")
  }
  if ((url.protocol === "mailto:" || url.protocol === "tel:") && !url.pathname) {
    invalid("Bitte ergänze ein Ziel für die CTA-URL.")
  }
  if (url.protocol === "mailto:") {
    let address: string
    try {
      address = decodeRepeatedly(url.pathname)
    } catch {
      invalid("Bitte gib eine gültige E-Mail-Adresse als CTA-Ziel ein.")
    }
    if (url.search || url.hash || /[\r\n]|%0[ad]/i.test(address) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      invalid("Bitte gib eine gültige E-Mail-Adresse als CTA-Ziel ein.")
    }
  }
  if (url.protocol === "tel:") {
    let phone: string
    try {
      phone = decodeRepeatedly(url.pathname)
    } catch {
      invalid("Bitte gib eine gültige Telefonnummer als CTA-Ziel ein.")
    }
    if (url.search || url.hash || !/^\+?[0-9().-]+$/.test(phone)) {
      invalid("Bitte gib eine gültige Telefonnummer als CTA-Ziel ein.")
    }
  }
  return raw
}

export function safeNormalizeReportCtaUrl(value: string | undefined): string | undefined {
  try {
    return normalizeReportCtaUrl(value)
  } catch {
    return undefined
  }
}

export function safeNormalizeWorkspaceWebsite(value: string | undefined): string | undefined {
  const normalized = safeNormalizeReportCtaUrl(value)
  if (!normalized) return undefined
  const url = new URL(normalized)
  return url.protocol === "http:" || url.protocol === "https:" ? normalized : undefined
}

export function safeMailtoFromContactEmail(value: string | undefined): string | undefined {
  const email = value?.trim()
  if (!email || /[\u0000-\u0020\u007f]|%0[ad]/i.test(email)) return undefined
  return safeNormalizeReportCtaUrl(`mailto:${email}`)
}

export function resolveReportCtaSnapshotValues(
  workspace: Pick<Doc<"workspaces">, "ctaText" | "ctaUrl" | "website" | "contactEmail">,
  lead: Pick<Doc<"leads">, "reportCtaText" | "reportCtaUrl"> | null,
): { text?: string; url?: string } {
  return {
    text: lead?.reportCtaText ?? workspace.ctaText,
    url:
      safeNormalizeReportCtaUrl(lead?.reportCtaUrl) ??
      safeNormalizeReportCtaUrl(workspace.ctaUrl) ??
      safeNormalizeWorkspaceWebsite(workspace.website) ??
      safeMailtoFromContactEmail(workspace.contactEmail),
  }
}
