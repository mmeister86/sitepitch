import { buildCanonicalReportUrl } from "./report_url"

export const REPORT_DOMAIN_CHALLENGE_PREFIX = "_sitepitch-challenge"
export const REPORT_DOMAIN_TOKEN_PREFIX = "sitepitch-verification="

export type ReportDomainStatus =
  | "pending_dns"
  | "verified"
  | "pending_host"
  | "active"
  | "suspended"
  | "disabled"
  | "error"

export class ReportDomainValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ReportDomainValidationError"
  }
}

function trimTrailingDot(value: string): string {
  return value.endsWith(".") ? value.slice(0, -1) : value
}

function validateDnsHostname(value: string): string {
  const hostname = trimTrailingDot(value.trim().toLowerCase())
  if (
    !hostname ||
    hostname.length > 253 ||
    /[\u0000-\u0020\u007f]/.test(hostname) ||
    hostname.includes(":") ||
    hostname.includes("/") ||
    hostname.includes("@") ||
    hostname.includes("*")
  ) {
    throw new ReportDomainValidationError("Die Domain ist ungültig.")
  }

  const labels = hostname.split(".")
  if (
    labels.length < 2 ||
    labels.some(
      (label) =>
        label.length === 0 ||
        label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    )
  ) {
    throw new ReportDomainValidationError("Die Domain ist ungültig.")
  }

  return hostname
}

const COMMON_TWO_LABEL_PUBLIC_SUFFIXES = new Set([
  "ac.uk",
  "co.jp",
  "co.nz",
  "co.uk",
  "com.au",
  "com.br",
  "com.mx",
  "com.sg",
  "edu.au",
  "gov.uk",
  "net.au",
  "ne.jp",
  "org.au",
  "org.uk",
])

/**
 * Normalizes a user-owned report hostname. V1 deliberately requires at least
 * three DNS labels (or four for common two-label public suffixes), rejecting
 * apex-domain inputs without adding a mutable public-suffix dependency.
 */
export function normalizeReportDomainHostname(value: string): string {
  const hostname = validateDnsHostname(value)
  const labels = hostname.split(".")
  const suffix = labels.slice(-2).join(".")
  const minimumLabels = COMMON_TWO_LABEL_PUBLIC_SUFFIXES.has(suffix) ? 4 : 3
  if (labels.length < minimumLabels) {
    throw new ReportDomainValidationError("Bitte eine Subdomain wie reports.example.com verwenden.")
  }

  const numericIpv4 = labels.length === 4 && labels.every((label) => /^\d+$/.test(label))
  if (
    numericIpv4 ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".test") ||
    hostname.endsWith(".invalid") ||
    hostname.endsWith(".example")
  ) {
    throw new ReportDomainValidationError("Diese Domain kann nicht als Report-Domain verwendet werden.")
  }

  return hostname
}

export function normalizeReportDomainTarget(value: string): string {
  return validateDnsHostname(value)
}

export function reportDomainChallengeName(hostname: string): string {
  return `${REPORT_DOMAIN_CHALLENGE_PREFIX}.${normalizeReportDomainHostname(hostname)}`
}

export function reportDomainChallengeValue(verificationToken: string): string {
  return `${REPORT_DOMAIN_TOKEN_PREFIX}${verificationToken}`
}

export function extractRequestHostname(host: string | null | undefined): string | null {
  const value = host?.split(",", 1)[0]?.trim().toLowerCase()
  if (!value || /[\u0000-\u0020\u007f/@]/.test(value)) return null

  try {
    const parsed = new URL(`http://${value}`)
    if (parsed.username || parsed.password || !parsed.hostname) return null
    return trimTrailingDot(parsed.hostname.toLowerCase())
  } catch {
    return null
  }
}

export function siteHostname(siteUrl: string | undefined): string | null {
  if (!siteUrl) return null
  try {
    const url = new URL(siteUrl)
    if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname) return null
    return trimTrailingDot(url.hostname.toLowerCase())
  } catch {
    return null
  }
}

export function isReportDomainPlanEnabled(plan: string): boolean {
  // Scale packaging is intentionally outside TASK-5.4.
  return plan === "agency"
}

