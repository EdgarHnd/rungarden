import { v } from "convex/values";
import { mutation } from "./_generated/server";

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