import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";
// Simplified for garden app - no complex gamification

// Sync result interface
interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  lastSyncDate: string;
  distanceGained?: number;
  plantsAwarded?: number;
  newRuns?: any[];
}

// Gamification functions moved to ./utils/gamification.ts

// Get activity by Strava ID
export const getActivityByStravaId = query({
  args: {
    stravaId: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("activities")
      .withIndex("by_strava_id", (q) => q.eq("stravaId", args.stravaId))
      .first();
  },
});

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

// Get a specific activity by ID
export const getActivityById = query({
  args: {
    activityId: v.id("activities"),
  },
  handler: async (ctx, { activityId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const activity = await ctx.db.get(activityId);
    
    // Ensure the activity belongs to the authenticated user
    if (!activity || activity.userId !== userId) {
      return null;
    }

    return activity;
  },
});

// Debug mutation to create fake activities for testing
export const createDebugActivity = mutation({
  args: {
    distance: v.number(), // distance in meters
  },
  handler: async (ctx, { distance }): Promise<{
    success: boolean;
    distance: number;
    result: any;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const now = new Date();
    const fakeActivity = {
      healthKitUuid: `debug-${Date.now()}`,
      startDate: now.toISOString(),
      endDate: new Date(now.getTime() + 30 * 60 * 1000).toISOString(), // 30 min later
      duration: Math.max(Math.round(distance / 100), 5), // Rough pace calculation, min 5 minutes
      distance: distance,
      calories: Math.round(distance * 0.06), // Rough estimate
      workoutName: `Debug Run ${(distance / 1000).toFixed(1)}km`,
    };

    // Use the existing sync function to create the activity
    const result: any = await ctx.runMutation(api.activities.syncActivitiesFromHealthKit, {
      activities: [fakeActivity],
      initialSync: false,
    });

    return {
      success: true,
      distance: distance,
      result: result,
    };
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
    deletedUuids: v.optional(v.array(v.string())),
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
        // Create new activity
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
          isNewActivity: initialSync ? false : true, // Mark as new only for incremental sync
          syncedAt: now,
        });
        
        // No more planned workout linking in garden app
        
        // Get the full activity record to include in results
        const newActivityRecord = await ctx.db.get(newActivityId);
        if (newActivityRecord) {
          syncResults.newRuns.push(newActivityRecord);
        }
        
        syncResults.created++;
        console.log(`[syncActivitiesFromHealthKit] Created new activity: ${activity.healthKitUuid}, ID: ${newActivityId}`);

        // Track distance for new activity
        totalDistanceGained += activity.distance;

        // Award plant for this run distance (if distance meets criteria)
        if (activity.distance > 0) {
          try {
            await ctx.runMutation(api.plants.awardPlantForActivity, {
              activityId: newActivityId,
            });
          } catch (error) {
            console.error(`[syncActivitiesFromHealthKit] Failed to award plant for activity ${newActivityId}:`, error);
          }
        }
      }
    }

    // Update user profile totals after sync (this calculates everything correctly from DB)
    await updateUserProfileTotalsInternal(ctx, userId);
    
    // No streak system in garden app - removed recalculation
    
    // Simple distance tracking for garden app
    if (totalDistanceGained > 0) {
      syncResults.distanceGained = totalDistanceGained;
    }
    
    // Handle deleted activities
    let deletedCount = 0;
    if (args.deletedUuids && args.deletedUuids.length > 0) {
      console.log(`[syncActivitiesFromHealthKit] Processing ${args.deletedUuids.length} deleted activities`);
      
      for (const deletedUuid of args.deletedUuids) {
        // Find the activity by HealthKit UUID
        const activityToDelete = await ctx.db
          .query("activities")
          .withIndex("by_healthkit_uuid", (q) => q.eq("healthKitUuid", deletedUuid))
          .first();

        if (activityToDelete && activityToDelete.userId === userId) {
          // Delete associated plant if it exists
          if (activityToDelete.plantEarned) {
            const plant = await ctx.db.get(activityToDelete.plantEarned);
            if (plant) {
              await ctx.db.delete(plant._id);
              console.log(`[syncActivitiesFromHealthKit] Deleted plant from deleted activity:`, plant._id);
            }
          }

          // Delete the activity
          await ctx.db.delete(activityToDelete._id);
          deletedCount++;
          console.log(`[syncActivitiesFromHealthKit] Deleted activity: ${deletedUuid}`);
        }
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

    return {
      ...syncResults,
      deleted: deletedCount,
    };
  },
});

