import { z } from "zod"

const MAX_CLOCK_SKEW_MS = 5 * 60_000

const scoreRecord = z.record(z.string().max(80), z.number().finite().min(0).max(100))
const gateRecord = z.record(z.string().max(100), z.boolean())

const payloadSchema = z.object({
  payload_version: z.literal("1"),
  run_id: z.string().regex(/^evr_[a-z0-9]{16,80}$/i),
  release: z.object({
    release_version: z.string().min(1).max(120),
    prompt_version: z.string().min(1).max(120),
    output_schema_version: z.string().min(1).max(120),
    suite_version: z.string().min(1).max(120),
    fixture_version: z.string().min(1).max(120),
    eve_version: z.string().min(1).max(80).optional(),
    baseline_release_version: z.string().min(1).max(120),
  }).strict(),
  source: z.object({
    build_sha: z.string().max(64).optional(),
    git_ref: z.string().max(300).optional(),
    event: z.string().max(80),
  }).strict(),
  status: z.enum(["passed", "failed"]),
  started_at: z.number().finite().nonnegative(),
  completed_at: z.number().finite().nonnegative(),
  promote_baseline: z.boolean(),
  gates: gateRecord,
  dimensions: scoreRecord,
  cases: z.array(z.object({
    case_id: z.string().min(1).max(120),
    language: z.enum(["de", "en"]),
    status: z.string().min(1).max(40),
    scores: scoreRecord,
    error_code: z.string().max(120).optional(),
  }).strict()).min(5).max(100),
}).strict()

function constantTimeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length)
  let mismatch = a.length ^ b.length
  for (let index = 0; index < length; index++) {
    mismatch |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0)
  }
  return mismatch === 0
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message))
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function verifyEvalIngestSignature(args: {
  body: string
  timestamp: string | null
  signature: string | null
  secret: string
  now?: number
}): Promise<boolean> {
  if (!args.timestamp || !args.signature || !args.signature.startsWith("v1=")) return false
  const timestamp = Number(args.timestamp)
  if (!Number.isFinite(timestamp) || Math.abs((args.now ?? Date.now()) - timestamp) > MAX_CLOCK_SKEW_MS) return false
  const supplied = args.signature.slice(3).toLowerCase()
  const expected = await hmacSha256Hex(args.secret, `${args.timestamp}.${args.body}`)
  return constantTimeEqual(supplied, expected)
}

function triggerFor(source: { event: string; git_ref?: string }, promoteBaseline: boolean) {
  if (promoteBaseline || source.git_ref === "refs/heads/main") return "main" as const
  if (source.event === "pull_request") return "pull_request" as const
  if (source.event === "schedule") return "nightly" as const
  return "manual" as const
}

export function parseEvalIngestPayload(raw: string) {
  const parsed = payloadSchema.parse(JSON.parse(raw) as unknown)
  return {
    publicRunId: parsed.run_id,
    candidateReleaseVersion: parsed.release.release_version,
    baselineReleaseVersion: parsed.release.baseline_release_version,
    suiteVersion: parsed.release.suite_version,
    fixtureVersion: parsed.release.fixture_version,
    eveVersion: parsed.release.eve_version,
    trigger: triggerFor(parsed.source, parsed.promote_baseline),
    status: parsed.status,
    buildSha: parsed.source.build_sha,
    dimensionScores: parsed.dimensions,
    gates: parsed.gates,
    startedAt: parsed.started_at,
    completedAt: parsed.completed_at,
    cases: parsed.cases.map((item) => ({
      caseId: item.case_id,
      label: item.case_id,
      locale: item.language,
      dimensionScores: item.scores,
      gates: {
        evidence_passed: item.scores.evidence === 100,
        claim_safety_passed: item.scores.claim_safety === 100,
        quality_passed:
          (item.scores.summary ?? 0) >= 75 &&
          (item.scores.findings ?? 0) >= 75 &&
          (item.scores.outreach ?? 0) >= 75,
      },
      regressions: {},
      passed: item.status === "passed" && !item.error_code,
      errorCode: item.error_code,
    })),
  }
}
