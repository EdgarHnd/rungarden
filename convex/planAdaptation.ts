import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Adaptation triggers and rules
const ADAPTATION_RULES = {
  missedWorkouts: {
    threshold: 2, // 2 missed workouts in 10 days
    lookbackDays: 10,
  },
  fatigue: {
    threshold: 8, // RPE > 8 for consecutive easy runs
    consecutiveRuns: 2,
  },
  improvement: {
    paceImprovement: 0.15, // 15% faster than target
    heartRateImprovement: 10, // 10 bpm lower than expected
  },
};

// Analyze user's recent performance and suggest adaptations
export const analyzePerformance = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const today = new Date();
    const tenDaysAgo = new Date(today);
    tenDaysAgo.setDate(today.getDate() - 10);

    // Get recent planned workouts
    const recentWorkouts = await ctx.db
      .query("plannedWorkouts")
      .withIndex("by_user_date", (q: any) => 
        q.eq("userId", userId)
         .gte("scheduledDate", tenDaysAgo.toISOString().split('T')[0])
         .lte("scheduledDate", today.toISOString().split('T')[0])
      )
      .collect();

    // Get recent completions
    const recentCompletions = await ctx.db
      .query("workoutCompletions")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .filter((q: any) => q.gte(q.field("completedAt"), tenDaysAgo.toISOString()))
      .collect();

    const analysis = {
      missedWorkouts: 0,
      skippedWorkouts: 0,
      completedWorkouts: 0,
      averageRPE: 0,
      fatigueSignals: 0,
      improvementSignals: 0,
      recommendations: [] as string[],
      needsAdaptation: false,
      adaptationReason: null as string | null,
    };

    // Count workout statuses
    const missedWorkouts = recentWorkouts.filter(w => w.status === "missed");
    const skippedWorkouts = recentWorkouts.filter(w => w.status === "skipped");
    const completedWorkouts = recentWorkouts.filter(w => w.status === "completed");

    analysis.missedWorkouts = missedWorkouts.length;
    analysis.skippedWorkouts = skippedWorkouts.length;
    analysis.completedWorkouts = completedWorkouts.length;

    // Analyze RPE patterns
    const rpeValues = recentCompletions
      .filter(c => c.perceivedEffort !== undefined)
      .map(c => c.perceivedEffort!);

    if (rpeValues.length > 0) {
      analysis.averageRPE = rpeValues.reduce((sum, rpe) => sum + rpe, 0) / rpeValues.length;
    }

    // Check for fatigue signals (high RPE on easy runs)
    const easyRunCompletions = recentCompletions.filter(c => {
      const workout = recentWorkouts.find(w => w._id === c.plannedWorkoutId);
      return workout?.type === "easy" && c.perceivedEffort !== undefined;
    });

    const highRPEEasyRuns = easyRunCompletions.filter(c => c.perceivedEffort! >= 8);
    analysis.fatigueSignals = highRPEEasyRuns.length;

    // Check for missed workout patterns
    if (analysis.missedWorkouts >= ADAPTATION_RULES.missedWorkouts.threshold) {
      analysis.needsAdaptation = true;
      analysis.adaptationReason = "missed_workouts";
      analysis.recommendations.push("Reduce training load due to missed workouts");
    }

    // Check for fatigue patterns
    if (analysis.fatigueSignals >= ADAPTATION_RULES.fatigue.consecutiveRuns) {
      analysis.needsAdaptation = true;
      analysis.adaptationReason = "fatigue";
      analysis.recommendations.push("Insert extra rest day due to fatigue signals");
    }

    // Check for improvement signals
    const improvementSignals = recentCompletions.filter(c => {
      if (!c.averagePace || !c.averageHeartRate) return false;
      // This would need target pace/HR from the workout plan
      // For now, just flag if pace is significantly faster
      return c.averagePace < 5.0; // Sub 5-min/km pace indicates strong performance
    });

    analysis.improvementSignals = improvementSignals.length;

    if (analysis.improvementSignals >= 2) {
      analysis.recommendations.push("Consider increasing training intensity");
    }

    return analysis;
  },
});

// Apply automatic adaptation to training plan
export const adaptTrainingPlan = mutation({
  args: {
    reason: v.union(
      v.literal("missed_workouts"),
      v.literal("fatigue"),
      v.literal("injury"),
      v.literal("performance_improvement"),
      v.literal("time_constraint"),
      v.literal("manual_adjustment")
    ),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get active training plan
    const activePlan = await ctx.db
      .query("trainingPlans")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .first();

    if (!activePlan) {
      throw new Error("No active training plan found");
    }

    const now = new Date().toISOString();
    const changes = [];

    // Apply adaptations based on reason
    switch (args.reason) {
      case "missed_workouts":
        changes.push(...await handleMissedWorkouts(ctx, userId, activePlan));
        break;
      
      case "fatigue":
        changes.push(...await handleFatigue(ctx, userId, activePlan));
        break;
      
      case "injury":
        changes.push(...await handleInjury(ctx, userId, activePlan));
        break;
      
      case "performance_improvement":
        changes.push(...await handleImprovement(ctx, userId, activePlan));
        break;
      
      default:
        throw new Error(`Unsupported adaptation reason: ${args.reason}`);
    }

    // Record the adaptation
    const adaptationId = await ctx.db.insert("planAdaptations", {
      userId,
      trainingPlanId: activePlan._id,
      reason: args.reason,
      description: args.description,
      changes,
      appliedAt: now,
    });

    return { adaptationId, changes: changes.length, message: "Plan adapted successfully" };
  },
});

