import assert from "node:assert/strict"
import { describe, it } from "vitest"

import {
  defaultCampaignLeadFilters,
  filterCampaignLeads,
  hasActiveCampaignLeadFilters,
  sortCampaignLeads,
  type FilterableCampaignLead,
} from "../lib/campaign-lead-filters.js"

const now = Date.UTC(2026, 6, 13, 12)
const day = 24 * 60 * 60 * 1000

type TestLead = FilterableCampaignLead & { id: string }

const leads: TestLead[] = [
  {
    id: "due-low",
    businessName: "Praxis Alpha",
    category: "Zahnarzt",
    city: "Leipzig",
    status: "follow_up",
    auditReady: true,
    followUpAt: now - day,
    lastContactedAt: now - 10 * day,
    updatedAt: now - 4 * day,
    audit: { overallScore: 35, viewCount: 1 },
  },
  {
    id: "recent-high",
    businessName: "Studio Beta",
    category: "Fitness",
    city: "Berlin",
    status: "contacted",
    auditReady: true,
    lastContactedAt: now - 2 * day,
    updatedAt: now - day,
    audit: { overallScore: 78, viewCount: 0 },
  },
  {
    id: "never-medium",
    businessName: "Praxis Gamma",
    category: "Zahnarzt",
    city: "Leipzig",
    status: "new",
    auditReady: false,
    updatedAt: now - 2 * day,
    audit: { overallScore: 62, viewCount: 0 },
  },
  {
    id: "without-audit",
    businessName: "Werkstatt Delta",
    city: "Leipzig",
    status: "new",
    auditReady: true,
    updatedAt: now,
    audit: null,
  },
]

describe("campaign lead filters", () => {
  it.each([
    ["category", { category: "Fitness" }, ["recent-high"]],
    ["city", { city: "Berlin" }, ["recent-high"]],
    ["score", { score: "60-74" }, ["never-medium"]],
    ["status", { status: "contacted" }, ["recent-high"]],
    ["report", { report: "opened" }, ["due-low"]],
    ["last contact", { lastContact: "never" }, ["never-medium", "without-audit"]],
  ] as const)("applies the %s filter", (_label, patch, expected) => {
    const result = filterCampaignLeads(
      leads,
      { ...defaultCampaignLeadFilters, ...patch },
      now,
    )

    assert.deepEqual(result.map((lead) => lead.id), expected)
  })

  it("combines category, city, score, status, report and last-contact filters", () => {
    const result = filterCampaignLeads(
      leads,
      {
        ...defaultCampaignLeadFilters,
        category: "Zahnarzt",
        city: "Leipzig",
        score: "under-40",
        status: "follow_up",
        report: "opened",
        lastContact: "days-8-30",
      },
      now,
    )

    assert.deepEqual(result.map((lead) => lead.id), ["due-low"])
  })

  it("supports missing audit, audit-ready and due quick filters", () => {
    assert.deepEqual(
      filterCampaignLeads(
        leads,
        { ...defaultCampaignLeadFilters, score: "without-audit", auditReadyOnly: true },
        now,
      ).map((lead) => lead.id),
      ["without-audit"],
    )
    assert.deepEqual(
      filterCampaignLeads(
        leads,
        { ...defaultCampaignLeadFilters, followUpDueOnly: true },
        now,
      ).map((lead) => lead.id),
      ["due-low"],
    )
  })

  it("uses due state, low score and recency for the default priority", () => {
    assert.deepEqual(sortCampaignLeads(leads, "priority", now).map((lead) => lead.id), [
      "due-low",
      "never-medium",
      "recent-high",
      "without-audit",
    ])
  })

  it("detects active filters", () => {
    assert.equal(hasActiveCampaignLeadFilters(defaultCampaignLeadFilters), false)
    assert.equal(
      hasActiveCampaignLeadFilters({ ...defaultCampaignLeadFilters, report: "opened" }),
      true,
    )
  })
})
