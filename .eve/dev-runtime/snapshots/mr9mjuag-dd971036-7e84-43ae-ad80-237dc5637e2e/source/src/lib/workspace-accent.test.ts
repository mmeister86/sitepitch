import assert from "node:assert/strict"

import { applyWorkspaceAccent, getWorkspaceAccentVariables } from "./workspace-accent.js"

assert.deepEqual(getWorkspaceAccentVariables("#059669"), {
  "--primary": "#059669",
  "--primary-foreground": "#ffffff",
  "--ring": "#059669",
  "--chart-1": "#059669",
  "--sidebar-primary": "#059669",
  "--sidebar-primary-foreground": "#ffffff",
  "--sidebar-ring": "#059669",
})

assert.equal(getWorkspaceAccentVariables("#facc15")["--primary-foreground"], "#171717")

const applied = new Map<string, string>()
applyWorkspaceAccent(
  { setProperty: (property, value) => applied.set(property, value) },
  "#2563eb"
)
assert.equal(applied.get("--primary"), "#2563eb")
assert.equal(applied.get("--sidebar-primary"), "#2563eb")
