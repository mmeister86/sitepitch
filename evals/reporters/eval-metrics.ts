import type { AssertionResult, EveEvalResult, EveEvalRunSummary } from "eve/evals"

import baseline from "../baselines/released.json"

export const EVAL_DIMENSIONS = [
  "summary",
  "findings",
  "outreach",
  "evidence",
  "claimSafety",
] as const

export type EvalDimension = (typeof EVAL_DIMENSIONS)[number]

export type EvalBaseline = {
  releaseVersion: string
  suiteVersion: string
  dimensions: Record<EvalDimension, number>
}

const ASSERTION_NAMES: Record<EvalDimension, string> = {
  summary: "judge.autoevals.summarizes",
  findings: "judge.autoevals.factuality",
  outreach: "judge.autoevals.closedQA",
  evidence: "satisfies(evidence_exact)",
  claimSafety: "satisfies(claim_safety)",
}

function assertionScore(assertions: readonly AssertionResult[], name: string): number {
  return assertions.find((assertion) => assertion.name === name)?.score ?? 0
}

export function resultDimensionScores(result: EveEvalResult): Record<EvalDimension, number> {
  return Object.fromEntries(
    EVAL_DIMENSIONS.map((dimension) => [
      dimension,
      assertionScore(result.assertions, ASSERTION_NAMES[dimension]),
    ]),
  ) as Record<EvalDimension, number>
}

export function suiteDimensionScores(summary: EveEvalRunSummary): Record<EvalDimension, number> {
  return Object.fromEntries(
    EVAL_DIMENSIONS.map((dimension) => {
      const scores = summary.results.map((result) => resultDimensionScores(result)[dimension])
      return [dimension, scores.length === 0 ? 0 : scores.reduce((sum, score) => sum + score, 0) / scores.length]
    }),
  ) as Record<EvalDimension, number>
}

export function evaluateSuiteGates(
  summary: EveEvalRunSummary,
  comparisonBaseline: EvalBaseline = baseline,
) {
  const dimensions = suiteDimensionScores(summary)
  const allCaseScores = summary.results.map(resultDimensionScores)
  const schemaPassed = summary.results.every((result) =>
    result.assertions.some((assertion) => assertion.name === "outputMatches" && assertion.score === 1),
  )
  const evidencePassed = allCaseScores.every((scores) => scores.evidence === 1)
  const claimSafetyPassed = allCaseScores.every((scores) => scores.claimSafety === 1)
  const perCaseQualityPassed = allCaseScores.every(
    (scores) => scores.summary >= 0.75 && scores.findings >= 0.75 && scores.outreach >= 0.75,
  )
  const suiteQualityPassed =
    dimensions.summary >= 0.8 && dimensions.findings >= 0.8 && dimensions.outreach >= 0.8
  const baselineRegressionPassed = EVAL_DIMENSIONS.every(
    (dimension) => dimensions[dimension] >= comparisonBaseline.dimensions[dimension] - 0.05,
  )
  const noSkips = summary.skipped === 0
  const caseCountPassed = summary.results.length >= 5

  return {
    passed:
      schemaPassed &&
      evidencePassed &&
      claimSafetyPassed &&
      perCaseQualityPassed &&
      suiteQualityPassed &&
      baselineRegressionPassed &&
      noSkips &&
      caseCountPassed &&
      summary.failed === 0 &&
      summary.scored === 0,
    dimensions,
    gates: {
      schemaPassed,
      evidencePassed,
      claimSafetyPassed,
      perCaseQualityPassed,
      suiteQualityPassed,
      baselineRegressionPassed,
      noSkips,
      caseCountPassed,
    },
  }
}
