import { ConvexError, v } from "convex/values"

import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import {
  action,
  env,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import {
  normalizeReportDomainHostname,
  normalizeReportDomainTarget,
  reportDomainChallengeName,
  reportDomainChallengeValue,
  ReportDomainValidationError,
  type ReportDomainDnsVerification,
  verifyReportDomainDns,
} from "./lib/report_domain"
import { requireSupportAdmin } from "./lib/support"
import { findAppUser, getWorkspaceByOwner, getWorkspacePlan } from "./lib/workspace"

type DatabaseCtx = QueryCtx | MutationCtx

type DomainSetupDto = {
  domainId: Id<"reportDomains">
  hostname: string
  status: Doc<"reportDomains">["status"]
  failureCount: number
  verificationName: string
  verificationValue: string
  cnameName: string
  cnameTarget: string | null
  verifiedAt: number | null
  activatedAt: number | null
  lastCheckedAt: number | null
  updatedAt: number
  canUseCustomDomain: boolean
}

type DnsCheckPreparation = {
  domainId: Id<"reportDomains">
  workspaceId: Id<"workspaces">
  hostname: string
  verificationToken: string
  cnameTarget: string
}

function domainError(code: string, message: string): never {
  throw new ConvexError({ code, message })
}

function configuredCnameTarget(required = true): string | null {
  const raw = env.REPORT_DOMAIN_CNAME_TARGET?.trim()
  if (!raw) {
    if (required) {
      domainError(
        "DOMAIN_CONFIGURATION_ERROR",
        "REPORT_DOMAIN_CNAME_TARGET ist nicht konfiguriert.",
      )
    }
    return null
  }
  try {
    return normalizeReportDomainTarget(raw)
  } catch {
    domainError("DOMAIN_CONFIGURATION_ERROR", "REPORT_DOMAIN_CNAME_TARGET ist ungültig.")
  }
}

function createVerificationToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

async function requireAgencyWorkspace(ctx: DatabaseCtx) {
  const { user, workspace } = await requireDomainOwnerWorkspace(ctx)
  if (workspace.deletionRequestedAt) {
    domainError("WORKSPACE_NOT_READY", "Workspace is being deleted")
  }
  const plan = await getWorkspacePlan(ctx, workspace._id)
  if (plan !== "agency") {
    domainError("PLAN_UPGRADE_REQUIRED", "Custom Domains sind im Agency-Plan verfügbar.")
  }
  return { user, workspace, plan }
}

async function requireDomainOwnerWorkspace(ctx: DatabaseCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) domainError("UNAUTHENTICATED", "Not authenticated")
  const user = await findAppUser(ctx, identity.tokenIdentifier)
  if (!user) domainError("WORKSPACE_NOT_READY", "Workspace not ready")
  const workspace = await getWorkspaceByOwner(ctx, user._id)
  if (!workspace) domainError("WORKSPACE_NOT_READY", "Workspace not ready")
  return { user, workspace }
}

function toSetupDto(
  domain: Doc<"reportDomains">,
  cnameTarget: string | null,
  canUseCustomDomain: boolean,
): DomainSetupDto {
  return {
    domainId: domain._id,
    hostname: domain.hostname,
    status: domain.status,
    failureCount: domain.failureCount,
    verificationName: reportDomainChallengeName(domain.hostname),
    verificationValue: reportDomainChallengeValue(domain.verificationToken),
    cnameName: domain.hostname,
    cnameTarget,
    verifiedAt: domain.verifiedAt ?? null,
    activatedAt: domain.activatedAt ?? null,
    lastCheckedAt: domain.lastCheckedAt ?? null,
    updatedAt: domain.updatedAt,
    canUseCustomDomain,
  }
}

export const getMyReportDomain = query({
  args: {},
  handler: async (ctx): Promise<DomainSetupDto | null> => {
    const { workspace } = await requireDomainOwnerWorkspace(ctx)
    const [plan, domain] = await Promise.all([
      getWorkspacePlan(ctx, workspace._id),
      ctx.db
        .query("reportDomains")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspace._id))
        .unique(),
    ])
    return domain
      ? toSetupDto(domain, configuredCnameTarget(false), plan === "agency")
      : null
  },
})

