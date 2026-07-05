import assert from "node:assert/strict"

import { shouldHydrateBrandingForm } from "./branding-form-state.js"

assert.equal(shouldHydrateBrandingForm(null, 100), true)
assert.equal(shouldHydrateBrandingForm(100, 100), false)
assert.equal(shouldHydrateBrandingForm(100, 101), true)
