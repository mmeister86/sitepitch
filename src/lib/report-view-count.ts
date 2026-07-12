export function formatReportViewCount(count: number, capped: boolean, pending: boolean): string {
  if (pending) return "Wird aktualisiert"
  return `${count}${capped ? "+" : ""}`
}