export const connectReportDomain = mutation({
  args: { hostname: v.string() },
  handler: async (ctx, args): Promise<DomainSetupDto> => {
    const { workspace } = await requireAgencyWorkspace(ctx)
    const cnameTarget = configuredCnameTarget(true)!
    let hostname: string
    try {
      hostname = normalizeReportDomainHostname(args.hostname)
    } catch (error) {
      if (error instanceof ReportDomainValidationError) {
        domainError("INVALID_DOMAIN", error.message)
      }
      throw error
    }

    const [workspaceDomain, hostnameDomain] = await Promise.all([
      ctx.db
        .query("reportDomains")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspace._id))
        .unique(),
      ctx.db
        .query("reportDomains")
        .withIndex("by_hostname", (q) => q.eq("hostname", hostname))
        .unique(),
    ])

    if (hostnameDomain && hostnameDomain.workspaceId !== workspace._id) {
      domainError("DOMAIN_UNAVAILABLE", "Diese Report-Domain ist bereits verbunden.")
    }
    if (workspaceDomain?.hostname === hostname && workspaceDomain.status !== "disabled") {
      return toSetupDto(workspaceDomain, cnameTarget, true)
    }

    const now = Date.now()
    const verificationToken = createVerificationToken()
    if (workspaceDomain) {
      await ctx.db.patch(workspaceDomain._id, {
        hostname,
        verificationToken,
        status: "pending_dns",
        failureCount: 0,
        verifiedAt: undefined,
        activatedAt: undefined,
        lastCheckedAt: undefined,
        updatedAt: now,
      })
      const updated = await ctx.db.get(workspaceDomain._id)
      if (!updated) domainError("NOT_FOUND", "Report-Domain nicht gefunden.")
      return toSetupDto(updated, cnameTarget, true)
    }

    const domainId = await ctx.db.insert("reportDomains", {
      workspaceId: workspace._id,
      hostname,
      verificationToken,
      status: "pending_dns",
      failureCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    const created = await ctx.db.get(domainId)
    if (!created) domainError("NOT_FOUND", "Report-Domain nicht gefunden.")
    return toSetupDto(created, cnameTarget, true)
  },
})

export const disableReportDomain = mutation({
  args: {},
  handler: async (ctx): Promise<DomainSetupDto | null> => {
    const { workspace } = await requireDomainOwnerWorkspace(ctx)
    const [plan, domain] = await Promise.all([
      getWorkspacePlan(ctx, workspace._id),
      ctx.db
        .query("reportDomains")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspace._id))
        .unique(),
    ])
    if (!domain) return null

    await ctx.db.patch(domain._id, {
      status: "disabled",
      failureCount: 0,
      activatedAt: undefined,
      updatedAt: Date.now(),
    })
    const updated = await ctx.db.get(domain._id)
    return updated
      ? toSetupDto(updated, configuredCnameTarget(false), plan === "agency")
      : null
  },
})

export const _prepareDnsCheck = internalQuery({
  args: {},
  handler: async (ctx): Promise<DnsCheckPreparation> => {
    const { workspace } = await requireAgencyWorkspace(ctx)
    const domain = await ctx.db
      .query("reportDomains")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspace._id))
      .unique()
    if (!domain || domain.status === "disabled") {
      domainError("DOMAIN_NOT_CONNECTED", "Keine aktive Domain-Verbindung gefunden.")
    }
    return {
      domainId: domain._id,
      workspaceId: workspace._id,
      hostname: domain.hostname,
      verificationToken: domain.verificationToken,
      cnameTarget: configuredCnameTarget(true)!,
    }
  },
})

const dnsErrorValidator = v.union(
  v.literal("TXT_MISMATCH"),
  v.literal("CNAME_MISMATCH"),
  v.literal("DNS_LOOKUP_FAILED"),
  v.null(),
)

export const _applyDnsCheck = internalMutation({
  args: {
    domainId: v.id("reportDomains"),
    workspaceId: v.id("workspaces"),
    hostname: v.string(),
    verificationToken: v.string(),
    result: v.object({
      ok: v.boolean(),
      txtVerified: v.boolean(),
      cnameVerified: v.boolean(),
      errorCode: dnsErrorValidator,
    }),
  },
  handler: async (ctx, args): Promise<DomainSetupDto> => {
    const domain = await ctx.db.get(args.domainId)
    if (
      !domain ||
      domain.workspaceId !== args.workspaceId ||
      domain.hostname !== args.hostname ||
      domain.verificationToken !== args.verificationToken ||
      domain.status === "disabled"
    ) {
      domainError("DOMAIN_STATE_CHANGED", "Die Domain-Konfiguration wurde zwischenzeitlich geändert.")
    }
    const plan = await getWorkspacePlan(ctx, args.workspaceId)
    if (plan !== "agency") {
      domainError("PLAN_UPGRADE_REQUIRED", "Custom Domains sind im Agency-Plan verfügbar.")
    }

    const now = Date.now()
    if (args.result.ok) {
      await ctx.db.patch(domain._id, {
        status: domain.status === "active" ? "active" : "pending_host",
        failureCount: 0,
        verifiedAt: now,
        lastCheckedAt: now,
        updatedAt: now,
      })
    } else {
      const failureCount = domain.failureCount + 1
      const status =
        domain.status === "active"
          ? failureCount >= 3
            ? "suspended"
            : "active"
          : domain.status === "suspended"
            ? "suspended"
            : args.result.errorCode === "DNS_LOOKUP_FAILED"
              ? "error"
              : "pending_dns"
      await ctx.db.patch(domain._id, {
        status,
        failureCount,
        lastCheckedAt: now,
        updatedAt: now,
      })
    }

    const updated = await ctx.db.get(domain._id)
    if (!updated) domainError("NOT_FOUND", "Report-Domain nicht gefunden.")
    return toSetupDto(updated, configuredCnameTarget(true), true)
  },
})

