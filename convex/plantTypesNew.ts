import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// New comprehensive plant system with proper categorization
export const NEW_PLANT_SYSTEM = {
  // Hero plants at major milestones
  HERO: {
    5: { name: "Marigold", emoji: "🌼", category: "flower" as const },
    10: { name: "Rose", emoji: "🌹", category: "flower" as const },
    21: { name: "Sakura", emoji: "🌸", category: "tree" as const },
    42: { name: "Baobab", emoji: "🌳", category: "tree" as const },
    100: { name: "Golden Truffle", emoji: "🍄", category: "mushroom" as const }
  },
  
  // Flowers (1-4, 6-9km)
  FLOWERS: {
    1: { name: "Daisy", emoji: "🌼", category: "flower" as const },
    2: { name: "Dandelion", emoji: "🌻", category: "flower" as const },
    3: { name: "Clover Bloom", emoji: "🍀", category: "flower" as const },
    4: { name: "Bluebell", emoji: "🔔", category: "flower" as const },
    6: { name: "Poppy", emoji: "🌺", category: "flower" as const },
    7: { name: "Cornflower", emoji: "💙", category: "flower" as const },
    8: { name: "Iris", emoji: "🌷", category: "flower" as const },
    9: { name: "Sunflower", emoji: "🌻", category: "flower" as const }
  },
  
  // Bushes (11-20km)
  BUSHES: {
    11: { name: "Lavender Bush", emoji: "💜", category: "bush" as const },
    12: { name: "Boxwood", emoji: "🌿", category: "bush" as const },
    13: { name: "Camellia", emoji: "🌺", category: "bush" as const },
    14: { name: "Azalea", emoji: "🌸", category: "bush" as const },
    15: { name: "Rosemary", emoji: "🌿", category: "bush" as const },
    16: { name: "Hibiscus", emoji: "🌺", category: "bush" as const },
    17: { name: "Hydrangea", emoji: "💙", category: "bush" as const },
    18: { name: "Holly", emoji: "🍃", category: "bush" as const },
    19: { name: "Oleander", emoji: "🌸", category: "bush" as const },
    20: { name: "Tea Bush", emoji: "🍃", category: "bush" as const }
  },
  
  // Trees (22-41km, excluding hero plants)
  TREES: {
    22: { name: "Olive", emoji: "🫒", category: "tree" as const },
    23: { name: "Birch", emoji: "🌳", category: "tree" as const },
    24: { name: "Elm", emoji: "🌳", category: "tree" as const },
    25: { name: "Maple", emoji: "🍁", category: "tree" as const },
    26: { name: "Willow", emoji: "🌳", category: "tree" as const },
    27: { name: "Pine", emoji: "🌲", category: "tree" as const },
    28: { name: "Eucalyptus", emoji: "🌿", category: "tree" as const },
    29: { name: "Cypress", emoji: "🌲", category: "tree" as const },
    30: { name: "Jacaranda", emoji: "💜", category: "tree" as const },
    31: { name: "Acacia", emoji: "🌳", category: "tree" as const },
    32: { name: "Ash", emoji: "🌳", category: "tree" as const },
    33: { name: "Ginkgo", emoji: "🍂", category: "tree" as const },
    34: { name: "Magnolia", emoji: "🌸", category: "tree" as const },
    35: { name: "Cedar", emoji: "🌲", category: "tree" as const },
    36: { name: "Chestnut", emoji: "🌰", category: "tree" as const },
    37: { name: "Linden", emoji: "🌳", category: "tree" as const },
    38: { name: "Hornbeam", emoji: "🌳", category: "tree" as const },
    39: { name: "Redwood Sapling", emoji: "🌲", category: "tree" as const },
    40: { name: "Oak", emoji: "🌳", category: "tree" as const },
    41: { name: "Sequoia Sapling", emoji: "🌲", category: "tree" as const }
  },
  
  // Desert plants (43-69km)
  DESERT: {
    43: { name: "Prickly Pear", emoji: "🌵", category: "desert" as const },
    44: { name: "Aloe", emoji: "🌿", category: "desert" as const },
    45: { name: "Agave", emoji: "🌵", category: "desert" as const },
    46: { name: "Barrel Cactus", emoji: "🌵", category: "desert" as const },
    47: { name: "Cholla", emoji: "🌵", category: "desert" as const },
    48: { name: "Organ Pipe", emoji: "🌵", category: "desert" as const },
    49: { name: "Ocotillo", emoji: "🌵", category: "desert" as const },
    50: { name: "Saguaro", emoji: "🌵", category: "desert" as const },
    51: { name: "Yucca", emoji: "🌵", category: "desert" as const },
    52: { name: "Desert Marigold", emoji: "🌼", category: "desert" as const },
    53: { name: "Tumbleweed", emoji: "🌾", category: "desert" as const },
    54: { name: "Mesquite", emoji: "🌿", category: "desert" as const },
    55: { name: "Saltbush", emoji: "🌿", category: "desert" as const },
    56: { name: "Creosote", emoji: "🌿", category: "desert" as const },
    57: { name: "Fairy Duster", emoji: "🌸", category: "desert" as const },
    58: { name: "Palo Verde", emoji: "🌳", category: "desert" as const },
    59: { name: "Desert Willow", emoji: "🌳", category: "desert" as const },
    60: { name: "Joshua Tree", emoji: "🌴", category: "desert" as const },
    61: { name: "Fishhook Cactus", emoji: "🌵", category: "desert" as const },
    62: { name: "Sand Verbena", emoji: "🌸", category: "desert" as const },
    63: { name: "Ghost Plant", emoji: "👻", category: "desert" as const },
    64: { name: "Stonecrop", emoji: "🪨", category: "desert" as const },
    65: { name: "Queen of the Night", emoji: "🌙", category: "desert" as const },
    66: { name: "Elephant Bush", emoji: "🐘", category: "desert" as const },
    67: { name: "Hedgehog Cactus", emoji: "🌵", category: "desert" as const },
    68: { name: "Living Stones", emoji: "🪨", category: "desert" as const },
    69: { name: "Golden Barrel", emoji: "🌵", category: "desert" as const }
  },
  
  // Mushrooms (70-99km)
  MUSHROOMS: {
    70: { name: "Morel", emoji: "🍄", category: "mushroom" as const },
    71: { name: "Porcini", emoji: "🍄", category: "mushroom" as const },
    72: { name: "Chanterelle", emoji: "🍄", category: "mushroom" as const },
    73: { name: "Oyster", emoji: "🍄", category: "mushroom" as const },
    74: { name: "Shiitake", emoji: "🍄", category: "mushroom" as const },
    75: { name: "Enoki", emoji: "🍄", category: "mushroom" as const },
    76: { name: "Shimeji", emoji: "🍄", category: "mushroom" as const },
    77: { name: "King Trumpet", emoji: "🍄", category: "mushroom" as const },
    78: { name: "Maitake", emoji: "🍄", category: "mushroom" as const },
    79: { name: "Lion's Mane", emoji: "🍄", category: "mushroom" as const },
    80: { name: "Black Trumpet", emoji: "🍄", category: "mushroom" as const },
    81: { name: "Coral Fungus", emoji: "🍄", category: "mushroom" as const },
    82: { name: "Turkey Tail", emoji: "🍄", category: "mushroom" as const },
    83: { name: "Ink Cap", emoji: "🍄", category: "mushroom" as const },
    84: { name: "Puffball", emoji: "🍄", category: "mushroom" as const },
    85: { name: "Hedgehog", emoji: "🍄", category: "mushroom" as const },
    86: { name: "Cauliflower Fungus", emoji: "🍄", category: "mushroom" as const },
    87: { name: "Milkcap", emoji: "🍄", category: "mushroom" as const },
    88: { name: "Russula", emoji: "🍄", category: "mushroom" as const },
    89: { name: "Boletus", emoji: "🍄", category: "mushroom" as const },
    90: { name: "Amethyst Deceiver", emoji: "🍄", category: "mushroom" as const },
    91: { name: "Velvet Foot", emoji: "🍄", category: "mushroom" as const },
    92: { name: "Fairy Ring", emoji: "🍄", category: "mushroom" as const },
    93: { name: "Witch's Butter", emoji: "🍄", category: "mushroom" as const },
    94: { name: "Earthstar", emoji: "🍄", category: "mushroom" as const },
    95: { name: "Fly Agaric", emoji: "🍄", category: "mushroom" as const },
    96: { name: "Blewit", emoji: "🍄", category: "mushroom" as const },
    97: { name: "Parasol", emoji: "🍄", category: "mushroom" as const },
    98: { name: "Stinkhorn", emoji: "🍄", category: "mushroom" as const },
    99: { name: "Mycelium Cluster", emoji: "🍄", category: "mushroom" as const }
  }
};

