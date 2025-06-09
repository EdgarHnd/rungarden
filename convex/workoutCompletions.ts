import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";

// Get user's workout completions within a date range
export const getUserCompletions = query({
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
      const days = args.days || 30;
      const start = new Date(now);
      start.setDate(now.getDate() - days);
      const end = new Date(now);
      
      startDate = start.toISOString();
      endDate = end.toISOString();
    }

    return await ctx.db
      .query("workoutCompletions")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .filter((q: any) => 
        q.and(
          q.gte(q.field("completedAt"), startDate),
          q.lte(q.field("completedAt"), endDate)
        )
      )
      .order("desc")
      .collect();
  },
});

// Get completion for a specific planned workout
export const getCompletionForWorkout = query({
  args: {
    plannedWorkoutId: v.id("plannedWorkouts"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    return await ctx.db
      .query("workoutCompletions")
      .withIndex("by_planned_workout", (q: any) => 
        q.eq("plannedWorkoutId", args.plannedWorkoutId)
      )
      .filter((q: any) => q.eq(q.field("userId"), userId))
      .first();
  },
}); 