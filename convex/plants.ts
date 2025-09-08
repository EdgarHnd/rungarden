import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { api } from "./_generated/api";
import { mutation, query } from "./_generated/server";

// Award a plant to user based on run distance
export const awardPlantForActivity = mutation({
  args: {
    activityId: v.id("activities"),
    distance: v.number(), // distance in meters
  },
  handler: async (ctx, { activityId, distance }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

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

    // Auto-plant the plant immediately
    try {
      await ctx.runMutation(api.garden.autoPlantInGarden, {
        plantId: plantId,
      });
    } catch (error) {
      console.log("Could not auto-plant, keeping in inventory:", error);
      // Plant stays in inventory if auto-planting fails
    }

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

// Note: Growth stages and XP system removed in new plant system
// All plants now start at mature stage (stage 3)

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

    // If activity has plantEarned reference, get it directly
    if (activity.plantEarned) {
      const plant = await ctx.db.get(activity.plantEarned);
      if (plant) {
        const plantType = await ctx.db.get(plant.plantTypeId);
        return {
          ...plant,
          plantType,
        };
      }
    }

    // Fallback: search for plant by earnedFromActivityId index
    const plant = await ctx.db
      .query("plants")
      .withIndex("by_activity", (q) => q.eq("earnedFromActivityId", activityId))
      .first();

    if (!plant || plant.userId !== userId) {
      return null;
    }

    const plantType = await ctx.db.get(plant.plantTypeId);
    return {
      ...plant,
      plantType,
    };
  },
});

// DEPRECATED: Growth system removed in new plant system
// Plants now start at mature stage and don't require growth
export const growPlant = mutation({
  args: {
    plantId: v.id("plants"),
    experiencePoints: v.number(),
  },
  handler: async (ctx, { plantId, experiencePoints }) => {
    // This function is deprecated but kept for backward compatibility
    // New plants start at mature stage and don't need growth
    return {
      success: true,
      leveledUp: false,
      newStage: 3,
      newXP: 0,
      deprecated: true,
      message: "Growth system has been simplified. All plants start mature.",
    };
  },
});

// DEPRECATED: Plant health/watering system simplified
// Plants no longer require maintenance in the new system
export const updatePlantHealth = mutation({
  args: { plantId: v.id("plants") },
  handler: async (ctx, { plantId }) => {
    // This function is deprecated but kept for backward compatibility
    // Plants no longer decay or require watering in the simplified system
    return { 
      waterLevel: 100, 
      isWilted: false,
      deprecated: true,
      message: "Plant health system has been simplified. Plants no longer require maintenance.",
    };
  },
});

// DEPRECATED: Plant care system removed
export const getPlantsNeedingCare = query({
  args: {},
  handler: async (ctx) => {
    // No plants need care in the simplified system
    return [];
  },
});

// Get user's plant collection stats
export const getPlantCollectionStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const userPlants = await ctx.db
      .query("plants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const allPlantTypes = await ctx.db.query("plantTypes").collect();

    // Count unique plant types owned
    const ownedTypes = new Set(userPlants.map(p => p.plantTypeId));
    const totalPossibleTypes = allPlantTypes.length;

    // Count plants by rarity
    const rarityCount: Record<string, number> = { common: 0, uncommon: 0, rare: 0, epic: 0 };
    
    for (const plant of userPlants) {
      const plantType = allPlantTypes.find(pt => pt._id === plant.plantTypeId);
      if (plantType) {
        rarityCount[plantType.rarity]++;
      }
    }

    // Count plants by stage
    const stageCount = { seed: 0, sprout: 0, growing: 0, mature: 0 };
    const stageNames = ['seed', 'sprout', 'growing', 'mature'];
    for (const plant of userPlants) {
      const stageName = stageNames[plant.currentStage] || 'seed';
      stageCount[stageName as keyof typeof stageCount]++;
    }

    return {
      totalPlants: userPlants.length,
      uniqueTypes: ownedTypes.size,
      totalPossibleTypes,
      collectionPercentage: Math.round((ownedTypes.size / totalPossibleTypes) * 100),
      planted: userPlants.filter(p => p.isPlanted).length,
      unplanted: userPlants.filter(p => !p.isPlanted).length,
      rarityCount,
      stageCount,
    };
  },
});

