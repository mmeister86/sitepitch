import { NextResponse, type NextRequest } from "next/server"

import { extractRequestHostname, siteHostname } from "./convex/lib/report_domain"

const REPORT_SLUG = /^[A-Za-z0-9_-]{8,128}$/
const PLATFORM_ROUTE_SEGMENTS = new Set([
  "api",
  "app",
  "audits",
  "campaigns",
  "examples",
  "leads",
  "login",
  "r",
  "settings",
  "signup",
])

export type CustomReportRoute =
  | { kind: "platform" }
  | { kind: "asset" }
  | { kind: "rewrite"; slug: string }
  | { kind: "blocked" }

function isLocalOrPreviewHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".vercel.app")
  )
}

/** Pure routing decision kept exported so the host boundary is regression-tested. */
export function classifyCustomReportRoute(args: {
  hostname: string | null
  pathname: string
  siteUrl: string | undefined
}): CustomReportRoute {
  const hostname = args.hostname?.toLowerCase().replace(/\.$/, "") ?? null
  const canonicalHostname = siteHostname(args.siteUrl)
  if (
    !hostname ||
    hostname === canonicalHostname ||
    isLocalOrPreviewHostname(hostname)
  ) {
    return { kind: "platform" }
  }

  if (args.pathname.startsWith("/_next/")) return { kind: "asset" }

  const segments = args.pathname.split("/").filter(Boolean)
  if (segments.length !== 1) return { kind: "blocked" }
  const slug = segments[0]
  if (PLATFORM_ROUTE_SEGMENTS.has(slug.toLowerCase()) || !REPORT_SLUG.test(slug)) {
    return { kind: "blocked" }
  }
  return { kind: "rewrite", slug }
}

function requestHostname(request: NextRequest): string | null {
  return extractRequestHostname(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  )
}

function unavailableResponse(): NextResponse {
  return new NextResponse("Not Found", {
    status: 404,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  })
}

export function proxy(request: NextRequest) {
  const decision = classifyCustomReportRoute({
    hostname: requestHostname(request),
    pathname: request.nextUrl.pathname,
    siteUrl: process.env.SITE_URL,
  })

  if (decision.kind === "platform" || decision.kind === "asset") {
    const response = NextResponse.next()
    if (request.nextUrl.pathname.startsWith("/r/")) {
      response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
      response.headers.set("Cache-Control", "private, no-store")
    }
    return response
  }
  if (decision.kind === "blocked") return unavailableResponse()

  const destination = request.nextUrl.clone()
  destination.pathname = `/r/${decision.slug}`
  const response = NextResponse.rewrite(destination)
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
  return response
}

export const config = {
  matcher: ["/((?!_next/).*)"],
}
