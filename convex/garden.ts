import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { api } from "./_generated/api";
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
      // Check if existing garden needs to be upgraded to 10x10 with all tiles unlocked
      const needsUpgrade = existingGarden.gridSize.width < 10 || existingGarden.gridSize.height < 10;
      
      if (needsUpgrade) {
        const totalGridSize = 10;
        
        // Create all tiles as unlocked for 10x10 grid
        const allUnlockedTiles = [];
        for (let x = 0; x < totalGridSize; x++) {
          for (let y = 0; y < totalGridSize; y++) {
            allUnlockedTiles.push({ 
              x, 
              y, 
              unlockedAt: new Date().toISOString() 
            });
          }
        }
        
        await ctx.db.patch(existingGarden._id, {
          gridSize: { width: totalGridSize, height: totalGridSize },
          unlockedTiles: allUnlockedTiles,
          updatedAt: new Date().toISOString(),
        });
        
        return await ctx.db.get(existingGarden._id);
      }
      return existingGarden;
    }

    // Create initial garden with a 10x10 total grid, with all tiles unlocked
    const totalGridSize = 10;
    
    const allUnlockedTiles = [];
    for (let x = 0; x < totalGridSize; x++) {
      for (let y = 0; y < totalGridSize; y++) {
        allUnlockedTiles.push({ 
          x, 
          y, 
          unlockedAt: new Date().toISOString() 
        });
      }
    }

    const gardenId = await ctx.db.insert("gardenLayout", {
      userId,
      gridSize: { width: totalGridSize, height: totalGridSize },
      unlockedTiles: allUnlockedTiles,
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

    console.log(`[getGardenPlants] Found ${plants.length} planted plants for user ${userId}`);

    // Fetch plant type details for each plant
    const plantsWithTypes = await Promise.all(
      plants.map(async (plant) => {
        const plantType = await ctx.db.get(plant.plantTypeId);
        
        // Debug logging for missing plant types
        if (!plantType) {
          console.warn(`[getGardenPlants] Missing plant type for plant ${plant._id}, plantTypeId: ${plant.plantTypeId}`);
        }
        
        return {
          ...plant,
          plantType,
        };
      })
    );

    // Count plants with missing plant types
    const plantsWithMissingTypes = plantsWithTypes.filter(p => !p.plantType);
    if (plantsWithMissingTypes.length > 0) {
      console.warn(`[getGardenPlants] ${plantsWithMissingTypes.length} out of ${plantsWithTypes.length} plants have missing plant types`);
    } else {
      console.log(`[getGardenPlants] All ${plantsWithTypes.length} plants have valid plant types`);
    }

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


// Auto-plant a plant from inventory to next available grid position
export const autoPlantInGarden = mutation({
  args: {
    plantId: v.id("plants"),
  },
  handler: async (ctx, { plantId }) => {
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

    // Get garden and find next available position
    const garden = await ctx.db
      .query("gardenLayout")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!garden) {
      throw new ConvexError("Garden not found");
    }

    // Get all planted plants to see which positions are occupied
    const plantedPlants = await ctx.db
      .query("plants")
      .withIndex("by_user_planted", (q) => q.eq("userId", userId).eq("isPlanted", true))
      .collect();

    // Create a set of occupied positions
    const occupiedPositions = new Set(
      plantedPlants
        .filter(p => p.gridPosition)
        .map(p => `${p.gridPosition!.row}-${p.gridPosition!.col}`)
    );

    // Find next available position (row by row, left to right) in 10x10 grid
    let gridPosition = null;
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const positionKey = `${row}-${col}`;
        if (!occupiedPositions.has(positionKey)) {
          gridPosition = { row, col };
          break;
        }
      }
      if (gridPosition) break;
    }

    if (!gridPosition) {
      throw new ConvexError("No available positions in garden");
    }

    // Auto-plant the plant at the found position
    await ctx.db.patch(plantId, {
      isPlanted: true,
      plantedAt: new Date().toISOString(),
      gridPosition,
      updatedAt: new Date().toISOString(),
    });

    // Update garden last tended time
    if (garden) {
      await ctx.db.patch(garden._id, {
        lastTended: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return { success: true };
  },
});

// Plant all inventory plants at once (for initial sync)
export const plantAllInventoryPlants = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    // Get all unplanted plants in inventory
    const inventoryPlants = await ctx.db
      .query("plants")
      .withIndex("by_user_planted", (q) => q.eq("userId", userId).eq("isPlanted", false))
      .collect();

    if (inventoryPlants.length === 0) {
      return { success: true, plantsPlanted: 0 };
    }

    console.log(`[plantAllInventoryPlants] Found ${inventoryPlants.length} plants to plant for user ${userId}`);

    // Get garden and find all occupied positions
    const garden = await ctx.db
      .query("gardenLayout")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!garden) {
      throw new ConvexError("Garden not found");
    }

    // Get all planted plants to see which positions are occupied
    const plantedPlants = await ctx.db
      .query("plants")
      .withIndex("by_user_planted", (q) => q.eq("userId", userId).eq("isPlanted", true))
      .collect();

    // Create a set of occupied positions
    const occupiedPositions = new Set(
      plantedPlants
        .filter(p => p.gridPosition)
        .map(p => `${p.gridPosition!.row}-${p.gridPosition!.col}`)
    );

    let plantsPlanted = 0;
    let currentRow = 0;
    let currentCol = 0;

    // Plant each inventory plant
    for (const plant of inventoryPlants) {
      // Find next available position (row by row, left to right) in 10x10 grid
      let gridPosition = null;
      let found = false;

      for (let row = currentRow; row < 10 && !found; row++) {
        for (let col = (row === currentRow ? currentCol : 0); col < 10; col++) {
          const positionKey = `${row}-${col}`;
          if (!occupiedPositions.has(positionKey)) {
            gridPosition = { row, col };
            occupiedPositions.add(positionKey); // Mark as occupied for next iteration
            currentRow = row;
            currentCol = col + 1; // Start next search from next position
            if (currentCol >= 10) {
              currentRow++;
              currentCol = 0;
            }
            found = true;
            break;
          }
        }
      }

      if (!gridPosition) {
        console.warn(`[plantAllInventoryPlants] Garden full: planted ${plantsPlanted} plants, ${inventoryPlants.length - plantsPlanted} plants remain in inventory`);
        break; // No more space in garden
      }

      // Plant the plant at the found position
      await ctx.db.patch(plant._id, {
        isPlanted: true,
        plantedAt: new Date().toISOString(),
        gridPosition,
        updatedAt: new Date().toISOString(),
      });

      plantsPlanted++;
      console.log(`[plantAllInventoryPlants] Planted plant ${plant._id} at position ${gridPosition.row},${gridPosition.col}`);
    }

    // Update garden last tended time
    if (plantsPlanted > 0) {
      await ctx.db.patch(garden._id, {
        lastTended: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    console.log(`[plantAllInventoryPlants] Successfully planted ${plantsPlanted} plants for user ${userId}. ${inventoryPlants.length - plantsPlanted} plants remain in inventory.`);

    return { success: true, plantsPlanted, remainingInInventory: inventoryPlants.length - plantsPlanted };
  },
});

// Debug function to check for plants with missing plant types and fix them
export const diagnosePlantTypeIssues = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    console.log(`[diagnosePlantTypeIssues] Starting diagnosis for user ${userId}`);

    // Get all user's plants
    const userPlants = await ctx.db
      .query("plants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    console.log(`[diagnosePlantTypeIssues] Found ${userPlants.length} total plants`);

    // Check which plants have missing plant types
    const plantsWithMissingTypes = [];
    const plantTypeIds = new Set();

    for (const plant of userPlants) {
      const plantType = await ctx.db.get(plant.plantTypeId);
      if (!plantType) {
        plantsWithMissingTypes.push(plant);
      }
      plantTypeIds.add(plant.plantTypeId);
    }

    console.log(`[diagnosePlantTypeIssues] ${plantsWithMissingTypes.length} plants have missing plant types`);
    console.log(`[diagnosePlantTypeIssues] Referenced plant type IDs:`, Array.from(plantTypeIds));

    // Get all available plant types
    const availablePlantTypes = await ctx.db.query("plantTypes").collect();
    console.log(`[diagnosePlantTypeIssues] ${availablePlantTypes.length} plant types available in database`);
    
    // If no plant types exist, try to initialize them
    if (availablePlantTypes.length === 0) {
      console.warn(`[diagnosePlantTypeIssues] No plant types found! Attempting to initialize...`);
      try {
        await ctx.runMutation(api.plantTypesNew.initializeNewPlantTypes, {});
        console.log(`[diagnosePlantTypeIssues] Successfully initialized plant types`);
      } catch (error) {
        console.error(`[diagnosePlantTypeIssues] Failed to initialize plant types:`, error);
      }
    }

    return {
      totalPlants: userPlants.length,
      plantsWithMissingTypes: plantsWithMissingTypes.length,
      availablePlantTypes: availablePlantTypes.length,
      missingPlantIds: plantsWithMissingTypes.map(p => p._id),
      referencedTypeIds: Array.from(plantTypeIds),
    };
  },
});

