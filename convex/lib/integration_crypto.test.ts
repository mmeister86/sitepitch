import { describe, expect, test } from "vitest"

import { decryptIntegrationSecret, encryptIntegrationSecret } from "./integration_crypto"

function key(byte: number) {
  return btoa(String.fromCharCode(...new Uint8Array(32).fill(byte)))
}

describe("integration credential encryption", () => {
  test("round trips with authenticated workspace context", async () => {
    const keyring = JSON.stringify({ current: "v1", keys: { v1: key(7) } })
    const envelope = await encryptIntegrationSecret("refresh-token", keyring, "workspace:integration:gmail")
    await expect(
      decryptIntegrationSecret(envelope, keyring, "workspace:integration:gmail"),
    ).resolves.toEqual({ plaintext: "refresh-token", needsRotation: false })
  })

  test("rejects the wrong AAD", async () => {
    const keyring = JSON.stringify({ current: "v1", keys: { v1: key(8) } })
    const envelope = await encryptIntegrationSecret("secret", keyring, "workspace-a")
    await expect(decryptIntegrationSecret(envelope, keyring, "workspace-b")).rejects.toThrow(
      "could not be decrypted",
    )
  })

  test("reads an old key and requests rotation", async () => {
    const oldKeyring = JSON.stringify({ current: "v1", keys: { v1: key(1) } })
    const envelope = await encryptIntegrationSecret("secret", oldKeyring, "aad")
    const rotated = JSON.stringify({ current: "v2", keys: { v1: key(1), v2: key(2) } })
    await expect(decryptIntegrationSecret(envelope, rotated, "aad")).resolves.toEqual({
      plaintext: "secret",
      needsRotation: true,
    })
  })
})

