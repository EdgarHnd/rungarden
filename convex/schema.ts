import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  /* ────────────────────────────── auth */
  ...authTables,

  /* ────────────────────────────── users */
  userProfiles: defineTable({
    userId: v.id("users"),

    weeklyGoal: v.number(),          // metres
    totalDistance: v.number(),       // metres
    totalWorkouts: v.number(),
    totalCalories: v.number(),

    // Gamification
    level: v.number(),
    totalXP: v.number(),             // start at 0 in first mutation
    coins: v.number(),

    // Streak (weekly-based)
    currentStreak: v.number(),       // consecutive weeks hitting goal
    longestStreak: v.number(),
    lastStreakWeek: v.optional(v.string()), // YYYY-MM-DD of week start
    streakFreezeAvailable: v.number(),

    // Mascot health system
    mascotName: v.optional(v.string()),
    mascotHealth: v.number(),        // 0-4, loses 1 per missed week

    // Onboarding profile data
    path: v.optional(v.union(
      v.literal("true-beginner"), v.literal("run-habit"),
      v.literal("weight-loss"), v.literal("race-ready")
    )),
    gender: v.optional(v.union(v.literal("female"), v.literal("male"), v.literal("other"))),
    age: v.optional(v.number()),

    // Preferences
    weekStartDay: v.optional(v.union(v.literal(0), v.literal(1))),
    metricSystem: v.optional(v.union(v.literal("metric"), v.literal("imperial"))),

    // Sync toggles & metadata
    healthKitSyncEnabled: v.optional(v.boolean()),
    stravaSyncEnabled: v.optional(v.boolean()),
    autoSyncEnabled: v.optional(v.boolean()),

    lastHealthKitSync: v.optional(v.string()),
    lastStravaSync: v.optional(v.string()),

    // Strava tokens
    stravaAthleteId: v.optional(v.number()),
    stravaAccessRevoked: v.optional(v.boolean()),
    stravaInitialSyncCompleted: v.optional(v.boolean()), // Track if initial sync modal has been shown
    stravaAccessToken: v.optional(v.string()),
    stravaRefreshToken: v.optional(v.string()),
    stravaTokenExpiresAt: v.optional(v.number()),

    // Push
    pushNotificationToken: v.optional(v.string()),
    pushNotificationsEnabled: v.optional(v.boolean()),

    healthKitInitialSyncCompleted: v.optional(v.boolean()), // Track if HealthKit initial sync modal has been shown

    updatedAt: v.string()
  }).index("by_user", ["userId"]),

  /* ────────────────────────────── onboarding */
  trainingProfiles: defineTable({
    userId: v.id("users"),
    goalDistance: v.optional(v.string()),
    goalDate: v.optional(v.string()),

    currentAbility: v.string(),
    longestDistance: v.string(),

    daysPerWeek: v.number(),                 // 2-6
    preferredDays: v.array(v.string()),      // ["Mon","Wed",…]
    hasTreadmill: v.optional(v.boolean()),
    preferTimeOverDistance: v.boolean(),

    fitnessLevel: v.union(
      v.literal("true-beginner"), v.literal("novice"),
      v.literal("intermediate"), v.literal("advanced")
    ),

    updatedAt: v.string()
  }).index("by_user", ["userId"]),

  /* ────────────────────────────── simple training schedule */
  simpleTrainingSchedule: defineTable({
    userId: v.id("users"),
    runsPerWeek: v.number(),           // Weekly minimum for streak (1-7)
    preferredDays: v.array(v.string()), // ["Mon", "Wed", "Fri"] - for daily motivation
    isActive: v.boolean(),
    startDate: v.string(),             // YYYY-MM-DD when they started this schedule
    updatedAt: v.string()
  }).index("by_user", ["userId"]),

  // Track schedule changes - new requirements apply to next week
  scheduleHistory: defineTable({
    userId: v.id("users"),
    runsPerWeek: v.number(),
    preferredDays: v.array(v.string()),
    effectiveFromDate: v.string(),     // YYYY-MM-DD week start when this became active
    createdAt: v.string()
  }).index("by_user_date", ["userId", "effectiveFromDate"]),

  /* ────────────────────────────── structured workouts */
  workouts: defineTable({
    userId: v.optional(v.id("users")),       // null -> system template
    name: v.optional(v.string()),
    type: v.union(
      v.literal("run"), v.literal("cross-train"),
      v.literal("strength"), v.literal("rest")
    ),
    subType: v.optional(v.union(
      v.literal("easy"), v.literal("tempo"), v.literal("interval"),
      v.literal("long"), v.literal("recovery"), v.literal("race")
    )),
    description: v.optional(v.string()),

    steps: v.array(v.object({
      order: v.number(),
      label: v.optional(v.string()),         // "Warm-up"…
      duration: v.optional(v.string()),      // "5 min"
      distance: v.optional(v.number()),      // metres
      pace: v.optional(v.number()),          // seconds per km
      effort: v.optional(v.string()),        // "easy"…
      target: v.optional(v.string()),        // HR zone, cadence…
      notes: v.optional(v.string())
    })),

    updatedAt: v.string()
  })
    .index("by_user", ["userId"])
    .index("by_type", ["type"]),

  /* ────────────────────────────── training plan */
  trainingPlans: defineTable({
    userId: v.id("users"),
    meta: v.object({
      goal: v.string(),              // "5K", etc.
      weeks: v.number(),
      level: v.string(),             // "novice"…
      daysPerWeek: v.number()
    }),
    isActive: v.boolean(),

    plan: v.array(v.object({
      week: v.number(),
      microCycle: v.union(
        v.literal("base"), v.literal("build"),
        v.literal("peak"), v.literal("taper")
      ),
      days: v.array(v.object({
        date: v.string(),            // YYYY-MM-DD
        type: v.union(
          v.literal("easy"), v.literal("tempo"), v.literal("interval"),
          v.literal("long"), v.literal("rest"), v.literal("cross-train")
        ),
        description: v.string()
      }))
    })),

    updatedAt: v.string()
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "isActive"]),

  /* ────────────────────────────── calendar entries */
  plannedWorkouts: defineTable({
    userId: v.id("users"),
    trainingPlanId: v.id("trainingPlans"),
    workoutId: v.id("workouts"),            // <-- REQUIRED

    scheduledDate: v.string(),              // YYYY-MM-DD
    status: v.union(
      v.literal("scheduled"),
      v.literal("completed"),
      v.literal("skipped"),
      v.literal("missed")
    ),
    completedAt: v.optional(v.string())
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "scheduledDate"])
    .index("by_plan", ["trainingPlanId"])
    .index("by_status", ["status"]),

  /* ────────────────────────────── real activities */
  activities: defineTable({
    userId: v.id("users"),

    startDate: v.string(),               // ISO
    endDate: v.string(),                 // ISO
    duration: v.number(),                // minutes
    distance: v.number(),                // metres
    calories: v.number(),

    averageHeartRate: v.optional(v.number()),
    workoutName: v.optional(v.string()),

    source: v.optional(
      v.union(v.literal("healthkit"), v.literal("strava"), v.literal("app"))
    ),
    healthKitUuid: v.optional(v.string()),
    stravaId: v.optional(v.number()),

    pace: v.optional(v.number()),        // min/km numeric
    plannedWorkoutId: v.optional(v.id("plannedWorkouts")),  // 🔗
    type: v.optional(v.literal("rest")),                    // inserted by app

    // Enhanced running data for achievements and gamification
    totalElevationGain: v.optional(v.number()),      // meters gained
    elevationHigh: v.optional(v.number()),           // highest elevation
    elevationLow: v.optional(v.number()),            // lowest elevation
    averageTemp: v.optional(v.number()),             // average temperature (celsius)
    startLatLng: v.optional(v.array(v.number())),    // [lat, lng] start coordinates
    endLatLng: v.optional(v.array(v.number())),      // [lat, lng] end coordinates
    timezone: v.optional(v.string()),                // timezone info
    isIndoor: v.optional(v.boolean()),               // trainer/treadmill vs outdoor
    isCommute: v.optional(v.boolean()),              // commute run
    averageCadence: v.optional(v.number()),          // steps per minute
    averageWatts: v.optional(v.number()),            // power data
    maxWatts: v.optional(v.number()),                // peak power
    kilojoules: v.optional(v.number()),              // energy expenditure
    polyline: v.optional(v.string()),                // route polyline for mapping
    maxSpeed: v.optional(v.number()),                // peak speed
    averageSpeed: v.optional(v.number()),            // average speed

    isNewActivity: v.optional(v.boolean()),
    syncedAt: v.string()
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "startDate"])
    .index("by_planned", ["plannedWorkoutId"])
    .index("by_healthkit_uuid", ["healthKitUuid"])
    .index("by_strava_id", ["stravaId"])
    .index("by_source", ["source"]),

  /* ────────────────────────────── rest activities */
  restActivities: defineTable({
    userId: v.id("users"),
    date: v.string(),                    // YYYY-MM-DD format
    completedAt: v.string(),             // ISO timestamp when completed
    xpGained: v.number(),                // XP gained from rest day
    coinsGained: v.number(),             // Coins gained from rest day
    plannedWorkoutId: v.optional(v.id("plannedWorkouts")), // Link to planned workout if applicable
    notes: v.optional(v.string()),       // Optional notes about the rest day
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"])
    .index("by_date", ["date"])
    .index("by_planned", ["plannedWorkoutId"]),

  /* ────────────────────────────── achievements */
  challenges: defineTable({
    name: v.string(),
    description: v.string(),
    emoji: v.string(),
    reward: v.optional(v.union(v.literal("coins"), v.literal("xp"), v.literal("energy"))),
    requirements: v.string(),
  }),

  userAchievements: defineTable({
    userId: v.id("users"),
    challengeId: v.id("challenges"), // Challenge identifier
    unlockedAt: v.string(), // ISO string when unlocked
    progress: v.number(), // Current progress toward challenge
    maxProgress: v.number(), // Total required for completion
    isCompleted: v.boolean(), // Whether challenge is completed
    rewardClaimed: v.optional(v.boolean()), // Whether reward has been claimed
    isNew: v.optional(v.boolean()), // Whether this is a new achievement that should show "NEW" badge
    updatedAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_challenge", ["userId", "challengeId"])
    .index("by_user_completed", ["userId", "isCompleted"])
    .index("by_user_new", ["userId", "isNew"]),

  // Activity achievements - links achievements to specific activities
  activityAchievements: defineTable({
    userId: v.id("users"),
    activityId: v.id("activities"), // The activity that unlocked this achievement
    challengeId: v.id("challenges"), // Challenge identifier
    achievementId: v.id("userAchievements"), // Reference to the user achievement
    unlockedAt: v.string(), // ISO string when unlocked by this activity
  })
    .index("by_user", ["userId"])
    .index("by_activity", ["activityId"])
    .index("by_user_activity", ["userId", "activityId"])
    .index("by_challenge", ["challengeId"]),

  /* ────────────────────────────── coin ledger */
  coinTransactions: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("earn"), v.literal("spend")),
    amount: v.number(),
    source: v.string(),
    referenceId: v.optional(v.union(v.id("activities"), v.id("restActivities"))), // Can link to run or rest reward
    createdAt: v.string(),
  }).index("by_user", ["userId"]),

  /* ────────────────────────────── push notifications */
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

  /* ────────────────────────────── friends */
  friendRequests: defineTable({
    fromUserId: v.id("users"),           // Sender of request
    toUserId: v.id("users"),             // Receiver of request
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("blocked")
    ),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_from", ["fromUserId"])
    .index("by_to", ["toUserId"])
    .index("by_users", ["fromUserId", "toUserId"]),
});

export default schema;