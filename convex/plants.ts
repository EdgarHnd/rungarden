import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { api } from "./_generated/api";
import { mutation, query } from "./_generated/server";

// Efficient batch plant awarding for initial sync performance
export const awardPlantsForActivitiesBatch = mutation({
  args: {
    activityIds: v.array(v.id("activities")),
  },
  handler: async (ctx, { activityIds }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    console.log(`[awardPlantsForActivitiesBatch] Processing ${activityIds.length} activities in batch`);
    let plantsAwarded = 0;
    const now = new Date().toISOString();

    // Get all activities at once
    const activities = await Promise.all(
      activityIds.map(async (id) => {
        const activity = await ctx.db.get(id);
        return activity;
      })
    );

    // Filter out activities that already have plants or don't meet criteria
    const activitiesNeedingPlants = activities.filter(activity => 
      activity && 
      !activity.plantEarned && 
      activity.distance && 
      activity.distance >= 1000 // At least 1km
    );

    console.log(`[awardPlantsForActivitiesBatch] ${activitiesNeedingPlants.length} activities need plants`);

    // Get all plant types at once to reduce queries
    const plantTypes = await ctx.db.query("plantTypes").collect();
    const plantTypesByDistance = new Map(
      plantTypes.map(pt => [pt.distanceRequired, pt])
    );

    // Process activities in batch
    for (const activity of activitiesNeedingPlants) {
      if (!activity) continue;

      try {
        const distanceKm = Math.floor(activity.distance / 1000);
        const cappedDistanceKm = Math.min(distanceKm, 100);
        const requiredDistance = cappedDistanceKm * 1000;
        
        const eligiblePlant = plantTypesByDistance.get(requiredDistance);
        if (!eligiblePlant) continue;

        // Create the plant
        const plantId = await ctx.db.insert("plants", {
          userId,
          plantTypeId: eligiblePlant._id,
          earnedFromActivityId: activity._id,
          earnedAt: now,
          isPlanted: false,
          currentStage: 3,
          experiencePoints: 0,
          nextStageRequirement: 0,
          waterLevel: 100,
          updatedAt: now,
        });

        // Update activity
        await ctx.db.patch(activity._id, {
          plantEarned: plantId,
        });

        plantsAwarded++;
      } catch (error) {
        console.error(`[awardPlantsForActivitiesBatch] Failed to award plant for activity ${activity._id}:`, error);
      }
    }

    console.log(`[awardPlantsForActivitiesBatch] Awarded ${plantsAwarded} plants`);
    return { plantsAwarded };
  },
});

// Legacy version for backwards compatibility
export const awardPlantsForActivities = mutation({
  args: {
    activityIds: v.array(v.id("activities")),
  },
  handler: async (ctx, { activityIds }) => {
    console.log(`[awardPlantsForActivities] Processing ${activityIds.length} activities in batch`);
    let plantsAwarded = 0;
    
    for (const activityId of activityIds) {
      try {
        const result = await ctx.runMutation(api.plants.awardPlantForActivity, { activityId });
        if (result) {
          plantsAwarded++;
        }
      } catch (error) {
        console.error(`[awardPlantsForActivities] Failed to award plant for activity ${activityId}:`, error);
      }
    }
    
    console.log(`[awardPlantsForActivities] Awarded ${plantsAwarded} plants out of ${activityIds.length} activities`);
    return { plantsAwarded };
  },
});

