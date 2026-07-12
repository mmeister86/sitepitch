"use client"

import { usePathname } from "next/navigation"
import Script from "next/script"

export function AnalyticsScript({ siteId }: { siteId?: string }) {
  const pathname = usePathname()
  if (!siteId || pathname?.startsWith("/examples/")) return null
  return <Script src="/analytics/script.js" data-site-id={siteId} strategy="afterInteractive" />
}
