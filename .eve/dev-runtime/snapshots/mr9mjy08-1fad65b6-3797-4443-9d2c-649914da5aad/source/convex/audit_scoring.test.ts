import assert from "node:assert/strict"

import { describe, test } from "vitest"

import {
  CATEGORY_WEIGHTS,
  SCORING_VERSION,
  clampScore,
  computeCategoryScore,
  computeOverallScore,
  evaluateChecks,
  scoreBand,
  scoreLabel,
  scoreOpportunity,
  summarizeCategoryScores,
  type AuditCheckData,
  type CheckInput,
} from "./lib/audit_scoring"

function check(category: CheckInput["category"], key: string, status: CheckInput["status"], weight?: number): CheckInput {
  return { category, key, label: key, status, weight }
}

const baseData: AuditCheckData = {
  domain: "example.com",
  auditType: "standard",
  finalUrl: "https://example.com/",
  httpStatus: 200,
  title: "Example Studio",
  metaDescription: "Modern web design for local businesses in Berlin",
  h1Texts: ["Example Studio"],
  h2Texts: ["Leistungen"],
  canonicalUrl: "https://example.com/",
  robotsFound: true,
  sitemapFound: true,
  schemaTypes: ["Organization"],
  phoneNumbers: ["+49 30 123456"],
  emailAddresses: ["info@example.com"],
  contactLinks: ["https://example.com/kontakt"],
  internalLinks: ["https://example.com/kontakt", "https://example.com/leistungen"],
  externalLinks: [],
  privacyLinkFound: true,
  imprintLinkFound: true,
  ctaCandidates: ["Jetzt Kontakt aufnehmen"],
  extractedMarkdown: "Example Studio in Berlin. Öffnungszeiten: Mo-Fr 9-17 Uhr.",
  imageCount: 4,
  imagesMissingAltCount: 1,
  phoneLinkFound: true,
  contactFormFound: true,
  viewportMetaFound: true,
  hasContactPage: true,
  hasServicesPage: true,
  hasMobileScreenshot: true,
  hasDesktopScreenshot: true,
  mobilePerformanceScore: 72,
  lcp: 2400,
  cls: 0.05,
  fcp: 1600,
  hasBusinessData: true,
  businessAddress: "Hauptstr. 1, 10115 Berlin",
  businessPhone: "+49 30 123456",
  businessCity: "Berlin",
  businessRating: 4.5,
  businessReviewCount: 23,
  leadCity: "Berlin",
}

describe("scoring math", () => {
  test("weights sum to 1 and match PRD", () => {
    const total = Object.values(CATEGORY_WEIGHTS).reduce((sum, value) => sum + value, 0)
    assert.equal(Math.round(total * 100) / 100, 1)
    assert.equal(CATEGORY_WEIGHTS.conversion, 0.25)
    assert.equal(CATEGORY_WEIGHTS.seo, 0.2)
    assert.equal(CATEGORY_WEIGHTS.local_seo, 0.2)
    assert.equal(CATEGORY_WEIGHTS.performance, 0.15)
    assert.equal(CATEGORY_WEIGHTS.mobile, 0.1)
    assert.equal(CATEGORY_WEIGHTS.trust, 0.1)
  })

  test("category score averages pass/warning/failed correctly", () => {
    const score = computeCategoryScore([
      check("conversion", "a", "passed"),
      check("conversion", "b", "warning"),
      check("conversion", "c", "failed"),
    ])
    assert.equal(score, 50)
  })

  test("not_applicable checks are excluded from the denominator", () => {
    const score = computeCategoryScore([
      check("conversion", "a", "passed"),
      check("conversion", "b", "not_applicable"),
    ])
    assert.equal(score, 100)
  })

  test("unknown counts as half points", () => {
    const score = computeCategoryScore([
      check("conversion", "a", "unknown"),
      check("conversion", "b", "unknown"),
    ])
    assert.equal(score, 50)
  })

  test("category with only not_applicable falls back to neutral score", () => {
    const score = computeCategoryScore([
      check("conversion", "a", "not_applicable"),
      check("conversion", "b", "not_applicable"),
    ])
    assert.equal(score, 50)
  })

  test("overall score is the weighted sum and matches PRD example", () => {
    const overall = computeOverallScore({
      conversion: 55,
      seo: 70,
      local_seo: 45,
      performance: 62,
      mobile: 58,
      trust: 50,
    })
    assert.equal(overall, 57)
  })

  test("clampScore keeps values in range and rounds", () => {
    assert.equal(clampScore(57.4), 57)
    assert.equal(clampScore(-5), 0)
    assert.equal(clampScore(150), 100)
    assert.equal(clampScore(Number.NaN), 50)
  })
})

