import { ConvexError, v } from "convex/values"

import type { Id } from "./_generated/dataModel"
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { auditRateLimiter } from "./lib/audit_rate_limit"
import { resolvePublicReportAccess } from "./lib/report_access"
import { reportFeaturePolicy, requireReportCapability } from "./lib/report_policy"
import { queueReportPdfArtifact } from "./lib/report_pdf_queue"
import { getWorkspacePlan, requireOwnerWorkspace } from "./lib/workspace"
import { ensureReportSettingsSnapshot } from "./report_settings"
import { sanitizeReportFilename } from "../src/lib/report-document"

async function requireOwnedReport(ctx: QueryCtx | MutationCtx, auditId: Id<"audits">) {
  const { workspace } = await requireOwnerWorkspace(ctx)
  const audit = await ctx.db.get(auditId)
  if (!audit || audit.workspaceId !== workspace._id || audit.deletionRequestedAt) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Report not found" })
  }
  return { workspace, audit }
}

export const requestReportPdf = mutation({
  args: { auditId: v.id("audits") },
  handler: async (ctx, args) => {
    const { workspace, audit } = await requireOwnedReport(ctx, args.auditId)
    if (audit.status !== "completed") {
      throw new ConvexError({ code: "REPORT_NOT_READY", message: "Report is not completed" })
    }
    const plan = await getWorkspacePlan(ctx, workspace._id)
    requireReportCapability(reportFeaturePolicy(plan), "pdfExport")
    const limit = await auditRateLimiter.limit(ctx, "pdfExportsByWorkspace", {
      key: `workspace:${workspace._id}:report-pdf`,
    })
    if (!limit.ok) {
      throw new ConvexError({ code: "RATE_LIMITED", message: "Please retry the PDF export later" })
    }

    const settings = await ensureReportSettingsSnapshot(ctx, audit)
    const currentArtifact = await ctx.db
      .query("reportPdfArtifacts")
      .withIndex("by_auditId_and_settingsVersion", (q) =>
        q.eq("auditId", audit._id).eq("settingsVersion", settings.settingsVersion),
      )
      .order("desc")
      .first()
    if (
      currentArtifact &&
      (currentArtifact.status === "queued" ||
        currentArtifact.status === "generating" ||
        currentArtifact.status === "ready")
    ) {
      return { artifactId: currentArtifact._id, status: currentArtifact.status }
    }
    const prior = await ctx.db
      .query("reportPdfArtifacts")
      .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
      .take(50)
    const now = Date.now()
    for (const artifact of prior) {
      if (artifact.status !== "stale") {
        await ctx.db.patch(artifact._id, { status: "stale", updatedAt: now })
      }
    }
    const artifact = await queueReportPdfArtifact(ctx, {
      workspaceId: workspace._id,
      auditId: audit._id,
      settingsVersion: settings.settingsVersion,
    })
    return { artifactId: artifact._id, status: artifact.status }
  },
})

export const getMyReportPdf = query({
  args: { auditId: v.id("audits") },
  handler: async (ctx, args) => {
    const { workspace, audit } = await requireOwnedReport(ctx, args.auditId)
    requireReportCapability(
      reportFeaturePolicy(await getWorkspacePlan(ctx, workspace._id)),
      "pdfExport",
    )
    const artifact = await ctx.db
      .query("reportPdfArtifacts")
      .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
      .order("desc")
      .first()
    return artifact
      ? {
          status: artifact.status,
          settingsVersion: artifact.settingsVersion,
          downloadUrl: artifact.status === "ready" && artifact.storageId
            ? await ctx.storage.getUrl(artifact.storageId)
            : null,
          filename: sanitizeReportFilename(audit.domain, audit.completedAt ?? null),
          errorCode: artifact.errorCode ?? null,
        }
      : null
  },
})

export const getPdfJobContext = internalQuery({
  args: { artifactId: v.id("reportPdfArtifacts") },
  handler: async (ctx, args) => {
    const artifact = await ctx.db.get(args.artifactId)
    if (!artifact || (artifact.status !== "queued" && artifact.status !== "generating")) return null
    return artifact
  },
})

export const markPdfGenerating = internalMutation({
  args: { artifactId: v.id("reportPdfArtifacts") },
  handler: async (ctx, args) => {
    const artifact = await ctx.db.get(args.artifactId)
    if (!artifact || artifact.status !== "queued") return false
    await ctx.db.patch(artifact._id, {
      status: "generating",
      startedAt: Date.now(),
      updatedAt: Date.now(),
      errorCode: undefined,
    })
    return true
  },
})

export const createPdfUploadUrl = internalMutation({
  args: { artifactId: v.id("reportPdfArtifacts") },
  handler: async (ctx, args) => {
    const artifact = await ctx.db.get(args.artifactId)
    if (!artifact || artifact.status !== "generating") return null
    return await ctx.storage.generateUploadUrl()
  },
})

export const completePdfArtifact = internalMutation({
  args: {
    artifactId: v.id("reportPdfArtifacts"),
    storageId: v.id("_storage"),
    size: v.number(),
    checksum: v.string(),
  },
  handler: async (ctx, args) => {
    const artifact = await ctx.db.get(args.artifactId)
    if (!artifact || artifact.status !== "generating") {
      await ctx.storage.delete(args.storageId)
      return false
    }
    if (artifact.storageId && artifact.storageId !== args.storageId) {
      await ctx.storage.delete(artifact.storageId)
    }
    const now = Date.now()
    await ctx.db.patch(artifact._id, {
      status: "ready",
      storageId: args.storageId,
      size: args.size,
      checksum: args.checksum,
      completedAt: now,
      updatedAt: now,
      errorCode: undefined,
    })
    return true
  },
})

export const failPdfArtifact = internalMutation({
  args: {
    artifactId: v.id("reportPdfArtifacts"),
    errorCode: v.string(),
  },
  handler: async (ctx, args) => {
    const artifact = await ctx.db.get(args.artifactId)
    if (!artifact || artifact.status === "ready" || artifact.status === "stale") return false
    await ctx.db.patch(artifact._id, {
      status: "failed",
      errorCode: args.errorCode.slice(0, 80),
      updatedAt: Date.now(),
    })
    return true
  },
})

export const getPublicPdfDownloadContext = internalQuery({
  args: {
    slug: v.string(),
    host: v.optional(v.string()),
    grantToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await resolvePublicReportAccess(ctx, args)
    if (access.status !== "available") return null
    if (!reportFeaturePolicy(access.plan).pdfExport) return null
    const artifact = await ctx.db
      .query("reportPdfArtifacts")
      .withIndex("by_auditId", (q) => q.eq("auditId", access.audit._id))
      .order("desc")
      .filter((q) => q.eq(q.field("status"), "ready"))
      .first()
    if (!artifact?.storageId) return null
    const downloadUrl = await ctx.storage.getUrl(artifact.storageId)
    if (!downloadUrl) return null
    return {
      downloadUrl,
      filename: sanitizeReportFilename(access.audit.domain, access.audit.completedAt ?? null),
    }
  },
})
