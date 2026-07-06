import assert from "node:assert/strict"

import { resolveAppAuthState } from "./app-auth-state.js"

assert.equal(
  resolveAppAuthState({
    isSessionPending: false,
    hasSession: true,
    isConvexLoading: true,
    isConvexAuthenticated: false,
  }),
  "loading"
)

assert.equal(
  resolveAppAuthState({
    isSessionPending: false,
    hasSession: true,
    isConvexLoading: false,
    isConvexAuthenticated: true,
  }),
  "authenticated"
)

assert.equal(
  resolveAppAuthState({
    isSessionPending: false,
    hasSession: false,
    isConvexLoading: false,
    isConvexAuthenticated: false,
  }),
  "unauthenticated"
)
