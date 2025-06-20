import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  calculateLevelFromXP,
  distanceToXP
} from "./utils/gamification";

// Gamification functions moved to ./utils/gamification.ts

// Get user profile
export const getOrCreateProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingProfile) {
      return existingProfile;
    }

    // Return null if no profile exists - will be created by mutation
    return null;
  },
});

// Create user profile (mutation)
export const createProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingProfile) {
      return existingProfile;
    }

    // Create new profile with default values
    const now = new Date().toISOString();
    const newProfileId = await ctx.db.insert("userProfiles", {
      userId,
      weeklyGoal: 10000, // 10km default
      totalDistance: 0,
      totalWorkouts: 0,
      totalCalories: 0,
      level: 1,
      totalXP: 0,
      coins: 0,
      // Initialize streak fields
      currentStreak: 0,
      longestStreak: 0,
      lastStreakWeek: undefined,
      streakFreezeAvailable: 0,
      // Initialize mascot health
      mascotHealth: 4,
      // Default preferences
      weekStartDay: 1, // Monday
      metricSystem: "metric",
      healthKitSyncEnabled: false,
      stravaSyncEnabled: false,
      autoSyncEnabled: false,
      updatedAt: now,
    });

    return await ctx.db.get(newProfileId);
  },
});

// Update user profile (creates if doesn't exist)
export const updateProfile = mutation({
  args: {
    weeklyGoal: v.optional(v.number()),
    totalDistance: v.optional(v.number()),
    totalWorkouts: v.optional(v.number()),
    totalCalories: v.optional(v.number()),
    level: v.optional(v.number()),
    totalXP: v.optional(v.number()),
    coins: v.optional(v.number()),
    metricSystem: v.optional(v.union(v.literal("metric"), v.literal("imperial"))),
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
      calculatedCoins = 0; // Don't calculate coins automatically
    }

    // Calculate totalXP from totalDistance if not provided
    let calculatedTotalXP = args.totalXP;
    if (calculatedTotalXP === undefined && args.totalDistance !== undefined) {
      calculatedTotalXP = distanceToXP(args.totalDistance);
    }

    // Calculate level from totalXP if level not provided
    let calculatedLevel = args.level;
    if (calculatedLevel === undefined && calculatedTotalXP !== undefined) {
      calculatedLevel = calculateLevelFromXP(calculatedTotalXP);
    }

    if (existingProfile) {
      // Update existing profile
      const updateData: any = {
        ...args,
        updatedAt: now,
      };
      
      // Include calculated values if we calculated them
      if (calculatedCoins !== undefined) {
        updateData.coins = calculatedCoins;
      }
      if (calculatedTotalXP !== undefined) {
        updateData.totalXP = calculatedTotalXP;
      }
      if (calculatedLevel !== undefined) {
        updateData.level = calculatedLevel;
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
        level: calculatedLevel ?? 1,
        totalXP: calculatedTotalXP ?? 0,
        coins: calculatedCoins ?? 0,
        currentStreak: 0,
        longestStreak: 0,
        streakFreezeAvailable: 0,
        mascotHealth: 4,
        metricSystem: args.metricSystem ?? "metric",
        updatedAt: now,
      });
    }
  },
});