export const checkReportDomainDns = action({
  args: {},
  handler: async (ctx): Promise<DomainSetupDto & { verification: ReportDomainDnsVerification }> => {
    const prepared: DnsCheckPreparation = await ctx.runQuery(
      internal.report_domains._prepareDnsCheck,
      {},
    )
    const verification = await verifyReportDomainDns({
      hostname: prepared.hostname,
      verificationToken: prepared.verificationToken,
      cnameTarget: prepared.cnameTarget,
    })
    const domain: DomainSetupDto = await ctx.runMutation(
      internal.report_domains._applyDnsCheck,
      {
        domainId: prepared.domainId,
        workspaceId: prepared.workspaceId,
        hostname: prepared.hostname,
        verificationToken: prepared.verificationToken,
        result: verification,
      },
    )
    return { ...domain, verification }
  },
})

export const _listDomainsForRecheck = internalQuery({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("reportDomains")
      .withIndex("by_status_and_updatedAt", (q) => q.eq("status", "active"))
      .take(50)
    const suspended = await ctx.db
      .query("reportDomains")
      .withIndex("by_status_and_updatedAt", (q) => q.eq("status", "suspended"))
      .take(50)
    return [...active, ...suspended].map((domain) => ({
      domainId: domain._id,
      workspaceId: domain.workspaceId,
      hostname: domain.hostname,
      verificationToken: domain.verificationToken,
    }))
  },
})

export const recheckReportDomains = internalAction({
  args: {},
  handler: async (ctx): Promise<number> => {
    const cnameTarget = configuredCnameTarget(false)
    if (!cnameTarget) return 0
    const domains = await ctx.runQuery(internal.report_domains._listDomainsForRecheck, {})
    let checked = 0
    for (const domain of domains) {
      const result = await verifyReportDomainDns({
        hostname: domain.hostname,
        verificationToken: domain.verificationToken,
        cnameTarget,
      })
      try {
        await ctx.runMutation(internal.report_domains._applyDnsCheck, { ...domain, result })
        checked += 1
      } catch {
        // Domain or plan changed while the check was running.
      }
    }
    return checked
  },
})

export const activateReportDomain = mutation({
  args: { domainId: v.id("reportDomains") },
  handler: async (ctx, args): Promise<DomainSetupDto> => {
    await requireSupportAdmin(ctx)
    const domain = await ctx.db.get(args.domainId)
    if (!domain) domainError("NOT_FOUND", "Report-Domain nicht gefunden.")
    if (
      (domain.status !== "verified" && domain.status !== "pending_host") ||
      !domain.verifiedAt
    ) {
      domainError("DOMAIN_NOT_VERIFIED", "Die DNS-Verifizierung ist noch nicht abgeschlossen.")
    }
    const workspace = await ctx.db.get(domain.workspaceId)
    if (!workspace || workspace.deletionRequestedAt) {
      domainError("WORKSPACE_NOT_READY", "Workspace is unavailable")
    }
    const plan = await getWorkspacePlan(ctx, domain.workspaceId)
    if (plan !== "agency") {
      domainError("PLAN_UPGRADE_REQUIRED", "Der Workspace hat keinen Agency-Plan.")
    }

    const now = Date.now()
    await ctx.db.patch(domain._id, {
      status: "active",
      failureCount: 0,
      activatedAt: now,
      updatedAt: now,
    })
    const updated = await ctx.db.get(domain._id)
    if (!updated) domainError("NOT_FOUND", "Report-Domain nicht gefunden.")
    return toSetupDto(updated, configuredCnameTarget(true), true)
  },
})
