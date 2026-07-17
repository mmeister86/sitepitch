// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test, vi } from "vitest"

import PricingPage from "../../app/pricing/page"
import { PRICING_CATALOG, publicNavigation } from "../lib/launch-content"
import { Sheet } from "./ui/sheet"
import {
  DemoAuditForm,
  runDemoAuditSubmission,
  type DemoAuditRequest,
} from "./marketing/demo-audit-form"
import { submitDemoAuditUnavailable } from "./marketing/demo-client-boundary"
import {
  demoFormReducer,
  initialDemoFormState,
  type DemoFormAction,
  type DemoFormState,
} from "./marketing/demo-state"
import { PricingSection } from "./marketing/pricing-section"
import { PublicFooter } from "./marketing/public-footer"
import {
  MobileFeatureAccordion,
  NavbarFeatureGrid,
  PublicHeader,
} from "./marketing/public-header"

function countElements(html: string, tag: string) {
  return (html.match(new RegExp(`<${tag}(?:\\s|>)`, "g")) ?? []).length
}

function formHarness(initial: DemoFormState = initialDemoFormState) {
  let state = initial
  const dispatch = (action: DemoFormAction) => {
    state = demoFormReducer(state, action)
  }
  return { dispatch, getState: () => state }
}

describe("real navbar5 and footer11 render structure", () => {
  test("renders a two-column desktop feature menu and mobile feature accordion", () => {
    const html = [
      renderToStaticMarkup(<PublicHeader />),
      renderToStaticMarkup(<NavbarFeatureGrid region="desktop-features" />),
      renderToStaticMarkup(
        <Sheet>
          <MobileFeatureAccordion defaultOpen />
        </Sheet>,
      ),
    ].join("\n")

    expect(html).toContain('data-navbar-region="desktop-features"')
    expect(html).toContain('data-navbar-region="mobile-features"')
    expect(html).toContain("Funktionen")
    expect(html).toContain("Gebrandete Reports")
    expect(html).toContain("Outreach-Entwürfe")
    expect(html).toContain("Demo-Audit")
    expect(html).toContain('aria-label="Hauptnavigation"')
  })

  test("closes the mobile sheet for every feature navigation without wrapping desktop feature links", () => {
    const mobileHtml = renderToStaticMarkup(
      <Sheet>
        <MobileFeatureAccordion defaultOpen />
      </Sheet>,
    )
    const desktopHtml = renderToStaticMarkup(<NavbarFeatureGrid region="desktop-features" />)
    const mobileCloseLinks = mobileHtml.match(/<a\b[^>]*data-slot="sheet-close"[^>]*>/g) ?? []

    expect(mobileCloseLinks).toHaveLength(publicNavigation.features.length)
    for (const feature of publicNavigation.features) {
      expect(mobileCloseLinks.some((link) => link.includes(`href="${feature.href}"`))).toBe(true)
    }
    expect(desktopHtml).not.toContain('data-slot="sheet-close"')
  })

  test("renders the product/company/legal grid and a real large SitePitch report image", () => {
    const html = renderToStaticMarkup(<PublicFooter />)

    expect(html).toContain('data-footer-region="link-grid"')
    expect(html).toContain("Produkt")
    expect(html).toContain("Unternehmen")
    expect(html).toContain("Rechtliches")
    expect(html).toContain("audit-restaurant-desktop.webp")
    expect(html).toContain("SitePitch Beispielreport")
    expect(html).not.toMatch(/instagram\.com|twitter\.com|linkedin\.com/i)
  })
})

describe("pricing heading semantics", () => {
  test("keeps the homepage section at h2", () => {
    const html = renderToStaticMarkup(<PricingSection catalog={PRICING_CATALOG} />)
    expect(countElements(html, "h1")).toBe(0)
    expect(countElements(html, "h2")).toBe(1)
  })

  test("renders exactly one h1 on the full pricing route", () => {
    const html = renderToStaticMarkup(<PricingPage />)
    expect(countElements(html, "h1")).toBe(1)
  })
})

