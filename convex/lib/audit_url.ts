import ipaddr from "ipaddr.js"

const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/
const WHITESPACE_PATTERN = /\s/
const DEFAULT_DNS_TIMEOUT_MS = 2000

export type NormalizedAuditUrl = {
  normalizedUrl: string
  hostname: string
  protocol: "http:" | "https:"
}

const ALLOWED_PORTS = new Set(["", "80", "443"])

export type AuditUrlErrorCode = "INVALID_URL" | "UNSAFE_URL" | "URL_UNRESOLVABLE"

export type AuditUrlError = {
  code: AuditUrlErrorCode
  message: string
}

function hasUnsafeCharacters(input: string) {
  return CONTROL_CHAR_PATTERN.test(input) || WHITESPACE_PATTERN.test(input) || input.includes("\\")
}

function normalizeHostname(hostname: string) {
  return hostname.replace(/^\[(.*)\]$/, "$1").replace(/\.$/, "")
}

function classifyIpAddress(address: string): "public" | "unsafe" | "invalid" {
  try {
    let parsed = ipaddr.parse(address)
    if (parsed.kind() === "ipv6") {
      const ipv6 = parsed as any
      if (ipv6.isIPv4MappedAddress()) {
        parsed = ipv6.toIPv4Address()
      }
    }
    return parsed.range() === "unicast" ? "public" : "unsafe"
  } catch {
    return "invalid"
  }
}

export function normalizeAuditUrl(input: string): NormalizedAuditUrl | AuditUrlError {
  const raw = input.trim()
  if (!raw || hasUnsafeCharacters(raw)) {
    return {
      code: "INVALID_URL",
      message: "Bitte gib eine gültige Website-URL ein.",
    }
  }

  const hasProtocol = raw.startsWith("http://") || raw.startsWith("https://")
  const candidate = hasProtocol ? raw : raw.startsWith("//") ? `https:${raw}` : `https://${raw}`

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return {
      code: "INVALID_URL",
      message: "Bitte gib eine gültige Website-URL ein.",
    }
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      code: "INVALID_URL",
      message: "Nur http:// und https:// URLs sind erlaubt.",
    }
  }

  if (url.username || url.password) {
    return {
      code: "INVALID_URL",
      message: "URLs mit Zugangsdaten sind nicht erlaubt.",
    }
  }

  if (!ALLOWED_PORTS.has(url.port)) {
    return {
      code: "UNSAFE_URL",
      message: "Nur die Web-Ports 80 und 443 sind erlaubt.",
    }
  }

  if (!url.hostname) {
    return {
      code: "INVALID_URL",
      message: "Bitte gib eine gültige Website-URL ein.",
    }
  }

  const hostname = normalizeHostname(url.hostname)
  url.hostname = hostname
  url.hash = ""

  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = ""
  }

  return {
    normalizedUrl: url.toString(),
    hostname,
    protocol: url.protocol,
  }
}

export async function validatePublicAuditTarget(
  hostname: string,
  options?: { timeoutMs?: number },
): Promise<AuditUrlError | { ok: true; addresses: string[] }> {
  const directIp = classifyIpAddress(hostname)
  if (directIp === "public") {
    return { ok: true, addresses: [hostname] }
  }
  if (directIp === "unsafe") {
    return {
      code: "UNSAFE_URL",
      message: "Lokale oder private Ziele sind nicht erlaubt.",
    }
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_DNS_TIMEOUT_MS
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const results = await Promise.allSettled([
      fetchDnsRecords(hostname, "A", controller.signal),
      fetchDnsRecords(hostname, "AAAA", controller.signal),
    ])

    const addresses = results
      .filter((result): result is PromiseFulfilledResult<string[]> => result.status === "fulfilled")
      .flatMap((result) => result.value)

    if (addresses.length === 0) {
      return {
        code: "URL_UNRESOLVABLE",
        message: "Die Website konnte nicht aufgelöst werden.",
      }
    }

    if (addresses.some((address) => classifyIpAddress(address) !== "public")) {
      return {
        code: "UNSAFE_URL",
        message: "Lokale oder private Ziele sind nicht erlaubt.",
      }
    }

    return { ok: true, addresses }
  } catch {
    return {
      code: "URL_UNRESOLVABLE",
      message: "Die Website konnte nicht aufgelöst werden.",
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

export function generatePublicSlug() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return toBase64Url(bytes)
}

export function toSafeDisplayUrl(value: string): string {
  try {
    const url = new URL(value)
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.host) return ""
    // Convex's standard query runtime supports URL parsing, but not the
    // username/password/search/hash setters. Reconstructing from read-only
    // components also guarantees that credentials, query data, and fragments
    // cannot reach browser DTOs.
    return `${url.protocol}//${url.host}${url.pathname}`
  } catch {
    return ""
  }
}

async function fetchDnsRecords(
  hostname: string,
  type: "A" | "AAAA",
  signal: AbortSignal,
): Promise<string[]> {
  const url = new URL("https://cloudflare-dns.com/dns-query")
  url.searchParams.set("name", hostname)
  url.searchParams.set("type", type)

  const response = await fetch(url, {
    signal,
    headers: {
      accept: "application/dns-json",
    },
  })

  if (!response.ok) {
    throw new Error(`DNS_QUERY_FAILED:${response.status}`)
  }

  const body = (await response.json()) as {
    Status?: number
    Answer?: Array<{ data?: string }>
  }

  if (body.Status !== 0 || !Array.isArray(body.Answer)) {
    return []
  }

  return body.Answer.map((answer) => answer.data).filter(
    (address): address is string => typeof address === "string" && classifyIpAddress(address) !== "invalid",
  )
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}
