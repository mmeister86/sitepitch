import { defineEvalConfig } from "eve/evals"
import type { EvalReporter } from "eve/evals/reporters"

import { SignedConvexReporter } from "./reporters/signed-convex"
import { SuiteGateReporter } from "./reporters/suite-gate"

function reporters(): EvalReporter[] {
  const configured: EvalReporter[] = [SuiteGateReporter()]
  const endpoint = process.env.EVE_EVAL_INGEST_URL?.trim()
  const secret = process.env.EVE_EVAL_REPORTER_SECRET?.trim()

  if (endpoint && secret) {
    configured.push(SignedConvexReporter({ endpoint, secret }))
    return configured
  }
  if (endpoint || secret || process.env.CI === "true") {
    throw new Error("EVE_EVAL_INGEST_URL and EVE_EVAL_REPORTER_SECRET are both required in CI.")
  }
  return configured
}

export default defineEvalConfig({
  judge: { model: "openai/gpt-4.1-mini" },
  maxConcurrency: 2,
  timeoutMs: 120_000,
  reporters: reporters(),
})
