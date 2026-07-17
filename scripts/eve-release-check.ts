import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"

type ReleaseManifest = {
  releaseVersion: string
  promptVersion: string
  outputSchemaVersion: string
  artifacts: {
    promptSha256: string
    skillsSha256: string
    outputSchemaSha256: string
  }
}

const root = process.cwd()

async function filesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name)
      return entry.isDirectory() ? filesBelow(fullPath) : [fullPath]
    }),
  )
  return files.flat().sort()
}

async function hashFiles(files: readonly string[]): Promise<string> {
  const hash = createHash("sha256")
  for (const file of files) {
    hash.update(path.relative(root, file))
    hash.update("\0")
    hash.update(await readFile(file))
    hash.update("\0")
  }
  return hash.digest("hex")
}

function readBaseManifest(baseRef: string | undefined): ReleaseManifest | null {
  if (!baseRef) return null
  try {
    return JSON.parse(
      execFileSync("git", ["show", `${baseRef}:eve.release.json`], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    ) as ReleaseManifest
  } catch {
    return null
  }
}

const manifest = JSON.parse(await readFile(path.join(root, "eve.release.json"), "utf8")) as ReleaseManifest
const actual = {
  promptSha256: await hashFiles([
    path.join(root, "agent/instructions.md"),
    path.join(root, "convex/lib/audit_agent_prompt.ts"),
    path.join(root, "convex/lib/audit_copy_review_prompt.ts"),
    path.join(root, "convex/lib/audit_design_critique_prompt.ts"),
    path.join(root, "convex/lib/audit_persona_prompt.ts"),
  ]),
  skillsSha256: await hashFiles(await filesBelow(path.join(root, "agent/skills"))),
  outputSchemaSha256: await hashFiles([
    path.join(root, "src/lib/eve/audit-contract.ts"),
    path.join(root, "convex/lib/audit_agent_schemas.ts"),
    path.join(root, "convex/lib/audit_copy_review_schemas.ts"),
    path.join(root, "convex/lib/audit_design_critique_schemas.ts"),
    path.join(root, "convex/lib/audit_persona_schemas.ts"),
  ]),
}

const mismatches = Object.entries(actual).filter(
  ([key, value]) => manifest.artifacts[key as keyof typeof actual] !== value,
)
if (mismatches.length > 0) {
  throw new Error(
    `Eve release artifact hashes are stale: ${mismatches.map(([key]) => key).join(", ")}. Update eve.release.json and bump the matching version.`,
  )
}

const base = readBaseManifest(process.env.EVE_BASE_REF?.trim())
if (base) {
  if (base.artifacts.promptSha256 !== actual.promptSha256 && base.promptVersion === manifest.promptVersion) {
    throw new Error("Eve prompt changed without a promptVersion bump.")
  }
  if (base.artifacts.skillsSha256 !== actual.skillsSha256 && base.releaseVersion === manifest.releaseVersion) {
    throw new Error("Eve skills changed without a releaseVersion bump.")
  }
  if (
    base.artifacts.outputSchemaSha256 !== actual.outputSchemaSha256 &&
    base.outputSchemaVersion === manifest.outputSchemaVersion
  ) {
    throw new Error("Eve output schema changed without an outputSchemaVersion bump.")
  }
}

console.log(`Eve release manifest ${manifest.releaseVersion} is consistent.`)
