// @vitest-environment node

import { existsSync, readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test } from "vitest"

import {
  HOME_SECTION_ORDER,
  PRICING_CATALOG,
  publicNavigation,
} from "../lib/launch-content"
import {
  demoAuditReducer,
  initialDemoAuditState,
  type DemoAuditState,
} from "./marketing/demo-state"
import { DemoStatusPanel } from "./marketing/demo-status-panel"
import { LegalArticle } from "./marketing/legal-article"

const root = new URL("../../", import.meta.url)

function source(path: string) {
  return readFileSync(new URL(path, root), "utf8")
}

describe("public launch route contracts", () => {
  test.each([
    "app/page.tsx",
    "app/pricing/page.tsx",
    "app/demo/page.tsx",
    "app/examples/page.tsx",
    "app/privacy/page.tsx",
    "app/terms/page.tsx",
    "app/imprint/page.tsx",
  ])("provides %s with German metadata", (path) => {
    expect(existsSync(new URL(path, root))).toBe(true)
    const route = source(path)
    expect(route).toContain("export const metadata")
    expect(route).toMatch(/title:/)
    expect(route).toMatch(/description:/)
  })

  test("keeps the PRD homepage sections in the required order", () => {
    expect(HOME_SECTION_ORDER).toEqual([
      "hero",
      "vergleich",
      "workflow",
      "beispiel-report",
      "funktionen",
      "preise",
      "faq",
      "start",
    ])

    const home = source("app/page.tsx")
    let cursor = -1
    for (const section of HOME_SECTION_ORDER) {
      const next = home.indexOf(`id=\"${section}\"`)
      expect(next, `${section} fehlt oder steht in der falschen Reihenfolge`).toBeGreaterThan(cursor)
      cursor = next
    }
    const homeCopy = `${home}\n${source("src/components/marketing/home-sections.tsx")}`
    expect(homeCopy).toContain("Website-Audits, die Kundengespräche starten")
    expect(homeCopy).toContain("Find")
    expect(homeCopy).toContain("Audit")
    expect(homeCopy).toContain("Pitch")
  })

  test("uses the twelve requested shadcnblocks structures", () => {
    const marketingSources = [
      source("src/components/marketing/public-header.tsx"),
      source("src/components/marketing/home-sections.tsx"),
      source("src/components/marketing/pricing-section.tsx"),
      source("src/components/marketing/faq-section.tsx"),
      source("src/components/marketing/public-footer.tsx"),
      source("src/components/marketing/legal-article.tsx"),
      source("src/components/marketing/demo-audit-form.tsx"),
    ].join("\n")

    for (const block of [
      "navbar5",
      "hero261",
      "compare10",
      "feature207",
      "feature344",
      "feature101",
      "pricing1",
      "faq3",
      "cta34",
      "footer11",
      "blogpost3",
      "contact9",
    ]) {
      expect(marketingSources).toContain(`data-registry-block=\"${block}\"`)
    }
  })
})

describe("shared pricing and CTA truth", () => {
  test("keeps homepage and full pricing on one MVP catalog", () => {
    expect(PRICING_CATALOG.trial.credits).toBe(3)
    expect(PRICING_CATALOG.plans.map(({ monthlyPriceEuro, credits }) => [monthlyPriceEuro, credits])).toEqual([
      [19, 25],
      [49, 100],
      [99, 300],
    ])
    expect(PRICING_CATALOG.plans.find((plan) => plan.id === "agency")?.features).toEqual(
      expect.arrayContaining([
        "Batch-Audits mit bis zu 100 URLs",
        "White-Label Light und Custom Domain",
        "Public API und Webhooks",
      ]),
    )
    expect(PRICING_CATALOG.extraPack).toMatchObject({ priceEuro: 10, credits: 25 })

    expect(source("app/page.tsx")).toContain("PRICING_CATALOG")
    expect(source("app/pricing/page.tsx")).toContain("PRICING_CATALOG")
    expect(source("src/views/billing-settings.tsx")).toContain("PRICING_CATALOG")
  })

  test("only sends public purchasing CTAs to signup or protected billing", () => {
    const destinations = [
      ...PRICING_CATALOG.plans.map((plan) => plan.ctaHref),
      PRICING_CATALOG.extraPack.ctaHref,
    ]
    expect(destinations.every((href) => href === "/signup" || href === "/app/settings/billing")).toBe(true)
    expect(publicNavigation.primaryCta.href).toBe("/demo")
  })
})

