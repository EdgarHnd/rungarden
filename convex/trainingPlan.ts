import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Simple workout types
const WORKOUT_TYPES = {
  easy: { name: "Easy Run", description: "Easy conversational pace run" },
  long: { name: "Long Run", description: "Longer endurance building run" },
  rest: { name: "Rest Day", description: "Rest or gentle stretching" }
};

// Simple distance progression by goal
const GOAL_DISTANCES = {
  "5K": { target: 5000, weeks: 8 },
  "10K": { target: 10000, weeks: 12 },
  "half-marathon": { target: 21097, weeks: 16 },
  "marathon": { target: 42195, weeks: 20 },
  "just-run-more": { target: 5000, weeks: 8 }
};

// Helper function to get week start based on user preference
function getWeekStart(date: Date, weekStartDay: number) {
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

// Calculate weeks between start and goal date
function calculateWeeksToGoal(startDate: string, goalDate: string, weekStartDay: number): number {
  const start = new Date(startDate);
  const goal = new Date(goalDate);
  
  const weekStart = getWeekStart(start, weekStartDay);
  
  let weeks = 0;
  let currentWeekStart = new Date(weekStart);
  currentWeekStart.setDate(weekStart.getDate() + 7); // Start from next week
  
  while (true) {
    weeks++;
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 6);
    
    if (goal >= currentWeekStart && goal <= weekEnd) {
      break;
    }
    
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    
    if (weeks > 52) {
      break;
    }
  }
  
  return Math.max(weeks, 1);
}

// Simple workout pattern based on days per week
function getWorkoutPattern(daysPerWeek: number): string[] {
  const patterns: Record<number, string[]> = {
    2: ["easy", "long"],
    3: ["easy", "easy", "long"],
    4: ["easy", "easy", "easy", "long"],
    5: ["easy", "easy", "easy", "easy", "long"],
    6: ["easy", "easy", "easy", "easy", "easy", "long"]
  };
  
  return patterns[daysPerWeek] || patterns[3];
}

