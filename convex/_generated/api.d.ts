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
import type * as http from "../http.js";
import type * as internal_verifyAppleToken from "../internal/verifyAppleToken.js";
import type * as leaderboard from "../leaderboard.js";
import type * as migrations from "../migrations.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as restReward from "../restReward.js";
import type * as simpleTrainingSchedule from "../simpleTrainingSchedule.js";
import type * as stravaWebhooks from "../stravaWebhooks.js";
import type * as streak from "../streak.js";
import type * as trainingPlan from "../trainingPlan.js";
import type * as trainingProfile from "../trainingProfile.js";
import type * as userProfile from "../userProfile.js";
import type * as utils_challenges from "../utils/challenges.js";
import type * as utils_gamification from "../utils/gamification.js";
import type * as utils_streak from "../utils/streak.js";
import type * as utils_streaks from "../utils/streaks.js";

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
  http: typeof http;
  "internal/verifyAppleToken": typeof internal_verifyAppleToken;
  leaderboard: typeof leaderboard;
  migrations: typeof migrations;
  pushNotifications: typeof pushNotifications;
  restReward: typeof restReward;
  simpleTrainingSchedule: typeof simpleTrainingSchedule;
  stravaWebhooks: typeof stravaWebhooks;
  streak: typeof streak;
  trainingPlan: typeof trainingPlan;
  trainingProfile: typeof trainingProfile;
  userProfile: typeof userProfile;
  "utils/challenges": typeof utils_challenges;
  "utils/gamification": typeof utils_gamification;
  "utils/streak": typeof utils_streak;
  "utils/streaks": typeof utils_streaks;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
