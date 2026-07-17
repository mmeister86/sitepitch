export type CredentialEnvelope = {
  keyVersion: string
  ciphertext: string
  nonce: string
}

type ParsedKeyring = {
  current: string
  keys: Map<string, Uint8Array>
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function bytesBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer
}

function parseKeyring(raw: string | undefined): ParsedKeyring {
  if (!raw?.trim()) throw new Error("INTEGRATION_CREDENTIAL_KEYRING is not configured")
  let decoded: unknown
  try {
    decoded = JSON.parse(raw)
  } catch {
    throw new Error("INTEGRATION_CREDENTIAL_KEYRING is invalid JSON")
  }
  if (!decoded || typeof decoded !== "object") throw new Error("Integration keyring is invalid")
  const input = decoded as { current?: unknown; keys?: unknown }
  if (typeof input.current !== "string" || !input.keys || typeof input.keys !== "object") {
    throw new Error("Integration keyring is invalid")
  }
  const keys = new Map<string, Uint8Array>()
  for (const [version, encoded] of Object.entries(input.keys as Record<string, unknown>)) {
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(version) || typeof encoded !== "string") {
      throw new Error("Integration keyring contains an invalid key")
    }
    const bytes = base64ToBytes(encoded)
    if (bytes.byteLength !== 32) throw new Error("Integration credential keys must be 32 bytes")
    keys.set(version, bytes)
  }
  if (!keys.has(input.current)) throw new Error("Integration keyring current version is missing")
  return { current: input.current, keys }
}

async function importAesKey(bytes: Uint8Array) {
  return await crypto.subtle.importKey("raw", bytes as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"])
}

export async function encryptIntegrationSecret(
  plaintext: string,
  rawKeyring: string | undefined,
  aad: string,
): Promise<CredentialEnvelope> {
  const keyring = parseKeyring(rawKeyring)
  const keyBytes = keyring.keys.get(keyring.current)!
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: new TextEncoder().encode(aad) },
    await importAesKey(keyBytes),
    new TextEncoder().encode(plaintext),
  )
  return {
    keyVersion: keyring.current,
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    nonce: bytesToBase64(nonce),
  }
}

export async function decryptIntegrationSecret(
  envelope: CredentialEnvelope,
  rawKeyring: string | undefined,
  aad: string,
): Promise<{ plaintext: string; needsRotation: boolean }> {
  const keyring = parseKeyring(rawKeyring)
  const keyBytes = keyring.keys.get(envelope.keyVersion)
  if (!keyBytes) throw new Error("Integration credential key version is unavailable")
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytesBuffer(base64ToBytes(envelope.nonce)),
        additionalData: new TextEncoder().encode(aad),
      },
      await importAesKey(keyBytes),
      bytesBuffer(base64ToBytes(envelope.ciphertext)),
    )
    return {
      plaintext: new TextDecoder().decode(plaintext),
      needsRotation: envelope.keyVersion !== keyring.current,
    }
  } catch {
    throw new Error("Integration credential could not be decrypted")
  }
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return bytesToBase64(new Uint8Array(digest))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

export function randomBase64Url(byteLength = 32): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(byteLength)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}
