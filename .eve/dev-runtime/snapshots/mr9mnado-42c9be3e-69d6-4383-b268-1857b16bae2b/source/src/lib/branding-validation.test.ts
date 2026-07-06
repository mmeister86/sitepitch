import assert from "node:assert/strict"

import { parseBrandingInput } from "./branding-validation.js"

const valid = parseBrandingInput({
  name: " Nordpixel Studio ",
  logoStorageId: null,
  accentColor: "#5b5bd6",
  website: "nordpixel.studio",
  contactEmail: "hallo@nordpixel.studio",
  ctaText: "Kostenloses Erstgespräch buchen",
  ctaUrl: "https://cal.com/nordpixel/audit",
  reportLanguage: "de",
})

assert.equal(valid.ok, true)
if (valid.ok) {
  assert.equal(valid.value.name, "Nordpixel Studio")
  assert.equal(valid.value.website, "https://nordpixel.studio")
  assert.equal(valid.value.contactEmail, "hallo@nordpixel.studio")
}

const invalid = parseBrandingInput({
  name: "",
  logoStorageId: null,
  accentColor: "blue",
  website: "not a url",
  contactEmail: "not-an-email",
  ctaText: "Audit ansehen",
  ctaUrl: "javascript:alert(1)",
  reportLanguage: "fr",
})

assert.equal(invalid.ok, false)
if (!invalid.ok) {
  assert.deepEqual(Object.keys(invalid.fieldErrors).sort(), [
    "accentColor",
    "contactEmail",
    "ctaUrl",
    "name",
    "reportLanguage",
    "website",
  ])
}
