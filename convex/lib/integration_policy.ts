import type { SubscriptionPlan } from "./rate_limit_helpers"

export type IntegrationCapability = "crm" | "gmail" | "google_sheets" | "webhook"

export function integrationsFeatureEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true"
}

export function canUseIntegration(plan: SubscriptionPlan, _capability: IntegrationCapability): boolean {
  return plan === "agency" || plan === "scale"
}

export function capabilityForProvider(
  provider: "hubspot" | "pipedrive" | "gmail" | "google_sheets" | "webhook",
): IntegrationCapability {
  if (provider === "hubspot" || provider === "pipedrive") return "crm"
  return provider
}

export const INTEGRATION_LIMITS = {
  oauthStatesPerHour: 10,
  gmailDraftsPerHour: 10,
  crmPushesPerHour: 30,
  sheetOperationsPerHour: 10,
  webhookTestsPerHour: 10,
  webhookEndpointsPerWorkspace: 5,
  sheetRows: 100,
  sheetBytes: 1_000_000,
} as const
