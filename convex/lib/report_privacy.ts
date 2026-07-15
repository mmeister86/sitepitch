const MAX_REFERRER_HOST_LENGTH = 253

export function normalizeReportReferrer(value: string | undefined): string | undefined {
  const raw = value?.trim()
  if (!raw || raw.length > 2_048) return undefined
  try {
    const url = new URL(raw)
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
      return undefined
    }
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "")
    if (!hostname || hostname.length > MAX_REFERRER_HOST_LENGTH) return undefined
    return hostname
  } catch {
    return undefined
  }
}
