import assert from "node:assert/strict"

import { convexTest } from "convex-test"
import { v } from "convex/values"
import { beforeEach, describe, expect, test, vi } from "vitest"

import schema from "./schema.ts"
import { api, internal } from "./_generated/api"
import {
  buildLeadSearchQuery,
  normalizeBusinessEmail,
  normalizeGooglePlacesResults,
  normalizeLeadWebsiteUrl,
  normalizeRapidApiResults,
} from "./lib/lead_search"

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  checkAuditStartLimits: vi.fn(),
  checkLeadSearchLimit: vi.fn(),
  auditWorkpoolEnqueueAction: vi.fn(async (..._args: any[]) => "work-id" as string),
}))

const workspaceState = vi.hoisted(() => ({
  userId: null as any,
  workspaceId: null as any,
}))

vi.stubGlobal("fetch", mocks.fetch)

vi.mock("./auth.ts", () => ({
  authComponent: {
    getAuthUser: async (ctx: any) => {
      const identity = await ctx.auth.getUserIdentity()
      if (!identity) return null
      return { _id: "mock-better-auth-id", email: identity.email ?? "test@example.com", name: identity.name ?? "Test" }
    },
  },
  createAuth: vi.fn(),
  getAuthUser: vi.fn(),
}))

vi.mock("./lib/audit_rate_limit", () => ({
  checkAuditStartLimits: mocks.checkAuditStartLimits,
  checkLeadSearchLimit: mocks.checkLeadSearchLimit,
  checkProviderLimit: vi.fn(),
  auditRateLimiter: { limit: vi.fn() },
  isPaidPlan: vi.fn(),
  providerToLimitKind: vi.fn(),
  throwRateLimited: vi.fn(),
}))

vi.mock("./workpools", () => {
  const poolStub = () => ({ enqueueAction: vi.fn(async () => "work-id") })
  return {
    auditWorkpool: { enqueueAction: mocks.auditWorkpoolEnqueueAction },
    providerWorkpool: poolStub(),
    llmWorkpool: poolStub(),
    pdfWorkpool: poolStub(),
  }
})

vi.mock("./audit_pipeline.ts", async () => {
  const { internalAction } = await import("./_generated/server")
  const { v } = await import("convex/values")

  return {
    processAuditPipeline: internalAction({
      args: {
        auditId: v.id("audits"),
      },
      handler: async () => null,
    }),
  }
})

