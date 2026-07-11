import { httpRouter } from "convex/server"

import { authComponent, createAuth } from "./auth"
import { internal } from "./_generated/api"
import { env, httpAction } from "./_generated/server"
import { timingSafeHexEqual } from "./lib/lemonsqueezy"

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function sha256(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))
}

async function hmacSha256(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)))
}

const http = httpRouter()

authComponent.registerRoutesLazy(http, createAuth, {
  basePath: "/api/auth",
  cors: true,
})

http.route({
  path: "/api/webhooks/lemonsqueezy",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = env.LEMONSQUEEZY_WEBHOOK_SECRET
    if (!secret) return new Response("Webhook not configured", { status: 503 })
    const body = await request.text()
    const signature = request.headers.get("x-signature") ?? ""
    const expected = await hmacSha256(body, secret)
    if (!timingSafeHexEqual(signature, expected)) return new Response("Invalid signature", { status: 401 })

    try {
      const headerId = request.headers.get("x-event-id")
      const providerEventId = headerId || await sha256(body)
      await ctx.runMutation(internal.billing.processWebhook, { providerEventId, payload: body })
      return new Response("OK", { status: 200 })
    } catch {
      return new Response("Invalid webhook", { status: 400 })
    }
  }),
})

export default http
