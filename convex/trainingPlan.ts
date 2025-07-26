import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { PlanTemplate, planTemplates } from "./planTemplates";
import { WORKOUT_LIBRARY } from "./workoutLibrary";

/* ────────────────────────────── token-based plan helpers */

// Split a token like "E4" → { base: "E", param: "4" }
function splitToken(token: string) {
  const [basePart, variantPart] = token.split("/");
  return {
    base: basePart,
    param: variantPart ?? "",
  };
}

// Cache to avoid duplicate template inserts during generation
const skeletonCache: Map<string, any> = new Map();

async function getOrCreateSkeletonTemplate(ctx: any, base: string) {
  if (skeletonCache.has(base)) return skeletonCache.get(base);

  const nowIso = new Date().toISOString();
  const lib = WORKOUT_LIBRARY[base];
  if (!lib) {
    throw new Error(`Unknown workout token base: ${base}`);
  }

  const { type, subType, description } = lib;
  const insertData: any = {
    name: `TOKEN_${base}`,
    type,
    subType,
    description,
    // Do not store steps with placeholders. They are generated during hydration.
    steps: [],
    updatedAt: nowIso,
  };

  const templateId = await ctx.db.insert("workoutTemplates", insertData);
  skeletonCache.set(base, templateId);
  return templateId;
}

function hydrateData(base: string, param: string, units: "metric" | "imperial") {
  // param can be a value ("4") or a variant ("6B")
  const num = parseFloat(param);
  const skeleton = (WORKOUT_LIBRARY as any)[base];
  if (!skeleton) return {};

  const Fmt = (val: number, decimals = 1) => parseFloat(val.toFixed(decimals));

  // Helper to replace placeholders like {{mi}} or {{min}} in a step object
  const hydrateStep = (stepTemplate: any, values: any) => {
    const newStep = { ...stepTemplate };
    if (newStep.description) {
      newStep.description = newStep.description
        .replace('{{mi}}', values.mi)
        .replace('{{km}}', values.km)
        .replace('{{min}}', values.min);
    }
    if (newStep.duration) {
      newStep.duration = newStep.duration.replace('{{min}}', values.min);
    }
    // The schema expects distance in meters (number)
    if (typeof newStep.distance === 'string' && newStep.distance.includes('{{km}}')) {
      newStep.distance = values.km * 1000;
    }
    return newStep;
  };

  // Helper to hydrate global description
  const hydrateGlobalDescription = (description: string, values: any) => {
    return description
      .replace('{{mi}}', values.mi)
      .replace('{{km}}', values.km)
      .replace('{{min}}', values.min);
  };

  // --- Handle different workout types ---

  // 1) Interval walk/run workouts
  if (base === "WR") {
    const variantKey = param.toUpperCase();
    const variantCfg = skeleton.variants?.[variantKey];
    if (!variantCfg) return { variant: variantKey };

    const executableSteps = [
      ...(skeleton.warmup ? [skeleton.warmup] : []),
      ...parsePattern(variantCfg.pattern, variantCfg.repeats),
      ...(skeleton.cooldown ? [skeleton.cooldown] : []),
    ];
    executableSteps.forEach((s, idx) => { s.order = idx + 1; });

    // Generate simplified display steps for the UI
    const displaySteps: any[] = [];
    if (skeleton.warmup) displaySteps.push({ ...skeleton.warmup, order: 1 });
    
    const mainSetDurationSec = executableSteps
      .filter(s => ['Run', 'Walk'].includes(s.label))
      .reduce((total, step) => {
        if (!step.duration) return total;
        const minMatch = step.duration.match(/(\d+(?:\.\d+)?)\s*min/);
        const secMatch = step.duration.match(/(\d+(?:\.\d+)?)\s*sec/);
        if (minMatch) return total + parseFloat(minMatch[1]) * 60;
        if (secMatch) return total + parseFloat(secMatch[1]);
        return total;
      }, 0);

    displaySteps.push({
      order: displaySteps.length + 1,
      label: "Main Set",
      duration: `${Math.round(mainSetDurationSec / 60)} min`,
      effort: "varied",
      notes: variantCfg.summary || "Alternating running and walking intervals.",
    });

    if (skeleton.cooldown) displaySteps.push({ ...skeleton.cooldown, order: displaySteps.length + 1 });

    return { 
      variant: variantKey, 
      steps: executableSteps,
      displaySteps: displaySteps,
      globalDescription: skeleton.globalDescription,
    };
  }

  // 2) Distance-based runs (Easy, Long, Tempo, etc.)
  if (["E", "L", "U", "T"].includes(base)) {
    if (isNaN(num)) return {};
    const miles = num;
    const km = Fmt(miles * 1.60934);
    const hydratedValues = { mi: Fmt(miles), km, min: 0 };
    
    // For these simple types, executable and display steps are the same
    const steps = (skeleton.steps || []).map((s: any) => hydrateStep(s, hydratedValues));
    
    return {
      distanceMi: miles,
      distanceKm: km,
      steps: steps,
      displaySteps: steps,
      globalDescription: skeleton.globalDescription,
    };
  }

  // 3) Time-based workouts (Cross-training, Fartlek)
  if (["X", "F"].includes(base)) {
    if (isNaN(num)) return {};
    const minutes = num;
    const hydratedValues = { mi: 0, km: 0, min: minutes };
    
    const steps = (skeleton.steps || []).map((s: any) => hydrateStep(s, hydratedValues));
    return {
      minutes: minutes,
      steps: steps,
      displaySteps: steps,
      globalDescription: skeleton.globalDescription,
    };
  }

  // Fallback for any other type, or if param is not a number for relevant types
  return isNaN(num) ? {} : { value: num };
}