vi.mock("./workspaces.ts", async () => {
  const { mutation, query } = await import("./_generated/server")
  const {
    ensureWorkspaceCreditBalance,
    getWorkspaceCreditBalance,
    getWorkspaceCreditSnapshot,
  } = await import("./lib/credits")

  return {
    ensureCurrentWorkspace: mutation({
      args: {},
      handler: async (ctx) => {
        if (workspaceState.workspaceId) {
          return {
            workspaceId: workspaceState.workspaceId,
            userId: workspaceState.userId,
            credits: getWorkspaceCreditSnapshot(
              await getWorkspaceCreditBalance(ctx, workspaceState.workspaceId as any),
            ),
          }
        }

        const identity = await ctx.auth.getUserIdentity()
        const tokenIdentifier = identity?.tokenIdentifier ?? "test-token-identifier"
        const email = identity?.email ?? "alice@example.com"
        const name = identity?.name ?? "Alice"
        const now = Date.now()
        const user = await ctx.db.insert("users", {
          tokenIdentifier,
          betterAuthUserId: "test-better-auth-user",
          email,
          name,
          createdAt: now,
        })
        workspaceState.userId = user

        workspaceState.workspaceId = await ctx.db.insert("workspaces", {
          name: "Alice",
          ownerUserId: user,
          accentColor: "#5b5bd6",
          contactEmail: "alice@example.com",
          ctaText: "Kostenloses Erstgespräch buchen",
          reportLanguage: "de",
          createdAt: now,
          updatedAt: now,
        })

        await ctx.db.insert("workspaceMembers", {
          workspaceId: workspaceState.workspaceId,
          userId: user,
          role: "owner",
          createdAt: now,
        })

        await ensureWorkspaceCreditBalance(ctx, workspaceState.workspaceId as any, user as any)

        const balance = await getWorkspaceCreditBalance(ctx, workspaceState.workspaceId as any)

        return {
          workspaceId: workspaceState.workspaceId,
          userId: user,
          credits: getWorkspaceCreditSnapshot(balance),
        }
      },
    }),
    getMyWorkspace: query({
      args: {},
      handler: async (ctx) => {
        const workspace: any = workspaceState.workspaceId
          ? await ctx.db.get(workspaceState.workspaceId as any)
          : null
        if (!workspace || !workspaceState.userId) return null
        const balance = await getWorkspaceCreditBalance(ctx, workspace._id as any)
        return {
          userId: workspaceState.userId,
          workspaceId: workspace._id,
          user: { email: "alice@example.com", name: "Alice" },
          workspace: {
            _id: workspace._id,
            name: workspace.name,
            logoStorageId: null,
            logoUrl: null,
            accentColor: workspace.accentColor ?? "#5b5bd6",
            website: "",
            contactEmail: workspace.contactEmail ?? "",
            ctaText: workspace.ctaText ?? "",
            ctaUrl: "",
            reportLanguage: workspace.reportLanguage,
            updatedAt: workspace.updatedAt,
          },
          credits: getWorkspaceCreditSnapshot(balance),
        }
      },
    }),
    getWorkspaceAuditContext: query({
      args: { workspaceId: v.id("workspaces") },
      handler: async (ctx, args) => {
        const workspace: any = await ctx.db.get(args.workspaceId as any)
        if (!workspace) return null
        const balance = await getWorkspaceCreditBalance(ctx, workspace._id as any)
        return {
          workspaceId: workspace._id,
          userId: workspace.ownerUserId,
          credits: getWorkspaceCreditSnapshot(balance),
        }
      },
    }),
  }
})

const modules = import.meta.glob([
  "./auth.ts",
  "./audits.ts",
  "./leads.ts",
  "./audit_pipeline.ts",
  "./audit_scoring.ts",
  "./audit_state.ts",
  "./http.ts",
  "./workspaces.ts",
  "./lib/*.ts",
  "./_generated/*.js",
])

function createTest() {
  return convexTest(schema, modules)
}

beforeEach(() => {
  mocks.fetch.mockReset()
  mocks.checkAuditStartLimits.mockReset()
  mocks.checkLeadSearchLimit.mockReset()
  mocks.auditWorkpoolEnqueueAction.mockReset()
  mocks.auditWorkpoolEnqueueAction.mockResolvedValue("work-id")
  workspaceState.userId = null
  workspaceState.workspaceId = null
})

