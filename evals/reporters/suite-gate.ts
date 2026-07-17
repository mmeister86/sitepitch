import type { EveEval, EveEvalResult, EveEvalRunSummary, EveEvalTarget } from "eve/evals"
import type { EvalReporter } from "eve/evals/reporters"

import { evaluateSuiteGates } from "./eval-metrics"

export function SuiteGateReporter(): EvalReporter {
  return {
    onRunStart(_evaluations: readonly EveEval[], _target: EveEvalTarget) {},
    onEvalComplete(_result: EveEvalResult) {},
    onRunComplete(summary: EveEvalRunSummary) {
      const evaluation = evaluateSuiteGates(summary)
      if (evaluation.passed) return

      const failedGates = Object.entries(evaluation.gates)
        .filter(([, passed]) => !passed)
        .map(([gate]) => gate)
      throw new Error(`SitePitch eval suite gate failed: ${failedGates.join(", ") || "eval verdict"}`)
    },
  }
}
