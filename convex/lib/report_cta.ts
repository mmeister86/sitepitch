import { ConvexError } from "convex/values"
import type { Doc } from "../_generated/dataModel"
import { normalizeStrictCtaTarget } from "../../src/lib/cta-target-validation"

const CTA_TEXT_LIMIT = 80

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
  const normalized = normalizeStrictCtaTarget(raw)
  if (!normalized) {
    invalid("Bitte gib eine gültige CTA-URL mit http, https, mailto oder tel ein.")
  }
  return normalized
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
