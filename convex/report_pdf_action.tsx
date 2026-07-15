"use node"

import { createHash } from "node:crypto"
import { v } from "convex/values"

import { internal } from "./_generated/api"
import { internalAction } from "./_generated/server"
import { renderBrandedReportPdf } from "./report_pdf_document"

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

async function inlineImage(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  const response = await fetch(url)
  if (!response.ok) return null
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase()
  if (contentType !== "image/png" && contentType !== "image/jpeg") return null
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength > MAX_IMAGE_BYTES) return null
  return `data:${contentType};base64,${buffer.toString("base64")}`
}

export const processReportPdf = internalAction({
  args: { artifactId: v.id("reportPdfArtifacts") },
  handler: async (ctx, args): Promise<void> => {
    const job = await ctx.runQuery(internal.report_pdf.getPdfJobContext, args)
    if (!job) return
    const started = await ctx.runMutation(internal.report_pdf.markPdfGenerating, args)
    if (!started) return
    try {
      const report = await ctx.runQuery(internal.reports.getPdfReportModel, {
        auditId: job.auditId,
      })
      if (!report) throw new Error("REPORT_UNAVAILABLE")
      const [logoUrl, desktop, mobile] = await Promise.all([
        inlineImage(report.branding.logoUrl),
        inlineImage(report.screenshots.desktop),
        inlineImage(report.screenshots.mobile),
      ])
      const pdf = await renderBrandedReportPdf({
        ...report,
        branding: { ...report.branding, logoUrl: logoUrl ?? undefined },
        screenshots: { desktop, mobile },
      })
      const uploadUrl = await ctx.runMutation(internal.report_pdf.createPdfUploadUrl, args)
      if (!uploadUrl) throw new Error("ARTIFACT_STALE")
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "content-type": "application/pdf" },
        body: pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer,
      })
      if (!uploadResponse.ok) throw new Error("UPLOAD_FAILED")
      const result = await uploadResponse.json() as { storageId?: string }
      if (!result.storageId) throw new Error("UPLOAD_FAILED")
      await ctx.runMutation(internal.report_pdf.completePdfArtifact, {
        artifactId: args.artifactId,
        storageId: result.storageId as any,
        size: pdf.byteLength,
        checksum: createHash("sha256").update(pdf).digest("hex"),
      })
    } catch (error) {
      const errorCode = error instanceof Error && /^[A-Z_]+$/.test(error.message)
        ? error.message
        : "PDF_GENERATION_FAILED"
      await ctx.runMutation(internal.report_pdf.failPdfArtifact, {
        artifactId: args.artifactId,
        errorCode,
      })
    }
  },
})