// Update weekly goal
export const updateWeeklyGoal = mutation({
  args: { goal: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      throw new Error("Profile not found");
    }

    await ctx.db.patch(profile._id, {
      weeklyGoal: args.goal,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

// Update metric system preference
export const updateMetricSystem = mutation({
  args: { metricSystem: v.union(v.literal("metric"), v.literal("imperial")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      throw new Error("Profile not found");
    }

    await ctx.db.patch(profile._id, {
      metricSystem: args.metricSystem,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

// Update Strava tokens (for server-side token refresh)
export const updateStravaTokens = mutation({
  args: {
    userId: v.id("users"),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, {
        stravaAccessToken: args.accessToken,
        stravaRefreshToken: args.refreshToken,
        stravaTokenExpiresAt: args.expiresAt,
        updatedAt: new Date().toISOString(),
      });
    }
  },
});

// Update sync preferences
export const updateSyncPreferences = mutation({
  args: {
    healthKitSyncEnabled: v.optional(v.boolean()),
    stravaSyncEnabled: v.optional(v.boolean()),
    lastHealthKitSync: v.optional(v.union(v.string(), v.null())),
    lastStravaSync: v.optional(v.union(v.string(), v.null())),
    stravaAthleteId: v.optional(v.number()),
    stravaAccessRevoked: v.optional(v.boolean()),
    stravaAccessToken: v.optional(v.string()),
    stravaRefreshToken: v.optional(v.string()),
    stravaTokenExpiresAt: v.optional(v.number()),
    pushNotificationToken: v.optional(v.string()),
    pushNotificationsEnabled: v.optional(v.boolean()),
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
        totalXP: 0,
        coins: 0,
        currentStreak: 0,
        longestStreak: 0,
        streakFreezeAvailable: 0,
        mascotHealth: 4,
        healthKitSyncEnabled: args.healthKitSyncEnabled ?? false,
        stravaSyncEnabled: args.stravaSyncEnabled ?? false,
        lastHealthKitSync: args.lastHealthKitSync === null ? undefined : args.lastHealthKitSync,
        lastStravaSync: args.lastStravaSync === null ? undefined : args.lastStravaSync,
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

// Update push notification settings
export const updatePushNotificationSettings = mutation({
  args: {
    token: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
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

    if (!existingProfile) {
      throw new Error("Profile not found");
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (args.token !== undefined) {
      updateData.pushNotificationToken = args.token;
    }
    if (args.enabled !== undefined) {
      updateData.pushNotificationsEnabled = args.enabled;
    }

    await ctx.db.patch(existingProfile._id, updateData);
    
    return { success: true };
  },
});

// Get user's push notification settings
export const getPushNotificationSettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { enabled: false, token: null };
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return {
      enabled: profile?.pushNotificationsEnabled ?? false,
      token: profile?.pushNotificationToken ?? null,
    };
  },
});

// Update streak when workout is completed
export const updateStreakOnCompletion = mutation({
  args: { 
    workoutDate: v.string(),
    workoutType: v.string(),
    plannedWorkoutId: v.optional(v.id("plannedWorkouts"))
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      throw new Error("Profile not found");
    }

    // Only training days count toward streak
    if (args.workoutType === 'rest' || args.workoutType === 'cross-train') {
      return {
        streakUpdated: false,
        currentStreak: profile.currentStreak || 0,
        streakIncreased: false
      };
    }

    const currentStreak = profile.currentStreak || 0;
    const longestStreak = profile.longestStreak || 0;
    const lastStreakWeek = profile.lastStreakWeek;

    // Calculate new streak values
    let newCurrentStreak = currentStreak;
    let streakIncreased = false;
    const today = new Date().toISOString().split('T')[0];

    // Only count workouts completed today or in the past
    if (args.workoutDate > today) {
      return {
        streakUpdated: false,
        currentStreak,
        streakIncreased: false
      };
    }

    if (!lastStreakWeek) {
      // First ever training day completed
      newCurrentStreak = 1;
      streakIncreased = true;
    } else {
      const lastStreakDateTime = new Date(lastStreakWeek).getTime();
      const workoutDateTime = new Date(args.workoutDate).getTime();
      const daysBetween = Math.floor((workoutDateTime - lastStreakDateTime) / (1000 * 60 * 60 * 24));

      if (daysBetween <= 3) { // Allow some flexibility for training plans
        newCurrentStreak = currentStreak + 1;
        streakIncreased = true;
      } else {
        // Gap is too large, reset streak
        newCurrentStreak = 1;
        streakIncreased = false;
      }
    }

    const newLongestStreak = Math.max(newCurrentStreak, longestStreak);

    // Check for milestone rewards
    let newStreakFreezes = profile.streakFreezeAvailable || 0;
    let milestoneMessage: string | undefined;

    const milestones = [7, 14, 30, 60, 100, 365];
    for (const milestone of milestones) {
      if (newCurrentStreak >= milestone && currentStreak < milestone) {
        // Award streak freezes at certain milestones
        if (milestone === 7) {
          newStreakFreezes += 1;
          milestoneMessage = "7 day streak! Earned 1 streak freeze! 🧊";
        } else if (milestone === 30) {
          newStreakFreezes += 2;
          milestoneMessage = "30 day streak! Earned 2 streak freezes! 🧊🧊";
        } else if (milestone === 100) {
          newStreakFreezes += 3;
          milestoneMessage = "100 day streak! Earned 3 streak freezes! 🧊🧊🧊";
        } else {
          milestoneMessage = `${milestone} day streak milestone! Amazing! 🏆`;
        }
        break;
      }
    }

    // Update profile with new streak values
    await ctx.db.patch(profile._id, {
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      lastStreakWeek: args.workoutDate,
      streakFreezeAvailable: newStreakFreezes,
      updatedAt: new Date().toISOString(),
    });

    return {
      streakUpdated: true,
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      streakIncreased,
      milestoneMessage,
      streakFreezesEarned: newStreakFreezes - (profile.streakFreezeAvailable || 0)
    };
  },
});

// Mark missed workouts and update streak accordingly
export const handleMissedWorkouts = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Find scheduled workouts that are now overdue
    const overdueWorkouts = await ctx.db
      .query("plannedWorkouts")
      .withIndex("by_user_date", (q) => 
        q.eq("userId", userId)
         .lt("scheduledDate", today)
      )
      .filter((q) => q.eq(q.field("status"), "scheduled"))
      .collect();

    let streakBroken = false;
    let brokenBy: string[] = [];

    // Mark overdue workouts as missed
    for (const workout of overdueWorkouts) {
      // Get workout details to check type
      const workoutDetails = await ctx.db.get(workout.workoutId);
      const workoutType = workoutDetails?.type || "run";
      
      // Only training days can break streak
      if (workoutType !== 'rest' && workoutType !== 'cross-train') {
        streakBroken = true;
        brokenBy.push(workout.scheduledDate);
      }

      await ctx.db.patch(workout._id, {
        status: "missed",
      });
    }

    // If streak was broken, reset it
    if (streakBroken) {
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();

      if (profile && profile.currentStreak && profile.currentStreak > 0) {
        await ctx.db.patch(profile._id, {
          currentStreak: 0,
          updatedAt: new Date().toISOString(),
        });

        return {
          streakBroken: true,
          missedWorkouts: brokenBy.length,
          message: `Streak broken due to ${brokenBy.length} missed training day(s). Time to start fresh! 💪`
        };
      }
    }

    return {
      streakBroken: false,
      missedWorkouts: overdueWorkouts.length,
      message: overdueWorkouts.length > 0 ? `${overdueWorkouts.length} workout(s) marked as missed.` : null
    };
  },
});

// Use a streak freeze
export const useStreakFreeze = mutation({
  args: { reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      throw new Error("Profile not found");
    }

    const availableFreezes = profile.streakFreezeAvailable || 0;
    if (availableFreezes <= 0) {
      throw new Error("No streak freezes available");
    }

    await ctx.db.patch(profile._id, {
      streakFreezeAvailable: availableFreezes - 1,
      updatedAt: new Date().toISOString(),
    });

    return {
      success: true,
      remainingFreezes: availableFreezes - 1,
      message: "Streak freeze used! Your streak is protected. 🧊"
    };
  },
});


// Get rest activities for a user within a date range
export const getRestActivities = query({
  args: {
    startDate: v.string(), // YYYY-MM-DD format
    endDate: v.string(),   // YYYY-MM-DD format
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const restActivities = await ctx.db
      .query("restActivities")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => 
        q.and(
          q.gte(q.field("date"), args.startDate),
          q.lte(q.field("date"), args.endDate)
        )
      )
      .collect();

    return restActivities;
  },
});

// Check if a specific date has a completed rest day
export const isRestDayCompleted = query({
  args: { 
    date: v.string() // YYYY-MM-DD format
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const restActivity = await ctx.db
      .query("restActivities")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", args.date))
      .first();

    return {
      isCompleted: !!restActivity,
      restActivity: restActivity || null,
    };
  },
});

// Complete rest day and update streak
export const completeRestDay = mutation({
  args: { 
    date: v.string(), // Date in YYYY-MM-DD format
    notes: v.optional(v.string()) // Optional notes about the rest day
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      throw new Error("Profile not found");
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Only allow completing today's rest day
    if (args.date !== today) {
      throw new Error("Can only complete today's rest day");
    }

    // Check if rest day has already been completed today
    const existingRestActivity = await ctx.db
      .query("restActivities")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", args.date))
      .first();

    if (existingRestActivity) {
      // Return success with current streak info instead of throwing error
      return {
        success: false,
        alreadyCompleted: true,
        message: "Rest day already completed for today",
        rewards: {
          xpGained: existingRestActivity.xpGained,
          coinsGained: existingRestActivity.coinsGained,
          leveledUp: false,
          oldLevel: profile.level || 1,
          newLevel: profile.level || 1,
        },
        streak: {
          currentStreak: profile.currentStreak || 0,
          longestStreak: profile.longestStreak || 0,
          streakIncreased: false,
          milestoneMessage: undefined,
          streakFreezesEarned: 0
        }
      };
    }

    // Rest day rewards: 100 XP and 10 coins
    const restXP = 100;
    const restCoins = 10;
    
    const currentXP = profile.totalXP || 0;
    const currentCoins = profile.coins || 0;
    const currentStreak = profile.currentStreak || 0;
    const longestStreak = profile.longestStreak || 0;
    const lastStreakWeek = profile.lastStreakWeek;

    // Calculate new totals
    const newTotalXP = currentXP + restXP;
    const newCoins = currentCoins + restCoins;
    const newLevel = calculateLevelFromXP(newTotalXP);
    const oldLevel = profile.level || 1;

    // Update streak for rest day completion
    let newCurrentStreak = currentStreak;
    let streakIncreased = false;

    if (!lastStreakWeek || currentStreak === 0) {
      // First ever day completed (rest day can start a streak)
      newCurrentStreak = 1;
      streakIncreased = true;
    } else {
      const lastStreakDateTime = new Date(lastStreakWeek).getTime();
      const restDateTime = new Date(args.date).getTime();
      const daysBetween = Math.floor((restDateTime - lastStreakDateTime) / (1000 * 60 * 60 * 24));

      if (daysBetween <= 3) { // Allow some flexibility
        newCurrentStreak = currentStreak + 1;
        streakIncreased = true;
      } else {
        // Gap is too large, reset streak to 1 (this rest day still counts)
        newCurrentStreak = 1;
        streakIncreased = false;
      }
    }

    const newLongestStreak = Math.max(newCurrentStreak, longestStreak);

    // Check for milestone rewards
    let newStreakFreezes = profile.streakFreezeAvailable || 0;
    let milestoneMessage: string | undefined;

    const milestones = [7, 14, 30, 60, 100, 365];
    for (const milestone of milestones) {
      if (newCurrentStreak >= milestone && currentStreak < milestone) {
        // Award streak freezes at certain milestones
        if (milestone === 7) {
          newStreakFreezes += 1;
          milestoneMessage = "7 day streak! Earned 1 streak freeze! 🧊";
        } else if (milestone === 30) {
          newStreakFreezes += 2;
          milestoneMessage = "30 day streak! Earned 2 streak freezes! 🧊🧊";
        } else if (milestone === 100) {
          newStreakFreezes += 3;
          milestoneMessage = "100 day streak! Earned 3 streak freezes! 🧊🧊🧊";
        } else {
          milestoneMessage = `${milestone} day streak milestone! Amazing! 🏆`;
        }
        break;
      }
    }

    // Create rest activity entry
    const restActivityId = await ctx.db.insert("restActivities", {
      userId,
      date: args.date,
      completedAt: new Date().toISOString(),
      xpGained: restXP,
      coinsGained: restCoins,
      notes: args.notes,
    });

    // Update profile with new values
    await ctx.db.patch(profile._id, {
      totalXP: newTotalXP,
      level: newLevel,
      coins: newCoins,
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      lastStreakWeek: args.date,
      streakFreezeAvailable: newStreakFreezes,
      updatedAt: new Date().toISOString(),
    });

    return {
      success: true,
      restActivityId,
      rewards: {
        xpGained: restXP,
        coinsGained: restCoins,
        leveledUp: newLevel > oldLevel,
        oldLevel,
        newLevel,
      },
      streak: {
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        streakIncreased,
        milestoneMessage,
        streakFreezesEarned: newStreakFreezes - (profile.streakFreezeAvailable || 0)
      }
    };
  },
});

// Get user profile by userId (for server-side operations like webhooks)
export const getProfileByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

// Get user profile or create if it doesn't exist
export const getOrCreateProfileByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = args.userId;
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingProfile) {
      return existingProfile;
    }

    // Return null if no profile exists - will be created by mutation
    return null;
  },
});

