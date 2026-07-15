import { describe, expect, test } from "vitest"

import { classifyCustomReportRoute } from "../proxy"

describe("custom report host proxy", () => {
  const siteUrl = "https://trysitepitch.com"

  test("leaves platform, local and preview hosts untouched", () => {
    expect(classifyCustomReportRoute({ hostname: "trysitepitch.com", pathname: "/app", siteUrl })).toEqual({ kind: "platform" })
    expect(classifyCustomReportRoute({ hostname: "localhost", pathname: "/app", siteUrl })).toEqual({ kind: "platform" })
    expect(classifyCustomReportRoute({ hostname: "preview.vercel.app", pathname: "/app", siteUrl })).toEqual({ kind: "platform" })
  })

  test("rewrites only a single safe slug on a custom host", () => {
    expect(classifyCustomReportRoute({
      hostname: "reports.agentur.de",
      pathname: "/AbCdEf12_345",
      siteUrl,
    })).toEqual({ kind: "rewrite", slug: "AbCdEf12_345" })

    for (const pathname of ["/", "/app", "/settings", "/login", "/r/AbCdEf12", "/AbCdEf12/extra", "/short"]) {
      expect(classifyCustomReportRoute({ hostname: "reports.agentur.de", pathname, siteUrl })).toEqual({ kind: "blocked" })
    }
  })

  test("allows Next.js framework assets", () => {
    expect(classifyCustomReportRoute({
      hostname: "reports.agentur.de",
      pathname: "/_next/static/chunk.js",
      siteUrl,
    })).toEqual({ kind: "asset" })
  })
})
