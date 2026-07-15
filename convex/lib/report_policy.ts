import { ConvexError } from "convex/values"

import type { SubscriptionPlan } from "./rate_limit_helpers"

export const REPORT_THEMES = ["classic", "minimal", "editorial"] as const
export type ReportTheme = (typeof REPORT_THEMES)[number]

export const REPORT_SECTIONS = [
  "score",
  "summary",
  "opportunities",
  "strengths_weaknesses",
  "screenshots",
  "findings",
  "next_steps",
  "cta",
] as const
export type ReportSection = (typeof REPORT_SECTIONS)[number]

export const CORE_REPORT_SECTIONS = ["score", "summary", "findings", "next_steps"] as const

export type ReportFeaturePolicy = {
  themes: boolean
  customColors: boolean
  sectionVisibility: boolean
  intro: boolean
  campaignCta: boolean
  passwordProtection: boolean
  expiration: boolean
  pdfExport: boolean
  poweredByToggle: boolean
  customDomain: boolean
}

const BASE_POLICY: ReportFeaturePolicy = {
  themes: false,
  customColors: false,
  sectionVisibility: false,
  intro: false,
  campaignCta: false,
  passwordProtection: false,
  expiration: false,
  pdfExport: false,
  poweredByToggle: false,
  customDomain: false,
}

const PRO_POLICY: ReportFeaturePolicy = {
  ...BASE_POLICY,
  themes: true,
  customColors: true,
  sectionVisibility: true,
  intro: true,
  campaignCta: true,
  passwordProtection: true,
  expiration: true,
  pdfExport: true,
}

const AGENCY_POLICY: ReportFeaturePolicy = {
  ...PRO_POLICY,
  poweredByToggle: true,
  customDomain: true,
}

/**
 * Central capability matrix for every report read and mutation.
 *
 * Scale packaging is outside TASK-5.4. It keeps Pro report capabilities, but
 * Agency-only white-label capabilities are deliberately not inferred for it.
 */
export function reportFeaturePolicy(plan: SubscriptionPlan): ReportFeaturePolicy {
  if (plan === "agency") return { ...AGENCY_POLICY }
  if (plan === "pro" || plan === "scale") return { ...PRO_POLICY }
  return { ...BASE_POLICY }
}

export function requireReportCapability(
  policy: ReportFeaturePolicy,
  capability: keyof ReportFeaturePolicy,
): void {
  if (!policy[capability]) {
    throw new ConvexError({
      code: "PLAN_UPGRADE_REQUIRED",
      message: capability === "customDomain"
        ? "Custom Domains sind im Agency-Plan verfügbar."
        : "Diese Report-Funktion ist in deinem aktuellen Plan nicht verfügbar.",
    })
  }
}

export function normalizeReportColor(value: string, fieldLabel: string): string {
  const normalized = value.trim().toLowerCase()
  if (!/^#[0-9a-f]{6}$/.test(normalized)) {
    throw new ConvexError({
      code: "VALIDATION_ERROR",
      message: `${fieldLabel} muss als sechsstelliger Hex-Farbwert angegeben werden.`,
    })
  }
  return normalized
}

export function normalizeReportIntro(value: string | undefined): string | undefined {
  const normalized = value?.trim() || undefined
  if (normalized && normalized.length > 2_000) {
    throw new ConvexError({
      code: "VALIDATION_ERROR",
      message: "Der Report-Introtext darf höchstens 2.000 Zeichen lang sein.",
    })
  }
  return normalized
}

export function normalizeHiddenSections(sections: readonly string[]): ReportSection[] {
  const allowed = new Set<string>(REPORT_SECTIONS)
  const normalized = [...new Set(sections)]
  if (normalized.some((section) => !allowed.has(section))) {
    throw new ConvexError({
      code: "VALIDATION_ERROR",
      message: "Der Report enthält eine unbekannte Sektion.",
    })
  }

  const hidden = new Set(normalized)
  if (CORE_REPORT_SECTIONS.every((section) => hidden.has(section))) {
    throw new ConvexError({
      code: "VALIDATION_ERROR",
      message: "Mindestens eine Kernsektion des Reports muss sichtbar bleiben.",
    })
  }

  return REPORT_SECTIONS.filter((section) => hidden.has(section))
}
