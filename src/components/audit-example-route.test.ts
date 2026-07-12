// @vitest-environment node

import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

import { GET } from "../../app/examples/[slug]/route"

const routeSource = readFileSync(
  new URL("../../app/examples/[slug]/route.ts", import.meta.url),
  "utf8",
)
const dataSource = readFileSync(new URL("../lib/audit-examples.ts", import.meta.url), "utf8")
const linksSource = readFileSync(new URL("./audit-example-links.tsx", import.meta.url), "utf8")

describe("provider-free audit example document", () => {
  test("returns a cached HTML document for a valid example", async () => {
    const response = await GET(new Request("https://sitepitch.test/examples/zahnarzt"), {
      params: Promise.resolve({ slug: "zahnarzt" }),
    })
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8")
    expect(response.headers.get("cache-control")).toContain("public")
    expect(html).toContain("<!doctype html>")
    expect(html).toContain("Beispiel")
    expect(html).toContain("Kategorie-Scores")
    expect(html).toContain("Nächste Schritte")
    expect(html).not.toMatch(/analytics\/script|data-site-id|NEXT_PUBLIC_CONVEX|convex\/react/i)
  })

  test("returns a real HTML 404 for an invalid slug", async () => {
    const response = await GET(new Request("https://sitepitch.test/examples/unknown"), {
      params: Promise.resolve({ slug: "unknown" }),
    })

    expect(response.status).toBe(404)
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8")
    expect(await response.text()).toContain("Beispiel nicht gefunden")
  })

  test("keeps the route and data dependency free of providers and uses hard anchors", () => {
    expect(routeSource).not.toMatch(/from\s+["'](?:next|react|convex)/i)
    expect(routeSource).not.toMatch(/auth|rybbit|analytics/i)
    expect(dataSource).not.toMatch(/components\/audit-report|convex|auth|analytics|rybbit/i)
    expect(routeSource).toContain("escapeHtml(")
    expect(linksSource).toContain("<a key=")
    expect(linksSource).not.toContain("next/link")
  })
})
