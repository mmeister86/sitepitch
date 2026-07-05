import assert from "node:assert/strict"

import { getFirstName, getUserDisplayName, personalizeOutreachText } from "./user-display.js"

assert.equal(getUserDisplayName(" Matthias Meister ", "matthias@example.com"), "Matthias Meister")
assert.equal(getUserDisplayName(null, "matthias.meister@example.com"), "matthias.meister")
assert.equal(getFirstName("Matthias Meister"), "Matthias")
assert.equal(
  personalizeOutreachText(
    "Viele Grüße\nJana Roth\nNordpixel Studio",
    "Matthias Meister",
    "Matthias Meister Workspace"
  ),
  "Viele Grüße\nMatthias Meister\nMatthias Meister Workspace"
)
