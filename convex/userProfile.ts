import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Calculate level from total distance
function calculateLevelFromDistance(totalDistance: number): number {
  let level = 1;
  
  // Progressive distance requirements: level^2 * 2.5km
  while (getDistanceForLevel(level + 1) <= totalDistance) {
    level++;
  }
  
  return level;
}

// Distance required for each level (cumulative, in meters)
function getDistanceForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(Math.pow(level - 1, 2) * 2500); // 2500 meters = 2.5km
}

// Calculate coins from total distance (1 coin per km)
function calculateCoinsFromDistance(totalDistance: number): number {
  return Math.floor(totalDistance / 1000); // 1 coin per kilometer
}

// Get or create user profile
export const getOrCreateProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (profile) {
      return profile;
    }

    // If no profile exists, return default values
    return {
      userId,
      weeklyGoal: 10000, // 10km default weekly goal
      totalDistance: 0,
      totalWorkouts: 0,
      totalCalories: 0,
      lastSyncDate: null,
      level: 1,
      coins: 0, // Start with 0 coins
      weekStartDay: 1, // Default to Monday
      // Sync preferences - all disabled by default
      healthKitSyncEnabled: false,
      stravaSyncEnabled: false,
      autoSyncEnabled: false,
      lastHealthKitSync: undefined,
      lastStravaSync: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },
});

// Update user profile (creates if doesn't exist)
export const updateProfile = mutation({
  args: {
    weeklyGoal: v.optional(v.number()),
    totalDistance: v.optional(v.number()),
    totalWorkouts: v.optional(v.number()),
    totalCalories: v.optional(v.number()),
    lastSyncDate: v.optional(v.string()),
    level: v.optional(v.number()),
    coins: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const now = new Date().toISOString();

    // Calculate coins from total distance if not provided but totalDistance is
    let calculatedCoins = args.coins;
    if (calculatedCoins === undefined && args.totalDistance !== undefined) {
      calculatedCoins = calculateCoinsFromDistance(args.totalDistance);
    }

    if (existingProfile) {
      // Update existing profile
      const updateData: any = {
        ...args,
        updatedAt: now,
      };
      
      // Include calculated coins if we calculated them
      if (calculatedCoins !== undefined) {
        updateData.coins = calculatedCoins;
      }

      await ctx.db.patch(existingProfile._id, updateData);
      return existingProfile._id;
    } else {
      // Create new profile
      return await ctx.db.insert("userProfiles", {
        userId,
        weeklyGoal: args.weeklyGoal ?? 10000,
        totalDistance: args.totalDistance ?? 0,
        totalWorkouts: args.totalWorkouts ?? 0,
        totalCalories: args.totalCalories ?? 0,
        lastSyncDate: args.lastSyncDate,
        level: args.level ?? 1,
        coins: calculatedCoins ?? 0,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// Update weekly goal specifically
export const updateWeeklyGoal = mutation({
  args: {
    weeklyGoal: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first()
      .then(async (profile) => {
        if (profile) {
          return await ctx.db.patch(profile._id, {
            weeklyGoal: args.weeklyGoal,
            updatedAt: new Date().toISOString(),
          });
        } else {
          // Create profile if it doesn't exist
          return await ctx.db.insert("userProfiles", {
            userId,
            weeklyGoal: args.weeklyGoal,
            totalDistance: 0,
            totalWorkouts: 0,
            totalCalories: 0,
            level: 1,
            coins: 0, // Start with 0 coins
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      });
  },
});

// Update sync preferences
export const updateSyncPreferences = mutation({
  args: {
    healthKitSyncEnabled: v.optional(v.boolean()),
    stravaSyncEnabled: v.optional(v.boolean()),
    autoSyncEnabled: v.optional(v.boolean()),
    lastHealthKitSync: v.optional(v.union(v.string(), v.null())),
    lastStravaSync: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const now = new Date().toISOString();

    if (existingProfile) {
      // Update existing profile
      const updateData: any = {
        ...args,
        updatedAt: now,
      };

      // Handle null values properly for optional string fields
      if (args.lastHealthKitSync === null) {
        updateData.lastHealthKitSync = undefined;
      }
      if (args.lastStravaSync === null) {
        updateData.lastStravaSync = undefined;
      }

      await ctx.db.patch(existingProfile._id, updateData);
      return existingProfile._id;
    } else {
      // Create new profile with sync preferences
      return await ctx.db.insert("userProfiles", {
        userId,
        weeklyGoal: 10000, // Default 10km
        totalDistance: 0,
        totalWorkouts: 0,
        totalCalories: 0,
        level: 1,
        coins: 0,
        healthKitSyncEnabled: args.healthKitSyncEnabled ?? false,
        stravaSyncEnabled: args.stravaSyncEnabled ?? false,
        autoSyncEnabled: args.autoSyncEnabled ?? false,
        lastHealthKitSync: args.lastHealthKitSync === null ? undefined : args.lastHealthKitSync,
        lastStravaSync: args.lastStravaSync === null ? undefined : args.lastStravaSync,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// Get current week's progress
export const getCurrentWeekProgress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get user's week start preference
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const weekStartDay = profile?.weekStartDay ?? 1; // Default to Monday

    // Get start of current week based on user preference
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    let daysToWeekStart;
    if (weekStartDay === 1) { // Monday start
      daysToWeekStart = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, Monday = 1
    } else { // Sunday start
      daysToWeekStart = dayOfWeek;
    }
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysToWeekStart);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartISO = weekStart.toISOString();

    const weekProgress = await ctx.db
      .query("weeklyProgress")
      .withIndex("by_user_and_week", (q) => 
        q.eq("userId", userId).eq("weekStart", weekStartISO)
      )
      .first();

    if (weekProgress) {
      return weekProgress;
    }

    // Calculate progress from activities if no weekly progress entry exists
    const endOfWeek = new Date(weekStart);
    endOfWeek.setDate(weekStart.getDate() + 7);
    
    const weekActivities = await ctx.db
      .query("activities")
      .withIndex("by_user_and_date", (q) => 
        q.eq("userId", userId).gte("startDate", weekStartISO).lt("startDate", endOfWeek.toISOString())
      )
      .collect();

    const actualDistance = weekActivities.reduce((sum, activity) => sum + activity.distance, 0);
    const totalCalories = weekActivities.reduce((sum, activity) => sum + activity.calories, 0);

    return {
      weekStart: weekStartISO,
      goalDistance: profile?.weeklyGoal ?? 10000,
      actualDistance,
      workoutCount: weekActivities.length,
      totalCalories,
    };
  },
});

// Spend coins mutation (for shop functionality)
export const spendCoins = mutation({
  args: {
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (args.amount <= 0) {
      throw new Error("Amount must be positive");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      throw new Error("Profile not found");
    }

    const currentCoins = profile.coins ?? 0;
    if (currentCoins < args.amount) {
      throw new Error("Insufficient coins");
    }

    await ctx.db.patch(profile._id, {
      coins: currentCoins - args.amount,
      updatedAt: new Date().toISOString(),
    });

    return {
      success: true,
      remainingCoins: currentCoins - args.amount,
    };
  },
});

// Get user's current coin balance
export const getUserCoins = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return profile?.coins ?? 0;
  },
}); 