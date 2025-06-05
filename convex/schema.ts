import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
 
const schema = defineSchema({
  ...authTables,
  
  // User profiles with running-specific data
  userProfiles: defineTable({
    userId: v.id("users"),
    weeklyGoal: v.number(), // distance in meters
    totalDistance: v.number(), // total distance run in meters
    totalWorkouts: v.number(),
    totalCalories: v.number(),
    lastSyncDate: v.optional(v.string()), // ISO string for last HealthKit sync
    // Gamification fields
    level: v.number(), // Current level based on total distance
    coins: v.optional(v.number()), // Coins earned from running (1 coin per km)
    // Week preferences
    weekStartDay: v.optional(v.union(v.literal(0), v.literal(1))), // 0 = Sunday, 1 = Monday, defaults to 1 (Monday)
    // Sync preferences
    healthKitSyncEnabled: v.optional(v.boolean()), // Whether HealthKit sync is enabled (defaults to false)
    stravaSyncEnabled: v.optional(v.boolean()), // Whether Strava sync is enabled (defaults to false)
    autoSyncEnabled: v.optional(v.boolean()), // Whether automatic syncing is enabled (defaults to false)
    lastHealthKitSync: v.optional(v.string()), // Last HealthKit sync timestamp
    lastStravaSync: v.optional(v.string()), // Last Strava sync timestamp
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_user", ["userId"]),

  // Activities synced from HealthKit and Strava
  activities: defineTable({
    userId: v.id("users"),
    // Common data
    startDate: v.string(), // ISO string
    endDate: v.string(), // ISO string
    duration: v.number(), // in minutes
    distance: v.number(), // in meters
    calories: v.number(),
    averageHeartRate: v.optional(v.number()),
    workoutName: v.optional(v.string()),
    // Data source tracking
    source: v.optional(v.union(v.literal("healthkit"), v.literal("strava"))), // Where this activity came from (defaults to healthkit for existing records)
    // HealthKit data
    healthKitUuid: v.optional(v.string()), // Original HealthKit UUID
    // Strava data
    stravaId: v.optional(v.number()), // Original Strava activity ID
    // Sync metadata
    syncedAt: v.string(), // When this was synced
    // Additional computed fields
    pace: v.optional(v.number()), // min/km
    createdAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "startDate"])
    .index("by_healthkit_uuid", ["healthKitUuid"])
    .index("by_strava_id", ["stravaId"])
    .index("by_source", ["source"]),

  // Weekly goals and progress tracking
  weeklyProgress: defineTable({
    userId: v.id("users"),
    weekStart: v.string(), // ISO string for Monday of the week
    goalDistance: v.number(), // weekly goal in meters
    actualDistance: v.number(), // actual distance achieved
    workoutCount: v.number(),
    totalCalories: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_week", ["userId", "weekStart"]),
});
 
export default schema;