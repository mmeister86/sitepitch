const MAX_MESSAGE_LENGTH = 500

function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim()
}

function redactTokens(input: string): string {
  return collapseWhitespace(
    input
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
      .replace(/api[_-]?key\s*[:=]\s*['"]?[^'"\s]+/gi, "api_key=[redacted]")
      .replace(/access[_-]?key\s*[:=]\s*['"]?[^'"\s]+/gi, "access_key=[redacted]")
      .replace(/secret\s*[:=]\s*['"]?[^'"\s]+/gi, "secret=[redacted]")
      .replace(/authorization\s*[:=]\s*['"]?[^'"\s]+/gi, "authorization=[redacted]")
      .replace(/password\s*[:=]\s*['"]?[^\s'"]+/gi, "password=[redacted]")
      .replace(/token\s*[:=]\s*['"]?[^'"\s]+/gi, "token=[redacted]")
      .replace(/cookie\s*[:=]\s*['"]?[^'"\s,]+/gi, "cookie=[redacted]"),
  )
}

function redactEmails(input: string): string {
  return input.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]")
}

function redactQueryParams(input: string): string {
  return input.replace(/(\?|&)[^?\s=&]+=[^?\s&]*/g, "$1[redacted]")
}

function truncateUrl(input: string): string {
  return input.replace(/(https?:\/\/[^\s|]+)/g, (match) => {
    try {
      const url = new URL(match)
      return `${url.origin}${url.pathname}`
    } catch {
      return "[url]"
    }
  })
}

export function redactSensitiveText(input: string): string {
  if (!input) return ""
  let result = input
  result = redactTokens(result)
  result = redactEmails(result)
  result = redactQueryParams(result)
  result = truncateUrl(result)
  if (result.length > MAX_MESSAGE_LENGTH) {
    result = result.slice(0, MAX_MESSAGE_LENGTH) + "…"
  }
  return result
}

export interface SafeTelemetryError {
  code: string
  message: string
  responseStatus?: number
}

interface RawProviderError {
  message?: string
  code?: string
  errorCode?: string
  responseBody?: unknown
  responseStatus?: number
  url?: string
  value?: unknown
  data?: unknown
  isRetryable?: boolean
  stack?: string
}

export function sanitizeError(error: unknown): SafeTelemetryError {
  if (!(error instanceof Error)) {
    const fallback = String(error)
    return {
      code: "UNKNOWN",
      message: redactSensitiveText(fallback),
    }
  }

  const raw = error as Error & RawProviderError
  const rawMessage = raw.message || error.name || "Unknown error"
  const code = raw.code || raw.errorCode || "UNKNOWN"
  const responseStatus =
    typeof raw.responseStatus === "number" ? raw.responseStatus : undefined

  return {
    code,
    message: redactSensitiveText(rawMessage),
    ...(responseStatus !== undefined ? { responseStatus } : {}),
  }
}

export function sanitizeRequestEvidence(input: string | undefined): string | undefined {
  if (!input) return undefined
  return redactSensitiveText(input)
}