// Helper function to update user profile totals
async function updateUserProfileTotalsInternal(ctx: any, userId: any) {
  const allActivities = await ctx.db
    .query("activities")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  const totalDistance = allActivities.reduce((sum: number, a: any) => sum + a.distance, 0);
  const totalCalories = allActivities.reduce((sum: number, a: any) => sum + a.calories, 0);
  const totalWorkouts = allActivities.length;
  
  // Calculate XP and level from total distance
  const totalXP = distanceToXP(totalDistance);
  const level = calculateLevelFromXP(totalXP);
  
  // Don't calculate coins automatically
  const coins = 0;

  const existingProfile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  const now = new Date().toISOString();

  if (existingProfile) {
    await ctx.db.patch(existingProfile._id, {
      totalDistance,
      totalWorkouts,
      totalCalories,
      totalXP,
      level,
      coins,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("userProfiles", {
      userId,
      weeklyGoal: 10000, // Default 10km
      totalDistance,
      totalWorkouts,
      totalCalories,
      totalXP,
      level,
      coins,
      currentStreak: 0,
      longestStreak: 0,
      streakFreezeAvailable: 0,
      mascotHealth: 4,
      updatedAt: now,
    });
  }
}

// Delete a rest activity (for corrections or testing)
export const deleteRestActivity = mutation({
  args: { 
    date: v.string() // YYYY-MM-DD format
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const restActivity = await ctx.db
      .query("restActivities")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", args.date))
      .first();

    if (!restActivity) {
      throw new Error("Rest activity not found for this date");
    }

    await ctx.db.delete(restActivity._id);

    return {
      success: true,
      message: "Rest activity deleted successfully",
    };
  },
}); 