/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as activities from "../activities.js";
import type * as auth from "../auth.js";
import type * as friends from "../friends.js";
import type * as garden from "../garden.js";
import type * as http from "../http.js";
import type * as internal_verifyAppleToken from "../internal/verifyAppleToken.js";
import type * as migration from "../migration.js";
import type * as plantTypesNew from "../plantTypesNew.js";
import type * as plants from "../plants.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as stravaAuth from "../stravaAuth.js";
import type * as stravaWebhooks from "../stravaWebhooks.js";
import type * as userProfile from "../userProfile.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  activities: typeof activities;
  auth: typeof auth;
  friends: typeof friends;
  garden: typeof garden;
  http: typeof http;
  "internal/verifyAppleToken": typeof internal_verifyAppleToken;
  migration: typeof migration;
  plantTypesNew: typeof plantTypesNew;
  plants: typeof plants;
  pushNotifications: typeof pushNotifications;
  stravaAuth: typeof stravaAuth;
  stravaWebhooks: typeof stravaWebhooks;
  userProfile: typeof userProfile;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