// Award a plant to user based on run distance
export const awardPlantForActivity = mutation({
  args: {
    activityId: v.id("activities"),
  },
  handler: async (ctx, { activityId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }
        // Check if activity already has a plant awarded
    const activity = await ctx.db.get(activityId);
    if (activity?.plantEarned) {
      return null; // Plant already awarded
    }
    const distance = activity?.distance;

    if (!distance) {
      console.error(`[awardPlantForActivity] No distance found for activity ${activityId}`);
      return null; // No distance found
    }

    // Convert distance to km and find the exact plant type
    const distanceKm = Math.floor(distance / 1000);
    
    // Cap at 100km max
    const cappedDistanceKm = Math.min(distanceKm, 100);
    
    if (cappedDistanceKm < 1) {
      console.error(`[awardPlantForActivity] No plant for distances under 1km for activity ${activityId}`);
      return null; // No plant for distances under 1km
    }

    // Get the exact plant type for this distance (1km = 1000m, 2km = 2000m, etc.)
    const requiredDistance = cappedDistanceKm * 1000;
    const eligiblePlant = await ctx.db
      .query("plantTypes")
      .withIndex("by_distance", (q) => q.eq("distanceRequired", requiredDistance))
      .first();
    
    if (!eligiblePlant) {
      // No plant earned for this distance
      console.error(`[awardPlantForActivity] No plant earned for this distance for activity ${activityId}`);
      return null;
    }

    // Create the plant in user's inventory
    const plantId = await ctx.db.insert("plants", {
      userId,
      plantTypeId: eligiblePlant._id,
      earnedFromActivityId: activityId,
      earnedAt: new Date().toISOString(),
      isPlanted: false,
      currentStage: 3, // Start at mature stage (no growth needed)
      experiencePoints: 0,
      nextStageRequirement: 0, // No more growth needed
      waterLevel: 100, // Start fully watered
      updatedAt: new Date().toISOString(),
    });

    // Plant will be auto-planted when user completes celebration modal
    // (no immediate auto-planting needed)

    // Update activity to reference the earned plant
    await ctx.db.patch(activityId, {
      plantEarned: plantId,
    });

    // Get the created plant
    const createdPlant = await ctx.db.get(plantId);

    return {
      plant: createdPlant,
      plantType: eligiblePlant,
      isNewType: await isFirstTimeEarningPlantType(ctx, userId, eligiblePlant._id),
    };
  },
});

// Server-side version for webhook calls (bypasses authentication)
export const awardPlantForActivityServer = mutation({
  args: {
    userId: v.id("users"),
    activityId: v.id("activities"),
    distance: v.number(), // distance in meters
  },
  handler: async (ctx, { userId, activityId, distance }) => {
    // Convert distance to km and find the exact plant type
    const distanceKm = Math.floor(distance / 1000);
    
    // Cap at 100km max
    const cappedDistanceKm = Math.min(distanceKm, 100);
    
    if (cappedDistanceKm < 1) {
      return null; // No plant for distances under 1km
    }

    // Get the exact plant type for this distance (1km = 1000m, 2km = 2000m, etc.)
    const requiredDistance = cappedDistanceKm * 1000;
    const eligiblePlant = await ctx.db
      .query("plantTypes")
      .withIndex("by_distance", (q) => q.eq("distanceRequired", requiredDistance))
      .first();
    
    if (!eligiblePlant) {
      // No plant earned for this distance
      return null;
    }

    // Check if activity already has a plant awarded
    const activity = await ctx.db.get(activityId);
    if (activity?.plantEarned) {
      return null; // Plant already awarded
    }

    // Create the plant in user's inventory
    const plantId = await ctx.db.insert("plants", {
      userId,
      plantTypeId: eligiblePlant._id,
      earnedFromActivityId: activityId,
      earnedAt: new Date().toISOString(),
      isPlanted: false,
      currentStage: 3, // Start at mature stage (no growth needed)
      experiencePoints: 0,
      nextStageRequirement: 0, // No more growth needed
      waterLevel: 100, // Start fully watered
      updatedAt: new Date().toISOString(),
    });

    // Plant will be auto-planted when user completes celebration modal
    // (no server-side auto-planting needed)

    // Update activity to reference the earned plant
    await ctx.db.patch(activityId, {
      plantEarned: plantId,
    });

    // Get the created plant
    const createdPlant = await ctx.db.get(plantId);

    return {
      plant: createdPlant,
      plantType: eligiblePlant,
      isNewType: await isFirstTimeEarningPlantType(ctx, userId, eligiblePlant._id),
    };
  }
});