describe("demo form render and interaction flow", () => {
  test("renders the actual URL, consent, submit, Turnstile fallback, and limit controls", () => {
    const html = renderToStaticMarkup(
      <DemoAuditForm submitAudit={vi.fn()} turnstileSiteKey={null} />,
    )

    expect(html).toContain('<form')
    expect(html).toContain('id="demo-url"')
    expect(html).toContain('id="demo-consent"')
    expect(html).toContain("Demo-Audit anfragen")
    expect(html).toContain("Turnstile-Sicherheitsprüfung")
    expect(html).toContain("1 Demo-Audit pro IP und Tag")
    expect(html).toContain("25 Demo-Audits pro Tag")
  })

  test("rejects an invalid URL before calling the adapter", async () => {
    const submitAudit = vi.fn()
    const harness = formHarness()

    await runDemoAuditSubmission(
      { url: "javascript:alert(1)", consent: true, turnstileRequired: false, turnstileToken: null },
      submitAudit,
      harness.dispatch,
    )

    expect(submitAudit).not.toHaveBeenCalled()
    expect(harness.getState().audit).toMatchObject({ status: "error", message: expect.stringContaining("http://") })
    expect(harness.getState().turnstileResetVersion).toBe(0)
  })

  test("requires explicit consent before calling the adapter", async () => {
    const submitAudit = vi.fn()
    const harness = formHarness()

    await runDemoAuditSubmission(
      { url: "https://example.de", consent: false, turnstileRequired: false, turnstileToken: null },
      submitAudit,
      harness.dispatch,
    )

    expect(submitAudit).not.toHaveBeenCalled()
    expect(harness.getState().audit).toMatchObject({ status: "error", message: expect.stringContaining("bestätige") })
  })

  test("enters progress immediately and resolves only with the real adapter result", async () => {
    let resolveSubmit: ((result: { reportHref: string; label: string }) => void) | undefined
    const submitAudit = vi.fn(
      () => new Promise<{ reportHref: string; label: string }>((resolve) => { resolveSubmit = resolve }),
    )
    const harness = formHarness()

    const submission = runDemoAuditSubmission(
      { url: "https://example.de", consent: true, turnstileRequired: false, turnstileToken: null },
      submitAudit,
      harness.dispatch,
    )

    expect(harness.getState().audit.status).toBe("submitting")
    expect(submitAudit).toHaveBeenCalledWith({ url: "https://example.de/", turnstileToken: null })
    resolveSubmit?.({ reportHref: "/r/real-report", label: "Report öffnen" })
    await submission
    expect(harness.getState().audit).toMatchObject({ status: "result", result: { reportHref: "/r/real-report" } })
  })

  test("resets Turnstile after the unavailable adapter and allows a tokenized retry", async () => {
    const harness = formHarness()
    harness.dispatch({ type: "turnstile_token", token: "first-token" })

    await runDemoAuditSubmission(
      { url: "https://example.de", consent: true, turnstileRequired: true, turnstileToken: "first-token" },
      submitDemoAuditUnavailable,
      harness.dispatch,
    )

    expect(harness.getState().audit).toMatchObject({ status: "error", message: expect.stringContaining("noch nicht verbunden") })
    expect(harness.getState().turnstileToken).toBeNull()
    expect(harness.getState().turnstileResetVersion).toBe(1)

    harness.dispatch({ type: "turnstile_token", token: "retry-token" })
    const recoveredAdapter = vi.fn(async (request: DemoAuditRequest) => ({
      reportHref: `/r/${request.turnstileToken}`,
      label: "Report öffnen",
    }))
    await runDemoAuditSubmission(
      { url: "https://example.de", consent: true, turnstileRequired: true, turnstileToken: "retry-token" },
      recoveredAdapter,
      harness.dispatch,
    )

    expect(recoveredAdapter).toHaveBeenCalledWith({ url: "https://example.de/", turnstileToken: "retry-token" })
    expect(harness.getState().audit).toMatchObject({ status: "result", result: { reportHref: "/r/retry-token" } })
  })
})
