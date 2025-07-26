import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";

/**
 * Database Migrations
 * 
 * How to run migrations:
 * 1. Open Convex dashboard
 * 2. Go to Functions tab
 * 3. Find the migration function you want to run
 * 4. Click on it and provide required arguments
 * 
 * Available migrations:
 * - migrateActivitiesToAddSource: Adds source field to existing activities
 * - cleanupActivityData: Cleans up inconsistent activity data
 * - removeDuplicateActivities: Removes duplicate activities between data sources
 * - resetDatabase: ⚠️ DANGER - Completely wipes all data from database
 * 
 * For resetDatabase: You MUST pass { confirmation: "RESET_CONFIRMED" } as argument
 * For resetDatabase dry run: Pass { dryRun: true } to see what would be deleted without deleting
 */

// Migration to add source field to existing activities
export const migrateActivitiesToAddSource = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("[Migration] Starting migration to add source field to activities...");
    
    // Get all activities without a source field
    const allActivities = await ctx.db.query("activities").collect();
    const activitiesNeedingMigration = allActivities.filter(activity => !activity.source);
    
    console.log(`[Migration] Found ${activitiesNeedingMigration.length} activities needing migration`);
    
    let migratedCount = 0;
    
    for (const activity of activitiesNeedingMigration) {
      // If the activity has a healthKitUuid, it's from HealthKit
      // Otherwise, assume it's from HealthKit (since Strava wasn't available before)
      const source = activity.healthKitUuid ? "healthkit" : "healthkit";
      
      await ctx.db.patch(activity._id, {
        source: source as "healthkit" | "strava",
      });
      
      migratedCount++;
    }
    
    console.log(`[Migration] Successfully migrated ${migratedCount} activities`);
    
    return {
      success: true,
      migratedCount,
      totalActivities: allActivities.length,
    };
  },
});

// Migration to clean up any inconsistent data
export const cleanupActivityData = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("[Migration] Starting cleanup of activity data...");
    
    const allActivities = await ctx.db.query("activities").collect();
    let cleanedCount = 0;
    
    for (const activity of allActivities) {
      let needsUpdate = false;
      const updates: any = {};
      
      // If no source field, set to healthkit
      if (!activity.source) {
        updates.source = "healthkit";
        needsUpdate = true;
      }
      
      // If source is healthkit but no healthKitUuid, that's suspicious
      if (activity.source === "healthkit" && !activity.healthKitUuid) {
        console.log(`[Migration] Warning: HealthKit activity ${activity._id} has no healthKitUuid`);
      }
      
      // If source is strava but no stravaId, that's an error
      if (activity.source === "strava" && !activity.stravaId) {
        console.log(`[Migration] Error: Strava activity ${activity._id} has no stravaId`);
        // This shouldn't happen, but let's fix it by setting source to healthkit
        updates.source = "healthkit";
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await ctx.db.patch(activity._id, updates);
        cleanedCount++;
      }
    }
    
    console.log(`[Migration] Cleaned up ${cleanedCount} activities`);
    
    return {
      success: true,
      cleanedCount,
      totalActivities: allActivities.length,
    };
  },
});

