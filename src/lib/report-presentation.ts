import type { ReportSectionKey, ReportThemePreset } from "./report-document"

export interface ReportPresentationInput {
  branding: { accentColor: string }
  presentation?: {
    theme?: ReportThemePreset
    primaryColor?: string
    backgroundColor?: string
    textColor?: string
    introText?: string
    hiddenSections?: ReportSectionKey[]
    showPoweredBy?: boolean
  }
  intro?: string
  hiddenSections?: ReportSectionKey[]
  theme?: {
    preset: ReportThemePreset
    primaryColor: string
    backgroundColor: string
    textColor: string
  }
  showPoweredBy?: boolean
}

const DEFAULT_BACKGROUND = "#f8fafc"
const DEFAULT_TEXT = "#172033"

function safeHex(value: string | undefined, fallback: string): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
}

export function resolveReportPresentation(report: ReportPresentationInput) {
  const presentation = report.presentation
  return {
    theme: report.theme?.preset ?? presentation?.theme ?? "classic",
    primaryColor: safeHex(
      report.theme?.primaryColor ?? presentation?.primaryColor,
      safeHex(report.branding.accentColor, "#5b5bd6"),
    ),
    backgroundColor: safeHex(
      report.theme?.backgroundColor ?? presentation?.backgroundColor,
      DEFAULT_BACKGROUND,
    ),
    textColor: safeHex(report.theme?.textColor ?? presentation?.textColor, DEFAULT_TEXT),
    introText: (report.intro ?? presentation?.introText)?.trim() ?? "",
    hiddenSections: new Set<ReportSectionKey>(
      report.hiddenSections ?? presentation?.hiddenSections ?? [],
    ),
    showPoweredBy: report.showPoweredBy ?? presentation?.showPoweredBy ?? true,
  }
}