/*──────────────────────── sync activities from HealthKit with initial sync support */
export const syncActivitiesFromHealthKitInitial = mutation({
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
    deletedUuids: v.optional(v.array(v.string())),
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
      newRuns: [] as any[],
    };

    let totalDistanceGained = 0;
    let plantsAwarded = 0;

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

      console.log(`[syncActivitiesFromHealthKitInitial] Processing activity: ${activity.workoutName} on ${activity.startDate}, distance: ${activity.distance}m`);

      if (existingActivity) {
        // Update existing activity
        await ctx.db.patch(existingActivity._id, {
          startDate: activity.startDate,
          endDate: activity.endDate,
          duration: activity.duration,
          distance: activity.distance,
          calories: activity.calories,
          averageHeartRate: activity.averageHeartRate,
          workoutName: activity.workoutName,
          pace,
          // Don't mark as celebrated yet - will be marked after InitialSyncModal is shown
          celebrationShown: existingActivity.celebrationShown,
        });
        
        syncResults.updated++;
        console.log(`[syncActivitiesFromHealthKitInitial] Updated existing activity: ${activity.healthKitUuid}`);

        // Store existing activity for batch plant awarding
        if (activity.distance > 0 && !existingActivity.plantEarned) {
          syncResults.newRuns.push({ id: existingActivity._id, distance: activity.distance });
        }
      } else {
        // Create new activity
        const newActivityId = await ctx.db.insert("activities", {
          userId,
          healthKitUuid: activity.healthKitUuid,
          startDate: activity.startDate,
          endDate: activity.endDate,
          duration: activity.duration,
          distance: activity.distance,
          calories: activity.calories,
          averageHeartRate: activity.averageHeartRate,
          workoutName: activity.workoutName,
          pace,
          source: "healthkit",
          syncedAt: now,
          // Don't mark as celebrated yet - will be marked after InitialSyncModal is shown
          celebrationShown: false,
        });
        
        totalDistanceGained += activity.distance;
        syncResults.created++;
        syncResults.newRuns.push({ id: newActivityId, distance: activity.distance });
        console.log(`[syncActivitiesFromHealthKitInitial] Created new activity: ${activity.healthKitUuid}, ID: ${newActivityId}`);
      }
    }

    // Award plants in batch for better performance
    if (syncResults.newRuns.length > 0) {
      try {
        const activityIds = syncResults.newRuns.map(run => run.id);
        const plantResult = await ctx.runMutation(api.plants.awardPlantsForActivitiesBatch, {
          activityIds
        });
        plantsAwarded = plantResult.plantsAwarded;
        console.log(`[syncActivitiesFromHealthKitInitial] Batch awarded ${plantsAwarded} plants for ${activityIds.length} activities`);
      } catch (error) {
        console.error(`[syncActivitiesFromHealthKitInitial] Failed to batch award plants:`, error);
      }
    }

    // Update user profile totals after sync
    await updateUserProfileTotalsInternal(ctx, userId);
    
    // Simple distance tracking for garden app
    if (totalDistanceGained > 0) {
      syncResults.distanceGained = totalDistanceGained;
    }
    
    // Update last sync date
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

    // Handle deleted activities if provided
    let deletedCount = 0;
    if (args.deletedUuids && args.deletedUuids.length > 0) {
      console.log(`[syncActivitiesFromHealthKitInitial] Processing ${args.deletedUuids.length} deleted activities`);
      
      for (const deletedUuid of args.deletedUuids) {
        const existingActivity = await ctx.db
          .query("activities")
          .withIndex("by_healthkit_uuid", (q: any) => q.eq("healthKitUuid", deletedUuid))
          .first();
        
        if (existingActivity) {
          // Delete any plants earned from this activity
          const plantsFromActivity = await ctx.db
            .query("plants")
            .withIndex("by_activity", (q: any) => q.eq("earnedFromActivityId", existingActivity._id))
            .collect();

          for (const plant of plantsFromActivity) {
            await ctx.db.delete(plant._id);
            console.log(`[syncActivitiesFromHealthKitInitial] Deleted plant from deleted activity:`, plant._id);
          }

          await ctx.db.delete(existingActivity._id);
          deletedCount++;
          console.log(`[syncActivitiesFromHealthKitInitial] Deleted activity: ${deletedUuid}`);
        }
      }
    }

    console.log(`[syncActivitiesFromHealthKitInitial] Sync completed: ${syncResults.created} created, ${syncResults.updated} updated, ${deletedCount} deleted, ${plantsAwarded} plants awarded`);

    return {
      ...syncResults,
      deleted: deletedCount,
      plantsAwarded, // Add plants awarded to result
    };
  },
});

