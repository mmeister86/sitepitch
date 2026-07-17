import { createHmac } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

type Baseline = {
  releaseVersion: string
  suiteVersion: string
  dimensions: {
    summary: number
    findings: number
    outreach: number
    evidence: number
    claimSafety: number
  }
}

const endpoint = process.env.EVE_EVAL_INGEST_URL?.trim()
const secret = process.env.EVE_EVAL_REPORTER_SECRET?.trim()
if (!endpoint || !secret) {
  if (process.env.CI === "true") throw new Error("Eval baseline sync requires signed ingestion credentials in CI.")
  process.exit(0)
}

const timestamp = String(Date.now())
const signature = createHmac("sha256", secret).update(`${timestamp}.`).digest("hex")
const response = await fetch(`${endpoint.replace(/\/$/, "")}/baseline`, {
  headers: {
    "x-sitepitch-eval-timestamp": timestamp,
    "x-sitepitch-eval-signature": `v1=${signature}`,
  },
  redirect: "error",
  signal: AbortSignal.timeout(15_000),
})
if (!response.ok) throw new Error(`Eval baseline sync failed with status ${response.status}.`)
const decoded = await response.json() as { baseline?: Baseline | null }
if (!decoded.baseline) process.exit(0)

for (const value of Object.values(decoded.baseline.dimensions)) {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error("Eval baseline response is invalid.")
}
const target = path.join(process.cwd(), "evals/baselines/released.json")
await readFile(target, "utf8")
await writeFile(target, `${JSON.stringify(decoded.baseline, null, 2)}\n`, "utf8")
