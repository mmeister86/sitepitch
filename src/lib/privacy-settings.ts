export const RETENTION_POLICY_VERSION = "2026-07-11"
export const ACCOUNT_DELETE_CONFIRMATION = "ACCOUNT LÖSCHEN"

export type RetentionMode = "standard" | "extended"

export interface SubscriptionForDeletion {
  plan?: string | null
  status?: string | null
  currentPeriodEnd?: number | null
}

export function blocksSelfServiceAccountDeletion(
  subscription: SubscriptionForDeletion | null | undefined,
): boolean {
  if (!subscription?.plan || subscription.plan === "free") return false
  if (["active", "trialing", "past_due"].includes(subscription.status ?? "")) return true
  return (
    subscription.status === "cancelled" &&
    (subscription.currentPeriodEnd ?? 0) > Date.now()
  )
}

export function canConfirmAccountDeletion(input: {
  confirmation: string
  password: string
  blockedBySubscription: boolean
  pending: boolean
}): boolean {
  return (
    !input.blockedBySubscription &&
    !input.pending &&
    input.confirmation === ACCOUNT_DELETE_CONFIRMATION &&
    input.password.length > 0
  )
}

export function formatConsentDate(value: number | null | undefined): string | null {
  if (!value) return null
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