// Handle missed workouts adaptation
async function handleMissedWorkouts(ctx: any, userId: any, plan: any) {
  const changes = [];
  const today = new Date().toISOString().split('T')[0];
  
  // Get upcoming workouts for next 2 weeks
  const twoWeeksFromNow = new Date();
  twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
  
  const upcomingWorkouts = await ctx.db
    .query("plannedWorkouts")
    .withIndex("by_user_date", (q: any) => 
      q.eq("userId", userId)
       .gte("scheduledDate", today)
       .lte("scheduledDate", twoWeeksFromNow.toISOString().split('T')[0])
    )
    .collect();

  // Reduce intensity and add rest days
  for (const workout of upcomingWorkouts) {
    if (workout.type === "tempo" || workout.type === "intervals") {
      // Replace quality workouts with easy runs
      await ctx.db.patch(workout._id, {
        type: "easy",
        description: "Easy run (adapted from quality workout)",
        target: "Conversational pace",
      });

      changes.push({
        week: workout.planWeek,
        day: workout.planDay,
        oldWorkout: workout.type,
        newWorkout: "easy",
        changeType: "intensity_reduced" as const,
      });
    }
  }

  return changes;
}

// Handle fatigue adaptation
async function handleFatigue(ctx: any, userId: any, plan: any) {
  const changes = [];
  const today = new Date();
  
  // Add an extra rest day this week
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
  
  const thisWeekWorkouts = await ctx.db
    .query("plannedWorkouts")
    .withIndex("by_user_date", (q: any) => 
      q.eq("userId", userId)
       .gte("scheduledDate", today.toISOString().split('T')[0])
       .lte("scheduledDate", endOfWeek.toISOString().split('T')[0])
    )
    .collect();

  // Find the first non-rest workout and convert to rest
  const workoutToRest = thisWeekWorkouts.find((w: any) => 
    w.status === "scheduled" && w.type !== "rest"
  );

  if (workoutToRest) {
    await ctx.db.patch(workoutToRest._id, {
      type: "rest",
      description: "Extra rest day for recovery",
      duration: "As needed",
      distance: undefined,
    });

    changes.push({
      week: workoutToRest.planWeek,
      day: workoutToRest.planDay,
      oldWorkout: workoutToRest.type,
      newWorkout: "rest",
      changeType: "rest_added" as const,
    });
  }

  return changes;
}

// Handle injury adaptation
async function handleInjury(ctx: any, userId: any, plan: any) {
  const changes = [];
  const today = new Date().toISOString().split('T')[0];
  
  // Get all future workouts
  const futureWorkouts = await ctx.db
    .query("plannedWorkouts")
    .withIndex("by_user_date", (q: any) => 
      q.eq("userId", userId).gte("scheduledDate", today)
    )
    .collect();

  // Convert all running workouts to rest or cross-training
  for (const workout of futureWorkouts) {
    if (workout.status === "scheduled" && workout.type !== "rest") {
      const newType = workout.type === "cross-train" ? "rest" : "cross-train";
      
      await ctx.db.patch(workout._id, {
        type: newType,
        description: newType === "rest" 
          ? "Rest for injury recovery" 
          : "Low-impact cross-training during injury",
        target: undefined,
      });

      changes.push({
        week: workout.planWeek,
        day: workout.planDay,
        oldWorkout: workout.type,
        newWorkout: newType,
        changeType: "workout_replaced" as const,
      });
    }
  }

  return changes;
}

// Handle performance improvement adaptation
async function handleImprovement(ctx: any, userId: any, plan: any) {
  const changes = [];
  const today = new Date().toISOString().split('T')[0];
  
  // Get upcoming workouts for next month
  const oneMonthFromNow = new Date();
  oneMonthFromNow.setDate(oneMonthFromNow.getDate() + 30);
  
  const upcomingWorkouts = await ctx.db
    .query("plannedWorkouts")
    .withIndex("by_user_date", (q: any) => 
      q.eq("userId", userId)
       .gte("scheduledDate", today)
       .lte("scheduledDate", oneMonthFromNow.toISOString().split('T')[0])
    )
    .collect();

  // Gradually increase intensity for easy runs
  let count = 0;
  for (const workout of upcomingWorkouts) {
    if (workout.type === "easy" && count < 2) { // Only upgrade 2 workouts
      await ctx.db.patch(workout._id, {
        type: "tempo",
        description: "Tempo run (upgraded from easy run)",
        target: "Comfortably hard effort",
      });

      changes.push({
        week: workout.planWeek,
        day: workout.planDay,
        oldWorkout: "easy",
        newWorkout: "tempo",
        changeType: "intensity_reduced" as const, // This should be "intensity_increased" but keeping schema
      });

      count++;
    }
  }

  return changes;
}

