import { describe, expect, it } from "vitest"

import {
  WEBHOOK_EVENTS,
  canUseIntegrationProvider,
  integrationStatusLabel,
  validateWebhookDraft,
  type WebhookDraft,
} from "./lib/integration-settings"

const validDraft: WebhookDraft = {
  label: "Automation",
  preset: "generic",
  endpointUrl: "https://hooks.example.com/sitepitch",
  secret: "a-secure-write-only-secret-value-123",
  events: ["audit_completed"],
}

describe("integration settings helpers", () => {
  it("gates all providers at Agency", () => {
    expect(canUseIntegrationProvider("pro", "hubspot")).toBe(false)
    expect(canUseIntegrationProvider("pro", "webhook")).toBe(false)
    expect(canUseIntegrationProvider("agency", "hubspot")).toBe(true)
    expect(canUseIntegrationProvider("agency", "webhook")).toBe(true)
    expect(canUseIntegrationProvider("scale", "webhook")).toBe(true)
  })

  it("provides concise German connection labels", () => {
    expect(integrationStatusLabel("connected")).toBe("Verbunden")
    expect(integrationStatusLabel("error")).toBe("Aktion erforderlich")
  })

  it("offers start, completion and failure lifecycle webhooks", () => {
    expect(WEBHOOK_EVENTS).toEqual(expect.arrayContaining([
      "audit_started",
      "audit_completed",
      "audit_failed",
    ]))
  })

  it("accepts a safe webhook draft", () => {
    expect(validateWebhookDraft(validDraft)).toEqual({})
    expect(validateWebhookDraft({ ...validDraft, endpointUrl: "https://fc.example.com/hook" })).toEqual({})
  })

  it.each([
    "http://hooks.example.com/sitepitch",
    "https://user:password@hooks.example.com/sitepitch",
    "https://hooks.example.com:8443/sitepitch",
    "https://localhost/sitepitch",
    "https://127.0.0.1/sitepitch",
    "https://192.168.1.4/sitepitch",
    "https://[::1]/sitepitch",
  ])("rejects unsafe webhook endpoint %s", (endpointUrl) => {
    expect(validateWebhookDraft({ ...validDraft, endpointUrl }).endpointUrl).toBeTruthy()
  })

  it("requires a write-only secret and at least one event", () => {
    const errors = validateWebhookDraft({ ...validDraft, secret: "too-short", events: [] })
    expect(errors.secret).toContain("32")
    expect(errors.events).toBeTruthy()
    expect(validateWebhookDraft({ ...validDraft, secret: "x".repeat(257) }).secret).toContain("256")
  })
})
