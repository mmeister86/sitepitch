export type LeadStatus =
  | "new"
  | "audited"
  | "contacted"
  | "follow_up"
  | "interested"
  | "won"
  | "lost"

export type AuditStatus =
  | "draft"
  | "queued"
  | "validating_url"
  | "fetching_html"
  | "extracting_content"
  | "taking_screenshots"
  | "running_performance_checks"
  | "fetching_business_data"
  | "running_deterministic_checks"
  | "calculating_scores"
  | "generating_findings"
  | "generating_outreach"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export type AuditType = "standard" | "local" | "quick"

export type OutreachStatus = "not_started" | "copied" | "sent"

export type FindingSeverity = "low" | "medium" | "high"

export type FindingCategory =
  | "conversion"
  | "seo"
  | "local_seo"
  | "performance"
  | "mobile"
  | "trust"
  | "technical"

export type CategoryKey =
  | "conversion"
  | "seoBasics"
  | "localSeo"
  | "performance"
  | "mobileUx"
  | "trust"

export interface CategoryScore {
  key: CategoryKey
  label: string
  score: number
  weight: number
}

export interface Finding {
  id: string
  category: FindingCategory
  severity: FindingSeverity
  title: string
  evidence: string
  explanation: string
  recommendation: string
  salesAngle: string
}

export interface CheckResult {
  key: string
  label: string
  status: "passed" | "failed" | "warning" | "not_applicable"
  category: string
}

export interface OutreachDraft {
  type: "email" | "linkedin" | "phone_note"
  label: string
  subject?: string
  body: string
}

export interface ReportEngagement {
  views: number
  reopened: boolean
  ctaClicks: number
  pdfDownloads: number
  lastViewedAt?: string
}

export interface AuditHistoryEntry {
  overallScore: number
  label: string
  at: string
}

export interface Audit {
  id: string
  businessName: string
  url: string
  domain: string
  city: string
  industry: string
  status: AuditStatus
  progress: number
  overallScore?: number
  categoryScores: CategoryScore[]
  summary: {
    short: string
    strengths: string[]
    weaknesses: string[]
    topOpportunities: string[]
  }
  findings: Finding[]
  checks: CheckResult[]
  outreach: OutreachDraft[]
  outreachStatus: OutreachStatus
  leadStatus: LeadStatus
  campaignId?: string
  engagement: ReportEngagement
  history?: AuditHistoryEntry[]
  screenshotDesktop?: string
  screenshotMobile?: string
  isPublic: boolean
  publicSlug: string
  createdAt: string
  completedAt?: string
  errorMessage?: string
}

export interface Lead {
  id: string
  businessName: string
  websiteUrl?: string
  category: string
  city: string
  phone?: string
  address?: string
  status: LeadStatus
  campaignId?: string
  auditId?: string
  score?: number
  followUpAt?: string
  lastContactedAt?: string
  note?: string
  createdAt: string
}

export interface Campaign {
  id: string
  name: string
  targetIndustry: string
  targetCity: string
  offerType: "relaunch" | "maintenance" | "seo" | "conversion" | "performance"
  language: "de" | "en"
  status: "draft" | "active" | "paused" | "archived"
  leadCount: number
  auditCount: number
  outreachCopied: number
  reportViews: number
  won: number
  lost: number
  createdAt: string
}

export interface Activity {
  id: string
  type:
    | "report_opened"
    | "outreach_copied"
    | "public_link_copied"
    | "audit_completed"
    | "status_changed"
    | "follow_up_scheduled"
    | "note_added"
  business: string
  detail: string
  at: string
}

export interface Workspace {
  name: string
  plan: "starter" | "pro" | "agency" | "scale"
  accentColor: string
  website: string
  contactEmail: string
  ctaText: string
  ctaUrl: string
  language: "de" | "en"
  showPoweredBy: boolean
  monthlyCredits: number
  usedCredits: number
  seats: { name: string; email: string; role: string; initials: string }[]
  templates: OutreachTemplate[]
}

export interface OutreachTemplate {
  id: string
  name: string
  channel: "email" | "linkedin" | "phone_note"
  tone: "Freundlich" | "Direkt" | "Beratend"
  usageCount: number
  updatedAt: string
}