// Generate a simple training plan
export const generateTrainingPlan = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get user's training profile
    const profile = await ctx.db
      .query("trainingProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      throw new Error("Training profile not found. Complete onboarding first.");
    }

    // Get user's week start preference
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const weekStartDay = userProfile?.weekStartDay ?? 1;
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];

    // Calculate plan parameters
    const weeksToGoal = calculateWeeksToGoal(today, profile.goalDate, weekStartDay);
    const goalConfig = GOAL_DISTANCES[profile.goalDistance as keyof typeof GOAL_DISTANCES];
    const weeks = Math.max(weeksToGoal, goalConfig.weeks);

    // Deactivate any existing plans
    const existingPlans = await ctx.db
      .query("trainingPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const plan of existingPlans) {
      await ctx.db.patch(plan._id, { isActive: false });
    }

    // Generate simple plan
    const planWeeks = [];
    const pattern = getWorkoutPattern(profile.daysPerWeek);
    
    // Start from next week
    const startDate = new Date();
    const thisWeekStart = getWeekStart(startDate, weekStartDay);
    const nextWeekStart = new Date(thisWeekStart);
    nextWeekStart.setDate(thisWeekStart.getDate() + 7);

    const dayNameToNumber: Record<string, number> = {
      'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
    };

    for (let weekNum = 1; weekNum <= weeks; weekNum++) {
      const weekStartDate = new Date(nextWeekStart);
      weekStartDate.setDate(nextWeekStart.getDate() + ((weekNum - 1) * 7));
      
      const dayWorkouts = [];
      
      // Simple progression: start at 2km and gradually increase
      const baseDistance = 2000; // 2km
      const weeklyIncrease = 500; // 500m per week
      const currentWeekDistance = baseDistance + (weekNum - 1) * weeklyIncrease;

      // Schedule workouts on preferred days
      const preferredDays = profile.preferredDays || ['Mon', 'Wed', 'Fri'];
      
      for (let workoutIndex = 0; workoutIndex < pattern.length; workoutIndex++) {
        const workoutType = pattern[workoutIndex];
        const preferredDay = preferredDays[workoutIndex % preferredDays.length];
        const dayNumber = dayNameToNumber[preferredDay];
        
        const workoutDate = new Date(weekStartDate);
        const daysFromMonday = (dayNumber - 1 + 7) % 7;
        workoutDate.setDate(weekStartDate.getDate() + daysFromMonday);
        
        // Spread workouts if more workouts than preferred days
        if (workoutIndex > 0 && preferredDays.length < pattern.length) {
          const daySpacing = Math.floor(7 / pattern.length);
          const adjustedDay = (dayNumber + (workoutIndex * daySpacing)) % 7;
          const adjustedDaysFromMonday = (adjustedDay - 1 + 7) % 7;
          workoutDate.setDate(weekStartDate.getDate() + adjustedDaysFromMonday);
        }
        
        const dateString = workoutDate.toISOString().split('T')[0];
        
        // Calculate distance for this workout
        let distance = currentWeekDistance;
        if (workoutType === "long") {
          distance = Math.round(currentWeekDistance * 1.5); // Long runs are 50% longer
        }
        
        // Estimate duration (assuming 6 min/km pace)
        const estimatedMinutes = Math.round((distance / 1000) * 6);

        dayWorkouts.push({
          date: dateString,
          type: workoutType,
          distance: distance,
          duration: `${estimatedMinutes} min`,
          description: WORKOUT_TYPES[workoutType as keyof typeof WORKOUT_TYPES]?.description || "Training workout",
          target: workoutType === "easy" ? "Conversational pace" : workoutType === "long" ? "Steady comfortable effort" : "Easy effort"
        });
      }
      
      planWeeks.push({
        week: weekNum,
        microCycle: weekNum <= weeks * 0.7 ? "base" : "peak" as "base" | "build" | "peak" | "taper",
        days: dayWorkouts
      });
    }

    // Add race day if goal date is set and not "just-run-more"
    if (profile.goalDistance !== 'just-run-more' && weeks > 0) {
      const lastWeek = planWeeks[planWeeks.length - 1];
      const goalDate = new Date(profile.goalDate);
      const goalDateString = goalDate.toISOString().split('T')[0];
      
      // Check if race day already has a workout
      const hasRaceDay = lastWeek.days.some((day: any) => day.date === goalDateString);
      
      if (!hasRaceDay) {
        const targetDistance = goalConfig.target;
        const estimatedMinutes = Math.round((targetDistance / 1000) * 6);
        
        lastWeek.days.push({
          date: goalDateString,
          type: "race",
          distance: targetDistance,
          duration: `${estimatedMinutes} min`,
          description: `${profile.goalDistance} Race Day - You've got this!`,
          target: "Race pace"
        });
      }
    }

    // Create the training plan
    const planId = await ctx.db.insert("trainingPlans", {
      userId,
      meta: {
        goal: profile.goalDistance,
        weeks,
        level: profile.fitnessLevel,
        daysPerWeek: profile.daysPerWeek,
        createdAt: now,
      },
      isActive: true,
      plan: planWeeks,
      createdAt: now,
      updatedAt: now,
    });

    // Generate planned workouts for the first 4 weeks
    await generatePlannedWorkouts(ctx, planId, userId, planWeeks.slice(0, 4));

    return { planId, weeks, message: "Simple training plan generated successfully" };
  },
});

// Helper function to generate planned workouts
async function generatePlannedWorkouts(
  ctx: any,
  planId: any,
  userId: any,
  planWeeks: any[]
) {
  for (let weekIndex = 0; weekIndex < planWeeks.length; weekIndex++) {
    const planWeek = planWeeks[weekIndex];
    
    for (let dayIndex = 0; dayIndex < planWeek.days.length; dayIndex++) {
      const day = planWeek.days[dayIndex];

      await ctx.db.insert("plannedWorkouts", {
        userId,
        trainingPlanId: planId,
        planWeek: planWeek.week,
        planDay: dayIndex,
        scheduledDate: day.date,
        type: day.type,
        workoutId: undefined,
        duration: day.duration,
        distance: day.distance,
        description: day.description,
        target: day.target,
        status: "scheduled",
        createdAt: new Date().toISOString(),
      });
    }
  }
}