export type ReportDomainUrlRecord = {
  hostname: string
  status: ReportDomainStatus
}

export function buildCustomReportUrl(hostname: string, publicSlug: string): string {
  return `https://${normalizeReportDomainHostname(hostname)}/${encodeURIComponent(publicSlug)}`
}

export function resolveReportPublicUrl(args: {
  siteUrl: string | undefined
  publicSlug: string
  plan: string
  domain?: ReportDomainUrlRecord | null
}): string {
  if (args.domain?.status === "active" && isReportDomainPlanEnabled(args.plan)) {
    return buildCustomReportUrl(args.domain.hostname, args.publicSlug)
  }
  return buildCanonicalReportUrl(args.siteUrl, args.publicSlug)
}

export function isAllowedReportRequestHost(args: {
  host: string | null | undefined
  siteUrl: string | undefined
  plan: string
  domain?: ReportDomainUrlRecord | null
}): boolean {
  const requested = extractRequestHostname(args.host)
  if (!requested) return false
  if (requested === siteHostname(args.siteUrl)) return true
  return (
    args.domain?.status === "active" &&
    isReportDomainPlanEnabled(args.plan) &&
    requested === normalizeReportDomainHostname(args.domain.hostname)
  )
}

type DnsJsonAnswer = { data?: unknown; type?: unknown }
type DnsJsonResponse = { Status?: unknown; Answer?: unknown }

async function queryDnsOverHttps(
  hostname: string,
  type: "TXT" | "CNAME",
  fetchImpl: typeof fetch,
): Promise<string[]> {
  const url = new URL("https://cloudflare-dns.com/dns-query")
  url.searchParams.set("name", hostname)
  url.searchParams.set("type", type)

  const response = await fetchImpl(url, {
    headers: { accept: "application/dns-json" },
  })
  if (!response.ok) throw new Error(`DNS_QUERY_FAILED:${response.status}`)

  const body = (await response.json()) as DnsJsonResponse
  if (body.Status !== 0) return []
  if (!Array.isArray(body.Answer)) return []
  return (body.Answer as DnsJsonAnswer[])
    .map((answer) => answer.data)
    .filter((data): data is string => typeof data === "string")
}

function decodeTxtRecord(value: string): string {
  const chunks = [...value.matchAll(/"((?:\\.|[^"\\])*)"/g)]
  if (chunks.length === 0) return value.trim()
  return chunks
    .map((match) => match[1].replace(/\\(["\\])/g, "$1"))
    .join("")
}

export type ReportDomainDnsVerification = {
  ok: boolean
  txtVerified: boolean
  cnameVerified: boolean
  errorCode: "TXT_MISMATCH" | "CNAME_MISMATCH" | "DNS_LOOKUP_FAILED" | null
}

export async function verifyReportDomainDns(args: {
  hostname: string
  verificationToken: string
  cnameTarget: string
  fetchImpl?: typeof fetch
}): Promise<ReportDomainDnsVerification> {
  const hostname = normalizeReportDomainHostname(args.hostname)
  const cnameTarget = normalizeReportDomainTarget(args.cnameTarget)
  const challengeValue = reportDomainChallengeValue(args.verificationToken)
  const fetchImpl = args.fetchImpl ?? fetch

  try {
    const [txtRecords, cnameRecords] = await Promise.all([
      queryDnsOverHttps(reportDomainChallengeName(hostname), "TXT", fetchImpl),
      queryDnsOverHttps(hostname, "CNAME", fetchImpl),
    ])
    const txtVerified = txtRecords.some((record) => decodeTxtRecord(record) === challengeValue)
    const cnameVerified = cnameRecords.some((record) => {
      try {
        return normalizeReportDomainTarget(record) === cnameTarget
      } catch {
        return false
      }
    })

    return {
      ok: txtVerified && cnameVerified,
      txtVerified,
      cnameVerified,
      errorCode: !txtVerified ? "TXT_MISMATCH" : !cnameVerified ? "CNAME_MISMATCH" : null,
    }
  } catch {
    return {
      ok: false,
      txtVerified: false,
      cnameVerified: false,
      errorCode: "DNS_LOOKUP_FAILED",
    }
  }
}
