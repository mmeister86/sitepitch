import { describe, expect, test } from "vitest"

import { canUseIntegration, integrationsFeatureEnabled } from "./integration_policy"

describe("integration policy", () => {
  test("keeps integrations behind the explicit feature flag", () => {
    expect(integrationsFeatureEnabled(undefined)).toBe(false)
    expect(integrationsFeatureEnabled("true")).toBe(true)
  })

  test("gates all workspace integrations to Agency", () => {
    expect(canUseIntegration("pro", "crm")).toBe(false)
    expect(canUseIntegration("pro", "webhook")).toBe(false)
    expect(canUseIntegration("agency", "crm")).toBe(true)
    expect(canUseIntegration("agency", "webhook")).toBe(true)
    expect(canUseIntegration("scale", "webhook")).toBe(true)
  })
})