// Get user's active training plan
export const getActiveTrainingPlan = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("trainingPlans")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .first();
  },
});

// Get planned workouts for a date range
export const getPlannedWorkouts = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("plannedWorkouts")
      .withIndex("by_user_date", (q: any) => 
        q.eq("userId", userId)
         .gte("scheduledDate", args.startDate)
         .lte("scheduledDate", args.endDate)
      )
      .collect();
  },
});

// Get today's planned workout
export const getTodaysWorkout = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const today = new Date().toISOString().split('T')[0];

    return await ctx.db
      .query("plannedWorkouts")
      .withIndex("by_user_date", (q: any) => q.eq("userId", userId).eq("scheduledDate", today))
      .first();
  },
});

// Mark workout as completed
export const completeWorkout = mutation({
  args: {
    plannedWorkoutId: v.id("plannedWorkouts"),
    actualDuration: v.optional(v.number()),
    actualDistance: v.optional(v.number()),
    averagePace: v.optional(v.number()),
    averageHeartRate: v.optional(v.number()),
    calories: v.optional(v.number()),
    perceivedEffort: v.optional(v.number()),
    feeling: v.optional(v.union(
      v.literal("amazing"),
      v.literal("good"),
      v.literal("okay"),
      v.literal("tough"),
      v.literal("struggled")
    )),
    notes: v.optional(v.string()),
    activityId: v.optional(v.id("activities")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const now = new Date().toISOString();

    // Create workout completion record
    const completionId = await ctx.db.insert("workoutCompletions", {
      userId,
      plannedWorkoutId: args.plannedWorkoutId,
      activityId: args.activityId,
      completedAt: now,
      actualDuration: args.actualDuration,
      actualDistance: args.actualDistance,
      averagePace: args.averagePace,
      averageHeartRate: args.averageHeartRate,
      calories: args.calories,
      perceivedEffort: args.perceivedEffort,
      feeling: args.feeling,
      notes: args.notes,
      createdAt: now,
    });

    // Update planned workout status
    await ctx.db.patch(args.plannedWorkoutId, {
      status: "completed",
      completedAt: now,
      completionId,
    });

    return completionId;
  },
});

// Skip a workout
export const skipWorkout = mutation({
  args: {
    plannedWorkoutId: v.id("plannedWorkouts"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.plannedWorkoutId, {
      status: "skipped",
    });

    return { message: "Workout skipped" };
  },
});

// Get workout completion history
export const getWorkoutHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const limit = args.limit || 20;

    return await ctx.db
      .query("workoutCompletions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

// Regenerate training plan
export const regenerateTrainingPlan = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Delete existing planned workouts for this user
    const existingWorkouts = await ctx.db
      .query("plannedWorkouts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const workout of existingWorkouts) {
      await ctx.db.delete(workout._id);
    }

    // Generate a new training plan by directly calling the generation logic
    const profile = await ctx.db
      .query("trainingProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      throw new Error("Training profile not found. Complete onboarding first.");
    }

    // Get user's week start preference
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const weekStartDay = userProfile?.weekStartDay ?? 1;
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];

    // Calculate plan parameters
    const weeksToGoal = calculateWeeksToGoal(today, profile.goalDate, weekStartDay);
    const goalConfig = GOAL_DISTANCES[profile.goalDistance as keyof typeof GOAL_DISTANCES];
    const weeks = Math.max(weeksToGoal, goalConfig.weeks);

    // Deactivate any existing plans
    const existingPlans = await ctx.db
      .query("trainingPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const plan of existingPlans) {
      await ctx.db.patch(plan._id, { isActive: false });
    }

    // Generate simple plan
    const planWeeks = [];
    const pattern = getWorkoutPattern(profile.daysPerWeek);
    
    // Start from next week
    const startDate = new Date();
    const thisWeekStart = getWeekStart(startDate, weekStartDay);
    const nextWeekStart = new Date(thisWeekStart);
    nextWeekStart.setDate(thisWeekStart.getDate() + 7);

    const dayNameToNumber: Record<string, number> = {
      'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
    };

    for (let weekNum = 1; weekNum <= weeks; weekNum++) {
      const weekStartDate = new Date(nextWeekStart);
      weekStartDate.setDate(nextWeekStart.getDate() + ((weekNum - 1) * 7));
      
      const dayWorkouts = [];
      
      // Simple progression: start at 2km and gradually increase
      const baseDistance = 2000; // 2km
      const weeklyIncrease = 500; // 500m per week
      const currentWeekDistance = baseDistance + (weekNum - 1) * weeklyIncrease;

      // Schedule workouts on preferred days
      const preferredDays = profile.preferredDays || ['Mon', 'Wed', 'Fri'];
      
      for (let workoutIndex = 0; workoutIndex < pattern.length; workoutIndex++) {
        const workoutType = pattern[workoutIndex];
        const preferredDay = preferredDays[workoutIndex % preferredDays.length];
        const dayNumber = dayNameToNumber[preferredDay];
        
        const workoutDate = new Date(weekStartDate);
        const daysFromMonday = (dayNumber - 1 + 7) % 7;
        workoutDate.setDate(weekStartDate.getDate() + daysFromMonday);
        
        // Spread workouts if more workouts than preferred days
        if (workoutIndex > 0 && preferredDays.length < pattern.length) {
          const daySpacing = Math.floor(7 / pattern.length);
          const adjustedDay = (dayNumber + (workoutIndex * daySpacing)) % 7;
          const adjustedDaysFromMonday = (adjustedDay - 1 + 7) % 7;
          workoutDate.setDate(weekStartDate.getDate() + adjustedDaysFromMonday);
        }
        
        const dateString = workoutDate.toISOString().split('T')[0];
        
        // Calculate distance for this workout
        let distance = currentWeekDistance;
        if (workoutType === "long") {
          distance = Math.round(currentWeekDistance * 1.5); // Long runs are 50% longer
        }
        
        // Estimate duration (assuming 6 min/km pace)
        const estimatedMinutes = Math.round((distance / 1000) * 6);

        dayWorkouts.push({
          date: dateString,
          type: workoutType,
          distance: distance,
          duration: `${estimatedMinutes} min`,
          description: WORKOUT_TYPES[workoutType as keyof typeof WORKOUT_TYPES]?.description || "Training workout",
          target: workoutType === "easy" ? "Conversational pace" : workoutType === "long" ? "Steady comfortable effort" : "Easy effort"
        });
      }
      
      planWeeks.push({
        week: weekNum,
        microCycle: weekNum <= weeks * 0.7 ? "base" : "peak" as "base" | "build" | "peak" | "taper",
        days: dayWorkouts
      });
    }

    // Add race day if goal date is set and not "just-run-more"
    if (profile.goalDistance !== 'just-run-more' && weeks > 0) {
      const lastWeek = planWeeks[planWeeks.length - 1];
      const goalDate = new Date(profile.goalDate);
      const goalDateString = goalDate.toISOString().split('T')[0];
      
      // Check if race day already has a workout
      const hasRaceDay = lastWeek.days.some((day: any) => day.date === goalDateString);
      
      if (!hasRaceDay) {
        const targetDistance = goalConfig.target;
        const estimatedMinutes = Math.round((targetDistance / 1000) * 6);
        
        lastWeek.days.push({
          date: goalDateString,
          type: "race",
          distance: targetDistance,
          duration: `${estimatedMinutes} min`,
          description: `${profile.goalDistance} Race Day - You've got this!`,
          target: "Race pace"
        });
      }
    }

    // Create the training plan
    const planId = await ctx.db.insert("trainingPlans", {
      userId,
      meta: {
        goal: profile.goalDistance,
        weeks,
        level: profile.fitnessLevel,
        daysPerWeek: profile.daysPerWeek,
        createdAt: now,
      },
      isActive: true,
      plan: planWeeks,
      createdAt: now,
      updatedAt: now,
    });

    // Generate planned workouts for the first 4 weeks
    await generatePlannedWorkouts(ctx, planId, userId, planWeeks.slice(0, 4));

    return { planId, weeks, message: "Simple training plan regenerated successfully" };
  },
}); 