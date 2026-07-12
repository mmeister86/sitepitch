export function isPublicReportPreview(searchParams: Pick<URLSearchParams, "get">): boolean {
  return searchParams.get("preview") === "1"
}
