import { describe, expect, it } from "vitest"

import { normalizeReportReferrer } from "./report_privacy"

describe("normalizeReportReferrer", () => {
  it("retains only the normalized host", () => {
    expect(normalizeReportReferrer("https://Google.COM/search?q=private#token"))
      .toBe("google.com")
  })

  it("rejects credentials and non-web schemes", () => {
    expect(normalizeReportReferrer("https://user:secret@example.com/path")).toBeUndefined()
    expect(normalizeReportReferrer("javascript:alert(1)")).toBeUndefined()
  })
})