/*──────────────────────── sync activities from HealthKit with forced plant awarding */
export const syncActivitiesFromHealthKitWithPlants = mutation({
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
    deletedUuids: v.optional(v.array(v.string())),
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
      newRuns: [] as any[], // Track newly created activities
    };

    let totalDistanceGained = 0;
    let plantsAwarded = 0;

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

      console.log(`[syncActivitiesFromHealthKitWithPlants] Processing activity: ${activity.workoutName} on ${activity.startDate}, distance: ${activity.distance}m`);

      if (existingActivity) {
        // Update existing activity
        await ctx.db.patch(existingActivity._id, {
          startDate: activity.startDate,
          endDate: activity.endDate,
          duration: activity.duration,
          distance: activity.distance,
          calories: activity.calories,
          averageHeartRate: activity.averageHeartRate,
          workoutName: activity.workoutName,
          pace,
        });
        
        syncResults.updated++;
        console.log(`[syncActivitiesFromHealthKitWithPlants] Updated existing activity: ${activity.healthKitUuid}`);

        // FORCE plant awarding even for existing activities (for testing)
        if (activity.distance > 0) {
          try {
            await ctx.runMutation(api.plants.awardPlantForActivity, {
              activityId: existingActivity._id,
            });
            plantsAwarded++;
            console.log(`[syncActivitiesFromHealthKitWithPlants] Awarded plant for existing activity: ${activity.distance}m`);
          } catch (error) {
            console.error(`[syncActivitiesFromHealthKitWithPlants] Failed to award plant for existing activity:`, error);
          }
        }
      } else {
        // Create new activity
        const newActivityId = await ctx.db.insert("activities", {
          userId,
          healthKitUuid: activity.healthKitUuid,
          startDate: activity.startDate,
          endDate: activity.endDate,
          duration: activity.duration,
          distance: activity.distance,
          calories: activity.calories,
          averageHeartRate: activity.averageHeartRate,
          workoutName: activity.workoutName,
          pace,
          source: "healthkit",
          syncedAt: now,
        });
        
        totalDistanceGained += activity.distance;
        syncResults.created++;
        syncResults.newRuns.push({ id: newActivityId, distance: activity.distance });
        console.log(`[syncActivitiesFromHealthKitWithPlants] Created new activity: ${activity.healthKitUuid}, ID: ${newActivityId}`);

        // Award plant for new activity
        if (activity.distance > 0) {
          try {
            await ctx.runMutation(api.plants.awardPlantForActivity, {
              activityId: newActivityId,
            });
            plantsAwarded++;
            console.log(`[syncActivitiesFromHealthKitWithPlants] Awarded plant for new activity: ${activity.distance}m`);
          } catch (error) {
            console.error(`[syncActivitiesFromHealthKitWithPlants] Failed to award plant for new activity:`, error);
          }
        }
      }
    }

    // Update user profile totals after sync
    await updateUserProfileTotalsInternal(ctx, userId);
    
    // Simple distance tracking for garden app
    if (totalDistanceGained > 0) {
      syncResults.distanceGained = totalDistanceGained;
    }
    
    // Update last sync date
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

    // Handle deleted activities if provided
    let deletedCount = 0;
    if (args.deletedUuids && args.deletedUuids.length > 0) {
      console.log(`[syncActivitiesFromHealthKitWithPlants] Processing ${args.deletedUuids.length} deleted activities`);
      
      for (const deletedUuid of args.deletedUuids) {
        const existingActivity = await ctx.db
          .query("activities")
          .withIndex("by_healthkit_uuid", (q: any) => q.eq("healthKitUuid", deletedUuid))
          .first();
        
        if (existingActivity) {
          // Delete any plants earned from this activity
          const plantsFromActivity = await ctx.db
            .query("plants")
            .withIndex("by_activity", (q: any) => q.eq("earnedFromActivityId", existingActivity._id))
            .collect();

          for (const plant of plantsFromActivity) {
            await ctx.db.delete(plant._id);
            console.log(`[syncActivitiesFromHealthKitWithPlants] Deleted plant from deleted activity:`, plant._id);
          }

          await ctx.db.delete(existingActivity._id);
          deletedCount++;
          console.log(`[syncActivitiesFromHealthKitWithPlants] Deleted activity: ${deletedUuid}`);
        }
      }
    }

    console.log(`[syncActivitiesFromHealthKitWithPlants] Sync completed: ${syncResults.created} created, ${syncResults.updated} updated, ${deletedCount} deleted, ${plantsAwarded} plants awarded`);

    return {
      ...syncResults,
      deleted: deletedCount,
      plantsAwarded, // Add plants awarded to result
    };
  },
});

