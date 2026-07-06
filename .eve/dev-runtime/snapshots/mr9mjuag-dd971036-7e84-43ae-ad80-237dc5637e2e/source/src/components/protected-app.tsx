"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useConvexAuth, useMutation, useQuery } from "convex/react"

import { api } from "../../convex/_generated/api"
import { authClient } from "@/lib/auth-client"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/sonner"
import { resolveAppAuthState } from "@/lib/app-auth-state"
import { applyWorkspaceAccent, getWorkspaceAccentVariables } from "@/lib/workspace-accent"

function WorkspaceAccentSync() {
  const data = useQuery(api.workspaces.getMyWorkspace)

  useEffect(() => {
    if (!data) return
    const root = document.documentElement
    const variables = getWorkspaceAccentVariables(data.workspace.accentColor)
    applyWorkspaceAccent(root.style, data.workspace.accentColor)

    return () => {
      for (const property of Object.keys(variables)) {
        root.style.removeProperty(property)
      }
    }
  }, [data?.workspace.accentColor])

  return null
}

export function ProtectedApp({ children }: { children: ReactNode }) {
  const router = useRouter()
  const session = authClient.useSession()
  const convexAuth = useConvexAuth()
  const ensureWorkspace = useMutation(api.workspaces.ensureCurrentWorkspace)
  const [isBootstrapped, setIsBootstrapped] = useState(false)
  const authState = resolveAppAuthState({
    isSessionPending: session.isPending,
    hasSession: Boolean(session.data),
    isConvexLoading: convexAuth.isLoading,
    isConvexAuthenticated: convexAuth.isAuthenticated,
  })

  useEffect(() => {
    if (authState === "loading") return

    if (authState === "unauthenticated") {
      setIsBootstrapped(false)
      router.replace("/login")
      return
    }

    let cancelled = false
    setIsBootstrapped(false)
    ensureWorkspace()
      .then(() => {
        if (!cancelled) setIsBootstrapped(true)
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Workspace konnte nicht geladen werden")
        }
      })

    return () => {
      cancelled = true
    }
  }, [authState, ensureWorkspace, router])

  if (authState !== "authenticated" || !isBootstrapped) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Spinner className="size-6 text-primary" />
      </div>
    )
  }

  return (
    <>
      <WorkspaceAccentSync />
      {children}
    </>
  )
}
