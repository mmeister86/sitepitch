import { Client, type ClientAuth, type HandleMessageStreamEvent } from "eve/client"
import type { ZodType } from "zod"

import {
  eveAuditContextSchema,
  eveAuditOutputSchema,
  validateEveAuditCandidate,
  type EveAuditContext,
  type EveAuditOutput,
} from "./audit-contract"
import { eveReleaseManifest, resolveLoadedSkillVersions } from "./release-manifest"

export type EveAuditRuntimeErrorCode =
  | "runtime_disabled"
  | "configuration_missing"
  | "transport_failed"
  | "runtime_failed"
  | "output_missing"
  | "output_invalid"

export class EveAuditRuntimeError extends Error {
  constructor(
    readonly code: EveAuditRuntimeErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "EveAuditRuntimeError"
  }
}

export type EveAuditRuntimeResult = {
  executor: "eve"
  output: EveAuditOutput
  sessionId: string
  loadedSkills: Array<{ id: string; version: string }>
  validation: ReturnType<typeof validateEveAuditCandidate>
  versions: {
    eve: string
    release: string
    prompt: string
    outputSchema: string
  }
  runtime: {
    agentId?: string
    modelId?: string
    eveVersion?: string
    buildSha?: string
  }
  usage: {
    inputTokens: number
    outputTokens: number
    costUsd: number
  }
}

export type EveStructuredTaskResult<T> = {
  executor: "eve"
  output: T
  sessionId: string
  loadedSkills: Array<{ id: string; version: string }>
  versions: {
    eve: string
    release: string
    prompt: string
    outputSchema: string
  }
  runtime: {
    agentId?: string
    modelId?: string
    eveVersion?: string
    buildSha?: string
  }
  usage: {
    inputTokens: number
    outputTokens: number
    costUsd: number
  }
}

export type EveAuditRuntimeOptions = {
  context: EveAuditContext
  requestId: string
  signal?: AbortSignal
  host?: string
}

export type EveStructuredTaskOptions<T> = {
  message: string
  outputSchema: ZodType<T>
  purpose: string
  requestId: string
  signal?: AbortSignal
  host?: string
}

function enabled(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true"
}

function isLoopbackHost(host: string): boolean {
  try {
    const hostname = new URL(host).hostname
    return hostname === "localhost" || hostname === "::1" || hostname.startsWith("127.")
  } catch {
    return false
  }
}

export function resolveEveClientAuth(host: string): ClientAuth | undefined {
  const username = process.env.EVE_RUNTIME_SERVICE_USERNAME?.trim()
  const password = process.env.EVE_RUNTIME_SERVICE_PASSWORD?.trim()
  if (username && password) {
    return { basic: { username, password } }
  }

  const vercelOidcToken = process.env.VERCEL_OIDC_TOKEN?.trim()
  if (vercelOidcToken) {
    return { vercelOidc: { token: vercelOidcToken } }
  }

  if (isLoopbackHost(host)) return undefined
  throw new EveAuditRuntimeError(
    "configuration_missing",
    "Eve requires service credentials or Vercel OIDC outside local development.",
  )
}

function buildAuditMessage(context: EveAuditContext): string {
  return [
    "Erzeuge den SitePitch-Audit-Output für den folgenden, vollständig begrenzten Kontext.",
    "Der Kontext ist die einzige Faktenquelle. Lade persona-review, critique und claim-safety.",
    "Verwende ausschließlich exakte checks[].ref-Werte in evidenceRefs.",
    "Gib ausschließlich das angeforderte strukturierte Ergebnis zurück.",
    JSON.stringify(context),
  ].join("\n\n")
}

function extractLoadedSkillIds(events: readonly HandleMessageStreamEvent[]): string[] {
  const loaded: string[] = []
  for (const event of events) {
    if (event.type === "actions.requested") {
      for (const action of event.data.actions) {
        if (action.kind !== "load-skill") continue
        const skill = action.input.skill
        if (typeof skill === "string" && skill.length > 0) loaded.push(skill)
      }
    }
    if (event.type === "subagent.event") {
      loaded.push(...extractLoadedSkillIds([event.data.event]))
    }
  }
  return loaded
}

