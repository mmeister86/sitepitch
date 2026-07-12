import assert from "node:assert/strict"

import { describe, test } from "vitest"

import {
  leadStatusOptions,
  formatAuditViewCount,
  matchesAuditFilter,
  matchesAuditSearch,
  outreachStatusMeta,
} from "../lib/audit-inbox"

describe("audit inbox helpers", () => {
  test("keeps the canonical lead status order and German labels", () => {
    assert.deepEqual(leadStatusOptions, [
      { value: "new", label: "Neu" },
      { value: "audited", label: "Auditiert" },
      { value: "contacted", label: "Kontaktiert" },
      { value: "follow_up", label: "Follow-up" },
      { value: "interested", label: "Interessiert" },
      { value: "won", label: "Gewonnen" },
      { value: "lost", label: "Verloren" },
    ])
  })

  test("maps all outreach states to concise German labels", () => {
    assert.equal(outreachStatusMeta.not_started.label, "Nicht begonnen")
    assert.equal(outreachStatusMeta.ready.label, "Bereit")
    assert.equal(outreachStatusMeta.copied.label, "Kopiert")
  })

  test("marks bounded legacy view counts without overstating precision", () => {
    assert.equal(formatAuditViewCount(99, false), "99")
    assert.equal(formatAuditViewCount(100, false), "100")
    assert.equal(formatAuditViewCount(100, true), "100+")
  })

  test("preserves audit status filters and searches lead plus website fields", () => {
    assert.equal(matchesAuditFilter("generating_outreach", "running"), true)
    assert.equal(matchesAuditFilter("cancelled", "failed"), true)
    assert.equal(matchesAuditFilter("completed", "running"), false)
    assert.equal(
      matchesAuditSearch(
        { businessName: "Müller GmbH", domain: "mueller.de", city: "Leipzig", category: "Sanitär" },
        "sanitär leipzig",
      ),
      true,
    )
  })
})
