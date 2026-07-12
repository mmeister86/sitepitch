import { httpRouter } from "convex/server"

import { authComponent, createAuth } from "./auth"
import { internal } from "./_generated/api"
import { env, httpAction } from "./_generated/server"
import { timingSafeHexEqual } from "./lib/lemonsqueezy"
import { isJsonContentType, readLimitedRequestText } from "./lib/webhook_request"

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
    if (!isJsonContentType(request.headers.get("content-type"))) {
      return new Response("Unsupported media type", { status: 415 })
    }
    const body = await readLimitedRequestText(request)
    if (body === null) return new Response("Payload too large", { status: 413 })
    const signature = request.headers.get("x-signature") ?? ""
    const expected = await hmacSha256(body, secret)
    if (!timingSafeHexEqual(signature, expected)) return new Response("Invalid signature", { status: 401 })

    try {
      JSON.parse(body)
      // The signature covers the body, not arbitrary transport headers. Using the
      // signed body hash makes replay deduplication impossible to bypass by changing
      // an unsigned event-id header.
      const providerEventId = await sha256(body)
      await ctx.runMutation(internal.billing.processWebhook, { providerEventId, payload: body })
      return new Response("OK", { status: 200 })
    } catch {
      return new Response("Invalid webhook", { status: 400 })
    }
  }),
})

export default http
