/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activation from "../activation.js";
import type * as admin_operations from "../admin_operations.js";
import type * as api_keys from "../api_keys.js";
import type * as audit_agent from "../audit_agent.js";
import type * as audit_agent_action from "../audit_agent_action.js";
import type * as audit_cache from "../audit_cache.js";
import type * as audit_pipeline from "../audit_pipeline.js";
import type * as audit_recovery from "../audit_recovery.js";
import type * as audit_scoring from "../audit_scoring.js";
import type * as audit_state from "../audit_state.js";
import type * as audits from "../audits.js";
import type * as auth from "../auth.js";
import type * as batch_audit_qa from "../batch_audit_qa.js";
import type * as batch_audits from "../batch_audits.js";
import type * as billing from "../billing.js";
import type * as campaign_imports from "../campaign_imports.js";
import type * as campaigns from "../campaigns.js";
import type * as crons from "../crons.js";
import type * as deletion from "../deletion.js";
import type * as eve_evals from "../eve_evals.js";
import type * as http from "../http.js";
import type * as integration_actions from "../integration_actions.js";
import type * as integrations from "../integrations.js";
import type * as lead_search from "../lead_search.js";
import type * as leads from "../leads.js";
import type * as lib_audit_agent_claim_safety from "../lib/audit_agent_claim_safety.js";
import type * as lib_audit_agent_evidence from "../lib/audit_agent_evidence.js";
import type * as lib_audit_agent_fallback from "../lib/audit_agent_fallback.js";
import type * as lib_audit_agent_prompt from "../lib/audit_agent_prompt.js";
import type * as lib_audit_agent_schemas from "../lib/audit_agent_schemas.js";
import type * as lib_audit_cache from "../lib/audit_cache.js";
import type * as lib_audit_copy_review_prompt from "../lib/audit_copy_review_prompt.js";
import type * as lib_audit_copy_review_schemas from "../lib/audit_copy_review_schemas.js";
import type * as lib_audit_design_critique_fallback from "../lib/audit_design_critique_fallback.js";
import type * as lib_audit_design_critique_prompt from "../lib/audit_design_critique_prompt.js";
import type * as lib_audit_design_critique_schemas from "../lib/audit_design_critique_schemas.js";
import type * as lib_audit_failure from "../lib/audit_failure.js";
import type * as lib_audit_persona_fallback from "../lib/audit_persona_fallback.js";
import type * as lib_audit_persona_prompt from "../lib/audit_persona_prompt.js";
import type * as lib_audit_persona_schemas from "../lib/audit_persona_schemas.js";
import type * as lib_audit_personas from "../lib/audit_personas.js";
import type * as lib_audit_pipeline from "../lib/audit_pipeline.js";
import type * as lib_audit_rate_limit from "../lib/audit_rate_limit.js";
import type * as lib_audit_scoring from "../lib/audit_scoring.js";
import type * as lib_audit_start from "../lib/audit_start.js";
import type * as lib_audit_url from "../lib/audit_url.js";
import type * as lib_batch_audit_policy from "../lib/batch_audit_policy.js";
import type * as lib_batch_audit_qa from "../lib/batch_audit_qa.js";
import type * as lib_campaigns from "../lib/campaigns.js";
import type * as lib_credits from "../lib/credits.js";
import type * as lib_eval_ingest from "../lib/eval_ingest.js";
import type * as lib_integration_crypto from "../lib/integration_crypto.js";
import type * as lib_integration_policy from "../lib/integration_policy.js";
import type * as lib_integration_webhook from "../lib/integration_webhook.js";
import type * as lib_lead_search from "../lib/lead_search.js";
import type * as lib_lemonsqueezy from "../lib/lemonsqueezy.js";
import type * as lib_provider_cost_rates from "../lib/provider_cost_rates.js";
import type * as lib_provider_costs from "../lib/provider_costs.js";
import type * as lib_public_api_contract from "../lib/public_api_contract.js";
import type * as lib_rate_limit_helpers from "../lib/rate_limit_helpers.js";
import type * as lib_report_access from "../lib/report_access.js";
import type * as lib_report_cta from "../lib/report_cta.js";
import type * as lib_report_domain from "../lib/report_domain.js";
import type * as lib_report_pdf_queue from "../lib/report_pdf_queue.js";
import type * as lib_report_policy from "../lib/report_policy.js";
import type * as lib_report_privacy from "../lib/report_privacy.js";
import type * as lib_report_url from "../lib/report_url.js";
import type * as lib_report_view_stats from "../lib/report_view_stats.js";
import type * as lib_support from "../lib/support.js";
import type * as lib_telemetry_safety from "../lib/telemetry_safety.js";
import type * as lib_turnstile from "../lib/turnstile.js";
import type * as lib_webhook_request from "../lib/webhook_request.js";
import type * as lib_workspace from "../lib/workspace.js";
import type * as lib_workspace_audit_counter from "../lib/workspace_audit_counter.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as outreach_templates from "../outreach_templates.js";
import type * as provider_billing from "../provider_billing.js";
import type * as provider_billing_state from "../provider_billing_state.js";
import type * as public_api from "../public_api.js";
import type * as report_domains from "../report_domains.js";
import type * as report_password from "../report_password.js";
import type * as report_pdf from "../report_pdf.js";
import type * as report_pdf_action from "../report_pdf_action.js";
import type * as report_pdf_document from "../report_pdf_document.js";
import type * as report_settings from "../report_settings.js";
import type * as reports from "../reports.js";
import type * as retention from "../retention.js";
import type * as workpools from "../workpools.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activation: typeof activation;
  admin_operations: typeof admin_operations;
  api_keys: typeof api_keys;
  audit_agent: typeof audit_agent;
  audit_agent_action: typeof audit_agent_action;
  audit_cache: typeof audit_cache;
  audit_pipeline: typeof audit_pipeline;
  audit_recovery: typeof audit_recovery;
  audit_scoring: typeof audit_scoring;
  audit_state: typeof audit_state;
  audits: typeof audits;
  auth: typeof auth;
  batch_audit_qa: typeof batch_audit_qa;
  batch_audits: typeof batch_audits;
  billing: typeof billing;
  campaign_imports: typeof campaign_imports;
  campaigns: typeof campaigns;
  crons: typeof crons;
  deletion: typeof deletion;
  eve_evals: typeof eve_evals;
  http: typeof http;
  integration_actions: typeof integration_actions;
  integrations: typeof integrations;
  lead_search: typeof lead_search;
  leads: typeof leads;
  "lib/audit_agent_claim_safety": typeof lib_audit_agent_claim_safety;
  "lib/audit_agent_evidence": typeof lib_audit_agent_evidence;
  "lib/audit_agent_fallback": typeof lib_audit_agent_fallback;
  "lib/audit_agent_prompt": typeof lib_audit_agent_prompt;
  "lib/audit_agent_schemas": typeof lib_audit_agent_schemas;
  "lib/audit_cache": typeof lib_audit_cache;
  "lib/audit_copy_review_prompt": typeof lib_audit_copy_review_prompt;
  "lib/audit_copy_review_schemas": typeof lib_audit_copy_review_schemas;
  "lib/audit_design_critique_fallback": typeof lib_audit_design_critique_fallback;
  "lib/audit_design_critique_prompt": typeof lib_audit_design_critique_prompt;
  "lib/audit_design_critique_schemas": typeof lib_audit_design_critique_schemas;
  "lib/audit_failure": typeof lib_audit_failure;
  "lib/audit_persona_fallback": typeof lib_audit_persona_fallback;
  "lib/audit_persona_prompt": typeof lib_audit_persona_prompt;
  "lib/audit_persona_schemas": typeof lib_audit_persona_schemas;
  "lib/audit_personas": typeof lib_audit_personas;
  "lib/audit_pipeline": typeof lib_audit_pipeline;
  "lib/audit_rate_limit": typeof lib_audit_rate_limit;
  "lib/audit_scoring": typeof lib_audit_scoring;
  "lib/audit_start": typeof lib_audit_start;
  "lib/audit_url": typeof lib_audit_url;
  "lib/batch_audit_policy": typeof lib_batch_audit_policy;
  "lib/batch_audit_qa": typeof lib_batch_audit_qa;
  "lib/campaigns": typeof lib_campaigns;
  "lib/credits": typeof lib_credits;
  "lib/eval_ingest": typeof lib_eval_ingest;
  "lib/integration_crypto": typeof lib_integration_crypto;
  "lib/integration_policy": typeof lib_integration_policy;
  "lib/integration_webhook": typeof lib_integration_webhook;
  "lib/lead_search": typeof lib_lead_search;
  "lib/lemonsqueezy": typeof lib_lemonsqueezy;
  "lib/provider_cost_rates": typeof lib_provider_cost_rates;
  "lib/provider_costs": typeof lib_provider_costs;
  "lib/public_api_contract": typeof lib_public_api_contract;
  "lib/rate_limit_helpers": typeof lib_rate_limit_helpers;
  "lib/report_access": typeof lib_report_access;
  "lib/report_cta": typeof lib_report_cta;
  "lib/report_domain": typeof lib_report_domain;
  "lib/report_pdf_queue": typeof lib_report_pdf_queue;
  "lib/report_policy": typeof lib_report_policy;
  "lib/report_privacy": typeof lib_report_privacy;
  "lib/report_url": typeof lib_report_url;
  "lib/report_view_stats": typeof lib_report_view_stats;
  "lib/support": typeof lib_support;
  "lib/telemetry_safety": typeof lib_telemetry_safety;
  "lib/turnstile": typeof lib_turnstile;
  "lib/webhook_request": typeof lib_webhook_request;
  "lib/workspace": typeof lib_workspace;
  "lib/workspace_audit_counter": typeof lib_workspace_audit_counter;
  migrations: typeof migrations;
  notifications: typeof notifications;
  outreach_templates: typeof outreach_templates;
  provider_billing: typeof provider_billing;
  provider_billing_state: typeof provider_billing_state;
  public_api: typeof public_api;
  report_domains: typeof report_domains;
  report_password: typeof report_password;
  report_pdf: typeof report_pdf;
  report_pdf_action: typeof report_pdf_action;
  report_pdf_document: typeof report_pdf_document;
  report_settings: typeof report_settings;
  reports: typeof reports;
  retention: typeof retention;
  workpools: typeof workpools;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  auditWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"auditWorkpool">;
  batchAuditWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"batchAuditWorkpool">;
  providerWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"providerWorkpool">;
  llmWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"llmWorkpool">;
  pdfWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"pdfWorkpool">;
  webhookWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"webhookWorkpool">;
};
