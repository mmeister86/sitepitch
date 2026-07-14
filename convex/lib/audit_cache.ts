export const AUDIT_CACHE_VERSION = "provider-artifacts-v1"

export const AUDIT_CACHE_TTL_MS = {
  content: 24 * 60 * 60 * 1000,
  screenshot: 24 * 60 * 60 * 1000,
  pagespeed: 48 * 60 * 60 * 1000,
  business_data: 14 * 24 * 60 * 60 * 1000,
} as const

export type AuditCacheKind = keyof typeof AUDIT_CACHE_TTL_MS

export function buildAuditCacheKey(args: {
  workspaceId: string
  normalizedUrl: string
  auditType: "standard" | "local" | "quick"
  kind: AuditCacheKind
  provider: string
  operation: string
  version?: string
}) {
  return [
    args.version ?? AUDIT_CACHE_VERSION,
    args.workspaceId,
    args.normalizedUrl,
    args.auditType,
    args.kind,
    args.provider,
    args.operation,
  ].join(":")
}

export function cacheExpiresAt(kind: AuditCacheKind, createdAt = Date.now()) {
  return createdAt + AUDIT_CACHE_TTL_MS[kind]
}

export function toCacheValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
