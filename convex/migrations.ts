import { v } from "convex/values";
import { mutation } from "./_generated/server";

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
      const workouts = await ctx.db.query("workouts").collect();
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

      // 13. Strava sync queue (depends on users)
      console.log(`[${isDryRun ? 'DRY RUN' : 'RESET'}] ${isDryRun ? 'Counting' : 'Deleting'} stravaSyncQueue...`);
      const stravaSyncQueue = await ctx.db.query("stravaSyncQueue").collect();
      for (const item of stravaSyncQueue) {
        if (!isDryRun) await ctx.db.delete(item._id);
        stats.stravaSyncQueue++;
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