// Server-side auto-plant function (bypasses authentication for webhooks)
export const autoPlantInGardenServer = mutation({
  args: {
    userId: v.id("users"),
    plantId: v.id("plants"),
  },
  handler: async (ctx, { userId, plantId }) => {
    // Verify the plant belongs to the user and is not already planted
    const plant = await ctx.db.get(plantId);
    if (!plant || plant.userId !== userId) {
      throw new ConvexError("Plant not found or not owned by user");
    }

    if (plant.isPlanted) {
      throw new ConvexError("Plant is already planted");
    }

    // Get garden and find next available position
    const garden = await ctx.db
      .query("gardenLayout")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!garden) {
      throw new ConvexError("Garden not found");
    }

    // Get all planted plants to see which positions are occupied
    const plantedPlants = await ctx.db
      .query("plants")
      .withIndex("by_user_planted", (q) => q.eq("userId", userId).eq("isPlanted", true))
      .collect();

    // Create a set of occupied positions
    const occupiedPositions = new Set(
      plantedPlants
        .filter(p => p.gridPosition)
        .map(p => `${p.gridPosition!.row}-${p.gridPosition!.col}`)
    );

    // Find next available position (row by row, left to right) in 10x10 grid
    let gridPosition = null;
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const positionKey = `${row}-${col}`;
        if (!occupiedPositions.has(positionKey)) {
          gridPosition = { row, col };
          break;
        }
      }
      if (gridPosition) break;
    }

    if (!gridPosition) {
      throw new ConvexError("No available positions in garden");
    }

    // Auto-plant the plant at the found position
    await ctx.db.patch(plantId, {
      isPlanted: true,
      plantedAt: new Date().toISOString(),
      gridPosition,
      updatedAt: new Date().toISOString(),
    });

    // Update garden last tended time
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

