import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

describe("public report telemetry", () => {
  test("cannot be disabled through a public preview query parameter", () => {
    const source = readFileSync(new URL("./public-report.tsx", import.meta.url), "utf8")
    expect(source).not.toContain("useSearchParams")
    expect(source).not.toContain("isPublicReportPreview")
    expect(source).not.toContain("preview=1")
    expect(source).toContain("recordView({ slug, host, grantToken })")
    expect(source).toContain("recordCta({ slug, host, grantToken })")
    expect(source).toContain("/reports/pdf?slug=")
    expect(source).toContain('"X-Report-Host": host')
    expect(source).toContain('access.status === "password_required"')
    expect(source).toContain('access.status === "unavailable"')
    expect(source).toContain("sessionStorage.setItem(grantStorageKey(slug), result.grantToken)")
  })
})
