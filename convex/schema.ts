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
    level: v.number(), // Current level based on total XP
    totalXP: v.optional(v.number()), // Total XP earned from running (defaults to 0)
    coins: v.optional(v.number()), // Coins earned from running (1 coin per km)
    // Streak tracking
    currentStreak: v.optional(v.number()), // Current consecutive training days completed (defaults to 0)
    longestStreak: v.optional(v.number()), // Longest streak ever achieved (defaults to 0)
    lastStreakDate: v.optional(v.string()), // ISO date of last completed training day that counted toward streak
    streakFreezeAvailable: v.optional(v.number()), // Number of streak freezes available (defaults to 0)
    // User preferences
    weekStartDay: v.optional(v.union(v.literal(0), v.literal(1))), // 0 = Sunday, 1 = Monday, defaults to 1 (Monday)
    metricSystem: v.optional(v.union(v.literal("metric"), v.literal("imperial"))), // User's preferred measurement system (defaults to metric)
    // Sync preferences
    healthKitSyncEnabled: v.optional(v.boolean()), // Whether HealthKit sync is enabled (defaults to false)
    stravaSyncEnabled: v.optional(v.boolean()), // Whether Strava sync is enabled (defaults to false)
    autoSyncEnabled: v.optional(v.boolean()), // Whether automatic syncing is enabled (defaults to false)
    lastHealthKitSync: v.optional(v.string()), // Last HealthKit sync timestamp
    lastStravaSync: v.optional(v.string()), // Last Strava sync timestamp
    // Strava integration
    stravaAthleteId: v.optional(v.number()), // Strava athlete ID for webhook matching
    stravaAccessRevoked: v.optional(v.boolean()), // Whether user revoked Strava access
    stravaAccessToken: v.optional(v.string()), // Strava access token for server-side API calls
    stravaRefreshToken: v.optional(v.string()), // Strava refresh token for token renewal
    stravaTokenExpiresAt: v.optional(v.number()), // When the access token expires (timestamp)
    // Push notifications
    pushNotificationToken: v.optional(v.string()), // Expo push notification token
    pushNotificationsEnabled: v.optional(v.boolean()), // Whether user wants push notifications
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_user", ["userId"]),

  // Training profiles - from onboarding data
  trainingProfiles: defineTable({
    userId: v.id("users"),
    goalDistance: v.union(
      v.literal("5K"), 
      v.literal("10K"),
      v.literal("just-run-more"),
      v.literal("half-marathon"), 
      v.literal("marathon")
    ),
    goalDate: v.string(), // ISO string
    currentAbility: v.union(
      v.literal("none"),
      v.literal("less1min"),
      v.literal("1to5min"), 
      v.literal("5to10min"),
      v.literal("more10min")
    ),
    longestDistance: v.union(
      v.literal("never"),
      v.literal("1to2km"),
      v.literal("2to4km"),
      v.literal("5plusKm")
    ),
    daysPerWeek: v.number(), // 2-6
    preferredDays: v.array(v.string()), // ['Mon', 'Wed', 'Fri']
    hasTreadmill: v.boolean(),
    preferTimeOverDistance: v.boolean(),
    // Computed fields
    fitnessLevel: v.union(
      v.literal("true-beginner"),
      v.literal("novice"),
      v.literal("intermediate"),
      v.literal("advanced")
    ),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_user", ["userId"]),

  // Generated training plans
  trainingPlans: defineTable({
    userId: v.id("users"),
    meta: v.object({
      goal: v.string(), // "5K", "10K", etc.
      weeks: v.number(),
      level: v.string(), // "novice", "intermediate", etc.
      daysPerWeek: v.number(),
      createdAt: v.string(),
    }),
    isActive: v.boolean(), // Only one active plan per user
    // Plan structure
    plan: v.array(v.object({
      week: v.number(),
      microCycle: v.union(
        v.literal("base"),
        v.literal("build"), 
        v.literal("peak"),
        v.literal("taper")
      ),
      days: v.array(v.object({
        date: v.string(), // YYYY-MM-DD format - specific date for this workout
        type: v.string(), // "easy", "tempo", "intervals", "long", "rest", "cross-train"
        duration: v.optional(v.string()), // "30 min"
        distance: v.optional(v.number()), // meters
        description: v.string(),
        target: v.optional(v.string()), // pace/HR zone
        workoutId: v.optional(v.id("workouts")), // Reference to workout library
      }))
    })),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "isActive"]),

  // Workout library - reusable workout templates
  workouts: defineTable({
    tag: v.string(), // "easy", "tempo", "intervals", "long", "recovery"
    levelMin: v.number(), // 0-3 (minimum fitness level)
    levelMax: v.optional(v.number()), // maximum fitness level
    name: v.string(),
    description: v.string(),
    // Workout structure
    structure: v.array(v.object({
      type: v.union(
        v.literal("warmup"),
        v.literal("main"),
        v.literal("recovery"),
        v.literal("cooldown")
      ),
      duration: v.optional(v.string()), // "15 min"
      distance: v.optional(v.number()), // meters
      intensity: v.union(
        v.literal("easy"),
        v.literal("moderate"),
        v.literal("threshold"),
        v.literal("vo2max"),
        v.literal("recovery")
      ),
      instructions: v.string(),
      repetitions: v.optional(v.number()), // for intervals
      restDuration: v.optional(v.string()), // rest between reps
    })),
    // Scaling factors for different goals
    scalingFactors: v.optional(v.object({
      fiveK: v.number(),
      tenK: v.number(),
      halfMarathon: v.number(),
      marathon: v.number(),
    })),
    createdAt: v.string(),
  })
    .index("by_tag", ["tag"])
    .index("by_level", ["levelMin"]),

  // Planned workouts - individual instances from training plans
  plannedWorkouts: defineTable({
    userId: v.id("users"),
    trainingPlanId: v.id("trainingPlans"),
    planWeek: v.number(),
    planDay: v.number(), // day within week
    scheduledDate: v.string(), // ISO date when this should be done
    type: v.string(),
    workoutId: v.optional(v.id("workouts")),
    duration: v.optional(v.string()),
    distance: v.optional(v.number()),
    description: v.string(),
    target: v.optional(v.string()),
    // Status tracking
    status: v.union(
      v.literal("scheduled"),
      v.literal("completed"),
      v.literal("skipped"),
      v.literal("missed")
    ),
    completedAt: v.optional(v.string()),
    completionId: v.optional(v.id("workoutCompletions")),
    createdAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "scheduledDate"])
    .index("by_plan", ["trainingPlanId"])
    .index("by_status", ["status"]),

  // Workout completions - when users complete workouts
  workoutCompletions: defineTable({
    userId: v.id("users"),
    plannedWorkoutId: v.optional(v.id("plannedWorkouts")), // null for ad-hoc workouts
    activityId: v.optional(v.id("activities")), // linked to actual run data
    completedAt: v.string(),
    // Performance data
    actualDuration: v.optional(v.number()), // minutes
    actualDistance: v.optional(v.number()), // meters
    averagePace: v.optional(v.number()), // min/km
    averageHeartRate: v.optional(v.number()),
    calories: v.optional(v.number()),
    // Subjective feedback
    perceivedEffort: v.optional(v.number()), // 1-10 RPE scale
    feeling: v.optional(v.union(
      v.literal("amazing"),
      v.literal("good"),
      v.literal("okay"),
      v.literal("tough"),
      v.literal("struggled")
    )),
    notes: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_planned_workout", ["plannedWorkoutId"])
    .index("by_activity", ["activityId"]),

  // Plan adaptations - when plans are modified based on performance
  planAdaptations: defineTable({
    userId: v.id("users"),
    trainingPlanId: v.id("trainingPlans"),
    reason: v.union(
      v.literal("missed_workouts"),
      v.literal("fatigue"),
      v.literal("injury"),
      v.literal("performance_improvement"),
      v.literal("time_constraint"),
      v.literal("manual_adjustment")
    ),
    description: v.string(),
    changes: v.array(v.object({
      week: v.number(),
      day: v.number(),
      oldWorkout: v.string(),
      newWorkout: v.string(),
      changeType: v.union(
        v.literal("intensity_reduced"),
        v.literal("distance_reduced"),
        v.literal("workout_skipped"),
        v.literal("rest_added"),
        v.literal("workout_replaced")
      ),
    })),
    appliedAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_plan", ["trainingPlanId"]),

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
    // UI state tracking
    celebrationShown: v.optional(v.boolean()), // Whether celebration modal has been shown for this activity
    isNewActivity: v.optional(v.boolean()), // Whether this is a new activity that should trigger celebration
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

  // Strava sync queue - for webhook-triggered syncs
  stravaSyncQueue: defineTable({
    userId: v.string(), // User ID that needs syncing
    activityIds: v.optional(v.array(v.number())), // Specific Strava activity IDs to sync (optional)
    status: v.union(v.literal("pending"), v.literal("processing"), v.literal("completed"), v.literal("failed")),
    createdAt: v.string(),
    updatedAt: v.string(),
    completedAt: v.optional(v.string()),
    error: v.optional(v.string()), // Error message if failed
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // Push notification logs
  pushNotificationLogs: defineTable({
    userId: v.string(),
    type: v.string(),
    title: v.string(),
    body: v.string(),
    status: v.string(),
    sentAt: v.string(),
    expoPushTicket: v.optional(v.any()),
    error: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_type", ["type"]),
});
 
export default schema;