// Helper function to determine rarity based on distance
function getRarityForDistance(distance: number): 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythical' {
  if (distance <= 10) return 'common';
  if (distance <= 20) return 'uncommon';
  if (distance <= 30) return 'rare';
  if (distance <= 50) return 'epic';
  if (distance <= 80) return 'legendary';
  return 'mythical';
}

// Helper function to create growth stages based on category
function getGrowthStages(category: string, emoji: string) {
  switch (category) {
    case 'flower':
      return [
        { stage: 0, name: "Seed", emoji: "🌱" },
        { stage: 1, name: "Sprout", emoji: "🌿" },
        { stage: 2, name: "Bud", emoji: "🌸" },
        { stage: 3, name: "Bloom", emoji: emoji }
      ];
    case 'bush':
      return [
        { stage: 0, name: "Seed", emoji: "🌱" },
        { stage: 1, name: "Sprout", emoji: "🌿" },
        { stage: 2, name: "Young Bush", emoji: "🍃" },
        { stage: 3, name: "Mature Bush", emoji: emoji }
      ];
    case 'tree':
      return [
        { stage: 0, name: "Seed", emoji: "🌱" },
        { stage: 1, name: "Sapling", emoji: "🌿" },
        { stage: 2, name: "Young Tree", emoji: "🌳" },
        { stage: 3, name: "Mature Tree", emoji: emoji }
      ];
    case 'desert':
      return [
        { stage: 0, name: "Seed", emoji: "🌱" },
        { stage: 1, name: "Sprout", emoji: "🌿" },
        { stage: 2, name: "Growing", emoji: "🌵" },
        { stage: 3, name: "Desert Plant", emoji: emoji }
      ];
    case 'mushroom':
      return [
        { stage: 0, name: "Spore", emoji: "🌱" },
        { stage: 1, name: "Mycelium", emoji: "🌿" },
        { stage: 2, name: "Pin Head", emoji: "🍄" },
        { stage: 3, name: "Mature", emoji: emoji }
      ];
    default:
      return [
        { stage: 0, name: "Seed", emoji: "🌱" },
        { stage: 1, name: "Sprout", emoji: "🌿" },
        { stage: 2, name: "Growing", emoji: "🌿" },
        { stage: 3, name: "Mature", emoji: emoji }
      ];
  }
}