// Migration to remove duplicate activities between HealthKit and Strava
export const removeDuplicateActivities = mutation({
  args: {
    keepSource: v.optional(v.union(v.literal("healthkit"), v.literal("strava"))), // Which source to keep
  },
  handler: async (ctx, args) => {
    console.log("[Migration] Starting duplicate removal...");
    
    const allActivities = await ctx.db.query("activities").collect();
    console.log(`[Migration] Analyzing ${allActivities.length} total activities`);
    
    // Group activities by user
    const userActivities = new Map<string, any[]>();
    allActivities.forEach(activity => {
      if (!userActivities.has(activity.userId)) {
        userActivities.set(activity.userId, []);
      }
      userActivities.get(activity.userId)!.push(activity);
    });
    
    let duplicatesRemoved = 0;
    const keepSource = args.keepSource || "healthkit"; // Default to keeping HealthKit
    
    for (const [userId, activities] of userActivities) {
      // Sort activities by start date for easier comparison
      const sortedActivities = activities.sort((a, b) => 
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );
      
      for (let i = 0; i < sortedActivities.length; i++) {
        const current = sortedActivities[i];
        
        // Look for potential duplicates within a 10-minute window
        for (let j = i + 1; j < sortedActivities.length; j++) {
          const next = sortedActivities[j];
          
          const timeDiff = Math.abs(
            new Date(current.startDate).getTime() - new Date(next.startDate).getTime()
          );
          
          // If activities are more than 10 minutes apart, stop checking
          if (timeDiff > 10 * 60 * 1000) break;
          
          // Simple and effective: same date + same distance = duplicate
          const distanceDiff = Math.abs(current.distance - next.distance);
          
          // If same day and very similar distance, it's a duplicate
          const isSameDay = new Date(current.startDate).toDateString() === new Date(next.startDate).toDateString();
          const isSameDistance = distanceDiff <= 50; // Within 50 meters (very close)
          
          const isSimilar = isSameDay && isSameDistance;
          
          // Debug logging for potential matches
          if (isSameDay && current.source !== next.source) {
            console.log(`[Migration] Comparing activities on same day:
              Date: ${new Date(current.startDate).toDateString()}
              Distance diff: ${distanceDiff}m
              Sources: ${current.source} vs ${next.source}
              Is duplicate: ${isSimilar}`);
          }
          
          if (isSimilar && current.source !== next.source) {
            // We have a duplicate! Decide which one to keep
            const toDelete = keepSource === "healthkit" 
              ? (current.source === "strava" ? current : next)
              : (current.source === "healthkit" ? current : next);
            
            console.log(`[Migration] Removing duplicate: ${toDelete.source} activity from ${toDelete.startDate}`);
            
            await ctx.db.delete(toDelete._id);
            duplicatesRemoved++;
            
            // Remove from our array to avoid processing again
            const indexToRemove = sortedActivities.indexOf(toDelete);
            if (indexToRemove > -1) {
              sortedActivities.splice(indexToRemove, 1);
              if (indexToRemove <= i) i--; // Adjust current index
              if (indexToRemove <= j) j--; // Adjust comparison index
            }
          }
        }
      }
    }
    
    console.log(`[Migration] Removed ${duplicatesRemoved} duplicate activities`);
    
    return {
      success: true,
      duplicatesRemoved,
      keptSource: keepSource,
      totalActivities: allActivities.length,
    };
  },
});

