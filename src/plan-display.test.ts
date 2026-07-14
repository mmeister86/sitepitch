import { describe, expect, it } from "vitest"

import { getPlanLabel } from "./lib/plan-display"

describe("getPlanLabel", () => {
  it.each([
    ["starter", "Starter-Plan"],
    ["pro", "Pro-Plan"],
    ["agency", "Agency-Plan"],
    ["scale", "Scale-Plan"],
  ] as const)("shows the %s subscription", (plan, label) => {
    expect(getPlanLabel(plan)).toBe(label)
  })

  it.each([null, undefined, "free" as const])("keeps the free plan fallback for %s", (plan) => {
    expect(getPlanLabel(plan)).toBe("Free-Plan · MVP")
  })
})
