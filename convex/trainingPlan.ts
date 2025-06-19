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

// Create or get workout template
async function createOrGetWorkout(
  ctx: any,
  userId: string,
  type: string,
  distance: number,
  description: string
) {
  const now = new Date().toISOString();
  
  // Create structured workout with steps
  const steps = [];
  
  if (type === "easy") {
    steps.push({
      order: 1,
      label: "Warm-up",
      duration: "5 min",
      effort: "very easy",
      notes: "Start with a gentle walking warm-up"
    });
    steps.push({
      order: 2,
      label: "Main Run",
      distance: distance,
      effort: "easy",
      target: "Conversational pace - you should be able to talk while running",
      notes: "Maintain a comfortable, sustainable pace throughout"
    });
    steps.push({
      order: 3,
      label: "Cool-down",
      duration: "5 min",
      effort: "very easy",
      notes: "Walk and stretch to cool down"
    });
  } else if (type === "long") {
    steps.push({
      order: 1,
      label: "Warm-up",
      duration: "10 min",
      effort: "very easy",
      notes: "Start slowly to prepare for longer effort"
    });
    steps.push({
      order: 2,
      label: "Long Run",
      distance: distance,
      effort: "easy",
      target: "Steady comfortable effort - build endurance",
      notes: "Focus on maintaining consistent effort rather than speed"
    });
    steps.push({
      order: 3,
      label: "Cool-down",
      duration: "10 min",
      effort: "very easy",
      notes: "Extended cool-down with walking and stretching"
    });
  } else if (type === "rest") {
    steps.push({
      order: 1,
      label: "Rest Day",
      duration: "20 min",
      effort: "very easy",
      notes: "Light stretching, foam rolling, or complete rest"
    });
  }

  const workoutId = await ctx.db.insert("workouts", {
    userId: undefined, // System template (undefined for optional field)
    name: WORKOUT_TYPES[type as keyof typeof WORKOUT_TYPES]?.name || "Training Run",
    type: type === "rest" ? "rest" : "run", // Map all running workouts to "run", keep "rest" as "rest"
    subType: type === "rest" ? undefined : type as "easy" | "tempo" | "interval" | "long" | "recovery" | "race",
    description: description,
    steps: steps,
    updatedAt: now
  });

  return workoutId;
}

// Generate a simple training plan
export const generateTrainingPlan = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await generateTrainingPlanInternal(ctx, userId);
  },
});

// Helper function to generate planned workouts
async function generatePlannedWorkouts(
  ctx: any,
  planId: any,
  userId: any,
  planWeeks: any[],
  workoutTemplates: Map<string, any>
) {
  // Create workout templates first
  const createdWorkouts = new Map();
  
  for (const [workoutKey, workoutInfo] of workoutTemplates) {
    const workoutId = await createOrGetWorkout(
      ctx,
      userId,
      workoutInfo.type,
      workoutInfo.distance,
      workoutInfo.description
    );
    createdWorkouts.set(workoutKey, workoutId);
  }

  // Create planned workouts
  for (const planWeek of planWeeks) {
    for (const day of planWeek.days) {
      // Calculate distance for workout key lookup
      const baseDistance = 2000;
      const weeklyIncrease = 500;
      const currentWeekDistance = baseDistance + (planWeek.week - 1) * weeklyIncrease;
      
      let distance = currentWeekDistance;
      if (day.type === "long") {
        distance = Math.round(currentWeekDistance * 1.5);
      }
      
      const workoutKey = `${day.type}-${distance}`;
      const workoutId = createdWorkouts.get(workoutKey);
      
      if (workoutId) {
        await ctx.db.insert("plannedWorkouts", {
          userId,
          trainingPlanId: planId,
          workoutId: workoutId,
          scheduledDate: day.date,
          status: "scheduled",
        });
      }
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

    const plannedWorkouts = await ctx.db
      .query("plannedWorkouts")
      .withIndex("by_user_date", (q: any) => 
        q.eq("userId", userId)
         .gte("scheduledDate", args.startDate)
         .lte("scheduledDate", args.endDate)
      )
      .collect();

    // Enrich with workout details
    return await Promise.all(
      plannedWorkouts.map(async (pw) => {
        const workout = await ctx.db.get(pw.workoutId);
        return {
          ...pw,
          workout: workout
        };
      })
    );
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

    const plannedWorkout = await ctx.db
      .query("plannedWorkouts")
      .withIndex("by_user_date", (q: any) => q.eq("userId", userId).eq("scheduledDate", today))
      .first();

    if (!plannedWorkout) {
      return null;
    }

    // Get workout details
    const workout = await ctx.db.get(plannedWorkout.workoutId);
    
    return {
      ...plannedWorkout,
      workout: workout
    };
  },
});