// ────────────────────────────── pattern parser
function parsePattern(pattern: string, explicitRepeats?: number): any[] {
  pattern = pattern.trim();

  // Extract group repeat like "(a / b) x3"
  let repeat = explicitRepeats ?? 1;
  const groupMatch = pattern.match(/^\((.*)\)\s*x(\d+)$/i);
  if (groupMatch) {
    pattern = groupMatch[1];
    repeat = parseInt(groupMatch[2], 10);
  }

  const parts = pattern.split("/").map((p) => p.trim());
  const singleSeq: any[] = parts.flatMap((part) => {
    // part like "90s run" or "2.5m walk" or "5m run"
    const tokens = part.split(" ").filter(Boolean);
    if (tokens.length < 2) return [];

    const durationTok = tokens[0];
    const actionTok = tokens[1].toLowerCase();

    let durationStr = durationTok;
    if (/s$/i.test(durationTok)) {
      durationStr = durationTok.replace(/s$/i, " sec");
    } else if (/m$/i.test(durationTok)) {
      durationStr = durationTok.replace(/m$/i, " min");
    }

    return [{
      label: actionTok.charAt(0).toUpperCase() + actionTok.slice(1),
      duration: durationStr,
      effort: actionTok === "run" ? "moderate" : "easy",
    }];
  });

  // Repeat sequence
  const out: any[] = [];
  for (let i = 0; i < repeat; i++) {
    out.push(...singleSeq);
  }
  return out;
}

