import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";
import {
  calculateCoinsFromDistance,
  calculateLevelFromXP,
  distanceToXP
} from "./utils/gamification";
import { recalcStreak } from "./utils/streak";
import {
  checkStreakMilestones
} from "./utils/streaks";

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
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

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
          isNewActivity: true, // Mark as new for celebration
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
        syncResults.coinsGained = 0; // No coins for initial sync
        syncResults.leveledUp = newLevel > oldLevel;
        syncResults.newLevel = newLevel;
        syncResults.oldLevel = oldLevel;
      }
    }
    
    // Update last sync date
    await updateLastSyncDate(ctx, userId, now);

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
    })),
  },
  handler: async (ctx, args): Promise<SyncResult> => {
    const { userId, activities } = args;
    const now = new Date().toISOString();
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
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
            isNewActivity: true, // Don't mark initial sync activities as new
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
      coins,
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
    
    // Calculate XP and level from total distance
    const totalXP = distanceToXP(totalDistance);
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

// Get activity statistics
export const getActivityStats = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const days = args.days ?? 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const activities = await ctx.db
      .query("activities")
      .withIndex("by_user_and_date", (q) => 
        q.eq("userId", userId).gte("startDate", startDate.toISOString())
      )
      .collect();

    if (activities.length === 0) {
      return {
        totalDistance: 0,
        totalWorkouts: 0,
        averagePace: 0,
        totalCalories: 0,
        averageDistance: 0,
        longestRun: 0,
      };
    }

    const totalDistance = activities.reduce((sum, a) => sum + a.distance, 0);
    const totalCalories = activities.reduce((sum, a) => sum + a.calories, 0);
    const validPaces = activities.filter(a => a.pace && a.pace > 0);
    const averagePace = validPaces.length > 0 ? 
      validPaces.reduce((sum, a) => sum + a.pace!, 0) / validPaces.length : 0;
    const longestRun = Math.max(...activities.map(a => a.distance));

    return {
      totalDistance,
      totalWorkouts: activities.length,
      averagePace,
      totalCalories,
      averageDistance: totalDistance / activities.length,
      longestRun,
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
  
  // Calculate XP and level from total distance
  const totalXP = distanceToXP(totalDistance);
  const level = calculateLevelFromXP(totalXP);
  
  // Calculate coins from total distance
  const coins = calculateCoinsFromDistance(totalDistance);

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
      coins,
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
      coins,
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
      lastSyncDate: syncDate,
      lastHealthKitSync: syncDate,
      updatedAt: syncDate,
    });
  }
}

// Helper function to update streak when workout is completed
async function updateStreakOnCompletion(
  ctx: any,
  userId: any,
  workoutDate: string,
  workoutType: string,
  plannedWorkoutId: any
) {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  if (!profile) {
    throw new Error("Profile not found");
  }

  const beforeStreak = profile.currentStreak || 0;

  // Centralized recalculation – streak only breaks on "missed"
  await recalcStreak(ctx.db, userId, new Date().toISOString().split("T")[0]);

  // Fetch updated profile
  const updatedProfile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  if (!updatedProfile) {
    return { streakUpdated: false, currentStreak: beforeStreak, streakIncreased: false };
  }

  const afterStreak = updatedProfile.currentStreak || 0;

  const milestoneRewards = checkStreakMilestones(
    beforeStreak,
    afterStreak,
    updatedProfile.streakFreezeAvailable || 0
  );

  // Apply freeze reward if any
  if (milestoneRewards.freezesEarned > 0) {
    await ctx.db.patch(updatedProfile._id, {
      streakFreezeAvailable: milestoneRewards.newFreezes,
    });
  }

  return {
    streakUpdated: true,
    currentStreak: afterStreak,
    longestStreak: updatedProfile.longestStreak || afterStreak,
    streakIncreased: afterStreak > beforeStreak,
    milestoneMessage: milestoneRewards.milestoneMessage,
    streakFreezesEarned: milestoneRewards.freezesEarned,
  };
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
        calories: activityData.calories || estimateCalories(activityData.distance, activityData.moving_time),
        averageHeartRate: activityData.average_heartrate,
        workoutName: activityData.name,
      };

      // Sync to database using the existing mutation
      const syncResult = await ctx.runMutation(api.activities.syncActivitiesFromStravaServer, {
        userId,
        activities: [activityForDb]
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
    const clientId = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID;
    const clientSecret = process.env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET;
    
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

// Helper function to estimate calories if not provided by Strava
function estimateCalories(distance: number, duration: number): number {
  // Assume average weight of 70kg for estimation
  const averageWeight = 70;
  const distanceKm = distance / 1000;
  return Math.round(averageWeight * distanceKm * 0.75);
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
            isNewActivity: true, // Don't mark initial sync activities as new
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
        }
      } catch (error) {
        console.error(`[syncActivitiesFromStrava] Error processing activity ${activity.stravaId}:`, error);
      }
    }

    // Calculate sync results for client
    let distanceGained = 0;
    let coinsGained = 0; // No coins for initial sync
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
      coinsGained: 0, // No coins for initial sync
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
    // Link the activity to the planned workout
    await ctx.db.patch(activityId, {
      plannedWorkoutId: plannedWorkout._id,
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