import { describe, expect, test, vi } from "vitest"

import {
  buildCustomReportUrl,
  extractRequestHostname,
  isAllowedReportRequestHost,
  normalizeReportDomainHostname,
  reportDomainChallengeName,
  reportDomainChallengeValue,
  resolveReportPublicUrl,
  verifyReportDomainDns,
} from "./report_domain"

describe("report domain validation", () => {
  test("normalizes a safe CNAME subdomain", () => {
    expect(normalizeReportDomainHostname(" Reports.Agentur.DE. ")).toBe("reports.agentur.de")
    expect(reportDomainChallengeName("reports.agentur.de")).toBe(
      "_sitepitch-challenge.reports.agentur.de",
    )
    expect(reportDomainChallengeValue("token-123")).toBe("sitepitch-verification=token-123")
  })

  test.each([
    "agentur.de",
    "example.co.uk",
    "https://reports.agentur.de",
    "reports.agentur.de/path",
    "reports.agentur.de:443",
    "*.agentur.de",
    "127.0.0.1",
    "reports.localhost",
    "reports.agentur.test",
    "bad_label.agentur.de",
  ])("rejects unsafe or unsupported host %s", (hostname) => {
    expect(() => normalizeReportDomainHostname(hostname)).toThrow()
  })

  test("accepts subdomains under a common two-label public suffix", () => {
    expect(normalizeReportDomainHostname("reports.example.co.uk")).toBe("reports.example.co.uk")
  })

  test("parses request hosts without accepting paths or credentials", () => {
    expect(extractRequestHostname("Reports.Agentur.DE:443")).toBe("reports.agentur.de")
    expect(extractRequestHostname("reports.agentur.de/path")).toBeNull()
    expect(extractRequestHostname("user@reports.agentur.de")).toBeNull()
  })
})

describe("report domain URLs and host policy", () => {
  const activeDomain = { hostname: "reports.agentur.de", status: "active" as const }

  test("uses a custom URL only for an active Agency domain", () => {
    expect(buildCustomReportUrl(activeDomain.hostname, "a/b")).toBe(
      "https://reports.agentur.de/a%2Fb",
    )
    expect(
      resolveReportPublicUrl({
        siteUrl: "https://trysitepitch.com",
        publicSlug: "report_slug",
        plan: "agency",
        domain: activeDomain,
      }),
    ).toBe("https://reports.agentur.de/report_slug")
    expect(
      resolveReportPublicUrl({
        siteUrl: "https://trysitepitch.com",
        publicSlug: "report_slug",
        plan: "pro",
        domain: activeDomain,
      }),
    ).toBe("https://trysitepitch.com/r/report_slug")
  })

  test("accepts only the canonical host or the active workspace custom host", () => {
    const base = {
      siteUrl: "https://trysitepitch.com",
      plan: "agency",
      domain: activeDomain,
    }
    expect(isAllowedReportRequestHost({ ...base, host: "trysitepitch.com" })).toBe(true)
    expect(isAllowedReportRequestHost({ ...base, host: "reports.agentur.de:443" })).toBe(true)
    expect(isAllowedReportRequestHost({ ...base, host: "reports.attacker.de" })).toBe(false)
    expect(isAllowedReportRequestHost({ ...base, host: "reports.agentur.de", plan: "pro" })).toBe(false)
  })
})

describe("DNS-over-HTTPS verification", () => {
  function dnsFetch(records: { txt?: string[]; cname?: string[] }): typeof fetch {
    return vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(input instanceof URL ? input.href : input instanceof Request ? input.url : input)
      const type = url.searchParams.get("type")
      const values = type === "TXT" ? records.txt ?? [] : records.cname ?? []
      return Response.json({
        Status: 0,
        Answer: values.map((data) => ({ data })),
      })
    }) as unknown as typeof fetch
  }

  test("requires both the exact TXT challenge and CNAME target", async () => {
    const result = await verifyReportDomainDns({
      hostname: "reports.agentur.de",
      verificationToken: "secret-token",
      cnameTarget: "reports.trysitepitch.com",
      fetchImpl: dnsFetch({
        txt: ['"sitepitch-verification=secret-" "token"'],
        cname: ["reports.trysitepitch.com."],
      }),
    })
    expect(result).toEqual({
      ok: true,
      txtVerified: true,
      cnameVerified: true,
      errorCode: null,
    })
  })

  test("returns a generic DNS failure without throwing resolver details", async () => {
    const result = await verifyReportDomainDns({
      hostname: "reports.agentur.de",
      verificationToken: "secret-token",
      cnameTarget: "reports.trysitepitch.com",
      fetchImpl: vi.fn(async () => {
        throw new Error("resolver secret")
      }) as unknown as typeof fetch,
    })
    expect(result).toEqual({
      ok: false,
      txtVerified: false,
      cnameVerified: false,
      errorCode: "DNS_LOOKUP_FAILED",
    })
  })
})
