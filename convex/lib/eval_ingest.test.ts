import assert from "node:assert/strict"
import { createHmac } from "node:crypto"

import { describe, test } from "vitest"

import { parseEvalIngestPayload, verifyEvalIngestSignature } from "./eval_ingest"

function payload() {
  return {
    payload_version: "1",
    run_id: "evr_1234567890abcdef",
    release: {
      release_version: "2026.07.16.1",
      prompt_version: "audit-prompt-v2",
      output_schema_version: "audit-output-v2",
      suite_version: "audit-suite-v1",
      fixture_version: "sanitized-fixtures-v1",
      baseline_release_version: "2026.07.1",
    },
    source: { build_sha: "abc123", git_ref: "refs/pull/7/merge", event: "pull_request" },
    status: "passed",
    started_at: 1_700_000_000_000,
    completed_at: 1_700_000_001_000,
    promote_baseline: false,
    gates: { schema_passed: true, evidence_passed: true, claim_safety_passed: true },
    dimensions: { summary: 84, findings: 85, outreach: 82, evidence: 100, claim_safety: 100 },
    cases: Array.from({ length: 5 }, (_, index) => ({
      case_id: `case-${index + 1}`,
      language: index === 1 ? "en" : "de",
      status: "passed",
      scores: { summary: 84, findings: 85, outreach: 82, evidence: 100, claim_safety: 100 },
    })),
  }
}

describe("signed eval ingestion", () => {
  test("accepts a fresh matching HMAC and rejects stale or changed bodies", async () => {
    const body = JSON.stringify(payload())
    const secret = "test-reporter-secret"
    const now = 1_700_000_100_000
    const timestamp = String(now)
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")
    assert.equal(await verifyEvalIngestSignature({ body, timestamp, signature: `v1=${signature}`, secret, now }), true)
    assert.equal(await verifyEvalIngestSignature({ body: `${body} `, timestamp, signature: `v1=${signature}`, secret, now }), false)
    assert.equal(await verifyEvalIngestSignature({ body, timestamp: String(now - 600_000), signature: `v1=${signature}`, secret, now }), false)
  })

  test("maps only sanitized scores, gates, identifiers and error codes", () => {
    const parsed = parseEvalIngestPayload(JSON.stringify(payload()))
    assert.equal(parsed.trigger, "pull_request")
    assert.equal(parsed.cases.length, 5)
    assert.equal(parsed.cases[0].gates.evidence_passed, true)
    assert.equal(parsed.cases[0].dimensionScores.summary, 84)
    assert.equal("output" in parsed.cases[0], false)
  })

  test("promotes a passed main run to the baseline trigger", () => {
    const value = payload()
    value.promote_baseline = true
    value.source.git_ref = "refs/heads/main"
    value.source.event = "push"
    assert.equal(parseEvalIngestPayload(JSON.stringify(value)).trigger, "main")
  })
})
