export const MAX_WEBHOOK_BODY_BYTES = 256 * 1024

export function isJsonContentType(value: string | null): boolean {
  if (!value) return false
  return value.split(";", 1)[0]?.trim().toLowerCase() === "application/json"
}

export async function readLimitedRequestText(
  request: Request,
  limitBytes = MAX_WEBHOOK_BODY_BYTES,
): Promise<string | null> {
  const declaredLength = request.headers.get("content-length")
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength)
    if (Number.isFinite(parsedLength) && parsedLength > limitBytes) return null
  }

  if (!request.body) return ""

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > limitBytes) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(body)
}
