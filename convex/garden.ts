import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Initialize user's garden with default settings
export const initializeGarden = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    // Check if garden already exists
    const existingGarden = await ctx.db
      .query("gardenLayout")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingGarden) {
      // Check if existing garden needs to be upgraded to 10x10 with center 5x5 unlocked
      const needsUpgrade = existingGarden.gridSize.width < 10 || existingGarden.gridSize.height < 10;
      
      if (needsUpgrade) {
        const totalGridSize = 10;
        const initialUnlockedSize = 5;
        const startOffset = Math.floor((totalGridSize - initialUnlockedSize) / 2);
        
        // Migrate existing unlocked tiles and add center 5x5 area
        const upgradedTiles = [...existingGarden.unlockedTiles];
        
        // Ensure center 5x5 is unlocked
        for (let x = startOffset; x < startOffset + initialUnlockedSize; x++) {
          for (let y = startOffset; y < startOffset + initialUnlockedSize; y++) {
            const existing = upgradedTiles.find(tile => tile.x === x && tile.y === y);
            if (!existing) {
              upgradedTiles.push({ 
                x, 
                y, 
                unlockedAt: new Date().toISOString() 
              });
            }
          }
        }
        
        await ctx.db.patch(existingGarden._id, {
          gridSize: { width: totalGridSize, height: totalGridSize },
          unlockedTiles: upgradedTiles,
          updatedAt: new Date().toISOString(),
        });
        
        return await ctx.db.get(existingGarden._id);
      }
      return existingGarden;
    }

    // Create initial garden with a 10x10 total grid, with center 5x5 unlocked
    const totalGridSize = 10;
    const initialUnlockedSize = 5;
    const startOffset = Math.floor((totalGridSize - initialUnlockedSize) / 2); // Center the 5x5 area
    
    const initialUnlockedTiles = [];
    for (let x = startOffset; x < startOffset + initialUnlockedSize; x++) {
      for (let y = startOffset; y < startOffset + initialUnlockedSize; y++) {
        initialUnlockedTiles.push({ 
          x, 
          y, 
          unlockedAt: new Date().toISOString() 
        });
      }
    }

    const gardenId = await ctx.db.insert("gardenLayout", {
      userId,
      gridSize: { width: totalGridSize, height: totalGridSize },
      unlockedTiles: initialUnlockedTiles,
      theme: "default",
      lastTended: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return await ctx.db.get(gardenId);
  },
});

// Get user's garden layout
export const getGardenLayout = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    return await ctx.db
      .query("gardenLayout")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

// Get all plants in user's garden (planted plants with positions)
export const getGardenPlants = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Get all planted plants with their types
    const plants = await ctx.db
      .query("plants")
      .withIndex("by_user_planted", (q) => q.eq("userId", userId).eq("isPlanted", true))
      .collect();

    // Fetch plant type details for each plant
    const plantsWithTypes = await Promise.all(
      plants.map(async (plant) => {
        const plantType = await ctx.db.get(plant.plantTypeId);
        return {
          ...plant,
          plantType,
        };
      })
    );

    return plantsWithTypes;
  },
});

// Get user's plant inventory (unplanted plants)
export const getPlantInventory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Get unplanted plants with their types
    const plants = await ctx.db
      .query("plants")
      .withIndex("by_user_planted", (q) => q.eq("userId", userId).eq("isPlanted", false))
      .collect();

    // Fetch plant type details for each plant
    const plantsWithTypes = await Promise.all(
      plants.map(async (plant) => {
        const plantType = await ctx.db.get(plant.plantTypeId);
        return {
          ...plant,
          plantType,
        };
      })
    );

    return plantsWithTypes;
  },
});

