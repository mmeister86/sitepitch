import { describe, expect, it } from "vitest"

import { isCreditPackVariant, parseTimestamp, planForVariant, timingSafeHexEqual } from "./lemonsqueezy"

const variants = { starter: "1", pro: "2", agency: "3", creditPack: "4" }

describe("Lemon Squeezy helpers", () => {
  it("maps only allowlisted subscription variants", () => {
    expect(planForVariant("1", variants)).toBe("starter")
    expect(planForVariant("2", variants)).toBe("pro")
    expect(planForVariant("3", variants)).toBe("agency")
    expect(planForVariant("4", variants)).toBeNull()
    expect(planForVariant("unknown", variants)).toBeNull()
  })

  it("recognizes only the configured credit pack", () => {
    expect(isCreditPackVariant("4", variants)).toBe(true)
    expect(isCreditPackVariant("3", variants)).toBe(false)
    expect(isCreditPackVariant("", {})).toBe(false)
  })

  it("compares hex signatures without accepting malformed input", () => {
    expect(timingSafeHexEqual("aabb", "aabb")).toBe(true)
    expect(timingSafeHexEqual("aabb", "aabc")).toBe(false)
    expect(timingSafeHexEqual("aa", "aaaa")).toBe(false)
    expect(timingSafeHexEqual("not-hex", "not-hex")).toBe(false)
  })

  it("parses provider timestamps defensively", () => {
    expect(parseTimestamp("2026-07-11T10:00:00.000Z")).toBe(1783764000000)
    expect(parseTimestamp("invalid")).toBeUndefined()
    expect(parseTimestamp(null)).toBeUndefined()
  })
})