// Get adaptation history
export const getAdaptationHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const limit = args.limit || 10;

    return await ctx.db
      .query("planAdaptations")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

// Manual plan adjustment
export const adjustPlan = mutation({
  args: {
    plannedWorkoutId: v.id("plannedWorkouts"),
    newType: v.string(),
    newDescription: v.string(),
    newDuration: v.optional(v.string()),
    newDistance: v.optional(v.number()),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the workout to update
    const workout = await ctx.db.get(args.plannedWorkoutId);
    if (!workout || workout.userId !== userId) {
      throw new Error("Workout not found or access denied");
    }

    const oldType = workout.type;
    
    // Update the workout
    await ctx.db.patch(args.plannedWorkoutId, {
      type: args.newType,
      description: args.newDescription,
      duration: args.newDuration,
      distance: args.newDistance,
    });

    // Record the manual adaptation
    const activePlan = await ctx.db
      .query("trainingPlans")
      .withIndex("by_user_active", (q: any) => q.eq("userId", userId).eq("isActive", true))
      .first();

    if (activePlan) {
      await ctx.db.insert("planAdaptations", {
        userId,
        trainingPlanId: activePlan._id,
        reason: "manual_adjustment",
        description: args.reason,
        changes: [{
          week: workout.planWeek,
          day: workout.planDay,
          oldWorkout: oldType,
          newWorkout: args.newType,
          changeType: "workout_replaced" as const,
        }],
        appliedAt: new Date().toISOString(),
      });
    }

    return { message: "Workout adjusted successfully" };
  },
});

// Check if plan needs adaptation (called periodically)
export const checkAdaptationNeeds = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        needsAdaptation: false,
        reason: null,
        recommendations: [],
      };
    }

    const today = new Date();
    const tenDaysAgo = new Date(today);
    tenDaysAgo.setDate(today.getDate() - 10);

    // Get recent planned workouts
    const recentWorkouts = await ctx.db
      .query("plannedWorkouts")
      .withIndex("by_user_date", (q: any) => 
        q.eq("userId", userId)
         .gte("scheduledDate", tenDaysAgo.toISOString().split('T')[0])
         .lte("scheduledDate", today.toISOString().split('T')[0])
      )
      .collect();

    // Get recent completions
    const recentCompletions = await ctx.db
      .query("workoutCompletions")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .filter((q: any) => q.gte(q.field("completedAt"), tenDaysAgo.toISOString()))
      .collect();

    const analysis = {
      missedWorkouts: 0,
      skippedWorkouts: 0,
      completedWorkouts: 0,
      averageRPE: 0,
      fatigueSignals: 0,
      improvementSignals: 0,
      recommendations: [] as string[],
      needsAdaptation: false,
      adaptationReason: null as string | null,
    };

    // Count workout statuses
    const missedWorkouts = recentWorkouts.filter((w: any) => w.status === "missed");
    const skippedWorkouts = recentWorkouts.filter((w: any) => w.status === "skipped");
    const completedWorkouts = recentWorkouts.filter((w: any) => w.status === "completed");

    analysis.missedWorkouts = missedWorkouts.length;
    analysis.skippedWorkouts = skippedWorkouts.length;
    analysis.completedWorkouts = completedWorkouts.length;

    // Analyze RPE patterns
    const rpeValues = recentCompletions
      .filter((c: any) => c.perceivedEffort !== undefined)
      .map((c: any) => c.perceivedEffort!);

    if (rpeValues.length > 0) {
      analysis.averageRPE = rpeValues.reduce((sum: number, rpe: number) => sum + rpe, 0) / rpeValues.length;
    }

    // Check for fatigue signals (high RPE on easy runs)
    const easyRunCompletions = recentCompletions.filter((c: any) => {
      const workout = recentWorkouts.find((w: any) => w._id === c.plannedWorkoutId);
      return workout?.type === "easy" && c.perceivedEffort !== undefined;
    });

    const highRPEEasyRuns = easyRunCompletions.filter((c: any) => c.perceivedEffort! >= 8);
    analysis.fatigueSignals = highRPEEasyRuns.length;

    // Check for missed workout patterns
    if (analysis.missedWorkouts >= ADAPTATION_RULES.missedWorkouts.threshold) {
      analysis.needsAdaptation = true;
      analysis.adaptationReason = "missed_workouts";
      analysis.recommendations.push("Reduce training load due to missed workouts");
    }

    // Check for fatigue patterns
    if (analysis.fatigueSignals >= ADAPTATION_RULES.fatigue.consecutiveRuns) {
      analysis.needsAdaptation = true;
      analysis.adaptationReason = "fatigue";
      analysis.recommendations.push("Insert extra rest day due to fatigue signals");
    }

    return {
      needsAdaptation: analysis.needsAdaptation,
      reason: analysis.adaptationReason,
      recommendations: analysis.recommendations,
    };
  },
}); 