// Plant a plant from inventory to garden canvas position
export const plantInGarden = mutation({
  args: {
    plantId: v.id("plants"),
    position: v.object({ x: v.float64(), y: v.float64() }),
    plantSize: v.optional(v.float64()),
    zIndex: v.optional(v.number()),
  },
  handler: async (ctx, { plantId, position, plantSize = 1.0, zIndex }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    // Verify the plant belongs to the user and is not already planted
    const plant = await ctx.db.get(plantId);
    if (!plant || plant.userId !== userId) {
      throw new ConvexError("Plant not found or not owned by user");
    }

    if (plant.isPlanted) {
      throw new ConvexError("Plant is already planted");
    }

    // Validate canvas properties
    if (plantSize < 0.5 || plantSize > 2.0) {
      throw new ConvexError("Plant size must be between 0.5 and 2.0");
    }

    // Get the next z-index if not provided
    let finalZIndex = zIndex;
    if (finalZIndex === undefined) {
      const plantedPlants = await ctx.db
        .query("plants")
        .withIndex("by_user_planted", (q) => q.eq("userId", userId).eq("isPlanted", true))
        .collect();
      
      const maxZIndex = Math.max(0, ...plantedPlants.map(p => p.zIndex || 0));
      finalZIndex = maxZIndex + 1;
    }

    // Plant the plant with canvas properties
    await ctx.db.patch(plantId, {
      isPlanted: true,
      plantedAt: new Date().toISOString(),
      gardenPosition: position,
      plantSize,
      zIndex: finalZIndex,
      updatedAt: new Date().toISOString(),
    });

    // Update garden last tended time
    const garden = await ctx.db
      .query("gardenLayout")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (garden) {
      await ctx.db.patch(garden._id, {
        lastTended: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return { success: true };
  },
});

// Remove plant from garden (move back to inventory)
export const removeFromGarden = mutation({
  args: { plantId: v.id("plants") },
  handler: async (ctx, { plantId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    // Verify the plant belongs to the user and is planted
    const plant = await ctx.db.get(plantId);
    if (!plant || plant.userId !== userId) {
      throw new ConvexError("Plant not found or not owned by user");
    }

    if (!plant.isPlanted) {
      throw new ConvexError("Plant is not planted");
    }

    // Remove from garden
    await ctx.db.patch(plantId, {
      isPlanted: false,
      plantedAt: undefined,
      gardenPosition: undefined,
      plantSize: undefined,
      zIndex: undefined,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

// Update plant canvas properties (position, size, layer)
export const updatePlantInGarden = mutation({
  args: {
    plantId: v.id("plants"),
    position: v.optional(v.object({ x: v.float64(), y: v.float64() })),
    plantSize: v.optional(v.float64()),
    zIndex: v.optional(v.number()),
  },
  handler: async (ctx, { plantId, position, plantSize, zIndex }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    // Verify the plant belongs to the user and is planted
    const plant = await ctx.db.get(plantId);
    if (!plant || plant.userId !== userId) {
      throw new ConvexError("Plant not found or not owned by user");
    }

    if (!plant.isPlanted) {
      throw new ConvexError("Plant is not planted in garden");
    }

    // Validate properties
    if (plantSize !== undefined && (plantSize < 0.5 || plantSize > 2.0)) {
      throw new ConvexError("Plant size must be between 0.5 and 2.0");
    }

    // Build update object with only provided properties
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (position !== undefined) {
      updateData.gardenPosition = position;
    }
    if (plantSize !== undefined) {
      updateData.plantSize = plantSize;
    }
    if (zIndex !== undefined) {
      updateData.zIndex = zIndex;
    }

    // Update the plant
    await ctx.db.patch(plantId, updateData);

    return { success: true };
  },
});

// Migration function to convert old grid-based positions to canvas positions
export const migratePlantsToCanvas = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    // Get all planted plants for this user
    const plants = await ctx.db
      .query("plants")
      .withIndex("by_user_planted", (q) => q.eq("userId", userId).eq("isPlanted", true))
      .collect();

    let migratedCount = 0;

    for (const plant of plants) {
      // Check if plant needs migration (has integer coordinates or no canvas properties)
      if (plant.gardenPosition && 
          (plant.plantSize === undefined || plant.zIndex === undefined ||
           (Number.isInteger(plant.gardenPosition.x) && Number.isInteger(plant.gardenPosition.y) && 
            plant.gardenPosition.x < 50 && plant.gardenPosition.y < 50))) {
        
        // Convert old grid coordinates to canvas coordinates
        // Old system: grid positions 0-9, new system: pixel positions
        const canvasX = (plant.gardenPosition.x * 100) + 300; // Spread out and offset
        const canvasY = (plant.gardenPosition.y * 100) + 300;
        
        await ctx.db.patch(plant._id, {
          gardenPosition: { x: canvasX, y: canvasY },
          plantSize: 1.0,
          zIndex: migratedCount, // Give each plant a unique layer
          updatedAt: new Date().toISOString(),
        });
        
        migratedCount++;
      }
    }

    return { migratedCount };
  },
});

// Water a plant (care action)
export const waterPlant = mutation({
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

    if (!plant.isPlanted) {
      throw new ConvexError("Plant must be planted to be watered");
    }

    // Update water level and last watered time
    const newWaterLevel = Math.min(100, plant.waterLevel + 25); // +25 water points
    const experienceGained = 5; // Small XP for caring

    await ctx.db.patch(plantId, {
      waterLevel: newWaterLevel,
      lastWatered: new Date().toISOString(),
      experiencePoints: plant.experiencePoints + experienceGained,
      isWilted: false,
      updatedAt: new Date().toISOString(),
    });

    // Log the care action
    await ctx.db.insert("plantCareLog", {
      userId,
      plantId,
      action: "water",
      timestamp: new Date().toISOString(),
      experienceGained,
    });

    return { success: true, waterLevel: newWaterLevel, experienceGained };
  },
});

// Expand garden (unlock new tiles) - could be based on achievements
export const expandGarden = mutation({
  args: {
    newTiles: v.array(v.object({ x: v.number(), y: v.number() })),
  },
  handler: async (ctx, { newTiles }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const garden = await ctx.db
      .query("gardenLayout")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!garden) {
      throw new ConvexError("Garden not found");
    }

    // Add new tiles to unlocked tiles
    const now = new Date().toISOString();
    const updatedTiles = [
      ...garden.unlockedTiles,
      ...newTiles.map(tile => ({ ...tile, unlockedAt: now })),
    ];

    await ctx.db.patch(garden._id, {
      unlockedTiles: updatedTiles,
      updatedAt: now,
    });

    return { success: true, newTilesCount: newTiles.length };
  },
});

// Reset garden - remove all plants from garden and return them to inventory
export const resetGarden = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    // Get all planted plants for this user
    const plantedPlants = await ctx.db
      .query("plants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isPlanted"), true))
      .collect();

    // Remove each plant from garden (return to inventory)
    for (const plant of plantedPlants) {
      await ctx.db.patch(plant._id, {
        isPlanted: false,
        plantedAt: undefined,
        gardenPosition: undefined,
        plantSize: undefined,
        zIndex: undefined,
        updatedAt: new Date().toISOString(),
      });
    }

    // Update garden last tended time
    const garden = await ctx.db
      .query("gardenLayout")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (garden) {
      await ctx.db.patch(garden._id, {
        lastTended: new Date().toISOString(),
      });
    }

    return { 
      success: true, 
      removedCount: plantedPlants.length 
    };
  },
});

// Clean up deprecated rotation field from all plants
export const cleanupRotationField = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    // Get all plants for this user that have the rotation field
    const plants = await ctx.db
      .query("plants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let cleanedCount = 0;

    for (const plant of plants) {
      // Check if plant has rotation field
      if (plant.rotation !== undefined) {
        await ctx.db.patch(plant._id, {
          rotation: undefined,
          updatedAt: new Date().toISOString(),
        });
        cleanedCount++;
      }
    }

    return { 
      success: true, 
      cleanedCount 
    };
  },
});
