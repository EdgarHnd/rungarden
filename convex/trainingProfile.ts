import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Classification logic to determine fitness level (0-3)
function classifyFitnessLevel(
  goalDistance: string,
  longestDistance: string,
  currentAbility: string
): "true-beginner" | "novice" | "intermediate" | "advanced" {
  // Convert ability to approximate minutes
  const abilityToMinutes = {
    "none": 0,
    "less1min": 0.5,
    "1to5min": 3,
    "5to10min": 7.5,
    "more10min": 15
  };

  // Convert longest distance to approximate km
  const distanceToKm = {
    "never": 0,
    "1to2km": 1.5,
    "2to4km": 3,
    "5plusKm": 6
  };

  const runningMinutes = abilityToMinutes[currentAbility as keyof typeof abilityToMinutes] || 0;
  const longestKm = distanceToKm[longestDistance as keyof typeof distanceToKm] || 0;

  // Distance-based gateposts for each goal
  const distanceGates: Record<string, number[]> = {
    "5K": [2, 4, 6],       // thresholds for levels 0→1→2→3
    "10K": [4, 8, 12],
    "half-marathon": [8, 14, 18],
    "marathon": [12, 20, 30],
    "just-run-more": [2, 4, 8] // General fitness progression
  };

  const gates = distanceGates[goalDistance] || [2, 4, 8];
  let level = gates.findIndex(threshold => longestKm < threshold);
  if (level === -1) level = 3; // Beyond all thresholds = advanced

  // Secondary adjustment based on running ability
  if (runningMinutes >= 15) level = Math.max(level, 2); // Can run 15+ min = at least intermediate
  else if (runningMinutes <= 1) level = Math.min(level, 1); // Can't run much = max novice

  const levels = ["true-beginner", "novice", "intermediate", "advanced"] as const;
  return levels[level];
}

// Save onboarding data and create training profile
export const saveOnboardingData = mutation({
  args: {
    goalDistance: v.optional(v.string()),
    goalDate: v.optional(v.string()), // ISO string
    currentAbility: v.string(),
    longestDistance: v.string(),
    daysPerWeek: v.number(),
    preferredDays: v.array(v.string()),
    hasTreadmill: v.boolean(),
    preferTimeOverDistance: v.boolean(),
    pushNotificationsEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const now = new Date().toISOString();
    
    // Classify fitness level
    const fitnessLevel = classifyFitnessLevel(
      args.goalDistance || "5K", 
      args.longestDistance || "never", 
      args.currentAbility || "none"
    );

    // Extract push notification setting to save to user profile
    const { pushNotificationsEnabled, ...trainingProfileData } = args;

    // Check if training profile already exists
    const existingProfile = await ctx.db
      .query("trainingProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    let trainingProfileId;
    if (existingProfile) {
      // Update existing training profile
      await ctx.db.patch(existingProfile._id, {
        ...trainingProfileData,
        fitnessLevel,
        updatedAt: now,
      });
      trainingProfileId = existingProfile._id;
    } else {
      // Create new training profile
      trainingProfileId = await ctx.db.insert("trainingProfiles", {
        userId,
        ...trainingProfileData,
        fitnessLevel,
        updatedAt: now,
      });
    }

    // Update user profile with push notification preference
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (userProfile) {
      await ctx.db.patch(userProfile._id, {
        pushNotificationsEnabled,
      });
    }

    return trainingProfileId;
  },
});

// Get user's training profile
export const getTrainingProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("trainingProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

// Update training profile
export const updateTrainingProfile = mutation({
  args: {
    goalDistance: v.optional(v.string()),
    goalDate: v.optional(v.string()),
    currentAbility: v.optional(v.string()),
    longestDistance: v.optional(v.string()),
    daysPerWeek: v.optional(v.number()),
    preferredDays: v.optional(v.array(v.string())),
    hasTreadmill: v.optional(v.boolean()),
    preferTimeOverDistance: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existingProfile = await ctx.db
      .query("trainingProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!existingProfile) {
      throw new Error("Training profile not found");
    }

    const now = new Date().toISOString();
    
    // Recalculate fitness level if relevant fields changed
    let fitnessLevel = existingProfile.fitnessLevel;
    if (args.goalDistance || args.longestDistance || args.currentAbility) {
      fitnessLevel = classifyFitnessLevel(
        args.goalDistance || existingProfile.goalDistance || "5K",
        args.longestDistance || existingProfile.longestDistance || "never",
        args.currentAbility || existingProfile.currentAbility || "none"
      );
    }

    await ctx.db.patch(existingProfile._id, {
      ...args,
      fitnessLevel,
      updatedAt: now,
    });

    return existingProfile._id;
  },
});

// Check if user needs a training plan
export const needsTrainingPlan = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return false;
    }

    // Check if user has a training profile
    const profile = await ctx.db
      .query("trainingProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      return true; // Needs to complete onboarding
    }

    // Check if user has an active training plan
    const activePlan = await ctx.db
      .query("trainingPlans")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .first();

    return !activePlan; // Needs plan if no active plan exists
  },
}); 