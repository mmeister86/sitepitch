import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

const source = readFileSync(new URL("./api-settings.tsx", import.meta.url), "utf8")

describe("API key settings", () => {
  test("offers all public API scopes by default, including usage", () => {
    expect(source).toContain(
      'const API_SCOPES = ["audits:create", "audits:read", "reports:read", "usage:read"] as const',
    )
    expect(source).toContain('const [scopes, setScopes] = useState<ApiScope[]>([...API_SCOPES])')
    expect(source).toContain('label: "Nutzung lesen"')
    expect(source).toContain('description: "Plan, Credits und Audit-Gesamtzahl des Workspace abrufen."')
  })

  test("keeps the four scope cards responsive", () => {
    expect(source).toContain('className="grid gap-3 md:grid-cols-2"')
    expect(source).not.toContain("lg:grid-cols-4")
  })

  test("removes a raw key from the page only after a successful copy", () => {
    expect(source).toContain("await copyTextThen(rawReveal.rawKey, () => setRawReveal(null))")
    expect(source).toContain('toast.error("API-Key konnte nicht kopiert werden")')
  })

  test("allows active and grace-period keys to be revoked but only active keys to be rotated", () => {
    expect(source).toContain('const canRotate = key.status === "active"')
    expect(source).toContain('const canRevoke = key.status === "active" || key.status === "grace"')
    expect(source).toContain("{canRevoke ? (")
    expect(source).toContain("{canRotate ? (")
  })
})
