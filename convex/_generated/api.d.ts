/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audit_agent from "../audit_agent.js";
import type * as audit_agent_action from "../audit_agent_action.js";
import type * as audit_pipeline from "../audit_pipeline.js";
import type * as audit_scoring from "../audit_scoring.js";
import type * as audit_state from "../audit_state.js";
import type * as audits from "../audits.js";
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as lib_audit_agent_claim_safety from "../lib/audit_agent_claim_safety.js";
import type * as lib_audit_agent_evidence from "../lib/audit_agent_evidence.js";
import type * as lib_audit_agent_fallback from "../lib/audit_agent_fallback.js";
import type * as lib_audit_agent_prompt from "../lib/audit_agent_prompt.js";
import type * as lib_audit_agent_schemas from "../lib/audit_agent_schemas.js";
import type * as lib_audit_pipeline from "../lib/audit_pipeline.js";
import type * as lib_audit_rate_limit from "../lib/audit_rate_limit.js";
import type * as lib_audit_scoring from "../lib/audit_scoring.js";
import type * as lib_audit_url from "../lib/audit_url.js";
import type * as lib_credits from "../lib/credits.js";
import type * as lib_rate_limit_helpers from "../lib/rate_limit_helpers.js";
import type * as lib_workspace from "../lib/workspace.js";
import type * as reports from "../reports.js";
import type * as workpools from "../workpools.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  audit_agent: typeof audit_agent;
  audit_agent_action: typeof audit_agent_action;
  audit_pipeline: typeof audit_pipeline;
  audit_scoring: typeof audit_scoring;
  audit_state: typeof audit_state;
  audits: typeof audits;
  auth: typeof auth;
  http: typeof http;
  "lib/audit_agent_claim_safety": typeof lib_audit_agent_claim_safety;
  "lib/audit_agent_evidence": typeof lib_audit_agent_evidence;
  "lib/audit_agent_fallback": typeof lib_audit_agent_fallback;
  "lib/audit_agent_prompt": typeof lib_audit_agent_prompt;
  "lib/audit_agent_schemas": typeof lib_audit_agent_schemas;
  "lib/audit_pipeline": typeof lib_audit_pipeline;
  "lib/audit_rate_limit": typeof lib_audit_rate_limit;
  "lib/audit_scoring": typeof lib_audit_scoring;
  "lib/audit_url": typeof lib_audit_url;
  "lib/credits": typeof lib_credits;
  "lib/rate_limit_helpers": typeof lib_rate_limit_helpers;
  "lib/workspace": typeof lib_workspace;
  reports: typeof reports;
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
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  auditWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"auditWorkpool">;
  providerWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"providerWorkpool">;
  llmWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"llmWorkpool">;
  pdfWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"pdfWorkpool">;
};
