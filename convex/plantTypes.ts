import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Plant type definitions based on distance milestones
export const PLANT_DISTANCE_REWARDS = [
  {
    name: "Radish",
    emoji: "🥕",
    imagePath: "assets/images/plants/01.png",
    distanceRequired: 1000, // 1km
    rarity: "common" as const,
    category: "vegetable" as const,
    description: "A quick-growing root vegetable earned from short runs",
    growthStages: [
      { stage: 0, name: "Seed", emoji: "🌱" },
      { stage: 1, name: "Sprout", emoji: "🌿" },
      { stage: 2, name: "Growing", emoji: "🥬" },
      { stage: 3, name: "Mature", emoji: "🥕" },
    ],
  },
  {
    name: "Lettuce",
    emoji: "🥬",
    distanceRequired: 2000, // 2km
    rarity: "common" as const,
    category: "vegetable" as const,
    description: "Fresh leafy greens from your dedication to running",
    growthStages: [
      { stage: 0, name: "Seed", emoji: "🌱" },
      { stage: 1, name: "Sprout", emoji: "🌿" },
      { stage: 2, name: "Growing", emoji: "🌿" },
      { stage: 3, name: "Mature", emoji: "🥬" },
    ],
  },
  {
    name: "Strawberry",
    emoji: "🍓",
    distanceRequired: 3000, // 3km
    rarity: "uncommon" as const,
    category: "fruit" as const,
    description: "Sweet berries that reward your growing endurance",
    growthStages: [
      { stage: 0, name: "Seed", emoji: "🌱" },
      { stage: 1, name: "Sprout", emoji: "🌿" },
      { stage: 2, name: "Flowering", emoji: "🌸" },
      { stage: 3, name: "Fruiting", emoji: "🍓" },
    ],
  },
  {
    name: "Tomato",
    emoji: "🍅",
    distanceRequired: 5000, // 5km
    rarity: "uncommon" as const,
    category: "vegetable" as const,
    description: "A versatile fruit from your 5K achievement",
    growthStages: [
      { stage: 0, name: "Seed", emoji: "🌱" },
      { stage: 1, name: "Seedling", emoji: "🌿" },
      { stage: 2, name: "Flowering", emoji: "🌼" },
      { stage: 3, name: "Ripe", emoji: "🍅" },
    ],
  },
  {
    name: "Sunflower",
    emoji: "🌻",
    distanceRequired: 7500, // 7.5km
    rarity: "rare" as const,
    category: "flower" as const,
    description: "A bright flower that follows your running journey",
    growthStages: [
      { stage: 0, name: "Seed", emoji: "🌱" },
      { stage: 1, name: "Sprout", emoji: "🌿" },
      { stage: 2, name: "Budding", emoji: "🌾" },
      { stage: 3, name: "Blooming", emoji: "🌻" },
    ],
  },
  {
    name: "Apple Tree",
    emoji: "🍎",
    distanceRequired: 10000, // 10km
    rarity: "rare" as const,
    category: "tree" as const,
    description: "A majestic tree earned from your 10K accomplishment",
    growthStages: [
      { stage: 0, name: "Seed", emoji: "🌱" },
      { stage: 1, name: "Sapling", emoji: "🌿" },
      { stage: 2, name: "Young Tree", emoji: "🌳" },
      { stage: 3, name: "Fruit Tree", emoji: "🍎" },
    ],
  },
  {
    name: "Rose Bush",
    emoji: "🌹",
    distanceRequired: 15000, // 15km
    rarity: "epic" as const,
    category: "flower" as const,
    description: "Beautiful roses for those who go the extra distance",
    growthStages: [
      { stage: 0, name: "Seed", emoji: "🌱" },
      { stage: 1, name: "Sprout", emoji: "🌿" },
      { stage: 2, name: "Bush", emoji: "🍃" },
      { stage: 3, name: "Blooming", emoji: "🌹" },
    ],
  },
  {
    name: "Oak Tree",
    emoji: "🌳",
    distanceRequired: 21100, // Half marathon
    rarity: "epic" as const,
    category: "tree" as const,
    description: "A mighty oak for conquering half marathon distance",
    growthStages: [
      { stage: 0, name: "Acorn", emoji: "🌰" },
      { stage: 1, name: "Sprout", emoji: "🌱" },
      { stage: 2, name: "Young Oak", emoji: "🌲" },
      { stage: 3, name: "Mighty Oak", emoji: "🌳" },
    ],
  },
  {
    name: "Cherry Blossom",
    emoji: "🌸",
    distanceRequired: 42200, // Marathon
    rarity: "epic" as const,
    category: "tree" as const,
    description: "The ultimate reward for marathon runners - ephemeral beauty",
    growthStages: [
      { stage: 0, name: "Seed", emoji: "🌱" },
      { stage: 1, name: "Sapling", emoji: "🌿" },
      { stage: 2, name: "Tree", emoji: "🌳" },
      { stage: 3, name: "Blossoming", emoji: "🌸" },
    ],
  },
];

// Initialize plant types in database
export const initializePlantTypes = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if plant types already exist
    const existing = await ctx.db.query("plantTypes").first();
    if (existing) {
      return { success: true, message: "Plant types already initialized" };
    }

    // Insert all plant types
    for (const plantType of PLANT_DISTANCE_REWARDS) {
      await ctx.db.insert("plantTypes", plantType);
    }

    return { success: true, message: `Initialized ${PLANT_DISTANCE_REWARDS.length} plant types` };
  },
});

// Get all available plant types
export const getAllPlantTypes = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("plantTypes")
      .order("asc")
      .collect();
  },
});

// Get plant type that should be awarded for a given distance
export const getPlantTypeForDistance = query({
  args: { distance: v.number() },
  handler: async (ctx, { distance }) => {
    // Find the highest distance requirement that the user has met
    const plantTypes = await ctx.db.query("plantTypes")
      .order("desc") // Start with highest distance requirements
      .collect();

    const eligiblePlant = plantTypes.find(plant => distance >= plant.distanceRequired);
    return eligiblePlant || null;
  },
});

// Get plant types by rarity
export const getPlantTypesByRarity = query({
  args: { rarity: v.union(v.literal("common"), v.literal("uncommon"), v.literal("rare"), v.literal("epic")) },
  handler: async (ctx, { rarity }) => {
    return await ctx.db.query("plantTypes")
      .filter((q) => q.eq(q.field("rarity"), rarity))
      .order("asc")
      .collect();
  },
});

// Migration function to update existing plant types with imagePath
export const migratePlantTypesWithImages = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all existing plant types
    const existingPlantTypes = await ctx.db.query("plantTypes").collect();
    
    let updatedCount = 0;
    
    // Update each plant type with imagePath from PLANT_DISTANCE_REWARDS
    for (const existingType of existingPlantTypes) {
      const definitionType = PLANT_DISTANCE_REWARDS.find(
        (def) => def.name === existingType.name
      );
      
      if (definitionType && definitionType.imagePath) {
        // Update the plant type with imagePath
        await ctx.db.patch(existingType._id, {
          imagePath: definitionType.imagePath,
        });
        
        updatedCount++;
      }
    }
    
    return { 
      success: true, 
      message: `Updated ${updatedCount} plant types with image paths`,
      updatedCount 
    };
  },
});
