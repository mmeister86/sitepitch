import { env } from "../_generated/server"

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "TURNSTILE_NOT_CONFIGURED" | "TURNSTILE_FAILED" }

export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<TurnstileResult> {
  if (!env.TURNSTILE_SECRET_KEY) {
    return { ok: false, reason: "TURNSTILE_NOT_CONFIGURED" }
  }
  const form = new FormData()
  form.append("secret", env.TURNSTILE_SECRET_KEY)
  form.append("response", token)
  if (remoteIp) form.append("remoteip", remoteIp)

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  })
  const data = (await response.json()) as { success?: boolean }
  return data.success ? { ok: true } : { ok: false, reason: "TURNSTILE_FAILED" }
}
