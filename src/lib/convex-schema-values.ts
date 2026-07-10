import { v } from "convex/values"

export const reportLanguageValidator = v.union(v.literal("de"), v.literal("en"))

export const workspaceMemberRoleValidator = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("member"),
)

export const subscriptionProviderValidator = v.union(v.literal("lemonsqueezy"), v.literal("stripe"))

export const subscriptionPlanValidator = v.union(
  v.literal("free"),
  v.literal("starter"),
  v.literal("pro"),
  v.literal("agency"),
)

export const subscriptionStatusValidator = v.union(
  v.literal("active"),
  v.literal("trialing"),
  v.literal("past_due"),
  v.literal("cancelled"),
  v.literal("expired"),
)

export const auditTypeValidator = v.union(
  v.literal("standard"),
  v.literal("local"),
  v.literal("quick"),
)

export const creditLedgerTypeValidator = v.union(
  v.literal("grant"),
  v.literal("reserve"),
  v.literal("consume"),
  v.literal("refund"),
  v.literal("expire"),
  v.literal("manual_adjustment"),
)

export const leadSourceProviderValidator = v.union(
  v.literal("manual"),
  v.literal("rapidapi"),
  v.literal("google_places"),
  v.literal("serpapi"),
  v.literal("dataforseo"),
  v.literal("apify"),
)

export const campaignOfferTypeValidator = v.union(
  v.literal("relaunch"),
  v.literal("maintenance"),
  v.literal("seo"),
  v.literal("conversion"),
  v.literal("performance"),
  v.literal("custom"),
)

export const campaignStatusValidator = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("paused"),
  v.literal("archived"),
)

export const campaignLeadStatusValidator = v.union(
  v.literal("new"),
  v.literal("audited"),
  v.literal("contacted"),
  v.literal("follow_up"),
  v.literal("interested"),
  v.literal("won"),
  v.literal("lost"),
)

export const leadActivityTypeValidator = v.union(
  v.literal("lead_added"),
  v.literal("status_changed"),
  v.literal("note_updated"),
  v.literal("follow_up_scheduled"),
  v.literal("follow_up_cleared"),
  v.literal("campaign_status_changed"),
)

export const leadStatusValidator = v.union(
  v.literal("new"),
  v.literal("audited"),
  v.literal("contacted"),
  v.literal("interested"),
  v.literal("not_interested"),
  v.literal("won"),
  v.literal("lost"),
)

export const auditStatusValidator = v.union(
  v.literal("draft"),
  v.literal("queued"),
  v.literal("validating_url"),
  v.literal("fetching_html"),
  v.literal("extracting_content"),
  v.literal("taking_screenshots"),
  v.literal("running_performance_checks"),
  v.literal("fetching_business_data"),
  v.literal("running_deterministic_checks"),
  v.literal("calculating_scores"),
  v.literal("generating_findings"),
  v.literal("generating_outreach"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled"),
)

export const auditPipelineStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
)

export const auditCheckCategoryValidator = v.union(
  v.literal("technical"),
  v.literal("seo"),
  v.literal("local_seo"),
  v.literal("conversion"),
  v.literal("mobile"),
  v.literal("trust"),
  v.literal("performance"),
)

export const auditCheckStatusValidator = v.union(
  v.literal("passed"),
  v.literal("failed"),
  v.literal("warning"),
  v.literal("not_applicable"),
  v.literal("unknown"),
)

export const auditFindingCategoryValidator = v.union(
  v.literal("conversion"),
  v.literal("seo"),
  v.literal("local_seo"),
  v.literal("performance"),
  v.literal("mobile"),
  v.literal("trust"),
  v.literal("technical"),
)

export const auditFindingSeverityValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
)

export const auditAssetTypeValidator = v.union(
  v.literal("desktop_screenshot"),
  v.literal("mobile_screenshot"),
  v.literal("fullpage_screenshot"),
  v.literal("pdf"),
)

export const auditAssetStorageProviderValidator = v.union(
  v.literal("convex"),
  v.literal("r2"),
  v.literal("external"),
)

export const auditPerformanceStrategyValidator = v.union(v.literal("mobile"), v.literal("desktop"))

export const outreachDraftTypeValidator = v.union(
  v.literal("email"),
  v.literal("linkedin"),
  v.literal("contact_form"),
  v.literal("phone_note"),
  v.literal("follow_up"),
)

export const usageEventTypeValidator = v.union(
  v.literal("audit_started"),
  v.literal("audit_completed"),
  v.literal("audit_failed"),
  v.literal("lead_search_started"),
  v.literal("report_viewed"),
  v.literal("report_cta_clicked"),
  v.literal("outreach_copied"),
  v.literal("public_link_copied"),
  v.literal("pdf_exported"),
  v.literal("credits_consumed"),
  v.literal("upgrade_clicked"),
)

export const providerCallProviderValidator = v.union(
  v.literal("direct_html"),
  v.literal("jina"),
  v.literal("firecrawl"),
  v.literal("screenshotone"),
  v.literal("pagespeed"),
  v.literal("local_business_data"),
  v.literal("google_places"),
  v.literal("openai"),
  v.literal("anthropic"),
  v.literal("other"),
)

export const providerCallStatusValidator = v.union(
  v.literal("queued"),
  v.literal("started"),
  v.literal("completed"),
  v.literal("failed"),
)

export const auditAgentRunProviderValidator = v.union(
  v.literal("openai"),
  v.literal("anthropic"),
  v.literal("other"),
)

export const auditAgentRunPurposeValidator = v.union(
  v.literal("findings"),
  v.literal("summary"),
  v.literal("outreach"),
  v.literal("qa"),
  v.literal("critique"),
)

export const auditAgentRunStatusValidator = v.union(
  v.literal("started"),
  v.literal("completed"),
  v.literal("failed"),
)

export const personaIdValidator = v.union(
  v.literal("busy_owner"),
  v.literal("mobile_customer"),
  v.literal("skeptical_buyer"),
  v.literal("search_visitor"),
)

export const personaConfidenceValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
)