async function generateTokenBasedPlan(
  ctx: any,
  userId: string,
  profile: any,
  userProfile: any,
) {
  // Map goal → template key
  const goalMap: Record<string, string> = {
    "5K": "C25K",
    marathon: "M16",
  };

  const planKey = goalMap[profile.goalDistance] || "C25K";
  const template: PlanTemplate | undefined = planTemplates[planKey];
  if (!template) return null; // fall back to old algorithm

  // 1) Clean up old data -----------------------------------------------------
  const existingWorkouts = await ctx.db
    .query("plannedWorkouts")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  for (const w of existingWorkouts) {
    await ctx.db.delete(w._id);
  }

  const existingPlans = await ctx.db
    .query("trainingPlans")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  for (const p of existingPlans) {
    await ctx.db.patch(p._id, { isActive: false });
  }

  // 2) Build schedule --------------------------------------------------------
  const weekStartDay = userProfile?.weekStartDay ?? 1; // 0=Sun,1=Mon
  const startOfWeek = getWeekStart(new Date(), weekStartDay);
  const units = userProfile?.metricSystem === "imperial" ? "imperial" : "metric";

  // Get user's preferred days and map them to day indices based on week start preference
  const preferredDays = profile.preferredDays || [];
  
  // Create day mapping based on user's week start preference
  let dayNameToIndex: Record<string, number>;
  if (weekStartDay === 1) { // Monday start
    dayNameToIndex = { 'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6 };
  } else { // Sunday start
    dayNameToIndex = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  }
  
  const preferredDayIndices = preferredDays.map((day: string) => dayNameToIndex[day as keyof typeof dayNameToIndex]);

  const planWeeks: any[] = [];
  const pendingPlanned: any[] = [];

  for (let wIdx = 0; wIdx < template.weeks.length; wIdx++) {
    const weekTokens = template.weeks[wIdx];
    const dayEntries: any[] = [];

    // Extract non-rest workout tokens from the template week
    const workoutTokens = weekTokens.filter(token => token !== "R");

    // Create a 7-day schedule with rest days by default
    const weekSchedule = Array(7).fill("R");

    // Map workout tokens to user's preferred days
    for (let i = 0; i < Math.min(workoutTokens.length, preferredDayIndices.length); i++) {
      const dayIndex = preferredDayIndices[i];
      weekSchedule[dayIndex] = workoutTokens[i];
    }

    // Now schedule each day
    for (let dIdx = 0; dIdx < 7; dIdx++) {
      const token = weekSchedule[dIdx];
      const { base, param } = splitToken(token);

      const skeletonId = await getOrCreateSkeletonTemplate(ctx, base);

      const scheduleDate = new Date(startOfWeek);
      scheduleDate.setDate(startOfWeek.getDate() + wIdx * 7 + dIdx);
      const dateStr = scheduleDate.toISOString().split("T")[0];

      const hydrated = hydrateData(base, param, units);

      // For rest days (R) we include in plan structure but DON'T create a DB plannedWorkout entry
      if (base !== "R") {
        pendingPlanned.push({
          dateStr,
          skeletonId,
          token,
          hydrated,
        });
      }

      const sk = WORKOUT_LIBRARY[base];
      dayEntries.push({
        date: dateStr,
        workoutTemplateId: base === "R" ? undefined : skeletonId,
        description: token,
        type: sk?.subType || sk?.type || base.toLowerCase(),
      });
    }

    planWeeks.push({
      week: wIdx + 1,
      microCycle: "base",
      days: dayEntries,
    });
  }

  // 3) Insert training plan --------------------------------------------------
  const nowIso = new Date().toISOString();

  const planId = await ctx.db.insert("trainingPlans", {
    userId,
    meta: {
      goal: profile.goalDistance || "5K",
      weeks: template.weeks.length,
      level: profile.fitnessLevel,
      daysPerWeek: profile.daysPerWeek,
    },
    isActive: true,
    plan: planWeeks,
    updatedAt: nowIso,
  });

  // 4) Insert planned workouts ----------------------------------------------
  for (const p of pendingPlanned) {
    await ctx.db.insert("plannedWorkouts", {
      userId,
      trainingPlanId: planId,
      workoutTemplateId: p.skeletonId,
      scheduledDate: p.dateStr,
      status: "scheduled",
      token: p.token,
      hydrated: p.hydrated,
    });
  }

  return { planId, weeks: template.weeks.length, message: "Training plan generated successfully (token-based)" };
}

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
        const skeleton = await ctx.db.get(pw.workoutTemplateId);

        const mergedWorkout: any = {
          ...skeleton,
        };

        // Use displaySteps for UI if available, otherwise fall back to regular steps
        if (pw.hydrated?.displaySteps?.length) {
          mergedWorkout.steps = pw.hydrated.displaySteps;
        } else if (pw.hydrated?.steps?.length) {
          mergedWorkout.steps = pw.hydrated.steps;
        }

        return {
          ...pw,
          workout: mergedWorkout,
          // Pass executable steps for run tracker
          executableSteps: pw.hydrated?.steps || skeleton?.steps || [],
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
    const skeleton = await ctx.db.get(plannedWorkout.workoutTemplateId);

    const mergedWorkout: any = {
      ...skeleton,
    };
    
    // Use displaySteps for UI if available, otherwise fall back to regular steps
    if (plannedWorkout.hydrated?.displaySteps?.length) {
      mergedWorkout.steps = plannedWorkout.hydrated.displaySteps;
    } else if (plannedWorkout.hydrated?.steps?.length) {
      mergedWorkout.steps = plannedWorkout.hydrated.steps;
    }
    
    return {
      ...plannedWorkout,
      workout: mergedWorkout,
      // Pass executable steps for run tracker
      executableSteps: plannedWorkout.hydrated?.steps || skeleton?.steps || [],
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
    const skeleton = await ctx.db.get(plannedWorkout.workoutTemplateId);

    const mergedWorkout: any = {
      ...skeleton,
    };

    // Use displaySteps for UI if available, otherwise fall back to regular steps
    if (plannedWorkout.hydrated?.displaySteps?.length) {
      mergedWorkout.steps = plannedWorkout.hydrated.displaySteps;
    } else if (plannedWorkout.hydrated?.steps?.length) {
      mergedWorkout.steps = plannedWorkout.hydrated.steps;
    }
    
    return {
      ...plannedWorkout,
      workout: mergedWorkout,
      // Pass executable steps for run tracker
      executableSteps: plannedWorkout.hydrated?.steps || skeleton?.steps || [],
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

// Delete training plan
export const deleteTrainingPlan = mutation({
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

    // Deactivate all existing plans
    const existingPlans = await ctx.db
      .query("trainingPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const plan of existingPlans) {
      await ctx.db.patch(plan._id, { isActive: false });
    }

    return { message: "Training plan deleted successfully" };
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

  // ────────────────────────────── token-based generator
  const tokenPlan = await generateTokenBasedPlan(ctx, userId, profile, userProfile);
  if (tokenPlan) {
    return tokenPlan;
  }

  throw new Error("No compatible training plan template found for the user's goal");
} 

// ────────────────────────────── TESTING FUNCTIONS ──────────────────────────────
// WARNING: These functions are for development/testing only

// Simulate training plan progress for testing
export const simulateTrainingProgress = mutation({
  args: {
    weeksToComplete: v.optional(v.number()), // Default to 2 weeks
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const weeksToComplete = args.weeksToComplete || 2;
    const now = new Date();
    
    // Get user's active training plan
    const activePlan = await ctx.db
      .query("trainingPlans")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .first();

    if (!activePlan) {
      throw new Error("No active training plan found");
    }

    // Get user's week start preference
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();

    const weekStartDay = userProfile?.weekStartDay ?? 1;

    // Calculate how far back to move the plan (add extra days to ensure we have full completed weeks)
    const daysToBackdate = (weeksToComplete * 7) + 10; // Extra buffer
    const newStartDate = new Date(now);
    newStartDate.setDate(now.getDate() - daysToBackdate);
    const newWeekStart = getWeekStart(newStartDate, weekStartDay);

    // Get all planned workouts for this user
    const plannedWorkouts = await ctx.db
      .query("plannedWorkouts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Update plan structure and planned workouts with new dates
    const updatedPlan = { ...activePlan };
    
    for (let weekIdx = 0; weekIdx < updatedPlan.plan.length; weekIdx++) {
      const week = updatedPlan.plan[weekIdx];
      
      for (let dayIdx = 0; dayIdx < week.days.length; dayIdx++) {
        const day = week.days[dayIdx];
        
        // Capture the original scheduled date BEFORE we update it
        const originalDate = day.date;

        // Calculate new date for this day (shift back in time)
        const newDate = new Date(newWeekStart);
        newDate.setDate(newWeekStart.getDate() + (weekIdx * 7) + dayIdx);
        const newDateStr = newDate.toISOString().split("T")[0];
        
        // Update the plan structure with the new date
        updatedPlan.plan[weekIdx].days[dayIdx].date = newDateStr;
        
        // Locate the planned workout using the ORIGINAL date (before shift)
        const foundWorkout = plannedWorkouts.find((pw) =>
          pw.scheduledDate === originalDate && pw.workoutTemplateId === day.workoutTemplateId
        );

        const plannedWorkout = foundWorkout;
        
        if (plannedWorkout) {
          await ctx.db.patch(plannedWorkout._id, {
            scheduledDate: newDateStr,
          });

          // Create fake activity for completed weeks
          if (weekIdx < weeksToComplete && day.workoutTemplateId) {
            const activityId = await createFakeActivity(ctx, userId, plannedWorkout, newDateStr);
            
            // Mark planned workout as completed
            await ctx.db.patch(plannedWorkout._id, {
              status: "completed",
              completedAt: newDate.toISOString(),
            });
          }
        }
      }
    }

    // Update the training plan with new dates
    await ctx.db.patch(activePlan._id, {
      plan: updatedPlan.plan,
      updatedAt: now.toISOString(),
    });

    return {
      message: `Successfully simulated ${weeksToComplete} weeks of training progress`,
      newStartDate: newWeekStart.toISOString().split("T")[0],
      completedWorkouts: weeksToComplete * 3, // Approximate for most plans
    };
  },
});

// Helper function to create fake activities
async function createFakeActivity(ctx: any, userId: string, plannedWorkout: any, dateStr: string) {
  const activityDate = new Date(dateStr);
  
  // Set activity time to morning (8-10 AM)
  activityDate.setHours(8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60));
  
  const startDate = activityDate.toISOString();
  
  // Generate realistic fake data based on workout type
  let duration, distance, calories, pace;
  
  if (plannedWorkout.token?.startsWith('WR')) {
    // Walk/Run interval workout - typically 20-35 minutes
    duration = 20 + Math.floor(Math.random() * 15); // 20-35 minutes
    distance = 2000 + Math.floor(Math.random() * 1500); // 2-3.5 km
    calories = duration * 8 + Math.floor(Math.random() * 50); // ~8 cal/min + variation
    pace = 6 + Math.random() * 2; // 6-8 min/km (beginner pace)
  } else if (plannedWorkout.token?.startsWith('E')) {
    // Easy run
    const distanceKm = parseFloat(plannedWorkout.token.substring(1)) || 3;
    distance = distanceKm * 1000;
    pace = 5.5 + Math.random() * 1.5; // 5.5-7 min/km
    duration = (distance / 1000) * pace;
    calories = duration * 10 + Math.floor(Math.random() * 50);
  } else if (plannedWorkout.token?.startsWith('L')) {
    // Long run
    const distanceKm = parseFloat(plannedWorkout.token.substring(1)) || 5;
    distance = distanceKm * 1000;
    pace = 6 + Math.random() * 1; // 6-7 min/km (slower for long runs)
    duration = (distance / 1000) * pace;
    calories = duration * 11 + Math.floor(Math.random() * 70);
  } else if (plannedWorkout.token?.startsWith('X')) {
    // Cross training
    const minutes = parseFloat(plannedWorkout.token.substring(1)) || 30;
    duration = minutes;
    distance = 0; // No distance for cross training
    calories = duration * 6 + Math.floor(Math.random() * 40);
    pace = 0;
  } else {
    // Default workout
    duration = 25 + Math.floor(Math.random() * 20); // 25-45 minutes
    distance = 3000 + Math.floor(Math.random() * 2000); // 3-5 km
    calories = duration * 9 + Math.floor(Math.random() * 60);
    pace = 5.5 + Math.random() * 1.5;
  }

  const endDate = new Date(activityDate);
  endDate.setMinutes(endDate.getMinutes() + duration);

  const activityId = await ctx.db.insert("activities", {
    userId,
    source: "app",
    startDate: startDate,
    endDate: endDate.toISOString(),
    duration: Math.round(duration),
    distance: Math.round(distance),
    calories: Math.round(calories),
    pace: Math.round(pace * 100) / 100, // Round to 2 decimal places
    plannedWorkoutId: plannedWorkout._id,
    workoutName: `Training Run - ${plannedWorkout.token}`,
    averageHeartRate: 140 + Math.floor(Math.random() * 30), // 140-170 bpm
    syncedAt: new Date().toISOString(),
  });

  return activityId;
}

// Reset training plan to current week (remove fake progress)
export const resetTrainingPlan = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Delete all activities with source "app" (fake activities)
    const fakeActivities = await ctx.db
      .query("activities")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("source"), "app"))
      .collect();

    for (const activity of fakeActivities) {
      await ctx.db.delete(activity._id);
    }

    // Reset all planned workouts to scheduled status
    const plannedWorkouts = await ctx.db
      .query("plannedWorkouts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const workout of plannedWorkouts) {
      if (workout.status === "completed") {
        await ctx.db.patch(workout._id, {
          status: "scheduled",
          completedAt: undefined,
        });
      }
    }

    // Regenerate the training plan with current dates
    await generateTrainingPlanInternal(ctx, userId);

    return { message: "Training plan reset to current week successfully" };
  },
}); 