// Get plant by ID with plant type data
export const getPlantById = query({
  args: {
    plantId: v.id("plants"),
  },
  handler: async (ctx, args) => {
    const plant = await ctx.db.get(args.plantId);
    if (!plant) return null;

    // Get the plant type data
    const plantType = await ctx.db.get(plant.plantTypeId);
    
    return {
      ...plant,
      plantType,
    };
  },
});

// Check if this is the first time user earns this plant type and update profile
async function isFirstTimeEarningPlantType(ctx: any, userId: string, plantTypeId: any): Promise<boolean> {
  // Get user profile
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  if (!profile) {
    return true; // No profile means first time
  }

  const unlockedPlantTypes = profile.unlockedPlantTypes || [];
  const isFirstTime = !unlockedPlantTypes.includes(plantTypeId);

  // If it's the first time, add to unlocked list
  if (isFirstTime) {
    await ctx.db.patch(profile._id, {
      unlockedPlantTypes: [...unlockedPlantTypes, plantTypeId],
      updatedAt: new Date().toISOString(),
    });
  }

  return isFirstTime;
}

// Get all plants owned by user
export const getUserPlants = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const plants = await ctx.db
      .query("plants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Fetch plant type details for each plant
    const plantsWithTypes = await Promise.all(
      plants.map(async (plant) => {
        const plantType = await ctx.db.get(plant.plantTypeId);
        const activity = await ctx.db.get(plant.earnedFromActivityId);
        return {
          ...plant,
          plantType,
          earnedFromActivity: activity,
        };
      })
    );

    return plantsWithTypes;
  },
});

