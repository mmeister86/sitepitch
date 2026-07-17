/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { afterEach, describe, expect, test, vi } from "vitest"

import { api } from "./_generated/api"
import schema from "./schema"

vi.mock("./auth.ts", () => ({
  authComponent: {
    getAuthUser: async (ctx: { auth: { getUserIdentity: () => Promise<{ email?: string; name?: string } | null> } }) => {
      const identity = await ctx.auth.getUserIdentity()
      return identity?.email ? { _id: `auth:${identity.email}`, email: identity.email, name: identity.name } : null
    },
  },
}))

const modules = import.meta.glob([
  "./integrations.ts",
  "./lib/*.ts",
  "./_generated/*.js",
])

function testDb() {
  return convexTest(schema, modules)
}

async function seed(t: ReturnType<typeof testDb>) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const aliceUserId = await ctx.db.insert("users", { tokenIdentifier: "alice", betterAuthUserId: "auth:alice@example.com", email: "alice@example.com", createdAt: now })
    const bobUserId = await ctx.db.insert("users", { tokenIdentifier: "bob", betterAuthUserId: "auth:bob@example.com", email: "bob@example.com", createdAt: now })
    const aliceWorkspaceId = await ctx.db.insert("workspaces", { name: "Alice", ownerUserId: aliceUserId, reportLanguage: "de", createdAt: now, updatedAt: now })
    const bobWorkspaceId = await ctx.db.insert("workspaces", { name: "Bob", ownerUserId: bobUserId, reportLanguage: "de", createdAt: now, updatedAt: now })
    await ctx.db.insert("subscriptions", { workspaceId: aliceWorkspaceId, provider: "lemonsqueezy", plan: "agency", status: "active", createdAt: now, updatedAt: now })
    await ctx.db.insert("subscriptions", { workspaceId: bobWorkspaceId, provider: "lemonsqueezy", plan: "agency", status: "active", createdAt: now, updatedAt: now })
    const integrationId = await ctx.db.insert("workspaceIntegrations", {
      workspaceId: aliceWorkspaceId, provider: "hubspot", status: "connected", connectionGeneration: 1,
      accountLabel: "owner@example.com", configured: true, connectedByUserId: aliceUserId, connectedAt: now, createdAt: now, updatedAt: now,
    })
    await ctx.db.insert("integrationCredentials", {
      workspaceId: aliceWorkspaceId, integrationId, keyVersion: "v1", ciphertext: "not-public", nonce: "not-public", createdAt: now, updatedAt: now,
    })
    const runId = await ctx.db.insert("integrationRuns", {
      workspaceId: aliceWorkspaceId, integrationId, kind: "crm_push", status: "permanent_failed",
      idempotencyKey: "retry-me", publicRunId: "run_public", attemptCount: 4, maxAttempts: 4,
      errorCode: "PROVIDER_HTTP_422", errorMessage: "Sichere Fehlermeldung", createdAt: now, updatedAt: now,
    })
    return { aliceWorkspaceId, integrationId, runId }
  })
}

function asUser(t: ReturnType<typeof testDb>, tokenIdentifier: string, email: string) {
  return t.withIdentity({ tokenIdentifier, email })
}

afterEach(() => vi.unstubAllEnvs())

describe("integration authorization and safe DTOs", () => {
  test("never exposes credential envelopes from the public connection list", async () => {
    const t = testDb()
    await seed(t)
    const result = await asUser(t, "alice", "alice@example.com").query(api.integrations.listConnections, {})
    expect(result.connections[0]).toMatchObject({ provider: "hubspot", accountLabel: "owner@example.com" })
    expect(JSON.stringify(result)).not.toContain("not-public")
    expect(JSON.stringify(result)).not.toContain("ciphertext")
  })

  test("isolates run retry by workspace and rechecks the feature flag", async () => {
    const t = testDb()
    const { runId } = await seed(t)
    vi.stubEnv("INTEGRATIONS_ENABLED", "true")
    await expect(asUser(t, "bob", "bob@example.com").mutation(api.integrations.retryRun, { runId })).rejects.toThrow(/nicht gefunden/i)
    const retried = await asUser(t, "alice", "alice@example.com").mutation(api.integrations.retryRun, { runId })
    expect(retried.status).toBe("queued")
    vi.stubEnv("INTEGRATIONS_ENABLED", "false")
    await expect(asUser(t, "alice", "alice@example.com").mutation(api.integrations.retryRun, { runId })).rejects.toThrow(/nicht aktiviert/i)
  })

  test("lists webhook deliveries with stable event and distinct delivery identifiers", async () => {
    const t = testDb()
    const { aliceWorkspaceId } = await seed(t)
    await t.run(async (ctx) => {
      const now = Date.now()
      const workspace = await ctx.db.get(aliceWorkspaceId)
      const webhookId = await ctx.db.insert("workspaceIntegrations", {
        workspaceId: aliceWorkspaceId,
        provider: "webhook",
        status: "connected",
        connectionGeneration: 1,
        configured: true,
        webhookLabel: "Automation",
        webhookPreset: "generic",
        webhookEndpointUrl: "https://hooks.example.com/••••",
        webhookEvents: ["audit_failed"],
        connectedByUserId: workspace!.ownerUserId,
        connectedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      const eventId = await ctx.db.insert("integrationEvents", {
        workspaceId: aliceWorkspaceId,
        publicEventId: "evt_stable",
        event: "audit_failed",
        idempotencyKey: "event-stable",
        occurredAt: now,
        domain: "example.com",
        createdAt: now,
      })
      await ctx.db.insert("integrationRuns", {
        workspaceId: aliceWorkspaceId,
        integrationId: webhookId,
        kind: "webhook_delivery",
        status: "permanent_failed",
        idempotencyKey: "delivery-terminal",
        publicRunId: "run_delivery_1",
        integrationEventId: eventId,
        attemptCount: 4,
        maxAttempts: 4,
        errorCode: "PROVIDER_HTTP_400",
        errorMessage: "Webhook-Ziel hat die Zustellung abgelehnt.",
        createdAt: now,
        updatedAt: now,
      })
    })

    const result = await asUser(t, "alice", "alice@example.com").query(
      api.integrations.listWebhookDeliveries,
      { paginationOpts: { numItems: 25, cursor: null } },
    )
    expect(result.page).toHaveLength(1)
    expect(result.page[0]).toMatchObject({
      eventId: "evt_stable",
      deliveryId: "run_delivery_1",
      event: "audit_failed",
      status: "permanent_failed",
      canRedeliver: true,
    })
    expect(JSON.stringify(result)).not.toMatch(/payload|secret|ciphertext/i)
  })
})
