import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  /* ────────────────────────────── auth */
  ...authTables,

  /* ────────────────────────────── users */
  userProfiles: defineTable({
    userId: v.id("users"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),

    totalDistance: v.number(),       // metres
    totalWorkouts: v.number(),
    totalCalories: v.number(),

    // Basic preferences
    metricSystem: v.optional(v.union(v.literal("metric"), v.literal("imperial"))),
    
    // Garden preferences
    gardenTheme: v.optional(v.string()), // Future: different garden themes
    
    // Plant unlocking tracking
    unlockedPlantTypes: v.optional(v.array(v.id("plantTypes"))), // List of unlocked plant type IDs

    // Sync toggles & metadata
    healthKitSyncEnabled: v.optional(v.boolean()),
    stravaSyncEnabled: v.optional(v.boolean()),
    autoSyncEnabled: v.optional(v.boolean()),

    lastHealthKitSync: v.optional(v.string()),
    lastStravaSync: v.optional(v.string()),

    // Strava tokens
    stravaAthleteId: v.optional(v.number()),
    stravaAccessRevoked: v.optional(v.boolean()),
    stravaInitialSyncCompleted: v.optional(v.boolean()),
    stravaAccessToken: v.optional(v.string()),
    stravaRefreshToken: v.optional(v.string()),
    stravaTokenExpiresAt: v.optional(v.number()),

    // Push
    pushNotificationToken: v.optional(v.string()),
    pushNotificationsEnabled: v.optional(v.boolean()),

    healthKitInitialSyncCompleted: v.optional(v.boolean()),

    updatedAt: v.string()
  }).index("by_user", ["userId"]),

  /* ────────────────────────────── activities */
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

    // Enhanced running data
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

    // User feedback on how the activity felt
    feeling: v.optional(v.union(
      v.literal("amazing"),
      v.literal("good"),
      v.literal("okay"),
      v.literal("tough"),
      v.literal("struggled"),
      v.literal("dead")
    )),
    feelingRecordedAt: v.optional(v.string()),

    isNewActivity: v.optional(v.boolean()),
    syncedAt: v.string(),

    // Garden integration - plant earned from this run
    plantEarned: v.optional(v.id("plants")),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "startDate"])
    .index("by_healthkit_uuid", ["healthKitUuid"])
    .index("by_strava_id", ["stravaId"])
    .index("by_source", ["source"]),

  /* ────────────────────────────── plant types */
  plantTypes: defineTable({
    name: v.string(),                    // "Radish", "Tomato", "Apple Tree"
    emoji: v.string(),                   // 🥕, 🍅, 🍎
    imagePath: v.optional(v.string()),   // optional path to plant image (e.g., "plants/01.png")
    distanceRequired: v.number(),        // metres required to earn this plant
    rarity: v.union(                     // rarity affects growth rate and appearance
      v.literal("common"),
      v.literal("uncommon"), 
      v.literal("rare"),
      v.literal("epic"),
      v.literal("legendary"),
      v.literal("mythical")
    ),
    category: v.union(                   // visual category
      v.literal("flower"),
      v.literal("bush"),
      v.literal("tree"),
      v.literal("desert"),
      v.literal("mushroom")
    ),
    description: v.string(),             // "A quick-growing root vegetable"
    growthStages: v.array(v.object({     // different visual states as plant grows
      stage: v.number(),                 // 0=seed, 1=sprout, 2=growing, 3=mature
      name: v.string(),                  // "Seed", "Sprout", "Growing", "Mature"
      emoji: v.string(),                 // visual representation for this stage
    })),
  }).index("by_distance", ["distanceRequired"]),

  /* ────────────────────────────── user plants inventory */
  plants: defineTable({
    userId: v.id("users"),
    plantTypeId: v.id("plantTypes"),
    earnedFromActivityId: v.id("activities"),  // which run earned this plant
    earnedAt: v.string(),                      // when the plant was earned
    
    // Planting status
    isPlanted: v.boolean(),                    // has user planted this in garden?
    plantedAt: v.optional(v.string()),         // when planted in garden
    
    // Grid-based garden position
    gridPosition: v.optional(v.object({        // position in 10x10 isometric grid
      row: v.number(),                         // grid row (0-9)
      col: v.number(),                         // grid column (0-9)
    })),
    
    // Legacy canvas properties (for migration compatibility)
    gardenPosition: v.optional(v.object({      // absolute position in canvas (deprecated)
      x: v.float64(),                          // pixel position from left
      y: v.float64(),                          // pixel position from top
    })),
    plantSize: v.optional(v.float64()),        // scale factor (deprecated, will be removed)
    zIndex: v.optional(v.number()),            // layer order (deprecated, will be removed)
    rotation: v.optional(v.float64()),         // rotation in degrees (deprecated, will be removed)
    
    // Growth system
    currentStage: v.number(),                  // 0-3 (seed to mature)
    experiencePoints: v.number(),              // XP towards next growth stage
    nextStageRequirement: v.number(),          // XP needed for next stage
    
    // Plant health and care
    waterLevel: v.number(),                    // 0-100, decreases over time
    lastWatered: v.optional(v.string()),       // last care date
    isWilted: v.optional(v.boolean()),         // needs attention
    
    updatedAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_planted", ["userId", "isPlanted"])
    .index("by_activity", ["earnedFromActivityId"])
    .index("by_grid_position", ["userId", "gridPosition.row", "gridPosition.col"])
    .index("by_garden_position", ["userId", "gardenPosition.x", "gardenPosition.y"]), // Legacy index

  /* ────────────────────────────── garden layout */
  gardenLayout: defineTable({
    userId: v.id("users"),
    gridSize: v.object({                       // garden dimensions
      width: v.number(),                       // number of tiles wide
      height: v.number(),                      // number of tiles tall
    }),
    unlockedTiles: v.array(v.object({          // which tiles are available for planting
      x: v.number(),
      y: v.number(),
      unlockedAt: v.string(),                  // when this tile became available
    })),
    theme: v.optional(v.string()),             // visual theme of the garden
    lastTended: v.optional(v.string()),        // last time user visited garden
    updatedAt: v.string(),
  }).index("by_user", ["userId"]),

  /* ────────────────────────────── plant care history */
  plantCareLog: defineTable({
    userId: v.id("users"),
    plantId: v.id("plants"),
    action: v.union(                           // type of care given
      v.literal("water"),
      v.literal("fertilize"),
      v.literal("harvest"),
      v.literal("replant")
    ),
    timestamp: v.string(),                     // when care was given
    experienceGained: v.optional(v.number()),  // XP gained from this action
  })
    .index("by_user", ["userId"])
    .index("by_plant", ["plantId"])
    .index("by_user_date", ["userId", "timestamp"]),

  /* ────────────────────────────── friends */
  friendRequests: defineTable({
    fromUserId: v.string(),
    toUserId: v.string(),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined")),
    createdAt: v.string(),
    respondedAt: v.optional(v.string()),
  })
    .index("by_users", ["fromUserId", "toUserId"])
    .index("by_from", ["fromUserId"])
    .index("by_to", ["toUserId"]),

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
});

export default schema;