import type { Doc } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import { settleBatchAuditItem } from "../batch_audits"
import { recordIntegrationEvent } from "../integrations"
import { releaseWorkspaceCreditReservation } from "./credits"

export async function settleAuditFailureSideEffects(
  ctx: MutationCtx,
  audit: Doc<"audits">,
  args: { errorCode: string; errorMessage: string; occurredAt: number },
) {
  await releaseWorkspaceCreditReservation(
    ctx,
    audit.workspaceId,
    audit._id,
    audit.idempotencyKey,
    args.errorCode || "audit_failed",
  )

  const existingFailedEvent = await ctx.db
    .query("usageEvents")
    .withIndex("by_auditId_and_event", (q) =>
      q.eq("auditId", audit._id).eq("event", "audit_failed"),
    )
    .first()
  if (!existingFailedEvent) {
    await ctx.db.insert("usageEvents", {
      workspaceId: audit.workspaceId,
      auditId: audit._id,
      event: "audit_failed",
      idempotencyKey: `audit_failed:${audit._id}`,
      metadata: { code: args.errorCode || "AUDIT_FAILED" },
      createdAt: args.occurredAt,
    })
  }

  await recordIntegrationEvent(ctx, {
    workspaceId: audit.workspaceId,
    auditId: audit._id,
    event: "audit_failed",
    idempotencyKey: `webhook:audit_failed:${audit._id}`,
    occurredAt: args.occurredAt,
    domain: audit.domain,
  })

  if (audit.batchAuditItemId) {
    await settleBatchAuditItem(ctx, {
      auditId: audit._id,
      outcome: "failed",
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
    })
  }
}