describe("lead search pure helpers", () => {
  test("buildLeadSearchQuery joins industry, city, country, keyword", () => {
    assert.equal(
      buildLeadSearchQuery({ industry: "Zahnarzt", city: "Leipzig", country: "Deutschland" }),
      "Zahnarzt Leipzig Deutschland",
    )
    assert.equal(
      buildLeadSearchQuery({
        industry: "Zahnarzt",
        city: "Leipzig",
        country: "Deutschland",
        keyword: "Notfall",
      }),
      "Zahnarzt Leipzig Deutschland Notfall",
    )
  })

  test("normalizeLeadWebsiteUrl adds https:// and strips hash/port", () => {
    assert.equal(normalizeLeadWebsiteUrl("zahnarzt-mueller.de"), "https://zahnarzt-mueller.de/")
    assert.equal(normalizeLeadWebsiteUrl("https://example.com:443/path#section"), "https://example.com/path")
    assert.equal(normalizeLeadWebsiteUrl("http://example.com:80/"), "http://example.com/")
  })

  test("normalizeLeadWebsiteUrl returns undefined for invalid or private URLs", () => {
    assert.equal(normalizeLeadWebsiteUrl(""), undefined)
    assert.equal(normalizeLeadWebsiteUrl("javascript:alert(1)"), undefined)
    assert.equal(normalizeLeadWebsiteUrl("not a url"), undefined)
  })

  test("normalizeRapidApiResults maps candidates including email, lat, lng", () => {
    const payload = {
      data: [
        {
          id: "abc123",
          name: "Zahnarzt Mueller",
          address: "Hauptstr. 1, 04109 Leipzig",
          city: "Leipzig",
          country: "Deutschland",
          website: "zahnarzt-mueller.de",
          phone: "+49 341 123456",
          categories: ["dentist"],
          email: "praxis@zahnarzt-mueller.de",
          latitude: 51.3397,
          longitude: 12.3731,
        },
        {
          id: "def456",
          name: "Apotheke am Markt",
          address: "Markt 5, 04109 Leipzig",
          city: "Leipzig",
          types: ["pharmacy"],
        },
      ],
    }

    const results = normalizeRapidApiResults(payload, 10)
    assert.equal(results.length, 2)
    assert.equal(results[0].businessName, "Zahnarzt Mueller")
    assert.equal(results[0].sourceProvider, "rapidapi")
    assert.equal(results[0].sourceId, "abc123")
    assert.equal(results[0].auditReady, true)
    assert.equal(results[0].normalizedWebsiteUrl, "https://zahnarzt-mueller.de/")
    assert.equal(results[0].businessEmail, "praxis@zahnarzt-mueller.de")
    assert.equal((results[0] as any).email, undefined)
    assert.equal(results[0].latitude, 51.3397)
    assert.equal(results[0].longitude, 12.3731)

    assert.equal(results[1].businessName, "Apotheke am Markt")
    assert.equal(results[1].auditReady, false)
  })

  test("normalizeGooglePlacesResults maps candidates with coordinates", () => {
    const payload = {
      status: "OK",
      results: [
        {
          place_id: "ChIJ1234",
          name: "Zahnarzt Leipzig",
          formatted_address: "Hauptstr. 1, Leipzig",
          website: "https://zahnarzt-leipzig.de",
          international_phone_number: "+49 341 999999",
          types: ["dentist", "health"],
          geometry: { location: { lat: 51.3397, lng: 12.3731 } },
        },
      ],
    }

    const results = normalizeGooglePlacesResults(payload, 10)
    assert.equal(results.length, 1)
    assert.equal(results[0].businessName, "Zahnarzt Leipzig")
    assert.equal(results[0].sourceProvider, "google_places")
    assert.equal(results[0].sourceId, "ChIJ1234")
    assert.equal(results[0].auditReady, true)
    assert.equal(results[0].normalizedWebsiteUrl, "https://zahnarzt-leipzig.de/")
    assert.equal(results[0].latitude, 51.3397)
    assert.equal(results[0].longitude, 12.3731)
  })

  test("normalizeBusinessEmail validates and lowercases emails", () => {
    assert.equal(normalizeBusinessEmail("  INFO@Firma.DE  "), "info@firma.de")
    assert.equal(normalizeBusinessEmail("not-an-email"), undefined)
    assert.equal(normalizeBusinessEmail(""), undefined)
    assert.equal(normalizeBusinessEmail(undefined), undefined)
  })

  test("normalizeRapidApiResults extracts alternative phone and email fields", () => {
    const payload = {
      data: [
        {
          id: "alt-1",
          name: "Zahnarzt Alt",
          phone_number: "+49 341 999",
          business_email: "kontakt@zahnarzt-alt.de",
        },
        {
          id: "alt-2",
          name: "Apotheke Alt",
          phone_numbers: ["+49 341 111", "+49 341 222"],
          emails: ["info@apo-alt.de"],
        },
      ],
    }

    const results = normalizeRapidApiResults(payload, 10)
    assert.equal(results[0].phone, "+49 341 999")
    assert.equal(results[0].businessEmail, "kontakt@zahnarzt-alt.de")
    assert.equal(results[1].phone, "+49 341 111")
    assert.equal(results[1].businessEmail, "info@apo-alt.de")
  })

  test("normalizeRapidApiResults extracts Local Business Data contact email fields", () => {
    const payload = {
      data: {
        businesses: [
          {
            business_id: "nested-1",
            name: "Zahnarzt Nested",
            emails_and_contacts: {
              emails: [" INFO@Zahnarzt-Nested.de ", "info@zahnarzt-nested.de"],
            },
          },
          {
            business_id: "nested-2",
            name: "Apotheke Contact",
            contact_emails: ["not-an-email", "OFFICE@Apo-Contact.de"],
          },
          {
            business_id: "nested-3",
            name: "Praxis Contacts",
            contacts: [{ email: "Team@Praxis-Contacts.de" }, { value: "service@praxis-contacts.de" }],
          },
        ],
      },
    }

    const results = normalizeRapidApiResults(payload, 10)
    assert.equal(results.length, 3)
    assert.equal(results[0].sourceId, "nested-1")
    assert.equal(results[0].businessEmail, "info@zahnarzt-nested.de")
    assert.equal(results[1].businessEmail, "office@apo-contact.de")
    assert.equal(results[2].businessEmail, "team@praxis-contacts.de")
  })

  test("normalizeRapidApiResults extracts alternative coordinate formats", () => {
    const payload = {
      data: [
        {
          id: "coord-1",
          name: "GPS Place",
          gps_coordinates: { latitude: 51.1, longitude: 12.2 },
        },
        {
          id: "coord-2",
          name: "Coord Place",
          coordinates: { lat: 52.2, lng: 13.3 },
        },
        {
          id: "coord-3",
          name: "String Place",
          lat: "53.3",
          lng: "14.4",
        },
      ],
    }

    const results = normalizeRapidApiResults(payload, 10)
    assert.equal(results[0].latitude, 51.1)
    assert.equal(results[0].longitude, 12.2)
    assert.equal(results[1].latitude, 52.2)
    assert.equal(results[1].longitude, 13.3)
    assert.equal(results[2].latitude, 53.3)
    assert.equal(results[2].longitude, 14.4)
  })
})

