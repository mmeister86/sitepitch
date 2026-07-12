import { ConvexError } from "convex/values"

const CTA_TEXT_LIMIT = 80
const CTA_URL_LIMIT = 2_048

function invalid(message: string): never {
  throw new ConvexError({ code: "VALIDATION_ERROR", message })
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
      address = decodeURIComponent(url.pathname)
    } catch {
      invalid("Bitte gib eine gültige E-Mail-Adresse als CTA-Ziel ein.")
    }
    if (url.search || url.hash || /[\r\n]/.test(address) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      invalid("Bitte gib eine gültige E-Mail-Adresse als CTA-Ziel ein.")
    }
  }
  if (url.protocol === "tel:") {
    let phone: string
    try {
      phone = decodeURIComponent(url.pathname)
    } catch {
      invalid("Bitte gib eine gültige Telefonnummer als CTA-Ziel ein.")
    }
    if (url.search || url.hash || !/^\+?[0-9().-]+$/.test(phone)) {
      invalid("Bitte gib eine gültige Telefonnummer als CTA-Ziel ein.")
    }
  }
  return raw
}
