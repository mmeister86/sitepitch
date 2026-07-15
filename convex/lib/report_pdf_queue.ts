import { internal } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import { pdfWorkpool } from "../workpools"

export async function queueReportPdfArtifact(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">
    auditId: Id<"audits">
    settingsVersion: number
  },
) {
  const existing = await ctx.db
    .query("reportPdfArtifacts")
    .withIndex("by_auditId_and_settingsVersion", (q) =>
      q.eq("auditId", args.auditId).eq("settingsVersion", args.settingsVersion),
    )
    .order("desc")
    .first()
  if (existing && ["queued", "generating", "ready"].includes(existing.status)) {
    return existing
  }
  const now = Date.now()
  const artifactId = await ctx.db.insert("reportPdfArtifacts", {
    workspaceId: args.workspaceId,
    auditId: args.auditId,
    settingsVersion: args.settingsVersion,
    status: "queued",
    createdAt: now,
    updatedAt: now,
  })
  await pdfWorkpool.enqueueAction(
    ctx,
    internal.report_pdf_action.processReportPdf,
    { artifactId },
    { retry: false },
  )
  const artifact = await ctx.db.get(artifactId)
  if (!artifact) throw new Error("PDF artifact unavailable")
  return artifact
}
