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
      weekStartDay: 1, // Default to Monday
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
      await ctx.db.patch(existingProfile._id, {
        ...args,
        updatedAt: now,
      });
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
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      });
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