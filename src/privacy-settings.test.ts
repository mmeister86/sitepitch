import { describe, expect, it } from "vitest"

import {
  ACCOUNT_DELETE_CONFIRMATION,
  blocksSelfServiceAccountDeletion,
  canConfirmAccountDeletion,
} from "./lib/privacy-settings"

describe("blocksSelfServiceAccountDeletion", () => {
  it.each(["active", "trialing", "past_due"])(
    "blocks a paid %s subscription",
    (status) => {
      expect(blocksSelfServiceAccountDeletion({ plan: "pro", status })).toBe(true)
    },
  )

  it.each([null, { plan: "free", status: "active" }, { plan: "pro", status: "expired" }])(
    "allows deletion without an active paid subscription",
    (subscription) => {
      expect(blocksSelfServiceAccountDeletion(subscription)).toBe(false)
    },
  )

  it("blocks a cancelled paid subscription until its entitlement period ends", () => {
    expect(
      blocksSelfServiceAccountDeletion({
        plan: "pro",
        status: "cancelled",
        currentPeriodEnd: Date.now() + 60_000,
      }),
    ).toBe(true)
    expect(
      blocksSelfServiceAccountDeletion({
        plan: "pro",
        status: "cancelled",
        currentPeriodEnd: Date.now() - 1,
      }),
    ).toBe(false)
  })
})

describe("canConfirmAccountDeletion", () => {
  it("requires the exact phrase, a password, and an unblocked idle state", () => {
    expect(
      canConfirmAccountDeletion({
        confirmation: ACCOUNT_DELETE_CONFIRMATION,
        password: "secret",
        blockedBySubscription: false,
        pending: false,
      }),
    ).toBe(true)

    expect(
      canConfirmAccountDeletion({
        confirmation: "Account löschen",
        password: "secret",
        blockedBySubscription: false,
        pending: false,
      }),
    ).toBe(false)
    expect(
      canConfirmAccountDeletion({
        confirmation: ACCOUNT_DELETE_CONFIRMATION,
        password: "",
        blockedBySubscription: false,
        pending: false,
      }),
    ).toBe(false)
    expect(
      canConfirmAccountDeletion({
        confirmation: ACCOUNT_DELETE_CONFIRMATION,
        password: "secret",
        blockedBySubscription: true,
        pending: false,
      }),
    ).toBe(false)
  })
})
