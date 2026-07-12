import { Migrations } from "@convex-dev/migrations"

import { components } from "./_generated/api.js"
import type { DataModel } from "./_generated/dataModel.js"
import { internalMutation } from "./_generated/server.js"
import schema from "./schema.js"
import { resolveReportCtaSnapshotValues } from "./lib/report_cta.js"

const migrations = new Migrations<DataModel, typeof schema>(components.migrations, {
  internalMutation,
  schema,
  defaultBatchSize: 50,
})

/** Deploy-1 migration: legacy rows remain schema-valid until this has completed. */
export const canonicalizeLeadStatuses = migrations.define({
  table: "leads",
  migrateOne: (_ctx, lead) => {
    if (lead.status !== "not_interested") return
    return { status: "lost" as const, updatedAt: Date.now() }
  },
})

/** Backfills the server-owned activation milestone at the workspace creation time. */
export const backfillSignedUpEvents = migrations.define({
  table: "workspaces",
  migrateOne: async (ctx, workspace) => {
    const idempotencyKey = `signed_up:${workspace._id}`
    const existing = await ctx.db
      .query("usageEvents")
      .withIndex("by_workspaceId_and_idempotencyKey", (q) =>
        q.eq("workspaceId", workspace._id).eq("idempotencyKey", idempotencyKey),
      )
      .unique()
    if (existing) return
    await ctx.db.insert("usageEvents", {
      workspaceId: workspace._id,
      userId: workspace.ownerUserId,
      event: "signed_up",
      idempotencyKey,
      createdAt: workspace.createdAt,
    })
  },
})

/**
 * Backfills stable CTA snapshots for legacy public reports.
 * Define and deploy this migration, then run it explicitly via the Convex CLI.
 */
export const backfillPublicReportCtaSnapshots = migrations.define({
  table: "audits",
  migrateOne: async (ctx, audit) => {
    if (!audit.isPublic || audit.reportCtaSnapshottedAt !== undefined) return
    const workspace = await ctx.db.get(audit.workspaceId)
    if (!workspace) return
    const lead = audit.leadId ? await ctx.db.get(audit.leadId) : null
    const ownedLead = lead?.workspaceId === workspace._id ? lead : null
    const snapshot = resolveReportCtaSnapshotValues(workspace, ownedLead)
    const now = Date.now()
    return {
      reportCtaText: snapshot.text,
      reportCtaUrl: snapshot.url,
      reportCtaSnapshottedAt: now,
      updatedAt: now,
    }
  },
})
