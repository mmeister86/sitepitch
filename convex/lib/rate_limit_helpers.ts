import { ConvexError } from "convex/values"

export type SubscriptionPlan = "free" | "starter" | "pro" | "agency" | "scale"

export type ProviderLimitKind =
  | "content" | "screenshot" | "pagespeed" | "businessData" | "llm" | "pdf"

export function isPaidPlan(plan: SubscriptionPlan): boolean {
  return plan === "starter" || plan === "pro" || plan === "agency" || plan === "scale"
}

export function providerToLimitKind(provider: string): ProviderLimitKind {
  if (provider === "screenshotone") return "screenshot"
  if (provider === "pagespeed") return "pagespeed"
  if (provider === "local_business_data" || provider === "google_places") return "businessData"
  if (provider === "openai" || provider === "anthropic" || provider === "other") return "llm"
  return "content"
}

export function throwRateLimited(retryAfter?: number): never {
  throw new ConvexError({
    code: "RATE_LIMITED",
    message: "Zu viele Versuche in kurzer Zeit. Bitte warte kurz und versuche es erneut.",
    retryAfter,
  })
}