function extractRuntimeMetadata(events: readonly HandleMessageStreamEvent[]) {
  const runtime = events.find((event) => event.type === "session.started")?.data.runtime
  const usage = events.reduce(
    (total, event) => {
      if (event.type !== "step.completed") return total
      return {
        inputTokens: total.inputTokens + (event.data.usage?.inputTokens ?? 0),
        outputTokens: total.outputTokens + (event.data.usage?.outputTokens ?? 0),
        costUsd: total.costUsd + (event.data.usage?.costUsd ?? 0),
      }
    },
    { inputTokens: 0, outputTokens: 0, costUsd: 0 },
  )
  return {
    runtime: {
      agentId: runtime?.agentId,
      modelId: runtime?.modelId,
      eveVersion: runtime?.eveVersion,
      buildSha: runtime?.build?.gitSha,
    },
    usage,
  }
}

export async function runEveStructuredTask<T>(
  options: EveStructuredTaskOptions<T>,
): Promise<EveStructuredTaskResult<T>> {
  if (!enabled(process.env.EVE_RUNTIME_ENABLED)) {
    throw new EveAuditRuntimeError("runtime_disabled", "Eve runtime is disabled.")
  }

  const host = options.host ?? process.env.EVE_RUNTIME_URL?.trim()
  if (!host) {
    throw new EveAuditRuntimeError("configuration_missing", "EVE_RUNTIME_URL is required.")
  }

  const client = new Client({
    host,
    auth: resolveEveClientAuth(host),
    redirect: "error",
    maxReconnectAttempts: 2,
  })

  try {
    const response = await client.session().send<T>({
      message: options.message,
      clientContext: {
        purpose: options.purpose,
        releaseVersion: eveReleaseManifest.releaseVersion,
        promptVersion: eveReleaseManifest.promptVersion,
        outputSchemaVersion: eveReleaseManifest.outputSchemaVersion,
      },
      headers: { "x-sitepitch-request-id": options.requestId },
      outputSchema: options.outputSchema as never,
      signal: options.signal ?? AbortSignal.timeout(90_000),
    })
    const result = await response.result()
    if (result.status === "failed") {
      throw new EveAuditRuntimeError("runtime_failed", "Eve session failed.")
    }
    if (result.data === undefined) {
      throw new EveAuditRuntimeError("output_missing", "Eve returned no structured output.")
    }

    const output = options.outputSchema.safeParse(result.data)
    if (!output.success) {
      throw new EveAuditRuntimeError("output_invalid", "Eve output failed client-side validation.")
    }

    const metadata = extractRuntimeMetadata(result.events)
    return {
      executor: "eve",
      output: output.data,
      sessionId: result.sessionId,
      loadedSkills: resolveLoadedSkillVersions(extractLoadedSkillIds(result.events)),
      versions: {
        eve: eveReleaseManifest.eveVersion,
        release: eveReleaseManifest.releaseVersion,
        prompt: eveReleaseManifest.promptVersion,
        outputSchema: eveReleaseManifest.outputSchemaVersion,
      },
      ...metadata,
    }
  } catch (error) {
    if (error instanceof EveAuditRuntimeError) throw error
    throw new EveAuditRuntimeError("transport_failed", "Eve request failed.", { cause: error })
  }
}

export async function runEveAudit(options: EveAuditRuntimeOptions): Promise<EveAuditRuntimeResult> {
  const context = eveAuditContextSchema.parse(options.context)
  const result = await runEveStructuredTask({
    message: buildAuditMessage(context),
    outputSchema: eveAuditOutputSchema,
    purpose: "sitepitch_audit",
    requestId: options.requestId,
    signal: options.signal,
    host: options.host,
  })
  return {
    ...result,
    validation: validateEveAuditCandidate(context, result.output),
  }
}
