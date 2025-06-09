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
import type * as leaderboard from "../leaderboard.js";
import type * as migrations from "../migrations.js";
import type * as planAdaptation from "../planAdaptation.js";
import type * as plannedWorkouts from "../plannedWorkouts.js";
import type * as trainingPlan from "../trainingPlan.js";
import type * as trainingProfile from "../trainingProfile.js";
import type * as userProfile from "../userProfile.js";
import type * as workoutCompletions from "../workoutCompletions.js";
import type * as workoutLibrary from "../workoutLibrary.js";

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
  leaderboard: typeof leaderboard;
  migrations: typeof migrations;
  planAdaptation: typeof planAdaptation;
  plannedWorkouts: typeof plannedWorkouts;
  trainingPlan: typeof trainingPlan;
  trainingProfile: typeof trainingProfile;
  userProfile: typeof userProfile;
  workoutCompletions: typeof workoutCompletions;
  workoutLibrary: typeof workoutLibrary;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
