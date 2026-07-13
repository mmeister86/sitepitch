import { ConvexError, v } from "convex/values"

const MAX_NOTE_LENGTH = 2000
const MAX_OUTCOME_REASON_LENGTH = 500

export type CampaignOfferType =
  | "relaunch"
  | "maintenance"
  | "seo"
  | "conversion"
  | "performance"
  | "custom"

export type CampaignStatus = "draft" | "active" | "paused" | "archived"

export type CampaignLeadStatus =
  | "new"
  | "audited"
  | "contacted"
  | "follow_up"
  | "interested"
  | "won"
  | "lost"

export type LeadActivityType =
  | "lead_added"
  | "status_changed"
  | "note_updated"
  | "follow_up_scheduled"
  | "follow_up_cleared"
  | "campaign_status_changed"

export function validateCampaignName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length < 3) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: "Der Kampagnenname braucht mindestens 3 Zeichen." })
  }
  if (trimmed.length > 80) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: "Der Kampagnenname darf maximal 80 Zeichen lang sein." })
  }
  return trimmed
}

export function validateCampaignSegment(value: string, label: string): string {
  const trimmed = value.trim()
  if (trimmed.length < 2) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: `${label} braucht mindestens 2 Zeichen.` })
  }
  if (trimmed.length > 80) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: `${label} darf maximal 80 Zeichen lang sein.` })
  }
  return trimmed
}

export function validateNote(note: string): string | undefined {
  const trimmed = note.trim()
  if (trimmed.length === 0) return undefined
  if (trimmed.length > MAX_NOTE_LENGTH) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: `Notizen dürfen maximal ${MAX_NOTE_LENGTH} Zeichen lang sein.` })
  }
  return trimmed
}

export function validateOutcomeReason(reason?: string): string | undefined {
  const trimmed = reason?.trim()
  if (!trimmed) return undefined
  if (trimmed.length > MAX_OUTCOME_REASON_LENGTH) {
    throw new ConvexError({
      code: "VALIDATION_ERROR",
      message: `Ergebnisgründe dürfen maximal ${MAX_OUTCOME_REASON_LENGTH} Zeichen lang sein.`,
    })
  }
  return trimmed
}

export function isTerminalStatus(status: CampaignLeadStatus): boolean {
  return status === "won" || status === "lost"
}

export function validateStatusTransition(current: CampaignStatus, next: CampaignStatus): void {
  if (current === "archived") {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: "Archivierte Kampagnen können nicht mehr verändert werden." })
  }

  const allowed: Record<CampaignStatus, CampaignStatus[]> = {
    draft: ["active", "archived"],
    active: ["paused", "archived"],
    paused: ["active", "archived"],
    archived: [],
  }

  if (!allowed[current].includes(next)) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: "Dieser Statuswechsel ist nicht erlaubt." })
  }
}

export async function loadCampaignForMutation(
  ctx: { db: any },
  campaignId: string,
  workspaceId: string,
): Promise<any> {
  const campaign = await ctx.db.get(campaignId)
  if (!campaign || campaign.workspaceId !== workspaceId) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Kampagne nicht gefunden." })
  }
  return campaign
}

export async function loadCampaignLeadForMutation(
  ctx: { db: any },
  campaignLeadId: string,
  workspaceId: string,
): Promise<any> {
  const campaignLead = await ctx.db.get(campaignLeadId)
  if (!campaignLead || campaignLead.workspaceId !== workspaceId) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Kampagnen-Lead nicht gefunden." })
  }
  return campaignLead
}

export async function loadCampaignLeadByIds(
  ctx: { db: any },
  campaignId: string,
  leadId: string,
): Promise<any | null> {
  return await ctx.db
    .query("campaignLeads")
    .withIndex("by_campaignId_and_leadId", (q: any) => q.eq("campaignId", campaignId).eq("leadId", leadId))
    .unique()
}

export async function attachLeadToCampaign(
  ctx: { db: any },
  args: {
    workspaceId: string
    campaignId: string
    leadId: string
    userId: string
  },
): Promise<{ campaignLeadId: string; alreadyAttached: boolean }> {
  const existing = await loadCampaignLeadByIds(ctx, args.campaignId, args.leadId)
  if (existing) {
    return { campaignLeadId: existing._id, alreadyAttached: true }
  }

  const now = Date.now()
  const campaignLeadId = await ctx.db.insert("campaignLeads", {
    workspaceId: args.workspaceId,
    campaignId: args.campaignId,
    leadId: args.leadId,
    status: "new",
    createdAt: now,
    updatedAt: now,
  })

  await ctx.db.insert("leadActivities", {
    workspaceId: args.workspaceId,
    campaignId: args.campaignId,
    campaignLeadId,
    leadId: args.leadId,
    type: "lead_added",
    message: "Lead zur Kampagne hinzugefügt",
    createdByUserId: args.userId,
    createdAt: now,
  })

  return { campaignLeadId, alreadyAttached: false }
}

export async function logLeadActivity(
  ctx: { db: any },
  args: {
    workspaceId: string
    campaignId: string
    campaignLeadId?: string
    leadId?: string
    type: LeadActivityType
    message: string
    userId: string
  },
): Promise<void> {
  await ctx.db.insert("leadActivities", {
    workspaceId: args.workspaceId,
    campaignId: args.campaignId,
    campaignLeadId: args.campaignLeadId,
    leadId: args.leadId,
    type: args.type,
    message: args.message,
    createdByUserId: args.userId,
    createdAt: Date.now(),
  })
}

export function campaignStatusLabel(status: CampaignStatus): string {
  switch (status) {
    case "draft":
      return "Entwurf"
    case "active":
      return "Aktiv"
    case "paused":
      return "Pausiert"
    case "archived":
      return "Archiviert"
  }
}

export function campaignLeadStatusLabel(status: CampaignLeadStatus): string {
  switch (status) {
    case "new":
      return "Neu"
    case "audited":
      return "Auditiert"
    case "contacted":
      return "Kontaktiert"
    case "follow_up":
      return "Follow-up"
    case "interested":
      return "Interessiert"
    case "won":
      return "Gewonnen"
    case "lost":
      return "Verloren"
  }
}

export function offerTypeLabel(offerType: CampaignOfferType): string {
  switch (offerType) {
    case "relaunch":
      return "Website-Relaunch"
    case "maintenance":
      return "Website-Pflege"
    case "seo":
      return "SEO-Optimierung"
    case "conversion":
      return "Conversion-Optimierung"
    case "performance":
      return "Performance-Optimierung"
    case "custom":
      return "Individuelles Angebot"
  }
}
