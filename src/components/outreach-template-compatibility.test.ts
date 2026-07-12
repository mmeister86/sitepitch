import { describe, expect, test } from "vitest"

import { filterCompatibleTemplates } from "../lib/outreach-template-compatibility"

describe("outreach template compatibility", () => {
  test("matches both draft type and report language", () => {
    const templates = [
      { _id: "de-email", type: "email", language: "de" },
      { _id: "en-email", type: "email", language: "en" },
      { _id: "de-follow-up", type: "follow_up", language: "de" },
    ] as const

    expect(filterCompatibleTemplates(templates, "email", "de").map((template) => template._id))
      .toEqual(["de-email"])
    expect(filterCompatibleTemplates(templates, "email", "en").map((template) => template._id))
      .toEqual(["en-email"])
  })
})
