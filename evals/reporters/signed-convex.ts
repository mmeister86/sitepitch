import { createHmac, randomUUID } from "node:crypto"

import type { EveEval, EveEvalResult, EveEvalRunSummary, EveEvalTarget } from "eve/evals"
import type { EvalReporter } from "eve/evals/reporters"

import baseline from "../baselines/released.json"
import manifest from "../../eve.release.json"
import {
  EVAL_DIMENSIONS,
  evaluateSuiteGates,
  resultDimensionScores,
  type EvalBaseline,
} from "./eval-metrics"

type SignedConvexReporterOptions = {
  endpoint: string
  secret: string
}

function errorCode(result: EveEvalResult): string | undefined {
  if (result.verdict === "skipped") return "eval_skipped"
  if (result.error) return "eval_execution_error"
  if (result.verdict === "failed") return "eval_gate_failed"
  if (result.verdict === "scored") return "eval_threshold_failed"
  return undefined
}

function percent(score: number): number {
  return Math.round(Math.max(0, Math.min(1, score)) * 10_000) / 100
}

function signature(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")
}

function baselineEndpoint(endpoint: string): string {
  return `${endpoint.replace(/\/+$/, "")}/baseline`
}

function parseBaseline(value: unknown): EvalBaseline | null {
  if (typeof value !== "object" || value === null || !("baseline" in value)) return null
  const candidate = value.baseline
  if (typeof candidate !== "object" || candidate === null) return null
  const record = candidate as Record<string, unknown>
  if (typeof record.releaseVersion !== "string" || typeof record.suiteVersion !== "string") return null
  if (typeof record.dimensions !== "object" || record.dimensions === null) return null
  const dimensions = record.dimensions as Record<string, unknown>
  if (!EVAL_DIMENSIONS.every((dimension) => typeof dimensions[dimension] === "number")) return null
  return {
    releaseVersion: record.releaseVersion,
    suiteVersion: record.suiteVersion,
    dimensions: Object.fromEntries(
      EVAL_DIMENSIONS.map((dimension) => [dimension, dimensions[dimension] as number]),
    ) as EvalBaseline["dimensions"],
  }
}

async function fetchReleasedBaseline(options: SignedConvexReporterOptions): Promise<EvalBaseline | null> {
  const timestamp = String(Date.now())
  const response = await fetch(baselineEndpoint(options.endpoint), {
    method: "GET",
    headers: {
      "x-sitepitch-eval-signature": `v1=${signature(options.secret, timestamp, "")}`,
      "x-sitepitch-eval-timestamp": timestamp,
    },
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Eval baseline lookup failed with status ${response.status}.`)
  return parseBaseline(await response.json())
}

export function SignedConvexReporter(options: SignedConvexReporterOptions): EvalReporter {
  const metadataById = new Map<string, Readonly<Record<string, unknown>>>()
  const runId = `evr_${randomUUID().replaceAll("-", "")}`

  return {
    onRunStart(evaluations: readonly EveEval[], _target: EveEvalTarget) {
      for (const evaluation of evaluations) {
        metadataById.set(evaluation.id, evaluation.metadata ?? {})
      }
    },
    onEvalComplete(_result: EveEvalResult) {},
    async onRunComplete(summary: EveEvalRunSummary) {
      const remoteBaseline = await fetchReleasedBaseline(options)
      const comparisonBaseline = remoteBaseline ?? baseline
      const suite = evaluateSuiteGates(summary, comparisonBaseline)
      const payload = {
        payload_version: "1",
        run_id: runId,
        release: {
          release_version: manifest.releaseVersion,
          eve_version: manifest.eveVersion,
          prompt_version: manifest.promptVersion,
          output_schema_version: manifest.outputSchemaVersion,
          suite_version: manifest.suiteVersion,
          fixture_version: manifest.fixtureVersion,
          baseline_release_version: comparisonBaseline.releaseVersion,
        },
        source: {
          build_sha: process.env.GITHUB_SHA?.slice(0, 64) || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 64),
          git_ref: process.env.GITHUB_REF?.slice(0, 300),
          event: process.env.GITHUB_EVENT_NAME?.slice(0, 80) ?? "local",
        },
        status: suite.passed ? "passed" : "failed",
        started_at: new Date(summary.startedAt).getTime(),
        completed_at: new Date(summary.completedAt).getTime(),
        promote_baseline:
          suite.passed &&
          process.env.GITHUB_REF === "refs/heads/main" &&
          process.env.GITHUB_EVENT_NAME !== "pull_request",
        gates: Object.fromEntries(
          Object.entries(suite.gates).map(([key, passed]) => [key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), passed]),
        ),
        dimensions: Object.fromEntries(
          Object.entries(suite.dimensions).map(([key, score]) => [key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), percent(score)]),
        ),
        cases: summary.results.map((result) => {
          const metadata = metadataById.get(result.id)
          const scores = resultDimensionScores(result)
          return {
            case_id: typeof metadata?.caseId === "string" ? metadata.caseId.slice(0, 120) : result.id.slice(0, 120),
            language: metadata?.language === "en" ? "en" : "de",
            status: result.verdict,
            scores: {
              summary: percent(scores.summary),
              findings: percent(scores.findings),
              outreach: percent(scores.outreach),
              evidence: percent(scores.evidence),
              claim_safety: percent(scores.claimSafety),
            },
            error_code: errorCode(result),
          }
        }),
      }
      const body = JSON.stringify(payload)
      const timestamp = String(Date.now())
      const bodySignature = signature(options.secret, timestamp, body)
      const response = await fetch(options.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-sitepitch-eval-run-id": runId,
          "x-sitepitch-eval-signature": `v1=${bodySignature}`,
          "x-sitepitch-eval-timestamp": timestamp,
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok) {
        throw new Error(`Eval ingestion failed with status ${response.status}.`)
      }
      if (!suite.passed) {
        throw new Error("Eval candidate failed the released-baseline gate.")
      }
    },
  }
}