// Get plant earned from a specific activity
export const getPlantByActivityId = query({
  args: {
    activityId: v.id("activities"),
  },
  handler: async (ctx, { activityId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    // First check if the activity has a plantEarned reference
    const activity = await ctx.db.get(activityId);
    if (!activity || activity.userId !== userId) {
      return null;
    }

    let plant = null;
    let plantType = null;

    // If activity has plantEarned reference, get it directly
    if (activity.plantEarned) {
      plant = await ctx.db.get(activity.plantEarned);
      if (plant) {
        plantType = await ctx.db.get(plant.plantTypeId);
      }
    }

    // Fallback: search for plant by earnedFromActivityId index
    if (!plant) {
      plant = await ctx.db
        .query("plants")
        .withIndex("by_activity", (q) => q.eq("earnedFromActivityId", activityId))
        .first();

      if (!plant || plant.userId !== userId) {
        return null;
      }

      plantType = await ctx.db.get(plant.plantTypeId);
    }

    if (!plant || !plantType) {
      return null;
    }

    // Check if this is the first plant of this type the user has earned
    // by checking if this plant is the earliest one of this type
    const allPlantsOfType = await ctx.db
      .query("plants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("plantTypeId"), plant.plantTypeId))
      .collect();

    // Sort by earnedAt to find the first one
    const sortedPlants = allPlantsOfType.sort((a, b) => 
      new Date(a.earnedAt).getTime() - new Date(b.earnedAt).getTime()
    );

    const isNewType = sortedPlants.length > 0 && sortedPlants[0]._id === plant._id;

    return {
      ...plant,
      plantType,
      isNewType,
    };
  },
});

// Debug function to check plant ID mismatches
export const debugPlantStashData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { message: "Not authenticated" };
    }

    const [allPlantTypes, userPlants] = await Promise.all([
      ctx.db.query("plantTypes").order("asc").collect(),
      ctx.db.query("plants").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);

    return {
      totalPlantTypes: allPlantTypes.length,
      totalUserPlants: userPlants.length,
      plantTypeIds: allPlantTypes.slice(0, 5).map(pt => ({ id: pt._id, name: pt.name })),
      userPlantTypeIds: userPlants.slice(0, 5).map(p => ({ 
        plantTypeId: p.plantTypeId, 
        typeIdType: typeof p.plantTypeId,
        isPlanted: p.isPlanted 
      })),
      plantCounts: userPlants.reduce((acc, plant) => {
        const key = String(plant.plantTypeId);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  },
});

// Get plants earned from multiple activities (for initial sync modal)
export const getPlantsEarnedFromActivities = query({
  args: {
    activityIds: v.array(v.id("activities")),
  },
  handler: async (ctx, { activityIds }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Get all plants earned from the specified activities
    const plants = await ctx.db
      .query("plants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => 
        q.and(
          q.neq(q.field("earnedFromActivityId"), undefined),
          // We'll filter by activity IDs in the application code since Convex doesn't support "in" queries on indexes
        )
      )
      .collect();

    // Filter to only plants from the specified activities and get plant types
    const activityIdSet = new Set(activityIds);
    const relevantPlants = plants.filter(plant => 
      plant.earnedFromActivityId && activityIdSet.has(plant.earnedFromActivityId)
    );

    // Get plant types for all relevant plants
    const plantsWithTypes = await Promise.all(
      relevantPlants.map(async (plant) => {
        const plantType = await ctx.db.get(plant.plantTypeId);
        return {
          ...plant,
          plantType,
        };
      })
    );

    // Group by plant type and count quantities
    const plantCounts: Record<string, { count: number; plantType: any }> = {};
    
    for (const plant of plantsWithTypes) {
      if (plant.plantType) {
        const typeKey = plant.plantType._id;
        if (plantCounts[typeKey]) {
          plantCounts[typeKey].count += 1;
        } else {
          plantCounts[typeKey] = {
            count: 1,
            plantType: plant.plantType
          };
        }
      }
    }

    // Convert to array and sort by distance required
    const result = Object.values(plantCounts)
      .sort((a, b) => a.plantType.distanceRequired - b.plantType.distanceRequired);
    
    console.log('[getPlantsEarnedFromActivities] Returning', result.length, 'plant types');
    result.forEach((plant, index) => {
      console.log(`[getPlantsEarnedFromActivities] Plant ${index + 1}:`, {
        count: plant.count,
        name: plant.plantType?.name,
        emoji: plant.plantType?.emoji,
        distance: plant.plantType?.distanceRequired
      });
    });
    
    return result;
  },
});

// Get plant stash data using profile unlocked plant types (optimized)
export const getPlantStashData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { plants: [], maxDistance: 0 };
    }

    // Run all queries in parallel for better performance
    const [profile, allPlantTypes, userPlants] = await Promise.all([
      // Get user profile with unlocked plant types
      ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first(),
      
      // Get all plant types (should be exactly 100: 1km to 100km)
      ctx.db
        .query("plantTypes")
        .order("asc")
        .take(100), // Limit to prevent fetching too many
      
      // Get user's unplanted plants count (with limit to prevent overflow)
      ctx.db
        .query("plants")
        .withIndex("by_user_planted", (q) => q.eq("userId", userId).eq("isPlanted", false))
        .take(200) // Reasonable limit for unplanted plants
    ]);

    const unlockedPlantTypeIds = profile?.unlockedPlantTypes || [];

    // Count unplanted plants by type
    const unplantedCounts: Record<string, number> = {};
    for (const plant of userPlants) {
      const typeId = String(plant.plantTypeId);
      unplantedCounts[typeId] = (unplantedCounts[typeId] || 0) + 1;
    }

    // Create plant stash data
    const plants = allPlantTypes.map(plantType => {
      const isUnlocked = unlockedPlantTypeIds.includes(plantType._id);
      const unplantedCount = unplantedCounts[String(plantType._id)] || 0;
      
      return {
        ...plantType,
        isUnlocked,
        totalCount: isUnlocked ? 1 : 0, // Simple: unlocked = 1, locked = 0
        unplantedCount,
        distanceToUnlock: isUnlocked ? 0 : Math.floor(plantType.distanceRequired / 1000),
      };
    }).sort((a, b) => a.distanceRequired - b.distanceRequired); // Sort by distance required

    return {
      plants,
      maxDistance: 100, // Max 100km
    };
  },
});

