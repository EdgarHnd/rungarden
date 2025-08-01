import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";
import { addCoins } from "./utils/coins";
import {
  calculateLevelFromXP,
  calculateTotalXPFromActivities,
  distanceToXP,
  getPlannedWorkoutXP,
  getRunXP
} from "./utils/gamification";
import { recalcStreak } from "./utils/streak";

// Sync result interface
interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  lastSyncDate: string;
  distanceGained?: number;
  coinsGained?: number;
  leveledUp?: boolean;
  newLevel?: number;
  oldLevel?: number;
  newRuns?: any[];
}

// Gamification functions moved to ./utils/gamification.ts

export const getUserActivitiesForYear = query({
  args: {
    year: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const limit = args.limit ?? 30;
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999); // Set to end of today
    const startDate = new Date(args.year, 0, 1);
    startDate.setHours(0, 0, 0, 0); // Set to start of the start day

    const activities = await ctx.db
      .query("activities")
      .withIndex("by_user_and_date", (q) => 
        q.eq("userId", userId)
         .gte("startDate", startDate.toISOString())
         .lte("startDate", endDate.toISOString())
      )
      .order("desc")
      .take(limit);

    return activities;
  },
});

// Get user's activities with pagination
export const getUserActivities = query({
  args: {
    limit: v.optional(v.number()),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const limit = args.limit ?? 30;
    const days = args.days ?? 30;

    // Calculate date range - fix date filtering issue
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999); // Set to end of today
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0); // Set to start of the start day

    console.log(`[getUserActivities] Querying activities from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const activities = await ctx.db
      .query("activities")
      .withIndex("by_user_and_date", (q) => 
        q.eq("userId", userId)
         .gte("startDate", startDate.toISOString())
         .lte("startDate", endDate.toISOString())
      )
      .order("desc")
      .take(limit);

    console.log(`[getUserActivities] Found ${activities.length} activities`);
    return activities;
  },
});

// Sync activities from HealthKit (bulk insert/update)
export const syncActivitiesFromHealthKit = mutation({
  args: {
    activities: v.array(v.object({
      healthKitUuid: v.string(),
      startDate: v.string(),
      endDate: v.string(),
      duration: v.number(),
      distance: v.number(),
      calories: v.number(),
      averageHeartRate: v.optional(v.number()),
      workoutName: v.optional(v.string()),
    })),
    initialSync: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const initialSync = args.initialSync ?? false;
    const now = new Date().toISOString();
    const syncResults = {
      created: 0,
      updated: 0,
      skipped: 0,
      distanceGained: 0,
      leveledUp: false,
      newLevel: 1,
      oldLevel: 1,
      coinsGained: 0,
      newRuns: [] as any[], // Track newly created activities
    };

    // Get current profile for level tracking
    const currentProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    let totalDistanceGained = 0;

    for (const activity of args.activities) {
      // Check if activity already exists
      const existingActivity = await ctx.db
        .query("activities")
        .withIndex("by_healthkit_uuid", (q) => 
          q.eq("healthKitUuid", activity.healthKitUuid)
        )
        .first();

      // Calculate pace (min/km)
      const pace = activity.distance > 0 ? 
        (activity.duration / (activity.distance / 1000)) : undefined;

      console.log(`[syncActivitiesFromHealthKit] Processing activity: ${activity.workoutName} on ${activity.startDate}, distance: ${activity.distance}m`);

      if (existingActivity) {
        // Update existing activity if data has changed
        const hasChanges = 
          existingActivity.duration !== activity.duration ||
          existingActivity.distance !== activity.distance ||
          existingActivity.calories !== activity.calories ||
          existingActivity.averageHeartRate !== activity.averageHeartRate;

        if (hasChanges) {
          await ctx.db.patch(existingActivity._id, {
            startDate: activity.startDate,
            endDate: activity.endDate,
            duration: activity.duration,
            distance: activity.distance,
            calories: activity.calories,
            averageHeartRate: activity.averageHeartRate,
            workoutName: activity.workoutName,
            pace,
            syncedAt: now,
          });
          syncResults.updated++;
          console.log(`[syncActivitiesFromHealthKit] Updated existing activity: ${activity.healthKitUuid}`);
        } else {
          syncResults.skipped++;
          console.log(`[syncActivitiesFromHealthKit] Skipped unchanged activity: ${activity.healthKitUuid}`);
        }
      } else {
        // Create new activity and track distance
        const xpEarned = getRunXP(); // Fixed 500 XP per run
        const newActivityId = await ctx.db.insert("activities", {
          userId,
          source: "healthkit",
          healthKitUuid: activity.healthKitUuid,
          startDate: activity.startDate,
          endDate: activity.endDate,
          duration: activity.duration,
          distance: activity.distance,
          calories: activity.calories,
          averageHeartRate: activity.averageHeartRate,
          workoutName: activity.workoutName,
          pace,
          xpEarned,
          isNewActivity: initialSync ? false : true, // Mark as new only for incremental sync
          syncedAt: now,
        });
        
        // Link to planned workout if one exists for this date
        const activityDate = new Date(activity.startDate).toISOString().split('T')[0];
        await linkActivityToPlannedWorkout(ctx, userId, newActivityId, activityDate);
        
        // Get the full activity record to include in results
        const newActivityRecord = await ctx.db.get(newActivityId);
        if (newActivityRecord) {
          syncResults.newRuns.push(newActivityRecord);
        }
        
        syncResults.created++;
        console.log(`[syncActivitiesFromHealthKit] Created new activity: ${activity.healthKitUuid}, ID: ${newActivityId}`);

        // Track distance for new activity
        totalDistanceGained += activity.distance;

        // Award coins when this run should count (isNewActivity = true means not from initial sync)
        if (!initialSync) {
          const coinsEarned = Math.floor(activity.distance / 100);
          if (coinsEarned > 0) {
            await addCoins(ctx, userId, coinsEarned, "run", newActivityId);
            syncResults.coinsGained += coinsEarned;
          }
        }
      }
    }

    // Update user profile totals after sync (this calculates everything correctly from DB)
    await updateUserProfileTotalsInternal(ctx, userId);
    
    // Recalculate streak after new activities (linking is now handled automatically)
    if (syncResults.newRuns.length > 0) {
      try {
        await recalcStreak(ctx.db, userId, new Date().toISOString().split('T')[0]);
        console.log(`[syncActivitiesFromHealthKit] Recalculated streak after adding ${syncResults.newRuns.length} activities`);
      } catch (error) {
        console.error('[syncActivitiesFromHealthKit] Failed to recalculate streak:', error);
      }
    }
    
    // Get the updated profile to calculate sync results
    if (totalDistanceGained > 0 && currentProfile) {
      const updatedProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
        
      if (updatedProfile) {
        const oldLevel = currentProfile.level || 1;
        const newLevel = updatedProfile.level;
        
        syncResults.distanceGained = totalDistanceGained;
        syncResults.leveledUp = newLevel > oldLevel;
        syncResults.newLevel = newLevel;
        syncResults.oldLevel = oldLevel;
      }
    }
    
    // Update last sync date and mark initial sync completed if applicable
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();

    if (userProfile) {
      await ctx.db.patch(userProfile._id, {
        lastHealthKitSync: now,
        updatedAt: now,
      });
    }

    return syncResults;
  },
});

// Sync activities from Strava (server-side version for webhooks)
export const syncActivitiesFromStravaServer = mutation({
  args: {
    userId: v.id("users"),
    activities: v.array(v.object({
      stravaId: v.number(),
      startDate: v.string(),
      endDate: v.string(),
      duration: v.number(),
      distance: v.number(),
      calories: v.number(),
      averageHeartRate: v.optional(v.number()),
      workoutName: v.optional(v.string()),
      totalElevationGain: v.optional(v.number()),
      elevationHigh: v.optional(v.number()),
      elevationLow: v.optional(v.number()),
      averageTemp: v.optional(v.number()),
      startLatLng: v.optional(v.array(v.number())),
      endLatLng: v.optional(v.array(v.number())),
      timezone: v.optional(v.string()),
      isIndoor: v.optional(v.boolean()),
      isCommute: v.optional(v.boolean()),
      averageCadence: v.optional(v.number()),
      averageWatts: v.optional(v.number()),
      maxWatts: v.optional(v.number()),
      kilojoules: v.optional(v.number()),
      polyline: v.optional(v.string()),
      maxSpeed: v.optional(v.number()),
      averageSpeed: v.optional(v.number()),
      isNewActivity: v.optional(v.boolean()),
    })),
    initialSync: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<SyncResult> => {
    const { userId, activities, initialSync } = args;
    const now = new Date().toISOString();
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let coinsGained = 0;
    const newRuns: any[] = [];

    for (const activity of activities) {
      try {
        // Check if activity already exists
        const existingActivity = await ctx.db
          .query("activities")
          .withIndex("by_strava_id", (q) => q.eq("stravaId", activity.stravaId))
          .first();

        if (existingActivity) {
          // Update existing activity
          const pace = activity.distance > 0 ? (activity.duration / (activity.distance / 1000)) : 0;
          
          // Check if data has actually changed
          const hasChanges = (
            existingActivity.startDate !== activity.startDate ||
            existingActivity.endDate !== activity.endDate ||
            existingActivity.duration !== activity.duration ||
            existingActivity.distance !== activity.distance ||
            existingActivity.calories !== activity.calories ||
            existingActivity.averageHeartRate !== activity.averageHeartRate ||
            existingActivity.workoutName !== activity.workoutName ||
            Math.abs((existingActivity.pace || 0) - pace) > 0.1
          );

          if (hasChanges) {
            await ctx.db.patch(existingActivity._id, {
              startDate: activity.startDate,
              endDate: activity.endDate,
              duration: activity.duration,
              distance: activity.distance,
              calories: activity.calories,
              averageHeartRate: activity.averageHeartRate,
              workoutName: activity.workoutName,
              pace,
              syncedAt: now,
            });
            updated++;
          } else {
            skipped++;
          }
        } else {
          // Create new activity
          const pace = activity.distance > 0 ? (activity.duration / (activity.distance / 1000)) : 0;
          const xpEarned = getRunXP(); // Fixed 500 XP per run
          
          const newActivityId = await ctx.db.insert("activities", {
            userId,
            source: "strava",
            stravaId: activity.stravaId,
            startDate: activity.startDate,
            endDate: activity.endDate,
            duration: activity.duration,
            distance: activity.distance,
            calories: activity.calories,
            averageHeartRate: activity.averageHeartRate,
            workoutName: activity.workoutName,
            pace,
            xpEarned,
            isNewActivity: initialSync ? false : true,
            syncedAt: now,
          });

          // Link to planned workout if one exists for this date
          const activityDate = new Date(activity.startDate).toISOString().split('T')[0];
          await linkActivityToPlannedWorkout(ctx, userId, newActivityId, activityDate);

          const newActivity = await ctx.db.get(newActivityId);
          if (newActivity) {
            newRuns.push(newActivity);
          }
          
          created++;

          // Award coins when this run should count (isNewActivity = true means not from initial sync)
          if (!initialSync) {
            const coinsEarned = Math.floor(activity.distance / 100);
            if (coinsEarned > 0) {
              await addCoins(ctx, userId, coinsEarned, "run", newActivityId);
              coinsGained += coinsEarned;
            }
          }
        }
      } catch (error) {
        console.error(`[syncActivitiesFromStravaServer] Error processing activity ${activity.stravaId}:`, error);
      }
    }

    // Update user profile totals if we created new activities
    if (created > 0) {
      await updateUserProfileTotalsServer(ctx, userId);
      
      // Recalculate streak after new activities
      try {
        await recalcStreak(ctx.db, userId, new Date().toISOString().split('T')[0]);
      } catch (error) {
        console.error('[syncActivitiesFromStravaServer] Failed to recalculate streak:', error);
      }
      
      // Update last sync time
      const userProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();

      if (userProfile) {
        await ctx.db.patch(userProfile._id, {
          lastStravaSync: now,
          updatedAt: now,
        });
      }
    }

    const result: SyncResult = {
      created,
      updated,
      skipped,
      lastSyncDate: now,
      newRuns,
      coinsGained,
    };

    return result;
  },
});

// Helper function to update user profile totals (server-side)
async function updateUserProfileTotalsServer(ctx: any, userId: string) {
  const userActivities = await ctx.db
    .query("activities")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  const totalDistance = userActivities.reduce((sum: number, activity: any) => sum + activity.distance, 0);
  const totalWorkouts = userActivities.length;
  const totalCalories = userActivities.reduce((sum: number, activity: any) => sum + activity.calories, 0);

  const userProfile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  if (userProfile) {
    const totalXP = distanceToXP(totalDistance);
    const level = calculateLevelFromXP(totalXP);
    const coins = 0; // Don't calculate coins automatically

    await ctx.db.patch(userProfile._id, {
      totalDistance,
      totalWorkouts,
      totalCalories,
      totalXP,
      level,
      updatedAt: new Date().toISOString(),
    });
  }
}

// Get real-time profile statistics calculated from activities
export const getProfileStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const allActivities = await ctx.db
      .query("activities")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const totalDistance = allActivities.reduce((sum, a) => sum + a.distance, 0);
    const totalCalories = allActivities.reduce((sum, a) => sum + a.calories, 0);
    const totalWorkouts = allActivities.length;
    
    // Calculate XP and level from activities (new system)
    const totalXP = calculateTotalXPFromActivities(allActivities);
    const level = calculateLevelFromXP(totalXP);
    const coins = 0; // Don't calculate coins automatically

    return {
      totalDistance,
      totalWorkouts,
      totalCalories,
      totalXP,
      level,
      coins,
    };
  },
});

// Delete an activity
export const deleteActivity = mutation({
  args: {
    activityId: v.id("activities"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.userId !== userId) {
      throw new Error("Activity not found or unauthorized");
    }

    await ctx.db.delete(args.activityId);
    
    // Update user profile totals after deletion
    await updateUserProfileTotalsInternal(ctx, userId);

    return { success: true };
  },
});

// Export the function as a mutation so it can be called from webhooks
export const updateUserProfileTotals = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await updateUserProfileTotalsInternal(ctx, args.userId);
  },
});

// Helper function to update user profile totals
async function updateUserProfileTotalsInternal(ctx: any, userId: any) {
  const allActivities = await ctx.db
    .query("activities")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  const totalDistance = allActivities.reduce((sum: number, a: any) => sum + a.distance, 0);
  const totalCalories = allActivities.reduce((sum: number, a: any) => sum + a.calories, 0);
  const totalWorkouts = allActivities.length;
  
  // Calculate XP and level from activities (new system)
  const totalXP = calculateTotalXPFromActivities(allActivities);
  const level = calculateLevelFromXP(totalXP);
  
  const existingProfile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  const now = new Date().toISOString();

  if (existingProfile) {
    await ctx.db.patch(existingProfile._id, {
      totalDistance,
      totalWorkouts,
      totalCalories,
      totalXP,
      level,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("userProfiles", {
      userId,
      weeklyGoal: 10000, // Default 10km
      totalDistance,
      totalWorkouts,
      totalCalories,
      totalXP,
      level,
      coins: 0,
      updatedAt: now,
    });
  }
}

// Helper function to update last sync date
async function updateLastSyncDate(ctx: any, userId: any, syncDate: string) {
  const existingProfile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  if (existingProfile) {
    await ctx.db.patch(existingProfile._id, {
      lastHealthKitSync: syncDate,
      updatedAt: syncDate,
    });
  }
}

// Get activities that need celebration (new activities not yet celebrated)
export const getActivitiesNeedingCelebration = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    return await ctx.db
      .query("activities")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isNewActivity"), true))
      .order("desc")
      .take(5); // Limit to 5 most recent
  },
});

// Mark activity celebration as shown
export const markCelebrationShown = mutation({
  args: {
    activityId: v.id("activities"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify the activity belongs to the user
    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.userId !== userId) {
      throw new Error("Activity not found or access denied");
    }

    await ctx.db.patch(args.activityId, {
      isNewActivity: false, // No longer new
    });

    return { success: true };
  },
});

// Server-side action to fetch and sync a specific Strava activity
export const fetchStravaActivityFromServer = action({
  args: {
    userId: v.id("users"),
    stravaActivityId: v.number(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string; activityId?: any }> => {
    const { userId, stravaActivityId } = args;
    
    console.log(`[fetchStravaActivityFromServer] Fetching activity ${stravaActivityId} for user ${userId}`);
    
    try {
      // Get user's Strava tokens from profile
      const userProfile = await ctx.runQuery(api.userProfile.getProfileByUserId, { userId });
      
      if (!userProfile || !userProfile.stravaSyncEnabled) {
        return { success: false, error: "Strava sync not enabled" };
      }

      if (!userProfile.stravaAccessToken) {
        return { success: false, error: "No Strava access token stored" };
      }

      // Check if token is expired and refresh if needed
      let accessToken = userProfile.stravaAccessToken;
      const now = Math.floor(Date.now() / 1000);
      
      if (userProfile.stravaTokenExpiresAt && userProfile.stravaTokenExpiresAt <= now) {
        if (!userProfile.stravaRefreshToken) {
          return { success: false, error: "Access token expired and no refresh token available" };
        }

        // Refresh the token
        const refreshResult = await refreshStravaToken(userProfile.stravaRefreshToken);
        if (!refreshResult.success) {
          return { success: false, error: "Failed to refresh Strava token" };
        }

        accessToken = refreshResult.accessToken!;
        
        // Update the stored tokens
        await ctx.runMutation(api.userProfile.updateStravaTokens, {
          userId,
          accessToken: refreshResult.accessToken!,
          refreshToken: refreshResult.refreshToken!,
          expiresAt: refreshResult.expiresAt!,
        });
      }

      // Fetch the specific activity from Strava API
      const activityData = await fetchStravaActivity(accessToken, stravaActivityId);
      console.log(`[fetchStravaActivityFromServer] Activity data:`, activityData);
      
      if (!activityData) {
        return { success: false, error: "Failed to fetch activity from Strava API" };
      }

      // Check if it's a running activity
      if (!['Run', 'TrailRun', 'Treadmill'].includes(activityData.type)) {
        return { success: false, error: "Not a running activity" };
      }

      // Convert to our format and sync to database
      const activityForDb = {
        stravaId: activityData.id,
        startDate: new Date(activityData.start_date).toISOString(),
        endDate: new Date(new Date(activityData.start_date).getTime() + activityData.elapsed_time * 1000).toISOString(),
        duration: Math.round(activityData.moving_time / 60), // Convert seconds to minutes
        distance: Math.round(activityData.distance), // Already in meters
        calories: activityData.calories,
        averageHeartRate: activityData.average_heartrate,
        workoutName: activityData.name,
        totalElevationGain: activityData.total_elevation_gain,      // meters gained
        elevationHigh: activityData.elev_high,           // highest elevation
        elevationLow: activityData.elev_low,            // lowest elevation
        averageTemp: activityData.average_temp,             // average temperature (celsius)
        startLatLng: activityData.start_latlng,    // [lat, lng] start coordinates
        endLatLng: activityData.end_latlng,      // [lat, lng] end coordinates
        timezone: activityData.timezone,                // timezone info
        isIndoor: activityData.is_indoor,               // trainer/treadmill vs outdoor
        isCommute: activityData.is_commute,              // commute run
        averageCadence: activityData.average_cadence,          // steps per minute
        averageWatts: activityData.average_watts,            // power data
        maxWatts: activityData.max_watts,                // peak power
        kilojoules: activityData.kilojoules,              // energy expenditure
        polyline: activityData.map?.polyline,                // route polyline for mapping
        maxSpeed: activityData.max_speed,                // peak speed
        averageSpeed: activityData.average_speed,            // average speed
        isNewActivity: true
      };

      // Sync to database using the existing mutation
      const syncResult = await ctx.runMutation(api.activities.syncActivitiesFromStravaServer, {
        userId,
        activities: [activityForDb],
        initialSync: false,
      });

      return { 
        success: true, 
        activityId: syncResult.newRuns?.[0]?._id,
      };

    } catch (error) {
      console.error(`[fetchStravaActivityFromServer] Error:`, error);
      return { success: false, error: (error as Error).message };
    }
  },
});

// Helper function to refresh Strava access token
async function refreshStravaToken(refreshToken: string): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  error?: string;
}> {
  try {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return { success: false, error: "Strava credentials not configured" };
    }

    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const tokens = await response.json();
    
    return {
      success: true,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_at,
    };
  } catch (error) {
    console.error('[refreshStravaToken] Error:', error);
    return { success: false, error: (error as Error).message };
  }
}

// Helper function to fetch a specific activity from Strava API
async function fetchStravaActivity(accessToken: string, activityId: number): Promise<any | null> {
  try {
    const response = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[fetchStravaActivity] API error: ${response.status} ${response.statusText}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[fetchStravaActivity] Error:', error);
    return null;
  }
}


// Sync activities from Strava (client-side version with authentication)
export const syncActivitiesFromStrava = mutation({
  args: {
    activities: v.array(v.object({
      stravaId: v.number(),
      startDate: v.string(),
      endDate: v.string(),
      duration: v.number(),
      distance: v.number(),
      calories: v.number(),
      averageHeartRate: v.optional(v.number()),
      workoutName: v.optional(v.string()),
      // Enhanced fields for achievements and gamification
      totalElevationGain: v.optional(v.number()),
      elevationHigh: v.optional(v.number()),
      elevationLow: v.optional(v.number()),
      averageTemp: v.optional(v.number()),
      startLatLng: v.optional(v.array(v.number())),
      endLatLng: v.optional(v.array(v.number())),
      timezone: v.optional(v.string()),
      isIndoor: v.optional(v.boolean()),
      isCommute: v.optional(v.boolean()),
      averageCadence: v.optional(v.number()),
      averageWatts: v.optional(v.number()),
      maxWatts: v.optional(v.number()),
      kilojoules: v.optional(v.number()),
      polyline: v.optional(v.string()),
      maxSpeed: v.optional(v.number()),
      averageSpeed: v.optional(v.number()),
      isNewActivity: v.optional(v.boolean()),
    })),
  },
  handler: async (ctx, args): Promise<SyncResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const { activities } = args;
    const now = new Date().toISOString();
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let coinsGained = 0;
    const newRuns: any[] = [];
    let totalDistanceGained = 0;

    // Get current profile for level tracking
    const currentProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();

    for (const activity of activities) {
      try {
        // Check if activity already exists
        const existingActivity = await ctx.db
          .query("activities")
          .withIndex("by_strava_id", (q: any) => q.eq("stravaId", activity.stravaId))
          .first();

        if (existingActivity) {
          // Update existing activity
          const pace = activity.distance > 0 ? (activity.duration / (activity.distance / 1000)) : 0;
          
          // Check if data has actually changed
          const hasChanges = (
            existingActivity.startDate !== activity.startDate ||
            existingActivity.endDate !== activity.endDate ||
            existingActivity.duration !== activity.duration ||
            existingActivity.distance !== activity.distance ||
            existingActivity.calories !== activity.calories ||
            existingActivity.averageHeartRate !== activity.averageHeartRate ||
            existingActivity.workoutName !== activity.workoutName ||
            Math.abs((existingActivity.pace || 0) - pace) > 0.1 ||
            // Enhanced fields comparison
            existingActivity.totalElevationGain !== activity.totalElevationGain ||
            existingActivity.elevationHigh !== activity.elevationHigh ||
            existingActivity.elevationLow !== activity.elevationLow ||
            existingActivity.averageTemp !== activity.averageTemp ||
            JSON.stringify(existingActivity.startLatLng) !== JSON.stringify(activity.startLatLng) ||
            JSON.stringify(existingActivity.endLatLng) !== JSON.stringify(activity.endLatLng) ||
            existingActivity.timezone !== activity.timezone ||
            existingActivity.isIndoor !== activity.isIndoor ||
            existingActivity.isCommute !== activity.isCommute ||
            existingActivity.averageCadence !== activity.averageCadence ||
            existingActivity.averageWatts !== activity.averageWatts ||
            existingActivity.maxWatts !== activity.maxWatts ||
            existingActivity.kilojoules !== activity.kilojoules ||
            existingActivity.polyline !== activity.polyline ||
            existingActivity.maxSpeed !== activity.maxSpeed ||
            existingActivity.averageSpeed !== activity.averageSpeed ||
            existingActivity.isNewActivity !== activity.isNewActivity
          );

          if (hasChanges) {
            await ctx.db.patch(existingActivity._id, {
              startDate: activity.startDate,
              endDate: activity.endDate,
              duration: activity.duration,
              distance: activity.distance,
              calories: activity.calories,
              averageHeartRate: activity.averageHeartRate,
              workoutName: activity.workoutName,
              pace,
              // Enhanced fields
              totalElevationGain: activity.totalElevationGain,
              elevationHigh: activity.elevationHigh,
              elevationLow: activity.elevationLow,
              averageTemp: activity.averageTemp,
              startLatLng: activity.startLatLng,
              endLatLng: activity.endLatLng,
              timezone: activity.timezone,
              isIndoor: activity.isIndoor,
              isCommute: activity.isCommute,
              averageCadence: activity.averageCadence,
              averageWatts: activity.averageWatts,
              maxWatts: activity.maxWatts,
              kilojoules: activity.kilojoules,
              polyline: activity.polyline,
              maxSpeed: activity.maxSpeed,
              averageSpeed: activity.averageSpeed,
              isNewActivity: activity.isNewActivity,
              syncedAt: now,
            });
            updated++;
          } else {
            skipped++;
          }
        } else {
          // Create new activity
          const pace = activity.distance > 0 ? (activity.duration / (activity.distance / 1000)) : 0;
          
          const newActivityId = await ctx.db.insert("activities", {
            userId,
            source: "strava",
            stravaId: activity.stravaId,
            startDate: activity.startDate,
            endDate: activity.endDate,
            duration: activity.duration,
            distance: activity.distance,
            calories: activity.calories,
            averageHeartRate: activity.averageHeartRate,
            workoutName: activity.workoutName,
            pace,
            // Enhanced fields
            totalElevationGain: activity.totalElevationGain,
            elevationHigh: activity.elevationHigh,
            elevationLow: activity.elevationLow,
            averageTemp: activity.averageTemp,
            startLatLng: activity.startLatLng,
            endLatLng: activity.endLatLng,
            timezone: activity.timezone,
            isIndoor: activity.isIndoor,
            isCommute: activity.isCommute,
            averageCadence: activity.averageCadence,
            averageWatts: activity.averageWatts,
            maxWatts: activity.maxWatts,
            kilojoules: activity.kilojoules,
            polyline: activity.polyline,
            maxSpeed: activity.maxSpeed,
            averageSpeed: activity.averageSpeed,
            isNewActivity: activity.isNewActivity, // Use the value from the client (false for initial sync)
            syncedAt: now,
          });

          // Link to planned workout if one exists for this date
          const activityDate = new Date(activity.startDate).toISOString().split('T')[0];
          await linkActivityToPlannedWorkout(ctx, userId, newActivityId, activityDate);

          const newActivity = await ctx.db.get(newActivityId);
          if (newActivity) {
            newRuns.push(newActivity);
          }
          
          created++;
          totalDistanceGained += activity.distance;

          // Award coins for runs that are not part of initial sync
          if (activity.isNewActivity !== false) {
            const coinsEarned = Math.floor(activity.distance / 100);
            if (coinsEarned > 0) {
              await addCoins(ctx, userId, coinsEarned, "run", newActivityId);
              coinsGained += coinsEarned;
            }
          }
        }
      } catch (error) {
        console.error(`[syncActivitiesFromStrava] Error processing activity ${activity.stravaId}:`, error);
      }
    }

    // Calculate sync results for client
    let distanceGained = 0;
    let leveledUp = false;
    let newLevel = 1;
    let oldLevel = 1;

    // Capture the OLD level BEFORE updating the profile
    if (created > 0 && currentProfile) {
      oldLevel = currentProfile.level || 1;
    }

    // Update user profile totals if we created new activities
    if (created > 0) {
      await updateUserProfileTotalsServer(ctx, userId);
      
      // Recalculate streak after new activities
      try {
        await recalcStreak(ctx.db, userId, new Date().toISOString().split('T')[0]);
      } catch (error) {
        console.error('[syncActivitiesFromStrava] Failed to recalculate streak:', error);
      }
      
      // Update last sync time
      const userProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();

      if (userProfile) {
        await ctx.db.patch(userProfile._id, {
          lastStravaSync: now,
          updatedAt: now,
        });
        
        // Get the NEW level AFTER updating the profile
        newLevel = userProfile.level || 1;
        leveledUp = newLevel > oldLevel;
      }
    }

    const result: SyncResult = {
      created,
      updated,
      skipped,
      lastSyncDate: now,
      distanceGained: totalDistanceGained,
      coinsGained,
      leveledUp,
      newLevel,
      oldLevel,
      newRuns,
    };

    return result;
  },
});

// Helper function to link an activity to a planned workout
async function linkActivityToPlannedWorkout(
  ctx: any,
  userId: any,
  activityId: any,
  activityDate: string
) {
  // Find a planned workout for this date
  const plannedWorkout = await ctx.db
    .query("plannedWorkouts")
    .withIndex("by_user_date", (q: any) => 
      q.eq("userId", userId).eq("scheduledDate", activityDate)
    )
    .first();

  if (plannedWorkout && plannedWorkout.status === 'scheduled') {
    // Get the workout template to determine XP
    const workoutTemplate = await ctx.db.get(plannedWorkout.workoutTemplateId);
    
    // Calculate XP for completing this planned workout
    const plannedWorkoutXP = getPlannedWorkoutXP(workoutTemplate);
    
    // Link the activity to the planned workout and update XP
    await ctx.db.patch(activityId, {
      plannedWorkoutId: plannedWorkout._id,
      xpEarned: plannedWorkoutXP, // Override run XP with planned workout XP
    });

    // Mark planned workout as completed
    await ctx.db.patch(plannedWorkout._id, {
      status: "completed",
      completedAt: new Date().toISOString(),
    });

    return plannedWorkout._id;
  }

  return null;
}

// Migration function to convert existing users from distance-based XP to activity-based XP
export const migrateUserToActivityBasedXP = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    console.log(`[migrateUserToActivityBasedXP] Starting migration for user: ${userId}`);
    
    // Get all activities for this user that don't have xpEarned set
    const allActivities = await ctx.db
      .query("activities")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const activitiesNeedingMigration = allActivities.filter(activity => !activity.xpEarned);
    
    console.log(`[migrateUserToActivityBasedXP] Found ${activitiesNeedingMigration.length} activities needing migration`);

    // Update each activity with appropriate XP
    for (const activity of activitiesNeedingMigration) {
      let xpEarned = getRunXP(); // Default to 500 XP for runs
      
      // If activity is linked to a planned workout, get workout-specific XP
      if (activity.plannedWorkoutId) {
        try {
          const plannedWorkout = await ctx.db.get(activity.plannedWorkoutId);
          if (plannedWorkout?.workoutTemplateId) {
            const workoutTemplate = await ctx.db.get(plannedWorkout.workoutTemplateId);
            if (workoutTemplate) {
              xpEarned = getPlannedWorkoutXP(workoutTemplate);
            }
          }
        } catch (error) {
          console.warn(`[migrateUserToActivityBasedXP] Failed to get planned workout XP for activity ${activity._id}, using default`);
        }
      }

      // Update the activity with XP
      await ctx.db.patch(activity._id, {
        xpEarned: xpEarned,
      });
    }

    // Recalculate user profile totals with new XP system
    await updateUserProfileTotalsInternal(ctx, userId);

    console.log(`[migrateUserToActivityBasedXP] Migration completed for user: ${userId}`);
    
    return {
      success: true,
      activitiesMigrated: activitiesNeedingMigration.length,
      message: `Successfully migrated ${activitiesNeedingMigration.length} activities to activity-based XP system`,
    };
  },
});

// Admin function to migrate all users to activity-based XP (use with caution)
export const migrateAllUsersToActivityBasedXP = mutation({
  args: { adminKey: v.string() },
  handler: async (ctx, args) => {
    // Simple admin protection - in production, use proper admin auth
    if (args.adminKey !== "migrate-xp-system-2024") {
      throw new Error("Unauthorized");
    }

    console.log(`[migrateAllUsersToActivityBasedXP] Starting global migration`);
    
    // Get all users with profiles
    const allProfiles = await ctx.db.query("userProfiles").collect();
    
    let migratedUsers = 0;
    let totalActivitiesMigrated = 0;

    for (const profile of allProfiles) {
      try {
        // Get all activities for this user that don't have xpEarned set
        const allActivities = await ctx.db
          .query("activities")
          .withIndex("by_user", (q) => q.eq("userId", profile.userId))
          .collect();

        const activitiesNeedingMigration = allActivities.filter(activity => !activity.xpEarned);
        
        if (activitiesNeedingMigration.length > 0) {
          console.log(`[migrateAllUsersToActivityBasedXP] Migrating ${activitiesNeedingMigration.length} activities for user: ${profile.userId}`);

          // Update each activity with appropriate XP
          for (const activity of activitiesNeedingMigration) {
            let xpEarned = getRunXP(); // Default to 500 XP for runs
            
            // If activity is linked to a planned workout, get workout-specific XP
            if (activity.plannedWorkoutId) {
              try {
                const plannedWorkout = await ctx.db.get(activity.plannedWorkoutId);
                if (plannedWorkout?.workoutTemplateId) {
                  const workoutTemplate = await ctx.db.get(plannedWorkout.workoutTemplateId);
                  if (workoutTemplate) {
                    xpEarned = getPlannedWorkoutXP(workoutTemplate);
                  }
                }
              } catch (error) {
                console.warn(`[migrateAllUsersToActivityBasedXP] Failed to get planned workout XP for activity ${activity._id}, using default`);
              }
            }

            // Update the activity with XP
            await ctx.db.patch(activity._id, {
              xpEarned: xpEarned,
            });
          }

          // Recalculate user profile totals with new XP system
          await updateUserProfileTotalsInternal(ctx, profile.userId);
          
          migratedUsers++;
          totalActivitiesMigrated += activitiesNeedingMigration.length;
        }
      } catch (error) {
        console.error(`[migrateAllUsersToActivityBasedXP] Failed to migrate user ${profile.userId}:`, error);
      }
    }

    console.log(`[migrateAllUsersToActivityBasedXP] Global migration completed. Users migrated: ${migratedUsers}, Total activities: ${totalActivitiesMigrated}`);
    
    return {
      success: true,
      usersMigrated: migratedUsers,
      totalActivitiesMigrated,
      message: `Successfully migrated ${migratedUsers} users with ${totalActivitiesMigrated} total activities to activity-based XP system`,
    };
  },
});

// Get activities linked to a planned workout
export const getActivitiesForPlannedWorkout = query({
  args: {
    plannedWorkoutId: v.id("plannedWorkouts"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("activities")
      .withIndex("by_planned", (q) => q.eq("plannedWorkoutId", args.plannedWorkoutId))
      .collect();
  },
});

// -----------------------------------------------------------------------------
// Full Strava sync (server-side). Pulls activities from Strava API then re-uses
// existing syncActivitiesFromStravaServer mutation to store them.
export const fullStravaSyncServer = action({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SyncResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // For initial sync pull data from Jan 1 2025 onwards (same logic as old client)
    const startDate = new Date(2025, 0, 1);
    const after = Math.floor(startDate.getTime() / 1000);

    // Get user tokens
    const profile = await ctx.runQuery(api.userProfile.getProfileByUserId, { userId });
    if (!profile || !profile.stravaSyncEnabled || !profile.stravaAccessToken) {
      throw new Error("Strava sync not enabled or no tokens");
    }

    let accessToken = profile.stravaAccessToken as string;

    // Refresh if expired
    const now = Math.floor(Date.now() / 1000);
    if (profile.stravaTokenExpiresAt && profile.stravaTokenExpiresAt <= now) {
      if (!profile.stravaRefreshToken) throw new Error("Access token expired and no refresh token");

      const refresh = await refreshStravaToken(profile.stravaRefreshToken);
      if (!refresh.success) throw new Error(refresh.error || "Failed to refresh token");

      accessToken = refresh.accessToken!;

      // persist new tokens
      await ctx.runMutation(api.userProfile.updateStravaTokens, {
        userId,
        accessToken: refresh.accessToken!,
        refreshToken: refresh.refreshToken!,
        expiresAt: refresh.expiresAt!,
      });
    }

    // Fetch activities
    const listResp = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!listResp.ok) {
      const txt = await listResp.text();
      console.error("[fullStravaSyncServer] API err", txt);
      throw new Error("Failed to fetch activities from Strava");
    }

    const activities = (await listResp.json()) as any[];

    const running = activities.filter((a) => ["Run", "TrailRun", "Treadmill"].includes(a.type));

    const mapped = running.map((activity) => {
      const startDateIso = activity.start_date;
      const endDateIso = new Date(new Date(activity.start_date).getTime() + activity.elapsed_time * 1000).toISOString();
      return {
        stravaId: activity.id,
        startDate: startDateIso,
        endDate: endDateIso,
        duration: Math.round(activity.moving_time / 60),
        distance: Math.round(activity.distance),
        calories: activity.calories ?? estimateCalories(activity.distance, activity.moving_time),
        averageHeartRate: activity.average_heartrate,
        workoutName: activity.name,
        // Enhanced running metrics
        totalElevationGain: activity.total_elevation_gain,
        elevationHigh: activity.elev_high,
        elevationLow: activity.elev_low,
        averageTemp: activity.average_temp,
        startLatLng: activity.start_latlng,
        endLatLng: activity.end_latlng,
        timezone: activity.timezone,
        isIndoor: activity.is_indoor,
        isCommute: activity.is_commute,
        averageCadence: activity.average_cadence,
        averageWatts: activity.average_watts,
        maxWatts: activity.max_watts,
        kilojoules: activity.kilojoules,
        polyline: activity.map?.polyline,
        maxSpeed: activity.max_speed,
        averageSpeed: activity.average_speed,
        // mark as not new for initial sync
        isNewActivity: false,
      };
    });

    // Store in DB
    const result = await ctx.runMutation(api.activities.syncActivitiesFromStravaServer, {
      userId,
      activities: mapped,
      initialSync: true,
    });

    return result;
  },
});

// Helper: estimate calories for a run
function estimateCalories(distance: number, durationSec: number) {
  const avgWeightKg = 70;
  const distanceKm = distance / 1000;
  return Math.round(avgWeightKg * distanceKm * 0.75);
} 

// -----------------------------------------------------------------------------
// Record a manual run from the Blaze app (free-run v1)
export const recordManualRun = mutation({
  args: {
    startDate: v.string(),
    endDate: v.string(),
    duration: v.number(), // minutes
    distance: v.number(), // metres
    calories: v.optional(v.number()),
    averageHeartRate: v.optional(v.number()),
    polyline: v.optional(v.string()), // JSON encoded for now
    plannedWorkoutId: v.optional(v.id("plannedWorkouts")), // Link to planned workout
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const pace = args.distance > 0 ? args.duration / (args.distance / 1000) : undefined; // min/km

    const newActivityId = await ctx.db.insert("activities", {
      userId,
      source: "app",
      startDate: args.startDate,
      endDate: args.endDate,
      duration: args.duration,
      distance: args.distance,
      calories: args.calories ?? Math.round(args.distance / 1000 * 70),
      averageHeartRate: args.averageHeartRate,
      pace,
      polyline: args.polyline,
      plannedWorkoutId: args.plannedWorkoutId,
      isNewActivity: true,
      syncedAt: new Date().toISOString(),
    });

    // Update totals & streaks using existing helpers
    await updateUserProfileTotalsInternal(ctx, userId);
    try {
      await recalcStreak(ctx.db, userId, args.startDate.split('T')[0]);
    } catch (e) {
      console.error('[recordManualRun] Failed to recalc streak', e);
    }

    return newActivityId;
  }
}); 

export const getActivityById = query({
  args: { activityId: v.id("activities") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.userId !== userId) return null;
    return activity;
  },
}); 