// Sync activities from Strava (initial sync version with celebration marking)
export const syncActivitiesFromStravaInitial = mutation({
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
    })),
    initialSync: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<SyncResult> => {
    const { userId, activities, initialSync = true } = args;
    const now = new Date().toISOString();

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let totalDistanceGained = 0;
    let plantsAwarded = 0;
    const newRuns: any[] = [];

    console.log(`[syncActivitiesFromStravaInitial] Starting sync for user ${userId} with ${activities.length} activities (initial: ${initialSync})`);

    for (const activity of activities) {
      try {
        // Check if activity already exists
        const existingActivity = await ctx.db
          .query("activities")
          .withIndex("by_strava_id", (q) => q.eq("stravaId", activity.stravaId))
          .first();

        console.log(`[syncActivitiesFromStravaInitial] Processing activity ${activity.stravaId}: ${activity.workoutName}, distance: ${activity.distance}m`);

        if (existingActivity) {
          // Update existing activity if it belongs to this user
          if (existingActivity.userId === userId) {
            const pace = activity.distance > 0 ? (activity.duration / (activity.distance / 1000)) : 0;
            
            await ctx.db.patch(existingActivity._id, {
              startDate: activity.startDate,
              endDate: activity.endDate,
              duration: activity.duration,
              distance: activity.distance,
              calories: activity.calories,
              averageHeartRate: activity.averageHeartRate,
              workoutName: activity.workoutName,
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
              pace,
              // Don't mark as celebrated yet - will be marked after InitialSyncModal is shown
              celebrationShown: existingActivity.celebrationShown,
            });
            
            updated++;

            // Award plant for existing activities only if they don't already have one
            if (activity.distance > 0 && !existingActivity.plantEarned) {
              try {
                const plantResult = await ctx.runMutation(api.plants.awardPlantForActivityServer, {
                  userId,
                  activityId: existingActivity._id,
                  distance: activity.distance,
                });
                if (plantResult) {
                  plantsAwarded++;
                  console.log(`[syncActivitiesFromStravaInitial] Awarded plant for existing activity: ${activity.distance}m`);
                }
              } catch (error) {
                console.error(`[syncActivitiesFromStravaInitial] Failed to award plant for existing activity ${existingActivity._id}:`, error);
              }
            }
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
            pace,
            syncedAt: now,
            // Don't mark as celebrated yet - will be marked after InitialSyncModal is shown
            celebrationShown: false,
          });

          const newActivity = await ctx.db.get(newActivityId);
          if (newActivity) {
            newRuns.push(newActivity);
          }
          
          created++;
          totalDistanceGained += activity.distance;

          // Award plant for this run distance (if distance meets criteria)
          if (activity.distance > 0) {
            try {
              const plantResult = await ctx.runMutation(api.plants.awardPlantForActivityServer, {
                userId,
                activityId: newActivityId,
                distance: activity.distance,
              });
              if (plantResult) {
                plantsAwarded++;
                console.log(`[syncActivitiesFromStravaInitial] Awarded plant for new activity: ${activity.distance}m`);
              }
            } catch (error) {
              console.error(`[syncActivitiesFromStravaInitial] Failed to award plant for activity ${newActivityId}:`, error);
            }
          }
        }
      } catch (error) {
        console.error(`[syncActivitiesFromStravaInitial] Error processing activity ${activity.stravaId}:`, error);
      }
    }

    // Update user profile totals if we created new activities
    if (created > 0) {
      await updateUserProfileTotalsServer(ctx, userId);
      
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

    console.log(`[syncActivitiesFromStravaInitial] Sync completed: ${created} created, ${updated} updated, ${skipped} skipped, ${plantsAwarded} plants awarded`);

    const result: SyncResult = {
      created,
      updated,
      skipped,
      lastSyncDate: now,
      distanceGained: totalDistanceGained,
      plantsAwarded,
      newRuns,
    };

    return result;
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
    let plantsAwarded = 0;
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
            isNewActivity: initialSync ? false : true,
            syncedAt: now,
          });

          // No more planned workout linking in garden app

          const newActivity = await ctx.db.get(newActivityId);
          if (newActivity) {
            newRuns.push(newActivity);
          }
          
          created++;

          // Award plant for this run distance (if distance meets criteria)
          if (activity.distance > 0) {
            try {
              const plantResult = await ctx.runMutation(api.plants.awardPlantForActivityServer, {
                userId,
                activityId: newActivityId,
                distance: activity.distance,
              });
              if (plantResult) {
                plantsAwarded++;
                console.log(`[syncActivitiesFromStravaServer] Awarded plant for new activity: ${activity.distance}m`);
              }
            } catch (error) {
              console.error(`[syncActivitiesFromStravaServer] Failed to award plant for activity ${newActivityId}:`, error);
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
      
      // No streak system in garden app - removed recalculation
      
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
      plantsAwarded,
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
    // Simple stats tracking for garden app
    await ctx.db.patch(userProfile._id, {
      totalDistance,
      totalWorkouts,
      totalCalories,
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
    
    // Simple stats for garden app - no XP or level system  
    return {
      totalDistance,
      totalWorkouts,
      totalCalories,
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

    // Delete any plants earned from this activity
    const plantsFromActivity = await ctx.db
      .query("plants")
      .withIndex("by_activity", (q: any) => q.eq("earnedFromActivityId", args.activityId))
      .collect();

    for (const plant of plantsFromActivity) {
      await ctx.db.delete(plant._id);
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
  
  // No XP or level system in garden app
  
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
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("userProfiles", {
      userId,
      totalDistance,
      totalWorkouts,
      totalCalories,
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

// Full Strava initial sync server action - fetches and syncs all activities with proper celebration marking
export const fullStravaInitialSyncServer = action({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SyncResult> => {
    const { days = 365 } = args;
    
    try {
      console.log(`[fullStravaInitialSyncServer] Starting initial sync for ${days} days`);

      // Get user profile to check authentication
      const userProfile = await ctx.runQuery(api.userProfile.getOrCreateProfile);
      if (!userProfile || !userProfile.stravaSyncEnabled) {
        throw new Error("Strava sync not enabled");
      }

      if (!userProfile.stravaAccessToken) {
        throw new Error("No Strava access token stored");
      }

      // Check if token is expired and refresh if needed
      let accessToken = userProfile.stravaAccessToken;
      const now = Math.floor(Date.now() / 1000);
      
      if (userProfile.stravaTokenExpiresAt && userProfile.stravaTokenExpiresAt <= now) {
        if (!userProfile.stravaRefreshToken) {
          throw new Error("Access token expired and no refresh token available");
        }

        // Refresh the token
        const refreshResult = await refreshStravaToken(userProfile.stravaRefreshToken);
        if (!refreshResult.success) {
          throw new Error("Failed to refresh Strava token");
        }

        accessToken = refreshResult.accessToken!;
        
        // Update the stored tokens
        await ctx.runMutation(api.userProfile.updateStravaTokens, {
          accessToken: refreshResult.accessToken!,
          refreshToken: refreshResult.refreshToken!,
          expiresAt: refreshResult.expiresAt!,
        });
      }

      // Get current year activities only
      const currentYear = new Date().getFullYear();
      const startOfYear = Math.floor(new Date(currentYear, 0, 1).getTime() / 1000);
      const endOfYear = Math.floor(new Date(currentYear, 11, 31, 23, 59, 59).getTime() / 1000);

      // Fetch activities from Strava API
      console.log(`[fullStravaInitialSyncServer] Fetching activities from ${new Date(startOfYear * 1000)} to ${new Date(endOfYear * 1000)}`);
      
      const stravaResponse = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${startOfYear}&before=${endOfYear}&per_page=200`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!stravaResponse.ok) {
        const errorText = await stravaResponse.text();
        throw new Error(`Strava API error: ${stravaResponse.status} ${errorText}`);
      }

      const stravaActivities = await stravaResponse.json();
      
      // Filter for running activities only
      const runningActivities = stravaActivities.filter((activity: any) => 
        ['Run', 'TrailRun', 'Treadmill'].includes(activity.type)
      );

      console.log(`[fullStravaInitialSyncServer] Found ${runningActivities.length} running activities from ${currentYear}`);

      if (runningActivities.length === 0) {
        return {
          created: 0,
          updated: 0,
          skipped: 0,
          lastSyncDate: new Date().toISOString(),
          distanceGained: 0,
          plantsAwarded: 0,
          newRuns: [],
        };
      }

      // Convert to our format
      const activitiesForDb = runningActivities.map((activity: any) => ({
        stravaId: activity.id,
        startDate: new Date(activity.start_date).toISOString(),
        endDate: new Date(new Date(activity.start_date).getTime() + activity.elapsed_time * 1000).toISOString(),
        duration: Math.round(activity.moving_time / 60), // Convert seconds to minutes
        distance: Math.round(activity.distance), // Already in meters
        calories: Math.round(activity.calories || 0),
        averageHeartRate: activity.average_heartrate,
        workoutName: activity.name || 'Running',
        totalElevationGain: activity.total_elevation_gain,
        elevationHigh: activity.elev_high,
        elevationLow: activity.elev_low,
        averageTemp: activity.average_temp,
        startLatLng: activity.start_latlng,
        endLatLng: activity.end_latlng,
        timezone: activity.timezone,
        isIndoor: activity.trainer,
        isCommute: activity.commute,
        averageCadence: activity.average_cadence,
        averageWatts: activity.average_watts,
        maxWatts: activity.max_watts,
        kilojoules: activity.kilojoules,
        polyline: activity.map?.polyline,
        maxSpeed: activity.max_speed,
        averageSpeed: activity.average_speed,
      }));

      // Sync using initial sync mutation
      const syncResult = await ctx.runMutation(api.activities.syncActivitiesFromStravaInitial, {
        userId: userProfile.userId,
        activities: activitiesForDb,
        initialSync: true,
      });

      // Mark initial sync as completed (only if we actually had activities to sync)
      if (syncResult.created > 0) {
        await ctx.runMutation(api.userProfile.updateProfile, {
          stravaInitialSyncCompleted: true,
        });
        console.log('[fullStravaInitialSyncServer] Marked Strava initial sync as completed (with activities)');
      }

      console.log(`[fullStravaInitialSyncServer] Initial sync complete:`, syncResult);
      return syncResult;

    } catch (error) {
      console.error(`[fullStravaInitialSyncServer] Error:`, error);
      throw error;
    }
  },
});

// Full Strava sync server action - fetches and syncs all activities
export const fullStravaSyncServer = action({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SyncResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const { days = 30 } = args;

    try {
      console.log(`[fullStravaSyncServer] Starting full sync for user ${userId}, days: ${days}`);

      // Get user profile to get Strava tokens
      const userProfile = await ctx.runQuery(api.userProfile.getOrCreateProfile);
      
      if (!userProfile?.stravaAccessToken) {
        throw new Error("No Strava access token found");
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const after = Math.floor(startDate.getTime() / 1000);
      const before = Math.floor(endDate.getTime() / 1000);

      console.log(`[fullStravaSyncServer] Fetching activities from ${startDate.toISOString()} to ${endDate.toISOString()}`);

      // Fetch activities from Strava
      let accessToken = userProfile.stravaAccessToken;
      
      // Check if token needs refresh
      if (userProfile.stravaTokenExpiresAt && userProfile.stravaTokenExpiresAt < Math.floor(Date.now() / 1000)) {
        console.log(`[fullStravaSyncServer] Access token expired, refreshing...`);
        
        if (!userProfile.stravaRefreshToken) {
          throw new Error("No refresh token available");
        }

        const refreshResult = await refreshStravaToken(userProfile.stravaRefreshToken);
        if (!refreshResult.success) {
          throw new Error(`Token refresh failed: ${refreshResult.error}`);
        }

        // Update tokens in database
        await ctx.runMutation(api.userProfile.updateSyncPreferences, {
          stravaAccessToken: refreshResult.accessToken,
          stravaRefreshToken: refreshResult.refreshToken,
          stravaTokenExpiresAt: refreshResult.expiresAt,
        });

        accessToken = refreshResult.accessToken!;
      }

      // Fetch activities from Strava API
      const stravaResponse = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&before=${before}&per_page=200`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!stravaResponse.ok) {
        const errorText = await stravaResponse.text();
        throw new Error(`Strava API error: ${stravaResponse.status} ${errorText}`);
      }

      const stravaActivities = await stravaResponse.json();
      console.log(`[fullStravaSyncServer] Fetched ${stravaActivities.length} activities from Strava`);

      // Filter for running activities and convert to our format
      const runningActivities = stravaActivities
        .filter((activity: any) => activity.type === 'Run')
        .map((activity: any) => ({
          stravaId: activity.id,
          startDate: activity.start_date,
          endDate: new Date(new Date(activity.start_date).getTime() + (activity.elapsed_time * 1000)).toISOString(),
          duration: Math.round(activity.elapsed_time / 60), // Convert to minutes
          distance: Math.round(activity.distance), // Already in meters
          calories: Math.round(activity.calories || 0),
          averageHeartRate: activity.average_heartrate,
          workoutName: activity.name || 'Running',
          totalElevationGain: activity.total_elevation_gain,
          elevationHigh: activity.elev_high,
          elevationLow: activity.elev_low,
          averageTemp: activity.average_temp,
          startLatLng: activity.start_latlng,
          endLatLng: activity.end_latlng,
          timezone: activity.timezone,
          isIndoor: activity.trainer || false,
          isCommute: activity.commute || false,
          averageCadence: activity.average_cadence,
          averageWatts: activity.average_watts,
          maxWatts: activity.max_watts,
          kilojoules: activity.kilojoules,
          polyline: activity.map?.summary_polyline,
          maxSpeed: activity.max_speed,
          averageSpeed: activity.average_speed,
          isNewActivity: true,
        }));

      console.log(`[fullStravaSyncServer] Filtered to ${runningActivities.length} running activities`);

      // Sync activities using the existing mutation
      const syncResult = await ctx.runMutation(api.activities.syncActivitiesFromStrava, {
        activities: runningActivities,
      });

      console.log(`[fullStravaSyncServer] Sync complete:`, syncResult);
      return syncResult;

    } catch (error) {
      console.error(`[fullStravaSyncServer] Error:`, error);
      throw error;
    }
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
    let plantsAwarded = 0;
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

          // No more planned workout linking in garden app

          const newActivity = await ctx.db.get(newActivityId);
          if (newActivity) {
            newRuns.push(newActivity);
          }
          
          created++;
          totalDistanceGained += activity.distance;

          // Award plant for this run distance (if distance meets criteria and it's a new activity)
          if (activity.isNewActivity && activity.distance > 0) {
            try {
              const plantResult = await ctx.runMutation(api.plants.awardPlantForActivity, {
                activityId: newActivityId,
              });
              if (plantResult) {
                plantsAwarded++;
                console.log(`[syncActivitiesFromStrava] Awarded plant for new activity: ${activity.distance}m`);
              }
            } catch (error) {
              console.error(`[syncActivitiesFromStrava] Failed to award plant for activity ${newActivityId}:`, error);
            }
          }

          // No coins system in garden app
        }
      } catch (error) {
        console.error(`[syncActivitiesFromStrava] Error processing activity ${activity.stravaId}:`, error);
      }
    }

    // Calculate sync results for client
    let distanceGained = 0;

    // Update user profile totals if we created new activities
    if (created > 0) {
      await updateUserProfileTotalsServer(ctx, userId);
      
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
      
      distanceGained = totalDistanceGained;
    }

    const result: SyncResult = {
      created,
      updated,
      skipped,
      lastSyncDate: now,
      distanceGained,
      plantsAwarded,
      newRuns,
    };

    return result;
  },
});

// Get activities that haven't been celebrated yet
export const getUncelebratedActivities = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user has seen initial sync modal
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // If user hasn't seen initial sync modal yet, don't show individual celebration modals
    if (!profile?.hasSeenInitialSyncModal) {
      console.log("[getUncelebratedActivities] User hasn't seen initial sync modal yet, skipping individual celebrations");
      return [];
    }

    // Check if initial sync is still in progress (optimization)
    const currentTime = Date.now();
    const lastSyncTime = profile?.lastHealthKitSync || profile?.lastStravaSync;
    if (lastSyncTime) {
      const timeSinceSync = currentTime - new Date(lastSyncTime).getTime();
      // If sync happened within last 30 seconds, throttle celebration queries
      if (timeSinceSync < 30000) {
        console.log("[getUncelebratedActivities] Recent sync detected, throttling celebration queries");
        return [];
      }
    }

    // Get activities with plants that haven't been celebrated (limit to 1 for performance)
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => 
        q.and(
          q.neq(q.field("plantEarned"), undefined),
          q.or(
            q.eq(q.field("celebrationShown"), undefined),
            q.eq(q.field("celebrationShown"), false)
          )
        )
      )
      .order("desc")
      .take(1); // Reduced from 5 to 1 for performance

    if (activities.length === 0) {
      return [];
    }

    // Enrich with plant data (only for the single activity)
    const activity = activities[0];
    let plantData = null;
    if (activity.plantEarned) {
      const plant = await ctx.db.get(activity.plantEarned);
      if (plant?.plantTypeId) {
        const plantType = await ctx.db.get(plant.plantTypeId);
        if (plantType) {
          plantData = {
            emoji: plantType.emoji,
            name: plantType.name,
          };
        }
      }
    }
    
    return [{
      ...activity,
      plantData,
    }];
  },
});

