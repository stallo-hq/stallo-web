/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as auth from "../auth.js";
import type * as dashboard from "../dashboard.js";
import type * as integrations_sasusync from "../integrations/sasusync.js";
import type * as lib_authMessages from "../lib/authMessages.js";
import type * as lib_phone from "../lib/phone.js";
import type * as lib_validators from "../lib/validators.js";
import type * as model_auth from "../model/auth.js";
import type * as model_fees from "../model/fees.js";
import type * as model_orders from "../model/orders.js";
import type * as model_time from "../model/time.js";
import type * as model_validation from "../model/validation.js";
import type * as model_verification from "../model/verification.js";
import type * as orders from "../orders.js";
import type * as phoneVerification from "../phoneVerification.js";
import type * as products from "../products.js";
import type * as sellers from "../sellers.js";
import type * as site from "../site.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  auth: typeof auth;
  dashboard: typeof dashboard;
  "integrations/sasusync": typeof integrations_sasusync;
  "lib/authMessages": typeof lib_authMessages;
  "lib/phone": typeof lib_phone;
  "lib/validators": typeof lib_validators;
  "model/auth": typeof model_auth;
  "model/fees": typeof model_fees;
  "model/orders": typeof model_orders;
  "model/time": typeof model_time;
  "model/validation": typeof model_validation;
  "model/verification": typeof model_verification;
  orders: typeof orders;
  phoneVerification: typeof phoneVerification;
  products: typeof products;
  sellers: typeof sellers;
  site: typeof site;
  users: typeof users;
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
  auth: import("@convex-dev/auth/_generated/component.js").ComponentApi<"auth">;
  authPassword: import("@convex-dev/auth/components/password/_generated/component.js").ComponentApi<"authPassword">;
  authUsername: import("@convex-dev/auth/components/username/_generated/component.js").ComponentApi<"authUsername">;
};
