"use client"

import type { ReactNode } from "react"
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react"
import { ConvexReactClient } from "convex/react"

import { convexAuthClient } from "@/lib/auth-client"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export function AppProviders({
  children,
  initialToken,
}: {
  children: ReactNode
  initialToken?: string | null
}) {
  return (
    <ConvexBetterAuthProvider
      client={convex}
      authClient={convexAuthClient}
      initialToken={initialToken}
    >
      <ThemeProvider defaultTheme="light" storageKey="sitepitch-theme">
        {children}
        <Toaster />
      </ThemeProvider>
    </ConvexBetterAuthProvider>
  )
}