describe("replaceable demo client boundary", () => {
  const states: DemoAuditState[] = [
    initialDemoAuditState,
    { status: "submitting", message: "Website wird geprüft …" },
    { status: "error", message: "Der Demo-Dienst ist noch nicht verbunden." },
    { status: "result", result: { reportHref: "/examples/zahnarzt", label: "Report öffnen" } },
  ]

  test.each(states)("renders the $status state accessibly", (state) => {
    const html = renderToStaticMarkup(<DemoStatusPanel state={state} />)
    expect(html).toContain(`data-demo-state=\"${state.status}\"`)
    if (state.status === "error") expect(html).toContain('role="alert"')
    if (state.status === "submitting") expect(html).toContain('aria-live="polite"')
    if (state.status === "result") expect(html).toContain("/examples/zahnarzt")
  })

  test("moves through progress, error, reset, and real result actions", () => {
    const submitting = demoAuditReducer(initialDemoAuditState, { type: "submit" })
    expect(submitting.status).toBe("submitting")
    const failed = demoAuditReducer(submitting, { type: "reject", message: "Nicht verfügbar" })
    expect(failed).toEqual({ status: "error", message: "Nicht verfügbar" })
    expect(demoAuditReducer(failed, { type: "reset" })).toEqual(initialDemoAuditState)
    expect(
      demoAuditReducer(submitting, {
        type: "resolve",
        result: { reportHref: "/r/real-report", label: "Report öffnen" },
      }),
    ).toMatchObject({ status: "result" })
  })

  test("keeps consent, Turnstile, and both public rate limits explicit", () => {
    const demo = source("src/components/marketing/demo-audit-form.tsx")
    expect(demo).toContain("/privacy")
    expect(demo).toContain("/terms")
    expect(demo).toMatch(/Turnstile/)
    expect(demo).toContain("1 Demo-Audit pro IP und Tag")
    expect(demo).toContain("25 Demo-Audits pro Tag")
    expect(demo).not.toMatch(/setTimeout|mockReport|fakeResult/)
  })
})

describe("examples and legal boundaries", () => {
  test("indexes exactly the three existing provider-free examples", () => {
    const examples = source("app/examples/page.tsx")
    expect(examples).toContain("auditExamples.map")
    expect(examples).toContain("/examples/${example.slug}")
    expect(source("app/examples/[slug]/route.ts")).not.toMatch(/analytics\/script|convex\/react|auth-client/i)
  })

  test("renders a centralized missing-operator state without invented details", () => {
    const html = renderToStaticMarkup(<LegalArticle kind="imprint" operator={null} />)
    expect(html).toContain("Betreiberangaben fehlen")
    expect(html).toContain("LEGAL_OPERATOR_NAME")
    expect(html).not.toMatch(/Musterstraße|Musterstadt|Max Mustermann/)
  })

  test("states the factual privacy and outreach boundaries", () => {
    const privacy = renderToStaticMarkup(<LegalArticle kind="privacy" operator={null} />)
    const terms = renderToStaticMarkup(<LegalArticle kind="terms" operator={null} />)
    expect(privacy).toContain("keine Rechtsberatung")
    expect(privacy).toContain("Anbieter")
    expect(terms).toContain("keine automatische Massenversendung")
    expect(terms).toContain("rechtmäßige Kontaktaufnahme")
  })
})