describe("lead mutations", () => {
  test("saveLeadFromSearch saves a lead without website as not audit-ready", async () => {
    const t = createTest().withIdentity({ email: "alice@example.com", name: "Alice" })

    await t.mutation(api.workspaces.ensureCurrentWorkspace, {})

    const leadId = await t.mutation(api.leads.saveLeadFromSearch, {
      businessName: "Café am Eck",
      category: "cafe",
      city: "Leipzig",
      country: "Deutschland",
      address: "Eckstr. 1",
      phone: "+49 341 111",
      sourceProvider: "google_places",
      sourceId: "place-cafe-1",
      sourceLabel: "Google Places",
    })

    const list = await t.query(api.leads.listMyLeads, {})
    assert.ok(list)
    assert.equal(list.items.length, 1)
    assert.equal(list.items[0].businessName, "Café am Eck")
    assert.equal(list.items[0].auditReady, false)
    assert.equal(list.items[0].sourceProvider, "google_places")
    assert.equal(list.items[0].sourceId, "place-cafe-1")
  })

  test("saveLeadFromSearch saves a lead with website as audit-ready", async () => {
    const t = createTest().withIdentity({ email: "bob@example.com", name: "Bob" })

    await t.mutation(api.workspaces.ensureCurrentWorkspace, {})

    const leadId = await t.mutation(api.leads.saveLeadFromSearch, {
      businessName: "Zahnarzt Mueller",
      websiteUrl: "zahnarzt-mueller.de",
      category: "dentist",
      city: "Leipzig",
      country: "Deutschland",
      sourceProvider: "rapidapi",
      sourceId: "rapid-1",
      sourceLabel: "Local Business Data",
    })

    const list = await t.query(api.leads.listMyLeads, {})
    assert.ok(list)
    assert.equal(list.items[0].auditReady, true)
    assert.equal(list.items[0].normalizedWebsiteUrl, "https://zahnarzt-mueller.de/")
  })

  test("saveLeadFromSearch deduplicates by workspace + provider + sourceId", async () => {
    const t = createTest().withIdentity({ email: "carla@example.com", name: "Carla" })

    await t.mutation(api.workspaces.ensureCurrentWorkspace, {})

    const firstId = await t.mutation(api.leads.saveLeadFromSearch, {
      businessName: "Apotheke am Markt",
      category: "pharmacy",
      city: "Leipzig",
      country: "Deutschland",
      sourceProvider: "rapidapi",
      sourceId: "rapid-dedupe-1",
      sourceLabel: "Local Business Data",
    })

    const secondId = await t.mutation(api.leads.saveLeadFromSearch, {
      businessName: "Apotheke am Markt (aktualisiert)",
      category: "pharmacy",
      city: "Leipzig",
      country: "Deutschland",
      websiteUrl: "apotheke-am-markt.de",
      sourceProvider: "rapidapi",
      sourceId: "rapid-dedupe-1",
      sourceLabel: "Local Business Data",
    })

    assert.equal(secondId, firstId)

    const list = await t.query(api.leads.listMyLeads, {})
    assert.ok(list)
    assert.equal(list.items.length, 1)
    assert.equal(list.items[0].businessName, "Apotheke am Markt (aktualisiert)")
    assert.equal(list.items[0].auditReady, true)
  })

  test("saveLeadFromSearch stores email, lat, lng and listMyLeads returns them", async () => {
    const t = createTest().withIdentity({ email: "heinz@example.com", name: "Heinz" })

    await t.mutation(api.workspaces.ensureCurrentWorkspace, {})

    await t.mutation(api.leads.saveLeadFromSearch, {
      businessName: "Zahnarzt Leipzig",
      websiteUrl: "zahnarzt-leipzig.de",
      city: "Leipzig",
      country: "Deutschland",
      phone: "+49 341 123456",
      businessEmail: "praxis@zahnarzt-leipzig.de",
      latitude: 51.3397,
      longitude: 12.3731,
      sourceProvider: "rapidapi",
      sourceId: "rapid-full-1",
      sourceLabel: "Local Business Data",
    })

    const list = await t.query(api.leads.listMyLeads, {})
    assert.ok(list)
    assert.equal(list.items.length, 1)
    assert.equal(list.items[0].businessEmail, "praxis@zahnarzt-leipzig.de")
    assert.equal(list.items[0].latitude, 51.3397)
    assert.equal(list.items[0].longitude, 12.3731)
  })

  test("updateLeadWebsite adds a website and makes lead audit-ready", async () => {
    const t = createTest().withIdentity({ email: "dina@example.com", name: "Dina" })

    await t.mutation(api.workspaces.ensureCurrentWorkspace, {})

    const leadId = await t.mutation(api.leads.saveLeadFromSearch, {
      businessName: "Bäckerei Schmidt",
      city: "Leipzig",
      country: "Deutschland",
      sourceProvider: "manual",
      sourceLabel: "Manuell",
    })

    await t.mutation(api.leads.updateLeadWebsite, {
      leadId: leadId as any,
      websiteUrl: "baeckerei-schmidt.de",
    })

    const list = await t.query(api.leads.listMyLeads, {})
    assert.ok(list)
    assert.equal(list.items[0].auditReady, true)
    assert.equal(list.items[0].normalizedWebsiteUrl, "https://baeckerei-schmidt.de/")
  })

  test("updateLeadWebsite rejects invalid URLs", async () => {
    const t = createTest().withIdentity({ email: "eva@example.com", name: "Eva" })

    await t.mutation(api.workspaces.ensureCurrentWorkspace, {})

    const leadId = await t.mutation(api.leads.saveLeadFromSearch, {
      businessName: "Test Lead",
      city: "Leipzig",
      country: "Deutschland",
      sourceProvider: "manual",
      sourceLabel: "Manuell",
    })

    await expect(
      t.mutation(api.leads.updateLeadWebsite, {
        leadId: leadId as any,
        websiteUrl: "javascript:alert(1)",
      }),
    ).rejects.toMatchObject({ data: { code: "VALIDATION_ERROR" } })
  })
})

