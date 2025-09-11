import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { mutation, query } from "./_generated/server";

// Interface for duplicate activity groups
interface DuplicateGroup {
  healthKit?: {
    id: string;
    startDate: string;
    distance: number;
    duration: number;
    source: "healthkit";
  };
  strava?: {
    id: string;
    startDate: string;
    distance: number;
    duration: number;
    source: "strava";
  };
  similarity: number;
}

// Find potential duplicate activities between HealthKit and Strava
export const findDuplicateActivities = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Limit search window to reduce comparisons (last 180 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 180);

    // Pull activities in-window using index by_user_and_date
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_user_and_date", (q) =>
        q
          .eq("userId", userId)
          .gte("startDate", startDate.toISOString())
          .lte("startDate", endDate.toISOString())
      )
      .collect();

    // Separate activities by source
    const healthKitActivities = activities.filter(a => a.source === "healthkit");
    const stravaActivities = activities.filter(a => a.source === "strava");

    const duplicateGroups: DuplicateGroup[] = [];

    // Bucket strava activities by local date to reduce pair comparisons
    const bucketByDay = (iso: string) => new Date(iso).toISOString().slice(0, 10);
    const stravaByDay = new Map<string, any[]>();
    for (const s of stravaActivities) {
      const key = bucketByDay(s.startDate);
      if (!stravaByDay.has(key)) stravaByDay.set(key, []);
      stravaByDay.get(key)!.push(s);
    }

    // Compare only within same-day buckets
    for (const healthKitActivity of healthKitActivities) {
      const dayKey = bucketByDay(healthKitActivity.startDate);
      const candidates = stravaByDay.get(dayKey) || [];
      for (const stravaActivity of candidates) {
        // Calculate time difference in minutes
        const timeDiff = Math.abs(
          new Date(healthKitActivity.startDate).getTime() - 
          new Date(stravaActivity.startDate).getTime()
        ) / (1000 * 60);

        // Calculate distance difference in meters
        const distanceDiff = Math.abs(healthKitActivity.distance - stravaActivity.distance);
        
        // Calculate duration difference in minutes
        const durationDiff = Math.abs(healthKitActivity.duration - stravaActivity.duration);

        // Calculate similarity score (0-1)
        const timeSimilarity = Math.max(0, 1 - timeDiff / 30); // Within 30 minutes
        const distanceSimilarity = Math.max(0, 1 - distanceDiff / 500); // Within 500 meters
        const durationSimilarity = Math.max(0, 1 - durationDiff / 10); // Within 10 minutes

        const similarity = (timeSimilarity + distanceSimilarity + durationSimilarity) / 3;

        // If similarity is high enough, consider it a potential duplicate
        if (similarity > 0.7) {
          duplicateGroups.push({
            healthKit: {
              id: healthKitActivity._id,
              startDate: healthKitActivity.startDate,
              distance: healthKitActivity.distance,
              duration: healthKitActivity.duration,
              source: "healthkit" as const,
            },
            strava: {
              id: stravaActivity._id,
              startDate: stravaActivity.startDate,
              distance: stravaActivity.distance,
              duration: stravaActivity.duration,
              source: "strava" as const,
            },
            similarity,
          });
        }
      }
    }

    // Sort by similarity desc and cap results for UI
    duplicateGroups.sort((a, b) => b.similarity - a.similarity);
    return duplicateGroups.slice(0, 200);
  },
});

// Resolve duplicate activities by keeping one source and deleting the other
export const resolveDuplicates = mutation({
  args: {
    duplicates: v.array(v.object({
      healthKitId: v.id("activities"),
      stravaId: v.id("activities"),
      keepSource: v.union(v.literal("healthkit"), v.literal("strava")),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const results = {
      resolved: 0,
      errors: 0,
      plantsTransferred: 0,
      plantsDeleted: 0,
    };

    for (const duplicate of args.duplicates) {
      try {
        // Verify both activities exist and belong to the user
        const healthKitActivity = await ctx.db.get(duplicate.healthKitId);
        const stravaActivity = await ctx.db.get(duplicate.stravaId);

        if (!healthKitActivity || !stravaActivity || 
            healthKitActivity.userId !== userId || 
            stravaActivity.userId !== userId) {
          results.errors++;
          continue;
        }

        // Determine kept and deleted activity ids
        const keepActivityId = duplicate.keepSource === "healthkit" ? duplicate.healthKitId : duplicate.stravaId;
        const deleteActivityId = duplicate.keepSource === "healthkit" ? duplicate.stravaId : duplicate.healthKitId;

        // Handle plants: prefer to keep a single plant linked to the kept activity
        const keptActivity = duplicate.keepSource === "healthkit" ? healthKitActivity : stravaActivity;
        const deletingActivity = duplicate.keepSource === "healthkit" ? stravaActivity : healthKitActivity;

        // Fetch plants linked to deleting activity
        const plantsFromDeletingActivity = await ctx.db
          .query("plants")
          .withIndex("by_activity", (q) => q.eq("earnedFromActivityId", deleteActivityId))
          .collect();

        // If the kept activity has no plantEarned, transfer one plant
        if (!keptActivity.plantEarned && plantsFromDeletingActivity.length > 0) {
          const plantToKeep = plantsFromDeletingActivity[0];
          await ctx.db.patch(plantToKeep._id, { earnedFromActivityId: keepActivityId });
          await ctx.db.patch(keepActivityId, { plantEarned: plantToKeep._id });
          results.plantsTransferred++;

          // Delete any extra plants from duplicated activity beyond the first
          for (let i = 1; i < plantsFromDeletingActivity.length; i++) {
            await ctx.db.delete(plantsFromDeletingActivity[i]._id);
            results.plantsDeleted++;
          }
        } else {
          // Kept already has a plant or no plants to transfer; delete all plants from deleting activity
          for (const plant of plantsFromDeletingActivity) {
            await ctx.db.delete(plant._id);
            results.plantsDeleted++;
          }
        }

        // Delete the duplicated activity
        await ctx.db.delete(deleteActivityId);
        results.resolved++;

      } catch (error) {
        console.error("Error resolving duplicate:", error);
        results.errors++;
      }
    }

    // Recalculate profile totals after deduplication
    try {
      await ctx.runMutation(api.activities.updateUserProfileTotals, { userId });
    } catch (e) {
      console.error("Failed to update profile totals after deduplication", e);
    }

    return results;
  },
});