// Update plant position in garden grid
export const updatePlantInGarden = mutation({
  args: {
    plantId: v.id("plants"),
    gridPosition: v.optional(v.object({ row: v.number(), col: v.number() })),
  },
  handler: async (ctx, { plantId, gridPosition }) => {
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

    // If moving to a new grid position, validate it
    if (gridPosition !== undefined) {
      // Validate grid bounds
      if (gridPosition.row < 0 || gridPosition.row >= 10 || 
          gridPosition.col < 0 || gridPosition.col >= 10) {
        throw new ConvexError("Grid position must be within 10x10 bounds");
      }

      // In simplified grid, all positions are available - no need to check unlocked tiles

      // Check if position is already occupied (by a different plant)
      const existingPlant = await ctx.db
        .query("plants")
        .withIndex("by_grid_position", (q) => 
          q.eq("userId", userId)
           .eq("gridPosition.row", gridPosition.row)
           .eq("gridPosition.col", gridPosition.col)
        )
        .first();

      if (existingPlant && existingPlant._id !== plantId) {
        throw new ConvexError("This grid position is already occupied");
      }
    }

    // Build update object
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (gridPosition !== undefined) {
      updateData.gridPosition = gridPosition;
    }

    // Update the plant
    await ctx.db.patch(plantId, updateData);

    return { success: true };
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