describe("startAuditFromLead", () => {
  test("rejects a lead without website with LEAD_WEBSITE_REQUIRED", async () => {
    mocks.checkAuditStartLimits.mockResolvedValue(undefined)
    mocks.checkLeadSearchLimit.mockResolvedValue(undefined)

    const t = createTest().withIdentity({ email: "frank@example.com", name: "Frank" })

    await t.mutation(api.workspaces.ensureCurrentWorkspace, {})

    const leadId = await t.mutation(api.leads.saveLeadFromSearch, {
      businessName: "Lead ohne Website",
      city: "Leipzig",
      country: "Deutschland",
      sourceProvider: "manual",
      sourceLabel: "Manuell",
    })

    await expect(
      t.action(api.leads.startAuditFromLead, {
        leadId: leadId as any,
        auditType: "local",
        reportLanguage: "de",
        idempotencyKey: "lead-audit-no-website",
      }),
    ).rejects.toMatchObject({ data: { code: "LEAD_WEBSITE_REQUIRED" } })
  })

  test("creates an audit linked to the lead when website is present", async () => {
    mocks.checkAuditStartLimits.mockResolvedValue(undefined)
    mocks.checkLeadSearchLimit.mockResolvedValue(undefined)
    mocks.fetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const type = url.searchParams.get("type")
      if (type === "A") return { ok: true, json: async () => ({ Status: 0, Answer: [{ data: "93.184.216.34" }] }) }
      if (type === "AAAA") return { ok: true, json: async () => ({ Status: 0, Answer: [] }) }
      return { ok: true, json: async () => ({ Status: 0, Answer: [] }) }
    })

    const t = createTest().withIdentity({ email: "gina@example.com", name: "Gina" })

    await t.mutation(api.workspaces.ensureCurrentWorkspace, {})

    const leadId = await t.mutation(api.leads.saveLeadFromSearch, {
      businessName: "Zahnarzt mit Website",
      websiteUrl: "zahnarzt-mit-website.de",
      city: "Leipzig",
      country: "Deutschland",
      sourceProvider: "rapidapi",
      sourceId: "rapid-website-1",
      sourceLabel: "Local Business Data",
    })

    const result = await t.action(api.leads.startAuditFromLead, {
      leadId: leadId as any,
      auditType: "local",
      reportLanguage: "de",
      idempotencyKey: "lead-audit-with-website",
    })

    assert.equal(result.status, "queued")

    const lead = await t.query((ctx) =>
      ctx.db.get(leadId as any),
    ) as any
    assert.ok(lead)
    assert.equal(lead.status, "audited")
    assert.equal(lead.auditId, result.auditId)

    const audit = await t.query(api.audits.getById, { auditId: result.auditId })
    assert.ok(audit)
    assert.equal(audit.leadId, leadId)
  })
})

