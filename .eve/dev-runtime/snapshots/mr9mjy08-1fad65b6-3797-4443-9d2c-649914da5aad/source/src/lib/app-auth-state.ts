type AppAuthStateInput = {
  isSessionPending: boolean
  hasSession: boolean
  isConvexLoading: boolean
  isConvexAuthenticated: boolean
}

export function resolveAppAuthState({
  isSessionPending,
  hasSession,
  isConvexLoading,
  isConvexAuthenticated,
}: AppAuthStateInput) {
  if (isSessionPending || isConvexLoading) return "loading" as const
  if (!hasSession || !isConvexAuthenticated) return "unauthenticated" as const
  return "authenticated" as const
}
