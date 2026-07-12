import { describe, expect, test } from "vitest"

import { auditExamples, getAuditExample } from "../lib/audit-examples"

describe("static audit examples", () => {
  test("provides exactly three read-only, untracked industries", () => {
    expect(auditExamples.map((example) => example.slug)).toEqual(["zahnarzt", "restaurant", "handwerk"])
    expect(auditExamples.every((example) => example.readOnly && example.tracking === "disabled")).toBe(true)
  })

  test("returns no data for an invalid slug", () => {
    expect(getAuditExample("unknown")).toBeNull()
  })
})