// DANGER: Reset entire database - clears ALL tables
export const resetDatabase = mutation({
  args: {
    confirmation: v.string(), // Must pass "RESET_CONFIRMED" to execute
    dryRun: v.optional(v.boolean()), // If true, shows what would be deleted without deleting
  },
  handler: async (ctx, args) => {
    // Safety check - require explicit confirmation for actual reset
    if (!args.dryRun && args.confirmation !== "RESET_CONFIRMED") {
      throw new Error("Migration requires confirmation string 'RESET_CONFIRMED' to execute");
    }

    const isDryRun = args.dryRun === true;
    console.log(`[${isDryRun ? 'DRY RUN' : 'DANGER'}] Starting ${isDryRun ? 'dry run of' : 'complete'} database reset...`);
    
    const stats = {
      userProfiles: 0,
      trainingProfiles: 0,
      simpleTrainingSchedule: 0,
      scheduleHistory: 0,
      workouts: 0,
      trainingPlans: 0,
      plannedWorkouts: 0,
      activities: 0,
      restActivities: 0,
      challenges: 0,
      userAchievements: 0,
      activityAchievements: 0,
      stravaSyncQueue: 0,
      pushNotificationLogs: 0,
      authTables: 0,
    };

    // Count/Delete tables in order that respects foreign key relationships
    // Start with dependent tables first, then parent tables

    try {
      // 1. Activity achievements (depends on activities, challenges, userAchievements)
      console.log(`[${isDryRun ? 'DRY RUN' : 'RESET'}] ${isDryRun ? 'Counting' : 'Deleting'} activityAchievements...`);
      const activityAchievements = await ctx.db.query("activityAchievements").collect();
      for (const item of activityAchievements) {
        if (!isDryRun) await ctx.db.delete(item._id);
        stats.activityAchievements++;
      }

      // 2. User achievements (depends on challenges)
      console.log(`[${isDryRun ? 'DRY RUN' : 'RESET'}] ${isDryRun ? 'Counting' : 'Deleting'} userAchievements...`);
      const userAchievements = await ctx.db.query("userAchievements").collect();
      for (const item of userAchievements) {
        if (!isDryRun) await ctx.db.delete(item._id);
        stats.userAchievements++;
      }

      // 3. Planned workouts (depends on training plans, workouts)
      console.log(`[${isDryRun ? 'DRY RUN' : 'RESET'}] ${isDryRun ? 'Counting' : 'Deleting'} plannedWorkouts...`);
      const plannedWorkouts = await ctx.db.query("plannedWorkouts").collect();
      for (const item of plannedWorkouts) {
        if (!isDryRun) await ctx.db.delete(item._id);
        stats.plannedWorkouts++;
      }

      // 4. Activities (depends on planned workouts - but optional)
      console.log(`[${isDryRun ? 'DRY RUN' : 'RESET'}] ${isDryRun ? 'Counting' : 'Deleting'} activities...`);
      const activities = await ctx.db.query("activities").collect();
      for (const item of activities) {
        if (!isDryRun) await ctx.db.delete(item._id);
        stats.activities++;
      }

      // 5. Rest activities (depends on planned workouts - but optional)
      console.log(`[${isDryRun ? 'DRY RUN' : 'RESET'}] ${isDryRun ? 'Counting' : 'Deleting'} restActivities...`);
      const restActivities = await ctx.db.query("restActivities").collect();
      for (const item of restActivities) {
        if (!isDryRun) await ctx.db.delete(item._id);
        stats.restActivities++;
      }

      // 6. Training plans (depends on users)
      console.log(`[${isDryRun ? 'DRY RUN' : 'RESET'}] ${isDryRun ? 'Counting' : 'Deleting'} trainingPlans...`);
      const trainingPlans = await ctx.db.query("trainingPlans").collect();
      for (const item of trainingPlans) {
        if (!isDryRun) await ctx.db.delete(item._id);
        stats.trainingPlans++;
      }

      // 7. Workouts (can be system or user workouts)
      console.log(`[${isDryRun ? 'DRY RUN' : 'RESET'}] ${isDryRun ? 'Counting' : 'Deleting'} workouts...`);
      const workouts = await ctx.db.query("workoutTemplates").collect();
      for (const item of workouts) {
        if (!isDryRun) await ctx.db.delete(item._id);
        stats.workouts++;
      }

      // 8. Schedule history (depends on users)
      console.log(`[${isDryRun ? 'DRY RUN' : 'RESET'}] ${isDryRun ? 'Counting' : 'Deleting'} scheduleHistory...`);
      const scheduleHistory = await ctx.db.query("scheduleHistory").collect();
      for (const item of scheduleHistory) {
        if (!isDryRun) await ctx.db.delete(item._id);
        stats.scheduleHistory++;
      }

      // 9. Simple training schedule (depends on users)
      console.log(`[${isDryRun ? 'DRY RUN' : 'RESET'}] ${isDryRun ? 'Counting' : 'Deleting'} simpleTrainingSchedule...`);
      const simpleTrainingSchedule = await ctx.db.query("simpleTrainingSchedule").collect();
      for (const item of simpleTrainingSchedule) {
        if (!isDryRun) await ctx.db.delete(item._id);
        stats.simpleTrainingSchedule++;
      }

      // 10. Training profiles (depends on users)
      console.log(`[${isDryRun ? 'DRY RUN' : 'RESET'}] ${isDryRun ? 'Counting' : 'Deleting'} trainingProfiles...`);
      const trainingProfiles = await ctx.db.query("trainingProfiles").collect();
      for (const item of trainingProfiles) {
        if (!isDryRun) await ctx.db.delete(item._id);
        stats.trainingProfiles++;
      }

      // 11. User profiles (depends on users)
      console.log(`[${isDryRun ? 'DRY RUN' : 'RESET'}] ${isDryRun ? 'Counting' : 'Deleting'} userProfiles...`);
      const userProfiles = await ctx.db.query("userProfiles").collect();
      for (const item of userProfiles) {
        if (!isDryRun) await ctx.db.delete(item._id);
        stats.userProfiles++;
      }

      // 12. Challenges (independent table)
      console.log(`[${isDryRun ? 'DRY RUN' : 'RESET'}] ${isDryRun ? 'Counting' : 'Deleting'} challenges...`);
      const challenges = await ctx.db.query("challenges").collect();
      for (const item of challenges) {
        if (!isDryRun) await ctx.db.delete(item._id);
        stats.challenges++;
      }

      // 14. Push notification logs (depends on users)
      console.log(`[${isDryRun ? 'DRY RUN' : 'RESET'}] ${isDryRun ? 'Counting' : 'Deleting'} pushNotificationLogs...`);
      const pushNotificationLogs = await ctx.db.query("pushNotificationLogs").collect();
      for (const item of pushNotificationLogs) {
        if (!isDryRun) await ctx.db.delete(item._id);
        stats.pushNotificationLogs++;
      }

      // 15. Auth tables (users, sessions, etc.)
      // Note: This is more complex because auth tables are managed by the auth library
      console.log(`[${isDryRun ? 'DRY RUN' : 'RESET'}] ${isDryRun ? 'Counting' : 'Deleting'} auth tables...`);
      
      // Delete sessions first
      try {
        const sessions = await ctx.db.query("authSessions").collect();
        for (const session of sessions) {
          if (!isDryRun) await ctx.db.delete(session._id);
          stats.authTables++;
        }
      } catch (error) {
        console.log(`[${isDryRun ? 'DRY RUN' : 'RESET'}] No authSessions table or already empty`);
      }

      // Delete accounts
      try {
        const accounts = await ctx.db.query("authAccounts").collect();
        for (const account of accounts) {
          if (!isDryRun) await ctx.db.delete(account._id);
          stats.authTables++;
        }
      } catch (error) {
        console.log(`[${isDryRun ? 'DRY RUN' : 'RESET'}] No authAccounts table or already empty`);
      }

      // Delete refresh tokens
      try {
        const refreshTokens = await ctx.db.query("authRefreshTokens").collect();
        for (const token of refreshTokens) {
          if (!isDryRun) await ctx.db.delete(token._id);
          stats.authTables++;
        }
      } catch (error) {
        console.log(`[${isDryRun ? 'DRY RUN' : 'RESET'}] No authRefreshTokens table or already empty`);
      }

      // Delete verification codes
      try {
        const verificationCodes = await ctx.db.query("authVerificationCodes").collect();
        for (const code of verificationCodes) {
          if (!isDryRun) await ctx.db.delete(code._id);
          stats.authTables++;
        }
      } catch (error) {
        console.log(`[${isDryRun ? 'DRY RUN' : 'RESET'}] No authVerificationCodes table or already empty`);
      }

      // Delete users last (everything depends on users)
      try {
        const users = await ctx.db.query("users").collect();
        for (const user of users) {
          if (!isDryRun) await ctx.db.delete(user._id);
          stats.authTables++;
        }
      } catch (error) {
        console.log(`[${isDryRun ? 'DRY RUN' : 'RESET'}] No users table or already empty`);
      }

      const totalDeleted = Object.values(stats).reduce((sum, count) => sum + count, 0);

      if (isDryRun) {
        console.log("[DRY RUN] Database reset simulation completed!");
        console.log(`[DRY RUN] Total records that would be deleted: ${totalDeleted}`);
        console.log("[DRY RUN] Breakdown:", stats);

        return {
          success: true,
          dryRun: true,
          totalThatWouldBeDeleted: totalDeleted,
          breakdown: stats,
          message: "This was a dry run. No data was actually deleted. To execute the reset, call again with confirmation: 'RESET_CONFIRMED' and dryRun: false",
        };
      } else {
        console.log("[RESET] Database reset completed successfully!");
        console.log(`[RESET] Total records deleted: ${totalDeleted}`);
        console.log("[RESET] Breakdown:", stats);

        return {
          success: true,
          dryRun: false,
          totalDeleted,
          breakdown: stats,
          message: "Database has been completely reset. All tables are now empty.",
        };
      }

    } catch (error) {
      console.error(`[${isDryRun ? 'DRY RUN' : 'RESET'}] Error during database ${isDryRun ? 'simulation' : 'reset'}:`, error);
      throw new Error(`Database ${isDryRun ? 'simulation' : 'reset'} failed: ${error}`);
    }
  },
}); 

