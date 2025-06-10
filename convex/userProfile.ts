import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Calculate level from total XP
function calculateLevelFromXP(totalXP: number): number {
  let level = 1;
  
  // Progressive XP requirements: level^2 * 250 XP
  while (getXPForLevel(level + 1) <= totalXP) {
    level++;
  }
  
  return level;
}

// XP required for each level (cumulative)
function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(Math.pow(level - 1, 2) * 250);
}

// Convert distance to XP (1km = 100 XP)
function distanceToXP(distanceMeters: number): number {
  return Math.floor(distanceMeters * 0.1);
}

// Calculate coins from total distance (1 coin per km)
function calculateCoinsFromDistance(totalDistance: number): number {
  return Math.floor(totalDistance / 1000); // 1 coin per kilometer
}

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
      lastStreakDate: undefined,
      streakFreezeAvailable: 0,
      // Default preferences
      weekStartDay: 1, // Monday
      metricSystem: "metric",
      healthKitSyncEnabled: false,
      stravaSyncEnabled: false,
      autoSyncEnabled: false,
      createdAt: now,
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
    lastSyncDate: v.optional(v.string()),
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
      calculatedCoins = calculateCoinsFromDistance(args.totalDistance);
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
        lastSyncDate: args.lastSyncDate,
        level: calculatedLevel ?? 1,
        totalXP: calculatedTotalXP ?? 0,
        coins: calculatedCoins ?? 0,
        metricSystem: args.metricSystem ?? "metric",
        createdAt: now,
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

// Get user's streak information
export const getStreakInfo = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      return null;
    }

    // Get recent planned workouts for streak calculation
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const plannedWorkouts = await ctx.db
      .query("plannedWorkouts")
      .withIndex("by_user_date", (q) => 
        q.eq("userId", userId)
         .gte("scheduledDate", thirtyDaysAgo.toISOString().split('T')[0])
      )
      .collect();

    return {
      currentStreak: profile.currentStreak || 0,
      longestStreak: profile.longestStreak || 0,
      lastStreakDate: profile.lastStreakDate || null,
      streakFreezeAvailable: profile.streakFreezeAvailable || 0,
      plannedWorkouts: plannedWorkouts.map(workout => ({
        scheduledDate: workout.scheduledDate,
        type: workout.type,
        status: workout.status
      }))
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
    const lastStreakDate = profile.lastStreakDate;

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

    if (!lastStreakDate) {
      // First ever training day completed
      newCurrentStreak = 1;
      streakIncreased = true;
    } else {
      const lastStreakDateTime = new Date(lastStreakDate).getTime();
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
      lastStreakDate: args.workoutDate,
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
      // Only training days can break streak
      if (workout.type !== 'rest' && workout.type !== 'cross-train') {
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

// Migration to update existing profiles to XP-based leveling system
export const migrateProfilesToXP = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("[Migration] Starting migration to XP-based leveling system...");
    
    // Get all profiles
    const allProfiles = await ctx.db.query("userProfiles").collect();
    const profilesToMigrate = allProfiles.filter(profile => profile.totalXP === undefined);
    
    console.log(`[Migration] Found ${profilesToMigrate.length} profiles needing XP migration`);
    
    let migratedCount = 0;
    
    for (const profile of profilesToMigrate) {
      // Calculate totalXP from existing totalDistance
      const totalXP = distanceToXP(profile.totalDistance);
      
      // Recalculate level based on XP
      const level = calculateLevelFromXP(totalXP);
      
      await ctx.db.patch(profile._id, {
        totalXP,
        level,
        updatedAt: new Date().toISOString(),
      });
      
      migratedCount++;
      console.log(`[Migration] Migrated profile ${profile._id}: ${profile.totalDistance}m → ${totalXP} XP, Level ${level}`);
    }
    
    console.log(`[Migration] Successfully migrated ${migratedCount} profiles to XP system`);
    
    return {
      success: true,
      migratedCount,
      totalProfiles: allProfiles.length,
    };
  },
}); 