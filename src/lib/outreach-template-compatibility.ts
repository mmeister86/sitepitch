export function filterCompatibleTemplates<
  T extends { type: string; language: "de" | "en" },
>(templates: readonly T[], draftType: string, reportLanguage: "de" | "en"): T[] {
  return templates.filter(
    (template) => template.type === draftType && template.language === reportLanguage,
  )
}
