import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";

// Get planned workouts for a user within a date range
export const getPlannedWorkouts = query({
  args: {
    days: v.optional(v.number()), // Number of days from today to fetch
    startDate: v.optional(v.string()), // ISO date string for start range
    endDate: v.optional(v.string()), // ISO date string for end range
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const now = new Date();
    let startDate: string;
    let endDate: string;

    if (args.startDate && args.endDate) {
      // Use provided date range
      startDate = args.startDate;
      endDate = args.endDate;
    } else {
      // Calculate date range from days parameter
      const days = args.days || 7;
      const start = new Date(now);
      start.setDate(now.getDate() - Math.floor(days / 2)); // Start from half the days ago
      const end = new Date(now);
      end.setDate(now.getDate() + Math.ceil(days / 2)); // End at half the days ahead
      
      startDate = start.toISOString().split('T')[0]; // YYYY-MM-DD format
      endDate = end.toISOString().split('T')[0];
    }

    return await ctx.db
      .query("plannedWorkouts")
      .withIndex("by_user_date", (q: any) => 
        q.eq("userId", userId)
         .gte("scheduledDate", startDate)
         .lte("scheduledDate", endDate)
      )
      .order("asc")
      .collect();
  },
});

// Get today's planned workout
export const getTodaysWorkout = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    return await ctx.db
      .query("plannedWorkouts")
      .withIndex("by_user_date", (q: any) => 
        q.eq("userId", userId).eq("scheduledDate", today)
      )
      .first();
  },
});

// Get workouts for a specific date
export const getWorkoutsForDate = query({
  args: {
    date: v.string(), // YYYY-MM-DD format
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    return await ctx.db
      .query("plannedWorkouts")
      .withIndex("by_user_date", (q: any) => 
        q.eq("userId", userId).eq("scheduledDate", args.date)
      )
      .collect();
  },
});

// Get a specific planned workout by ID
export const getById = query({
  args: {
    id: v.id("plannedWorkouts"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const workout = await ctx.db.get(args.id);
    
    // Ensure the workout belongs to the authenticated user
    if (!workout || workout.userId !== userId) {
      return null;
    }

    return workout;
  },
}); 