describe("score labels", () => {
  test("maps the PRD ranges", () => {
    assert.equal(scoreBand(0), "critical")
    assert.equal(scoreBand(39), "critical")
    assert.equal(scoreBand(40), "weak")
    assert.equal(scoreBand(59), "weak")
    assert.equal(scoreBand(60), "solid")
    assert.equal(scoreBand(74), "solid")
    assert.equal(scoreBand(75), "strong")
    assert.equal(scoreBand(89), "strong")
    assert.equal(scoreBand(90), "very_strong")
    assert.equal(scoreBand(100), "very_strong")
  })

  test("labels are phrased as opportunities", () => {
    assert.equal(scoreLabel(10), "Kritisch")
    assert.equal(scoreLabel(50), "Ausbaufähig")
    assert.equal(scoreLabel(65), "Solide, aber optimierbar")
    assert.equal(scoreLabel(80), "Stark")
    assert.equal(scoreLabel(95), "Sehr stark")
    assert.ok(scoreOpportunity(10).includes("Akquise-Chance"))
  })

  test("scoring version is stable and documented", () => {
    assert.ok(SCORING_VERSION.length > 0)
  })
})

describe("evaluateChecks", () => {
  test("produces checks across all categories for healthy data", () => {
    const checks = evaluateChecks(baseData)
    const categories = new Set(checks.map((entry) => entry.category))

    assert.ok(categories.has("technical"))
    assert.ok(categories.has("seo"))
    assert.ok(categories.has("local_seo"))
    assert.ok(categories.has("conversion"))
    assert.ok(categories.has("mobile"))
    assert.ok(categories.has("trust"))
    assert.ok(categories.has("performance"))
  })

  test("marks HTTPS passed and HTTP failed", () => {
    const httpsChecks = evaluateChecks(baseData).filter((entry) => entry.key === "https_active")
    assert.equal(httpsChecks[0].status, "passed")

    const httpChecks = evaluateChecks({ ...baseData, finalUrl: "http://example.com/" }).filter(
      (entry) => entry.key === "https_active",
    )
    assert.equal(httpChecks[0].status, "failed")
  })

  test("flags missing title and meta description", () => {
    const checks = evaluateChecks({ ...baseData, title: undefined, metaDescription: undefined })
    assert.equal(checks.find((entry) => entry.key === "title_present")?.status, "failed")
    assert.equal(checks.find((entry) => entry.key === "meta_description_present")?.status, "failed")
  })

  test("warns on multiple H1 tags", () => {
    const checks = evaluateChecks({ ...baseData, h1Texts: ["One", "Two"] })
    assert.equal(checks.find((entry) => entry.key === "h1_present")?.status, "warning")
  })

  test("marks unknown checks when performance data is missing", () => {
    const checks = evaluateChecks({
      ...baseData,
      mobilePerformanceScore: undefined,
      lcp: undefined,
      cls: undefined,
      fcp: undefined,
    })
    assert.equal(checks.find((entry) => entry.key === "mobile_performance_score")?.status, "unknown")
    assert.equal(checks.find((entry) => entry.key === "lcp_in_range")?.status, "unknown")
    assert.equal(checks.find((entry) => entry.key === "cls_in_range")?.status, "unknown")
    assert.equal(checks.find((entry) => entry.key === "fcp_in_range")?.status, "unknown")
  })

  test("keyword/city checks are not_applicable without city hint", () => {
    const checks = evaluateChecks({ ...baseData, leadCity: undefined, businessCity: undefined })
    assert.equal(checks.find((entry) => entry.key === "keyword_city_in_title")?.status, "not_applicable")
    assert.equal(checks.find((entry) => entry.key === "keyword_city_in_content")?.status, "not_applicable")
  })

  test("image alt coverage reflects missing alt ratio", () => {
    const fullCoverage = evaluateChecks({ ...baseData, imagesMissingAltCount: 0 })
    assert.equal(fullCoverage.find((entry) => entry.key === "image_alt_coverage")?.status, "passed")

    const partialCoverage = evaluateChecks({ ...baseData, imageCount: 10, imagesMissingAltCount: 3 })
    assert.equal(partialCoverage.find((entry) => entry.key === "image_alt_coverage")?.status, "warning")

    const poorCoverage = evaluateChecks({ ...baseData, imageCount: 10, imagesMissingAltCount: 8 })
    assert.equal(poorCoverage.find((entry) => entry.key === "image_alt_coverage")?.status, "failed")
  })

  test("summarizeCategoryScores returns numbers in range for sparse data", () => {
    const checks = evaluateChecks({
      domain: "example.com",
      auditType: "quick",
      finalUrl: "http://example.com/",
    })
    const scores = summarizeCategoryScores(checks)
    for (const value of Object.values(scores)) {
      assert.ok(value >= 0 && value <= 100)
    }
  })

  test("overall score from full data is reproducible", () => {
    const checks1 = evaluateChecks(baseData)
    const checks2 = evaluateChecks(baseData)
    const overall1 = computeOverallScore(summarizeCategoryScores(checks1))
    const overall2 = computeOverallScore(summarizeCategoryScores(checks2))
    assert.equal(overall1, overall2)
    assert.ok(overall1 >= 0 && overall1 <= 100)
  })
})