describe("deleteLead", () => {
  test("removes a saved lead and it disappears from listMyLeads", async () => {
    const t = createTest().withIdentity({ email: "hans@example.com", name: "Hans" })

    await t.mutation(api.workspaces.ensureCurrentWorkspace, {})

    const leadId = await t.mutation(api.leads.saveLeadFromSearch, {
      businessName: "Bäckerei Hans",
      city: "Leipzig",
      country: "Deutschland",
      sourceProvider: "manual",
      sourceLabel: "Manuell",
    })

    const before = await t.query(api.leads.listMyLeads, {})
    assert.ok(before)
    assert.equal(before.items.length, 1)

    await t.mutation(api.leads.deleteLead, { leadId: leadId as any })

    const after = await t.query(api.leads.listMyLeads, {})
    assert.ok(after)
    assert.equal(after.items.length, 0)
  })

  test("rejects an already deleted lead with NOT_FOUND", async () => {
    const t = createTest().withIdentity({ email: "ida@example.com", name: "Ida" })

    await t.mutation(api.workspaces.ensureCurrentWorkspace, {})

    const leadId = await t.mutation(api.leads.saveLeadFromSearch, {
      businessName: "Bäckerei Ida",
      city: "Leipzig",
      country: "Deutschland",
      sourceProvider: "manual",
      sourceLabel: "Manuell",
    })

    await t.mutation(api.leads.deleteLead, { leadId: leadId as any })

    await expect(
      t.mutation(api.leads.deleteLead, { leadId: leadId as any }),
    ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } })
  })

  test("unlinks a connected audit but preserves the audit document", async () => {
    mocks.checkAuditStartLimits.mockResolvedValue(undefined)
    mocks.checkLeadSearchLimit.mockResolvedValue(undefined)
    mocks.fetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const type = url.searchParams.get("type")
      if (type === "A") return { ok: true, json: async () => ({ Status: 0, Answer: [{ data: "93.184.216.34" }] }) }
      if (type === "AAAA") return { ok: true, json: async () => ({ Status: 0, Answer: [] }) }
      return { ok: true, json: async () => ({ Status: 0, Answer: [] }) }
    })

    const t = createTest().withIdentity({ email: "karin@example.com", name: "Karin" })

    await t.mutation(api.workspaces.ensureCurrentWorkspace, {})

    const leadId = await t.mutation(api.leads.saveLeadFromSearch, {
      businessName: "Zahnarzt Karin",
      websiteUrl: "zahnarzt-karin.de",
      city: "Leipzig",
      country: "Deutschland",
      sourceProvider: "rapidapi",
      sourceId: "rapid-delete-1",
      sourceLabel: "Local Business Data",
    })

    const result = await t.action(api.leads.startAuditFromLead, {
      leadId: leadId as any,
      auditType: "local",
      reportLanguage: "de",
      idempotencyKey: "lead-delete-audit",
    })

    await t.mutation(api.leads.deleteLead, { leadId: leadId as any })

    const list = await t.query(api.leads.listMyLeads, {})
    assert.ok(list)
    assert.equal(list.items.length, 0)

    const audit = await t.query(api.audits.getById, { auditId: result.auditId })
    assert.ok(audit)
    assert.equal(audit.leadId, undefined)
  })
})

