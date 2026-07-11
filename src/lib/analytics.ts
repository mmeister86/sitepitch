"use client"

declare global {
  interface Window {
    rybbit?: {
      event: (eventName: string, eventData?: Record<string, string | number>) => void
      pageview: () => void
    }
  }
}

export type AnalyticsProperties = Record<string, string | number | boolean | undefined | null>

function sanitizeProperties(properties?: AnalyticsProperties): Record<string, string | number> {
  if (!properties) return {}
  const result: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined || value === null) continue
    if (typeof value === "boolean") {
      result[key] = value ? "true" : "false"
    } else if (typeof value === "string" || typeof value === "number") {
      result[key] = value
    }
  }
  return result
}

export function trackRybbitEvent(eventName: string, properties?: AnalyticsProperties): void {
  if (typeof window === "undefined") return
  if (!window.rybbit || typeof window.rybbit.event !== "function") return
  try {
    window.rybbit.event(eventName, sanitizeProperties(properties))
  } catch {
    // analytics must never break product functionality
  }
}

export function trackRybbitPageview(): void {
  if (typeof window === "undefined") return
  if (!window.rybbit || typeof window.rybbit.pageview !== "function") return
  try {
    window.rybbit.pageview()
  } catch {
    // analytics must never break product functionality
  }
}
