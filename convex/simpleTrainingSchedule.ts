import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { recalcStreak, restoreMascotHealth } from "./utils/streak";

// Helper function to get week start date based on user preference  
function getWeekStart(date: Date, weekStartDay: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.

  let diff;
  if (weekStartDay === 1) { // Monday start
    diff = day === 0 ? 6 : day - 1;
  } else { // Sunday start
    diff = day;
  }

  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

// Get next week start date
function getNextWeekStart(date: Date, weekStartDay: number): string {
  const weekStart = getWeekStart(date, weekStartDay);
  weekStart.setDate(weekStart.getDate() + 7);
  return weekStart.toISOString().split('T')[0];
}

// Get day name from date
function getDayName(date: string): string {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const d = new Date(date);
  return dayNames[d.getDay()];
}

// Create or update simple training schedule
export const setSimpleTrainingSchedule = mutation({
  args: {
    runsPerWeek: v.number(),
    preferredDays: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Validate inputs
    if (args.runsPerWeek < 1 || args.runsPerWeek > 7) {
      throw new Error("Runs per week must be between 1 and 7");
    }

    if (args.preferredDays.length === 0) {
      throw new Error("Must specify at least one preferred day");
    }

    const validDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (const day of args.preferredDays) {
      if (!validDays.includes(day)) {
        throw new Error(`Invalid day: ${day}`);
      }
    }

    // Get user's week start preference
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();

    const weekStartDay = userProfile?.weekStartDay ?? 1; // Default to Monday
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];

    // Check if user already has a simple schedule
    const existingSchedule = await ctx.db
      .query("simpleTrainingSchedule")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();

    if (existingSchedule) {
      // Calculate current week start for the change to take effect immediately
      const thisWeekStart = getWeekStart(new Date(), weekStartDay).toISOString().split('T')[0];

      // Check if there's already a schedule history entry for this week
      const existingHistoryForWeek = await ctx.db
        .query("scheduleHistory")
        .withIndex("by_user_date", (q: any) => 
          q.eq("userId", userId).eq("effectiveFromDate", thisWeekStart)
        )
        .first();

      if (existingHistoryForWeek) {
        // Update existing history entry for this week
        await ctx.db.patch(existingHistoryForWeek._id, {
          runsPerWeek: args.runsPerWeek,
          preferredDays: args.preferredDays,
          createdAt: now
        });
      } else {
        // Add new entry to schedule history for current week (effective immediately)
        await ctx.db.insert("scheduleHistory", {
          userId,
          runsPerWeek: args.runsPerWeek,
          preferredDays: args.preferredDays,
          effectiveFromDate: thisWeekStart,
          createdAt: now
        });
      }

      // Update current schedule
      await ctx.db.patch(existingSchedule._id, {
        runsPerWeek: args.runsPerWeek,
        preferredDays: args.preferredDays,
        updatedAt: now
      });

      return { message: "Training schedule updated. Changes apply to remaining days this week." };
    } else {
      // Create new schedule starting this week
      const thisWeekStart = getWeekStart(new Date(), weekStartDay).toISOString().split('T')[0];

      const scheduleId = await ctx.db.insert("simpleTrainingSchedule", {
        userId,
        runsPerWeek: args.runsPerWeek,
        preferredDays: args.preferredDays,
        isActive: true,
        startDate: thisWeekStart,
        updatedAt: now
      });

      // Add initial entry to schedule history
      await ctx.db.insert("scheduleHistory", {
        userId,
        runsPerWeek: args.runsPerWeek,
        preferredDays: args.preferredDays,
        effectiveFromDate: thisWeekStart,
        createdAt: now
      });

      return { message: "Simple training schedule created successfully!" };
    }
  },
});

// Get user's simple training schedule
export const getSimpleTrainingSchedule = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("simpleTrainingSchedule")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();
  },
});

// Get schedule history for a user (for streak calculation)
export const getScheduleHistory = query({
  args: {
    userId: v.optional(v.id("users")), // Optional for internal use
  },
  handler: async (ctx, args) => {
    const userId = args.userId || await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("scheduleHistory")
      .withIndex("by_user_date", (q: any) => q.eq("userId", userId))
      .collect();
  },
});

// Deactivate simple training schedule
export const deactivateSimpleTrainingSchedule = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const schedule = await ctx.db
      .query("simpleTrainingSchedule")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();

    if (schedule) {
      await ctx.db.patch(schedule._id, {
        isActive: false,
        updatedAt: new Date().toISOString()
      });
    }

    return { message: "Simple training schedule deactivated" };
  },
});

// Complete a run - logs activity and updates streak/health
export const completeRun = mutation({
  args: {
    duration: v.optional(v.number()),     // minutes
    distance: v.optional(v.number()),     // meters
    calories: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user has an active simple training schedule
    const schedule = await ctx.db
      .query("simpleTrainingSchedule")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();

    if (!schedule || !schedule.isActive) {
      throw new Error("No active simple training schedule found");
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Check if user already logged a run today
    const todayActivities = await ctx.db
      .query("activities")
      .withIndex("by_user_and_date", (q: any) => 
        q.eq("userId", userId).gte("startDate", today).lt("startDate", today + "T23:59:59")
      )
      .collect();

    if (todayActivities.length > 0) {
      throw new Error("You've already logged a run today!");
    }

    // Create activity with default values if not provided
    const activity = await ctx.db.insert("activities", {
      userId,
      startDate: now.toISOString(),
      endDate: now.toISOString(),
      duration: args.duration ?? 30,      // Default 30 minutes
      distance: args.distance ?? 3000,    // Default 3km
      calories: args.calories ?? 200,     // Default 200 calories
      workoutName: args.notes ?? "Simple Training Run",
      source: "app",
      isNewActivity: true,
      syncedAt: now.toISOString()
    });

    // Update user profile totals
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();

    if (userProfile) {
      await ctx.db.patch(userProfile._id, {
        totalDistance: userProfile.totalDistance + (args.distance ?? 3000),
        totalWorkouts: userProfile.totalWorkouts + 1,
        totalCalories: userProfile.totalCalories + (args.calories ?? 200),
        updatedAt: now.toISOString()
      });
    }

    // Check if this completes the weekly goal and restore health if needed
    const weekStartDay = userProfile?.weekStartDay ?? 1;
    const thisWeekStart = getWeekStart(now, weekStartDay).toISOString().split('T')[0];
    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekEnd.getDate() + 6);
    const thisWeekEndStr = thisWeekEnd.toISOString().split('T')[0];

    const thisWeekActivities = await ctx.db
      .query("activities")
      .withIndex("by_user_and_date", (q: any) => 
        q.eq("userId", userId).gte("startDate", thisWeekStart).lte("startDate", thisWeekEndStr + "T23:59:59")
      )
      .collect();

    // Count unique run days this week (including today's run)
    const runDaysThisWeek = new Set();
    thisWeekActivities.forEach(activity => {
      const activityDate = activity.startDate.split('T')[0];
      runDaysThisWeek.add(activityDate);
    });

    const weeklyGoalMet = runDaysThisWeek.size >= schedule.runsPerWeek;
    
    // If weekly goal is met, restore 1 health point
    if (weeklyGoalMet) {
      await restoreMascotHealth(ctx.db, userId);
    }

    // Recalculate streak
    await recalcStreak(ctx.db, userId, today);

    return { 
      message: "Run completed successfully! 🏃‍♂️",
      activityId: activity,
      weeklyProgress: {
        completed: runDaysThisWeek.size,
        target: schedule.runsPerWeek,
        goalMet: weeklyGoalMet
      }
    };
  },
}); 