// Get user's maximum distance achieved (for unlocking plants)
export const getUserMaxDistance = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return 0;
    }

    const activities = await ctx.db
      .query("activities")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (activities.length === 0) {
      return 0;
    }

    // Find the maximum distance from all activities
    const maxDistance = Math.max(...activities.map(activity => activity.distance));
    return maxDistance;
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

// Get plant stash data using profile unlocked plant types
export const getPlantStashData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { plants: [], maxDistance: 0 };
    }

    // Get user profile with unlocked plant types
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const unlockedPlantTypeIds = profile?.unlockedPlantTypes || [];

    // Get all plant types (should be exactly 100: 1km to 100km)
    const allPlantTypes = await ctx.db
      .query("plantTypes")
      .order("asc")
      .take(100); // Limit to prevent fetching too many

    // Get user's unplanted plants count (with limit to prevent overflow)
    const userPlants = await ctx.db
      .query("plants")
      .withIndex("by_user_planted", (q) => q.eq("userId", userId).eq("isPlanted", false))
      .take(200); // Reasonable limit for unplanted plants

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

// Fix plants with invalid plantTypeId references
export const fixInvalidPlantReferences = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const [allPlantTypes, userPlants] = await Promise.all([
      ctx.db.query("plantTypes").collect(),
      ctx.db.query("plants").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);

    const validPlantTypeIds = new Set([
      ...allPlantTypes.map(pt => pt._id),
      ...allPlantTypes.map(pt => String(pt._id)),
      "ultra_mushroom" // Special case for ultra mushrooms
    ]);

    let fixedCount = 0;
    let deletedCount = 0;

    for (const plant of userPlants) {
      const plantTypeId = plant.plantTypeId;
      
      // Skip ultra mushrooms and other special plants
      if (plantTypeId === "ultra_mushroom" || typeof plantTypeId === "string") {
        continue;
      }

      // Check if the plant type ID is valid
      if (!validPlantTypeIds.has(plantTypeId) && !validPlantTypeIds.has(String(plantTypeId))) {
        // Try to find a matching plant type by distance
        const activity = await ctx.db.get(plant.earnedFromActivityId);
        if (activity) {
          const distance = activity.distance;
          const matchingPlantType = allPlantTypes
            .sort((a, b) => b.distanceRequired - a.distanceRequired)
            .find(pt => distance >= pt.distanceRequired);
          
          if (matchingPlantType) {
            // Fix the plant by updating its plantTypeId
            await ctx.db.patch(plant._id, {
              plantTypeId: matchingPlantType._id,
              updatedAt: new Date().toISOString(),
            });
            fixedCount++;
          } else {
            // Delete plants that can't be fixed
            await ctx.db.delete(plant._id);
            deletedCount++;
          }
        } else {
          // Delete plants without valid activity references
          await ctx.db.delete(plant._id);
          deletedCount++;
        }
      }
    }

    return {
      success: true,
      fixedCount,
      deletedCount,
      message: `Fixed ${fixedCount} plants, deleted ${deletedCount} invalid plants`,
    };
  },
});

// Simple debug query to check user's plants
export const debugUserPlants = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { error: "Not authenticated" };
    }

    const userPlants = await ctx.db
      .query("plants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(10);

    const plantTypes = await ctx.db
      .query("plantTypes")
      .take(10);

    return {
      userId,
      totalUserPlants: userPlants.length,
      totalPlantTypes: plantTypes.length,
      sampleUserPlants: userPlants.map(p => ({
        id: p._id,
        plantTypeId: p.plantTypeId,
        isPlanted: p.isPlanted,
        earnedAt: p.earnedAt,
      })),
      samplePlantTypes: plantTypes.map(pt => ({
        id: pt._id,
        name: pt.name,
        emoji: pt.emoji,
        distanceRequired: pt.distanceRequired,
      })),
    };
  }
});