describe("updateLeadProfile", () => {
  test("updates editable profile fields", async () => {
    const t = createTest().withIdentity({ email: "peter@example.com", name: "Peter" })

    await t.mutation(api.workspaces.ensureCurrentWorkspace, {})

    const leadId = await t.mutation(api.leads.saveLeadFromSearch, {
      businessName: "Bäckerei Peter",
      city: "Leipzig",
      country: "Deutschland",
      sourceProvider: "manual",
      sourceLabel: "Manuell",
    })

    await t.mutation(api.leads.updateLeadProfile, {
      leadId: leadId as any,
      businessName: "Bäckerei Peter GmbH",
      category: "Bäckerei",
      city: "Dresden",
      country: "Deutschland",
      address: "Katharinenstraße 1",
      phone: "+49 351 123456",
      businessEmail: "peter@example.com",
    })

    const list = await t.query(api.leads.listMyLeads, {})
    assert.ok(list)
    const lead = list.items[0]
    assert.equal(lead.businessName, "Bäckerei Peter GmbH")
    assert.equal(lead.category, "Bäckerei")
    assert.equal(lead.city, "Dresden")
    assert.equal(lead.country, "Deutschland")
    assert.equal(lead.address, "Katharinenstraße 1")
    assert.equal(lead.phone, "+49 351 123456")
    assert.equal(lead.businessEmail, "peter@example.com")
  })

  test("rejects empty business name", async () => {
    const t = createTest().withIdentity({ email: "peter@example.com", name: "Peter" })

    await t.mutation(api.workspaces.ensureCurrentWorkspace, {})

    const leadId = await t.mutation(api.leads.saveLeadFromSearch, {
      businessName: "Bäckerei Peter",
      city: "Leipzig",
      country: "Deutschland",
      sourceProvider: "manual",
      sourceLabel: "Manuell",
    })

    await expect(
      t.mutation(api.leads.updateLeadProfile, {
        leadId: leadId as any,
        businessName: "",
      }),
    ).rejects.toMatchObject({ data: { code: "VALIDATION_ERROR" } })
  })
})