// Mark all current year activities as celebrated (used after InitialSyncModal)
export const markCurrentYearActivitiesCelebrated = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get current year date range
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1).toISOString();
    const today = new Date().toISOString();

    // Get all activities from current year that have plants but aren't celebrated
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => 
        q.and(
          q.gte(q.field("startDate"), startOfYear),
          q.lte(q.field("startDate"), today),
          q.neq(q.field("plantEarned"), undefined),
          q.or(
            q.eq(q.field("celebrationShown"), undefined),
            q.eq(q.field("celebrationShown"), false)
          )
        )
      )
      .collect();

    console.log(`[markCurrentYearActivitiesCelebrated] Marking ${activities.length} activities as celebrated for user ${userId}`);

    // Mark all as celebrated
    for (const activity of activities) {
      if (activity.plantEarned) {
        const plant = await ctx.db.get(activity.plantEarned);
        console.log(`[markCurrentYearActivitiesCelebrated] Plant ${plant?._id} for activity ${activity._id}`);
        if (plant && !plant.isPlanted) {
          await ctx.runMutation(api.garden.autoPlantInGarden, {
            plantId: plant._id,
          });
          console.log(`[markCurrentYearActivitiesCelebrated] Auto-planted plant ${plant._id} for activity ${activity._id}`);
        }
        
        await ctx.db.patch(activity._id, {
          celebrationShown: true,
        });
      }
    }

    return { success: true, activitiesMarked: activities.length };
  },
});

