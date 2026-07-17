import manifest from "../../../eve.release.json"

export type EveReleaseManifest = typeof manifest

export const eveReleaseManifest: EveReleaseManifest = Object.freeze(manifest)

export function resolveLoadedSkillVersions(skillIds: readonly string[]) {
  return [...new Set(skillIds)].sort().map((id) => ({
    id,
    version: eveReleaseManifest.skills[id as keyof typeof eveReleaseManifest.skills] ?? "unknown",
  }))
}
