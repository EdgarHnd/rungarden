import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    return await ctx.db.get(userId);
  },
});

// Get or create user profile for garden app
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

    return existingProfile;
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

    const currentUser = await ctx.db.get(userId);

    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingProfile) {
      return existingProfile;
    }

    // Create new profile with default values for garden app
    const now = new Date().toISOString();
    const newProfileId = await ctx.db.insert("userProfiles", {
      userId,
      totalDistance: 0,
      totalWorkouts: 0,
      totalCalories: 0,
      firstName: currentUser?.name?.split(' ')[0] ?? undefined,
      lastName: currentUser?.name?.split(' ').slice(1).join(' ') ?? undefined,
      // Default preferences
      metricSystem: "metric",
      weekStartDay: 1, // Default to Monday
      pushNotificationsEnabled: false,
      healthKitSyncEnabled: false,
      autoSyncEnabled: false,
      stravaSyncEnabled: false,
      updatedAt: now,
    });

    return await ctx.db.get(newProfileId);
  },
});

// Update user profile (creates if doesn't exist)
export const updateProfile = mutation({
  args: {
    username: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    region: v.optional(v.string()),
    // Personal information from onboarding
    gender: v.optional(v.union(v.literal("female"), v.literal("male"), v.literal("other"))),
    age: v.optional(v.number()),
    // Preferences
    metricSystem: v.optional(v.union(v.literal("metric"), v.literal("imperial"))),
    weekStartDay: v.optional(v.union(v.literal(0), v.literal(1))),
    // Training preferences from onboarding
    daysPerWeek: v.optional(v.number()),
    preferredDays: v.optional(v.array(v.string())),
    // App settings
    pushNotificationsEnabled: v.optional(v.boolean()),
    healthKitSyncEnabled: v.optional(v.boolean()),
    autoSyncEnabled: v.optional(v.boolean()),
    stravaSyncEnabled: v.optional(v.boolean()),
    gardenTheme: v.optional(v.string()),
    hasSeenInitialSyncModal: v.optional(v.boolean()),
    hasSeenWelcomeModal: v.optional(v.boolean()),
    healthKitInitialSyncCompleted: v.optional(v.boolean()),
    stravaInitialSyncCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const now = new Date().toISOString();

    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingProfile) {
      // Update existing profile
      const updateData: any = {
        ...args,
        updatedAt: now,
      };

      await ctx.db.patch(existingProfile._id, updateData);
      return existingProfile._id;
    } else {
      // Create new profile
      return await ctx.db.insert("userProfiles", {
        userId,
        totalDistance: 0,
        totalWorkouts: 0,
        totalCalories: 0,
        firstName: args.firstName,
        lastName: args.lastName,
        gender: args.gender,
        age: args.age,
        metricSystem: args.metricSystem ?? "metric",
        weekStartDay: args.weekStartDay ?? 1,
        daysPerWeek: args.daysPerWeek,
        preferredDays: args.preferredDays,
        pushNotificationsEnabled: args.pushNotificationsEnabled ?? false,
        healthKitSyncEnabled: args.healthKitSyncEnabled ?? false,
        autoSyncEnabled: args.autoSyncEnabled ?? false,
        stravaSyncEnabled: args.stravaSyncEnabled ?? false,
        gardenTheme: args.gardenTheme,
        hasSeenInitialSyncModal: args.hasSeenInitialSyncModal ?? false,
        updatedAt: now,
      });
    }
  },
});

// Function for strava auth backward compatibility
export const updateSyncPreferences = mutation({
  args: {
    // HealthKit fields
    healthKitSyncEnabled: v.optional(v.boolean()),
    lastHealthKitSync: v.optional(v.string()),
    healthKitSyncAnchor: v.optional(v.string()),
    healthKitInitialSyncCompleted: v.optional(v.boolean()),
    // Strava fields  
    stravaAccessToken: v.optional(v.string()),
    stravaRefreshToken: v.optional(v.string()), 
    stravaTokenExpiresAt: v.optional(v.number()),
    stravaAthleteId: v.optional(v.number()),
    stravaSyncEnabled: v.optional(v.boolean()),
    lastStravaSync: v.optional(v.string()),
    autoSyncEnabled: v.optional(v.boolean()),
    stravaInitialSyncCompleted: v.optional(v.boolean()),
    stravaAccessRevoked: v.optional(v.boolean()),
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

    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, {
        ...args,
        updatedAt: new Date().toISOString(),
      });
    }
  },
});

// Update push notification settings
export const updatePushNotificationSettings = mutation({
  args: {
    token: v.optional(v.string()),
    enabled: v.boolean(),
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

    if (existingProfile) {
      const updateData: any = {
        pushNotificationsEnabled: args.enabled,
        updatedAt: new Date().toISOString(),
      };

      // Only update token if provided
      if (args.token !== undefined) {
        updateData.pushNotificationToken = args.token;
      }

      await ctx.db.patch(existingProfile._id, updateData);
    }
  },
});

// Simple function for backward compatibility  
export const getProfileByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

// Simple function for backward compatibility
export const updateStravaTokens = mutation({
  args: {
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
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

// Search profiles for adding friends
export const searchProfiles = query({
  args: { 
    text: v.string() 
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    if (args.text.length < 2) {
      return [];
    }

    // Get current user profile
    const currentUserProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // Search for profiles by name
    const profiles = await ctx.db
      .query("userProfiles")
      .collect();

    const searchText = args.text.toLowerCase();
    
    const matchingProfiles = profiles
      .filter(profile => {
        // Don't include current user
        if (profile.userId === userId) return false;
        
        // Search in first name, last name, or full name
        const firstName = profile.firstName?.toLowerCase() || "";
        const lastName = profile.lastName?.toLowerCase() || "";
        const fullName = `${firstName} ${lastName}`.trim();
        
        return firstName.includes(searchText) || 
               lastName.includes(searchText) || 
               fullName.includes(searchText);
      })
      .slice(0, 10) // Limit results
      .map(profile => ({
        userId: profile.userId,
        name: `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "Unknown User",
      }));

    return matchingProfiles;
  },
});