// Convert the new system to the format expected by the database
export const NEW_PLANT_DISTANCE_REWARDS = (() => {
  const plants = [];
  
  // Combine all categories into a single array
  const allPlants: { [key: number]: { name: string; emoji: string; category: string } } = {
    ...NEW_PLANT_SYSTEM.FLOWERS,
    ...NEW_PLANT_SYSTEM.HERO,
    ...NEW_PLANT_SYSTEM.BUSHES,
    ...NEW_PLANT_SYSTEM.TREES,
    ...NEW_PLANT_SYSTEM.DESERT,
    ...NEW_PLANT_SYSTEM.MUSHROOMS
  };
  
  // Sort by distance and create plant entries
  for (let distance = 1; distance <= 100; distance++) {
    const plant = allPlants[distance];
    if (plant) {
      plants.push({
        name: plant.name,
        emoji: plant.emoji,
        distanceRequired: distance * 1000, // Convert km to meters
        rarity: getRarityForDistance(distance),
        category: plant.category as "flower" | "bush" | "tree" | "desert" | "mushroom",
        description: `A ${plant.category} earned from your ${distance}km achievement`,
        growthStages: getGrowthStages(plant.category, plant.emoji)
      });
    }
  }
  
  return plants;
})();

// Ultra distance mushroom for 100km+ (keeping the existing concept)
export const ULTRA_DISTANCE_MUSHROOM = {
  name: "Ultra Mushroom",
  emoji: "🍄",
  distanceRequired: 100001, // For distances over 100km
  rarity: "mythical" as const,
  category: "mushroom" as const,
  description: "A mystical mushroom for ultra-distance runners beyond 100km",
  growthStages: [
    { stage: 0, name: "Spore", emoji: "🌱" },
    { stage: 1, name: "Mycelium", emoji: "🌿" },
    { stage: 2, name: "Ultra Growth", emoji: "🍄" },
    { stage: 3, name: "Ultra Mushroom", emoji: "🍄" },
  ],
};

// Initialize new plant types in database
export const initializeNewPlantTypes = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear existing plant types (optional - for development)
    // const existing = await ctx.db.query("plantTypes").collect();
    // for (const plant of existing) {
    //   await ctx.db.delete(plant._id);
    // }

    // Insert all new plant types
    for (const plantType of NEW_PLANT_DISTANCE_REWARDS) {
      await ctx.db.insert("plantTypes", plantType);
    }

    return { 
      success: true, 
      message: `Initialized ${NEW_PLANT_DISTANCE_REWARDS.length} new plant types` 
    };
  },
});

// Get plant type that should be awarded for a given distance (updated for new system)
export const getNewPlantTypeForDistance = query({
  args: { distance: v.number() },
  handler: async (ctx, { distance }) => {
    // For distances over 100km, return the ultra mushroom
    if (distance > 100000) {
      return ULTRA_DISTANCE_MUSHROOM;
    }

    // Find the highest distance requirement that the user has met
    const plantTypes = await ctx.db.query("plantTypes")
      .order("desc") // Start with highest distance requirements
      .collect();

    const eligiblePlant = plantTypes.find(plant => distance >= plant.distanceRequired);
    return eligiblePlant || null;
  },
});
