import { ConvexError } from "convex/values"

function configurationError(): never {
  throw new ConvexError({
    code: "CONFIGURATION_ERROR",
    message: "SITE_URL muss als vertrauenswürdige http(s)-URL konfiguriert sein.",
  })
}

export function buildCanonicalReportUrl(siteUrl: string | undefined, publicSlug: string): string {
  const raw = siteUrl?.trim()
  if (!raw || /[\u0000-\u0020\u007f]/.test(raw)) configurationError()

  let base: URL
  try {
    base = new URL(raw)
  } catch {
    configurationError()
  }
  if (
    (base.protocol !== "http:" && base.protocol !== "https:") ||
    !base.hostname ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  ) {
    configurationError()
  }

  const basePath = base.pathname.replace(/\/+$/, "")
  const reportPath = `${basePath}/r/${encodeURIComponent(publicSlug)}`.replace(/\/{2,}/g, "/")
  return `${base.origin}${reportPath}`
}
