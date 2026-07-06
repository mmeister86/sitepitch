/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audit_pipeline from "../audit_pipeline.js";
import type * as audit_state from "../audit_state.js";
import type * as audits from "../audits.js";
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as lib_audit_pipeline from "../lib/audit_pipeline.js";
import type * as lib_audit_rate_limit from "../lib/audit_rate_limit.js";
import type * as lib_audit_url from "../lib/audit_url.js";
import type * as lib_credits from "../lib/credits.js";
import type * as lib_workspace from "../lib/workspace.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  audit_pipeline: typeof audit_pipeline;
  audit_state: typeof audit_state;
  audits: typeof audits;
  auth: typeof auth;
  http: typeof http;
  "lib/audit_pipeline": typeof lib_audit_pipeline;
  "lib/audit_rate_limit": typeof lib_audit_rate_limit;
  "lib/audit_url": typeof lib_audit_url;
  "lib/credits": typeof lib_credits;
  "lib/workspace": typeof lib_workspace;
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
};