// Migration to backfill missing activity metrics and recalculate user profiles
// Helper mutation to patch activity fields (called by the action)
export const patchActivityFields = mutation({
  args: {
    activityId: v.id("activities"),
    data: v.object({
      pace: v.optional(v.number()),
      calories: v.optional(v.number()),
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
      syncedAt: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.activityId, args.data);
  },
});

export const backfillActivityMetricsAndProfiles = action({
  args: {
    dryRun: v.optional(v.boolean()), // If true, no writes are made
    limitPerUser: v.optional(v.number()), // Optional limit of activities to process per user
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun === true;
    const limitPerUser = args.limitPerUser ?? undefined;

    let totalUsers = 0;
    let activitiesExamined = 0;
    let activitiesUpdated = 0;

    console.log(`[Migration] Starting backfillActivityMetricsAndProfiles (dryRun=${dryRun})`);

    // Helper: estimate calories if missing
    const estimateCalories = (distance: number, durationSec: number) => {
      const avgWeightKg = 70;
      const distanceKm = distance / 1000;
      return Math.round(avgWeightKg * distanceKm * 0.75);
    };

    // Helper: refresh Strava token if expired
    const refreshStravaToken = async (refreshToken: string) => {
      try {
        const clientId = process.env.STRAVA_CLIENT_ID;
        const clientSecret = process.env.STRAVA_CLIENT_SECRET;
        if (!clientId || !clientSecret) return null;

        const resp = await fetch("https://www.strava.com/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
          }),
        });
        if (!resp.ok) return null;
        return (await resp.json()) as any;
      } catch (err) {
        console.error("[Migration] Failed to refresh Strava token", err);
        return null;
      }
    };

    // Helper: fetch Strava activity detail
    const fetchStravaActivity = async (accessToken: string, activityId: number) => {
      try {
        const res = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return null;
        return (await res.json()) as any;
      } catch (err) {
        console.error(`[Migration] Error fetching Strava activity ${activityId}`, err);
        return null;
      }
    };

    // Iterate over all user profiles
    const profiles = await ctx.runQuery("migrations:listAllUserProfiles" as any, {});

    for (const profile of profiles) {
      totalUsers++;
      const userId = profile.userId;

      const userActivities = await ctx.runQuery("migrations:listUserActivities" as any, {
        userId,
        limit: limitPerUser,
      });

      let userUpdatedAny = false;

      // Prepare Strava token if needed
      let stravaAccessToken: string | undefined = profile.stravaAccessToken ?? undefined;
      const stravaRefreshToken: string | undefined = profile.stravaRefreshToken ?? undefined;
      const stravaTokenExpiresAt: number | undefined = profile.stravaTokenExpiresAt ?? undefined;
      const now = Math.floor(Date.now() / 1000);

      if (stravaAccessToken && stravaTokenExpiresAt && stravaTokenExpiresAt <= now) {
        if (stravaRefreshToken) {
          const newTokens = await refreshStravaToken(stravaRefreshToken);
          if (newTokens) {
            stravaAccessToken = newTokens.access_token;
            if (!dryRun) {
              await ctx.runMutation("userProfile:updateStravaTokens" as any, {
                userId: userId,
                accessToken: newTokens.access_token,
                refreshToken: newTokens.refresh_token,
                expiresAt: newTokens.expires_at,
              });
            }
          } else {
            console.warn(`[Migration] Unable to refresh tokens for user ${userId}`);
          }
        }
      }

      for (const activity of userActivities) {
        activitiesExamined++;
        const updates: any = {};

        // 1. Backfill pace
        if ((activity.pace === undefined || activity.pace === 0) && activity.distance > 0) {
          updates.pace = activity.duration / (activity.distance / 1000);
        }

        // 2. If Strava activity missing extended metrics, fetch from API
        const needsStravaDetails =
          activity.source === "strava" &&
          (activity.totalElevationGain === undefined || activity.averageSpeed === undefined || activity.polyline === undefined);

        if (needsStravaDetails && stravaAccessToken && activity.stravaId) {
          const stravaData = await fetchStravaActivity(stravaAccessToken, activity.stravaId);
          if (stravaData) {
            updates.totalElevationGain = stravaData.total_elevation_gain;
            updates.elevationHigh = stravaData.elev_high;
            updates.elevationLow = stravaData.elev_low;
            updates.averageTemp = stravaData.average_temp;
            updates.startLatLng = stravaData.start_latlng;
            updates.endLatLng = stravaData.end_latlng;
            updates.timezone = stravaData.timezone;
            updates.isIndoor = stravaData.is_indoor;
            updates.isCommute = stravaData.is_commute;
            updates.averageCadence = stravaData.average_cadence;
            updates.averageWatts = stravaData.average_watts;
            updates.maxWatts = stravaData.max_watts;
            updates.kilojoules = stravaData.kilojoules;
            updates.polyline = stravaData.map?.polyline;
            updates.maxSpeed = stravaData.max_speed;
            updates.averageSpeed = stravaData.average_speed;
            if (stravaData.calories !== undefined && (activity.calories === undefined || activity.calories === 0)) {
              updates.calories = stravaData.calories;
            }
          }
        }

        // 3. HealthKit / app activities: ensure calories if missing
        if ((activity.calories === undefined || activity.calories === 0) && activity.distance > 0) {
          updates.calories = estimateCalories(activity.distance, activity.duration * 60);
        }

        if (Object.keys(updates).length > 0) {
          activitiesUpdated++;
          if (!dryRun) {
            await ctx.runMutation("migrations:patchActivityFields" as any, {
              activityId: activity._id,
              data: { ...updates, syncedAt: new Date().toISOString() },
            });
          }
          userUpdatedAny = true;
        }
      }

      // Recalculate user profile totals if any activity changed
      if (userUpdatedAny && !dryRun) {
        await ctx.runMutation("activities:updateUserProfileTotals" as any, { userId });
      }
    }

    console.log(`[Migration] Completed. Examined ${activitiesExamined} activities; updated ${activitiesUpdated}.`);

    return {
      success: true,
      dryRun,
      totalUsers,
      activitiesExamined,
      activitiesUpdated,
    };
  },
}); 

// Helper query: list all user profiles (used by the action)
export const listAllUserProfiles = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("userProfiles").collect();
  },
});

// Helper query: list activities for a specific user (optionally limited)
export const listUserActivities = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("activities")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId));
    if (args.limit !== undefined) {
      return await q.take(args.limit);
    }
    return await q.collect();
  },
}); 