const CTA_TARGET_LIMIT = 2_048
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/
const RESERVED_TARGET_DELIMITERS = /[/?#&]/

function decodeUntilStable(value: string): string | null {
  let decoded = value
  try {
    for (let i = 0; i <= value.length; i++) {
      const next = decodeURIComponent(decoded)
      if (next === decoded) return decoded
      decoded = next
    }
  } catch {
    return null
  }
  return null
}

function isStrictEmailAddress(value: string): boolean {
  if (CONTROL_CHARACTERS.test(value) || /\s/.test(value) || RESERVED_TARGET_DELIMITERS.test(value)) {
    return false
  }
  const parts = value.split("@")
  if (parts.length !== 2) return false
  const [local, domain] = parts
  if (
    !local || !domain ||
    local.startsWith(".") || local.endsWith(".") || local.includes("..") ||
    !/^[A-Za-z0-9.!$%*+=^_`{|}~-]+$/.test(local)
  ) {
    return false
  }
  const labels = domain.split(".")
  if (labels.length < 2 || !/^[A-Za-z]{2,63}$/.test(labels.at(-1) ?? "")) return false
  return labels.every((label) =>
    /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label),
  )
}

function isStrictTelephone(value: string): boolean {
  if (CONTROL_CHARACTERS.test(value) || RESERVED_TARGET_DELIMITERS.test(value)) return false
  if (!/^\+?[0-9 ().-]+$/.test(value)) return false
  return (value.match(/[0-9]/g) ?? []).length >= 3
}

/** Returns a trimmed safe CTA target, or undefined when the target is empty/invalid. */
export function normalizeStrictCtaTarget(value: string | undefined): string | undefined {
  const raw = value?.trim()
  if (!raw || raw.length > CTA_TARGET_LIMIT || CONTROL_CHARACTERS.test(raw)) return undefined

  const separator = raw.indexOf(":")
  if (separator <= 0) return undefined
  const scheme = raw.slice(0, separator).toLowerCase()
  const rawTarget = raw.slice(separator + 1)
  const decodedTarget = decodeUntilStable(rawTarget)
  if (!decodedTarget) return undefined

  if (scheme === "mailto") {
    return isStrictEmailAddress(rawTarget) && isStrictEmailAddress(decodedTarget) ? raw : undefined
  }
  if (scheme === "tel") {
    return isStrictTelephone(rawTarget) && isStrictTelephone(decodedTarget) ? raw : undefined
  }
  if (scheme !== "http" && scheme !== "https") return undefined
  if (/\s/.test(raw) || /\s/.test(decodedTarget)) return undefined

  try {
    const url = new URL(raw)
    if (!url.hostname || url.username || url.password || url.protocol !== `${scheme}:`) return undefined
    return raw
  } catch {
    return undefined
  }
}
