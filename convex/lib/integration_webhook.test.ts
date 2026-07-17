import { describe, expect, test } from "vitest"

import {
  buildWebhookBody,
  integrationRetryDelay,
  isRetryableIntegrationResponse,
  normalizeWebhookEndpoint,
  signWebhookBody,
} from "./integration_webhook"

describe("integration webhook safety", () => {
  test("accepts only public-looking HTTPS endpoints and masks the display path", () => {
    expect(normalizeWebhookEndpoint("https://hooks.example.com/private/token")).toMatchObject({
      hostname: "hooks.example.com",
      display: "https://hooks.example.com/private/••••",
    })
    expect(() => normalizeWebhookEndpoint("http://hooks.example.com")).toThrow(/HTTPS/)
    expect(() => normalizeWebhookEndpoint("https://127.0.0.1/hook")).toThrow(/Private/)
  })

  test("emits an allowlisted body without internal identifiers or contact data", () => {
    const body = buildWebhookBody({
      publicEventId: "evt_public",
      event: "audit_completed",
      occurredAt: 0,
      externalAuditId: "aud_public",
      auditStatus: "completed",
      domain: "example.com",
      score: 42,
      apiReportUrl: "https://api.example/api/v1/audits/aud_public/report",
      reportUrl: "https://site.example/r/report",
      reportStatus: "published",
    })
    expect(JSON.parse(body)).toEqual({
      event_id: "evt_public",
      type: "audit_completed",
      version: "1",
      occurred_at: "1970-01-01T00:00:00.000Z",
      data: {
        audit_id: "aud_public",
        status: "completed",
        domain: "example.com",
        score: 42,
        api_report_url: "https://api.example/api/v1/audits/aud_public/report",
        report_url: "https://site.example/r/report",
        report_status: "published",
      },
    })
    expect(body).not.toMatch(/auditId|email|phone|finding|outreach/i)
  })

  test("signs timestamp and exact body", async () => {
    await expect(signWebhookBody("x".repeat(32), 123, "{}"))
      .resolves.toMatch(/^v1=[a-f0-9]{64}$/)
  })

  test("bounds retryable statuses and backoff", () => {
    expect(isRetryableIntegrationResponse(429)).toBe(true)
    expect(isRetryableIntegrationResponse(400)).toBe(false)
    expect(integrationRetryDelay(1)).toBe(60_000)
    expect(integrationRetryDelay(4)).toBeNull()
  })
})
