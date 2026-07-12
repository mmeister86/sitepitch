import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

describe("public report telemetry", () => {
  test("cannot be disabled through a public preview query parameter", () => {
    const source = readFileSync(new URL("./public-report.tsx", import.meta.url), "utf8")
    expect(source).not.toContain("useSearchParams")
    expect(source).not.toContain("isPublicReportPreview")
    expect(source).not.toContain("preview=1")
    expect(source).toContain("recordView({ slug })")
    expect(source).toContain("recordCta({ slug })")
    expect(source).toContain("recordPdf({ slug })")
  })
})