// Get planned workout by ID
export const getPlannedWorkoutById = query({
  args: {
    plannedWorkoutId: v.id("plannedWorkouts"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const plannedWorkout = await ctx.db.get(args.plannedWorkoutId);
    
    if (!plannedWorkout) {
      throw new Error("Planned workout not found");
    }

    // Verify ownership
    if (plannedWorkout.userId !== userId) {
      throw new Error("Unauthorized access to planned workout");
    }

    // Get workout details
    const workout = await ctx.db.get(plannedWorkout.workoutId);
    
    return {
      ...plannedWorkout,
      workout: workout
    };
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

    // Generate a new plan using the same logic
    return await generateTrainingPlanInternal(ctx, userId);
  },
});

// Shared training plan generation logic
async function generateTrainingPlanInternal(ctx: any, userId: string) {
  // Get user's training profile
  const profile = await ctx.db
    .query("trainingProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  if (!profile) {
    throw new Error("Training profile not found. Complete onboarding first.");
  }

  // Get user's week start preference
  const userProfile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
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
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  for (const plan of existingPlans) {
    await ctx.db.patch(plan._id, { isActive: false });
  }

  // Generate simple plan
  const planWeeks = [];
  const pattern = getWorkoutPattern(profile.daysPerWeek);
  
  // Start from this week, but find the closest preferred day from today
  const startDate = new Date();
  const thisWeekStart = getWeekStart(startDate, weekStartDay);
  const currentDate = new Date();
  const todayDayOfWeek = currentDate.getDay();
  
  // Find the closest preferred day from today
  const preferredDays = profile.preferredDays || ['Mon', 'Wed', 'Fri'];
  const dayNameToNumber: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  
  const preferredDayNumbers = preferredDays.map((day: string) => dayNameToNumber[day]);
  
  // Find next preferred day (today or later this week)
  let nextPreferredDay = preferredDayNumbers.find((dayNum: number) => dayNum >= todayDayOfWeek);
  let planStartWeek = new Date(thisWeekStart);
  
  // If no preferred days left this week, start next week
  if (nextPreferredDay === undefined) {
    planStartWeek.setDate(thisWeekStart.getDate() + 7);
  }

  // Create workout templates and plan structure
  const workoutTemplates = new Map();

  for (let weekNum = 1; weekNum <= weeks; weekNum++) {
    const weekStartDate = new Date(planStartWeek);
    weekStartDate.setDate(planStartWeek.getDate() + ((weekNum - 1) * 7));
    
    const dayWorkouts = [];
    
    // Simple progression: start at 2km and gradually increase
    const baseDistance = 2000; // 2km
    const weeklyIncrease = 500; // 500m per week
    const currentWeekDistance = baseDistance + (weekNum - 1) * weeklyIncrease;

    // Schedule workouts on preferred days
    const currentPreferredDays = profile.preferredDays || ['Mon', 'Wed', 'Fri'];
    
    for (let workoutIndex = 0; workoutIndex < pattern.length; workoutIndex++) {
      const workoutType = pattern[workoutIndex];
      const preferredDay = currentPreferredDays[workoutIndex % currentPreferredDays.length];
      const dayNumber = dayNameToNumber[preferredDay];
      
      const workoutDate = new Date(weekStartDate);
      const daysFromMonday = (dayNumber - 1 + 7) % 7;
      workoutDate.setDate(weekStartDate.getDate() + daysFromMonday);
      
      // For the first week, skip days that have already passed
      if (weekNum === 1) {
        const today = new Date().toISOString().split('T')[0];
        const workoutDateString = workoutDate.toISOString().split('T')[0];
        if (workoutDateString < today) {
          continue; // Skip this workout as the day has already passed
        }
      }
      
      // Spread workouts if more workouts than preferred days
      if (workoutIndex > 0 && currentPreferredDays.length < pattern.length) {
        const daySpacing = Math.floor(7 / pattern.length);
        const adjustedDay = (dayNumber + (workoutIndex * daySpacing)) % 7;
        const adjustedDaysFromMonday = (adjustedDay - 1 + 7) % 7;
        workoutDate.setDate(weekStartDate.getDate() + adjustedDaysFromMonday);
        
        // Check again for first week
        if (weekNum === 1) {
          const today = new Date().toISOString().split('T')[0];
          const workoutDateString = workoutDate.toISOString().split('T')[0];
          if (workoutDateString < today) {
            continue;
          }
        }
      }
      
      const dateString = workoutDate.toISOString().split('T')[0];
      
      // Calculate distance for this workout
      let distance = currentWeekDistance;
      if (workoutType === "long") {
        distance = Math.round(currentWeekDistance * 1.5); // Long runs are 50% longer
      }
      
      const description = WORKOUT_TYPES[workoutType as keyof typeof WORKOUT_TYPES]?.description || "Training workout";

      dayWorkouts.push({
        date: dateString,
        type: workoutType as "easy" | "tempo" | "interval" | "long" | "rest" | "cross-train",
        description: description
      });

      // Store workout info for later template creation
      const workoutKey = `${workoutType}-${distance}`;
      if (!workoutTemplates.has(workoutKey)) {
        workoutTemplates.set(workoutKey, { type: workoutType, distance, description });
      }
    }
    
    planWeeks.push({
      week: weekNum,
      microCycle: weekNum <= weeks * 0.7 ? "base" : "peak" as "base" | "build" | "peak" | "taper",
      days: dayWorkouts
    });
  }

  // Create the training plan
  const planId = await ctx.db.insert("trainingPlans", {
    userId,
    meta: {
      goal: profile.goalDistance,
      weeks,
      level: profile.fitnessLevel,
      daysPerWeek: profile.daysPerWeek,
    },
    isActive: true,
    plan: planWeeks,
    updatedAt: now,
  });

  // Generate planned workouts for the first 4 weeks with workout templates
  await generatePlannedWorkouts(ctx, planId, userId, planWeeks.slice(0, 4), workoutTemplates);

  return { planId, weeks, message: "Training plan generated successfully" };
} 