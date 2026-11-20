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
import type * as admin from "../admin.js";
import type * as attention from "../attention.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as deliveries from "../deliveries.js";
import type * as http from "../http.js";
import type * as inbound from "../inbound.js";
import type * as integrations_assistant from "../integrations/assistant.js";
import type * as integrations_paystack from "../integrations/paystack.js";
import type * as integrations_sasusync from "../integrations/sasusync.js";
import type * as integrations_vision from "../integrations/vision.js";
import type * as integrations_whatsapp from "../integrations/whatsapp.js";
import type * as lib_address from "../lib/address.js";
import type * as lib_authMessages from "../lib/authMessages.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_phone from "../lib/phone.js";
import type * as lib_validators from "../lib/validators.js";
import type * as model_attention from "../model/attention.js";
import type * as model_auth from "../model/auth.js";
import type * as model_conversation from "../model/conversation.js";
import type * as model_copy from "../model/copy.js";
import type * as model_crypto from "../model/crypto.js";
import type * as model_delivery from "../model/delivery.js";
import type * as model_fees from "../model/fees.js";
import type * as model_fulfilment from "../model/fulfilment.js";
import type * as model_orders from "../model/orders.js";
import type * as model_outbound from "../model/outbound.js";
import type * as model_stats from "../model/stats.js";
import type * as model_time from "../model/time.js";
import type * as model_validation from "../model/validation.js";
import type * as model_verification from "../model/verification.js";
import type * as orders from "../orders.js";
import type * as outbound from "../outbound.js";
import type * as payments from "../payments.js";
import type * as payouts from "../payouts.js";
import type * as phoneVerification from "../phoneVerification.js";
import type * as products from "../products.js";
import type * as sellers from "../sellers.js";
import type * as site from "../site.js";
import type * as sms from "../sms.js";
import type * as summary from "../summary.js";
import type * as users from "../users.js";
import type * as vision from "../vision.js";
import type * as whatsapp_templates from "../whatsapp/templates.js";
import type * as whatsappConnect from "../whatsappConnect.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  admin: typeof admin;
  attention: typeof attention;
  auth: typeof auth;
  crons: typeof crons;
  dashboard: typeof dashboard;
  deliveries: typeof deliveries;
  http: typeof http;
  inbound: typeof inbound;
  "integrations/assistant": typeof integrations_assistant;
  "integrations/paystack": typeof integrations_paystack;
  "integrations/sasusync": typeof integrations_sasusync;
  "integrations/vision": typeof integrations_vision;
  "integrations/whatsapp": typeof integrations_whatsapp;
  "lib/address": typeof lib_address;
  "lib/authMessages": typeof lib_authMessages;
  "lib/money": typeof lib_money;
  "lib/phone": typeof lib_phone;
  "lib/validators": typeof lib_validators;
  "model/attention": typeof model_attention;
  "model/auth": typeof model_auth;
  "model/conversation": typeof model_conversation;
  "model/copy": typeof model_copy;
  "model/crypto": typeof model_crypto;
  "model/delivery": typeof model_delivery;
  "model/fees": typeof model_fees;
  "model/fulfilment": typeof model_fulfilment;
  "model/orders": typeof model_orders;
  "model/outbound": typeof model_outbound;
  "model/stats": typeof model_stats;
  "model/time": typeof model_time;
  "model/validation": typeof model_validation;
  "model/verification": typeof model_verification;
  orders: typeof orders;
  outbound: typeof outbound;
  payments: typeof payments;
  payouts: typeof payouts;
  phoneVerification: typeof phoneVerification;
  products: typeof products;
  sellers: typeof sellers;
  site: typeof site;
  sms: typeof sms;
  summary: typeof summary;
  users: typeof users;
  vision: typeof vision;
  "whatsapp/templates": typeof whatsapp_templates;
  whatsappConnect: typeof whatsappConnect;
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
