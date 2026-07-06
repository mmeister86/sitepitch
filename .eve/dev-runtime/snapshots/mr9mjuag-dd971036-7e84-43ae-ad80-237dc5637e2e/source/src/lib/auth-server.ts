import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs"

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL

if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is required")
}

if (!convexSiteUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_SITE_URL is required")
}

export const { getToken, handler, isAuthenticated } = convexBetterAuthNextJs({
  convexUrl,
  convexSiteUrl,
})