// Note: Old shouldShowInitialSyncModal and getInitialSyncModalData queries removed
// They have been replaced with completion flag-based logic in the frontend

// Mark activity as celebrated and plant the earned plant in garden
export const markActivityCelebrated = mutation({
  args: {
    activityId: v.id("activities"),
  },
  handler: async (ctx, { activityId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify the activity belongs to the user
    const activity = await ctx.db.get(activityId);
    if (!activity || activity.userId !== userId) {
      throw new Error("Activity not found or not owned by user");
    }

    // Mark as celebrated
    await ctx.db.patch(activityId, {
      celebrationShown: true,
      // updatedAt: new Date().toISOString(),
    });

    // Plant the earned plant in the garden if it exists and isn't already planted
    if (activity.plantEarned) {
      const plant = await ctx.db.get(activity.plantEarned);
      if (plant && !plant.isPlanted) {
        try {
          await ctx.runMutation(api.garden.autoPlantInGarden, {
            plantId: plant._id,
          });
          console.log(`[markActivityCelebrated] Auto-planted plant ${plant._id} for activity ${activityId}`);
        } catch (error) {
          console.log(`[markActivityCelebrated] Could not auto-plant ${plant._id}, keeping in inventory:`, error);
          // Plant stays in inventory if auto-planting fails (e.g., garden full)
        }
      }
    }

    return { success: true };
  },
});
