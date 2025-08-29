import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
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

    // Find the appropriate plant type for this distance
    const plantTypes = await ctx.db.query("plantTypes")
      .order("desc") // Start with highest distance requirements
      .collect();

    const eligiblePlant = plantTypes.find(plant => distance >= plant.distanceRequired);
    
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
      currentStage: 0, // Start as seed
      experiencePoints: 0,
      nextStageRequirement: getXPRequiredForStage(1), // XP needed for first growth
      waterLevel: 100, // Start fully watered
      updatedAt: new Date().toISOString(),
    });

    // Update activity to reference the earned plant
    await ctx.db.patch(activityId, {
      plantEarned: plantId,
    });

    // Get the created plant with its type
    const createdPlant = await ctx.db.get(plantId);
    const plantType = await ctx.db.get(eligiblePlant._id);

    return {
      plant: createdPlant,
      plantType,
      isNewType: await isFirstTimeEarningPlantType(ctx, userId, eligiblePlant._id),
    };
  },
});

// Helper function to calculate XP required for each growth stage
function getXPRequiredForStage(stage: number): number {
  const baseXP = 100;
  return baseXP * stage; // Stage 1: 100 XP, Stage 2: 200 XP, Stage 3: 300 XP
}

// Check if this is the first time user earns this plant type
async function isFirstTimeEarningPlantType(ctx: any, userId: string, plantTypeId: any): Promise<boolean> {
  const existingPlants = await ctx.db
    .query("plants")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .filter((q: any) => q.eq(q.field("plantTypeId"), plantTypeId))
    .collect();

  return existingPlants.length <= 1; // 1 because we just created one
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

// Grow plant by adding experience (from caring actions)
export const growPlant = mutation({
  args: {
    plantId: v.id("plants"),
    experiencePoints: v.number(),
  },
  handler: async (ctx, { plantId, experiencePoints }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const plant = await ctx.db.get(plantId);
    if (!plant || plant.userId !== userId) {
      throw new ConvexError("Plant not found or not owned by user");
    }

    const newXP = plant.experiencePoints + experiencePoints;
    let newStage = plant.currentStage;
    let newRequirement = plant.nextStageRequirement;

    // Check if plant can advance to next stage
    const maxStage = 3; // 0=seed, 1=sprout, 2=growing, 3=mature
    if (newStage < maxStage && newXP >= newRequirement) {
      newStage += 1;
      newRequirement = newStage < maxStage ? getXPRequiredForStage(newStage + 1) : newRequirement;
    }

    await ctx.db.patch(plantId, {
      experiencePoints: newXP,
      currentStage: newStage,
      nextStageRequirement: newRequirement,
      updatedAt: new Date().toISOString(),
    });

    return {
      success: true,
      leveledUp: newStage > plant.currentStage,
      newStage,
      newXP,
    };
  },
});

// Apply natural plant decay (water level decreases over time)
export const updatePlantHealth = mutation({
  args: { plantId: v.id("plants") },
  handler: async (ctx, { plantId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const plant = await ctx.db.get(plantId);
    if (!plant || plant.userId !== userId) {
      throw new ConvexError("Plant not found or not owned by user");
    }

    // Calculate time since last watered
    const now = new Date();
    const lastWatered = plant.lastWatered ? new Date(plant.lastWatered) : new Date(plant.earnedAt);
    const hoursSinceWatered = (now.getTime() - lastWatered.getTime()) / (1000 * 60 * 60);

    // Decrease water level over time (1 point per hour, faster if not planted)
    const decayRate = plant.isPlanted ? 1 : 2;
    const waterLoss = Math.floor(hoursSinceWatered * decayRate);
    const newWaterLevel = Math.max(0, plant.waterLevel - waterLoss);

    // Plant wilts if water level is very low
    const isWilted = newWaterLevel < 20;

    await ctx.db.patch(plantId, {
      waterLevel: newWaterLevel,
      isWilted,
      updatedAt: new Date().toISOString(),
    });

    return { waterLevel: newWaterLevel, isWilted };
  },
});

// Get plants that need care (low water, wilted)
export const getPlantsNeedingCare = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const plants = await ctx.db
      .query("plants")
      .withIndex("by_user_planted", (q) => q.eq("userId", userId).eq("isPlanted", true))
      .filter((q) => q.or(
        q.lt(q.field("waterLevel"), 30),
        q.eq(q.field("isWilted"), true)
      ))
      .collect();

    // Fetch plant type details
    const plantsWithTypes = await Promise.all(
      plants.map(async (plant) => {
        const plantType = await ctx.db.get(plant.plantTypeId);
        return { ...plant, plantType };
      })
    );

    return plantsWithTypes;
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
