import { mutation, query } from "./_generated/server";
import { NEW_PLANT_DISTANCE_REWARDS } from "./plantTypesNew";

// Migration function to replace old plant system with new one
export const migrateToNewPlantSystem = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🌱 Starting migration to new plant system...");
    
    try {
      // Step 1: Clear existing plant types
      console.log("📝 Clearing old plant types...");
      const existingPlantTypes = await ctx.db.query("plantTypes").collect();
      let deletedCount = 0;
      
      for (const plantType of existingPlantTypes) {
        await ctx.db.delete(plantType._id);
        deletedCount++;
      }
      console.log(`✅ Deleted ${deletedCount} old plant types`);

      // Step 2: Insert new plant types
      console.log("🌱 Inserting new plant types...");
      let insertedCount = 0;
      
      for (const plantType of NEW_PLANT_DISTANCE_REWARDS) {
        await ctx.db.insert("plantTypes", plantType);
        insertedCount++;
      }
      console.log(`✅ Inserted ${insertedCount} new plant types`);

      // Step 3: Update existing user plants to remove growth logic
      console.log("🔄 Updating existing user plants...");
      const existingPlants = await ctx.db.query("plants").collect();
      let updatedPlantsCount = 0;

      for (const plant of existingPlants) {
        // Set all plants to mature stage (stage 3) and remove XP system
        await ctx.db.patch(plant._id, {
          currentStage: 3, // All plants start mature in new system
          experiencePoints: 0,
          nextStageRequirement: 0,
          waterLevel: 100, // Reset water level
          isWilted: false,
          updatedAt: new Date().toISOString(),
        });
        updatedPlantsCount++;
      }
      console.log(`✅ Updated ${updatedPlantsCount} existing plants`);

      // Step 4: Handle plants with invalid plantTypeIds (ultra mushrooms, etc.)
      console.log("🍄 Handling special plants...");
      const plantsWithInvalidTypes = existingPlants.filter(plant => 
        plant.plantTypeId === "ultra_mushroom" || 
        typeof plant.plantTypeId === "string"
      );

      for (const plant of plantsWithInvalidTypes) {
        // For ultra mushrooms and special plants, keep them as-is but ensure they're mature
        await ctx.db.patch(plant._id, {
          currentStage: 3,
          experiencePoints: 0,
          nextStageRequirement: 0,
          waterLevel: 100,
          isWilted: false,
          updatedAt: new Date().toISOString(),
        });
      }
      console.log(`✅ Updated ${plantsWithInvalidTypes.length} special plants`);

      return {
        success: true,
        message: `Migration completed successfully!`,
        details: {
          deletedPlantTypes: deletedCount,
          insertedPlantTypes: insertedCount,
          updatedPlants: updatedPlantsCount,
          specialPlantsUpdated: plantsWithInvalidTypes.length,
        }
      };

    } catch (error) {
      console.error("❌ Migration failed:", error);
      return {
        success: false,
        message: "Migration failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// Query to check migration status
export const getMigrationStatus = query({
  args: {},
  handler: async (ctx) => {
    const plantTypes = await ctx.db.query("plantTypes").collect();
    const plants = await ctx.db.query("plants").collect();
    
    // Check if we have the new plant system (should have 100 plant types)
    const hasNewSystem = plantTypes.length === 100;
    
    // Check plant categories to see if migration happened
    const newCategories = ["flower", "bush", "tree", "desert", "mushroom"];
    const hasNewCategories = plantTypes.some(pt => newCategories.includes(pt.category));
    
    // Count plants with growth logic still active
    const plantsWithGrowthLogic = plants.filter(p => 
      p.currentStage < 3 || 
      p.experiencePoints > 0 || 
      p.nextStageRequirement > 0
    ).length;

    return {
      totalPlantTypes: plantTypes.length,
      totalUserPlants: plants.length,
      hasNewSystem,
      hasNewCategories,
      plantsWithGrowthLogic,
      migrationNeeded: !hasNewSystem || plantsWithGrowthLogic > 0,
      plantTypesByCategory: plantTypes.reduce((acc, pt) => {
        acc[pt.category] = (acc[pt.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  },
});

// Rollback function (in case something goes wrong)
export const rollbackMigration = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🔄 Rolling back migration...");
    
    try {
      // This would restore from a backup if we had one
      // For now, just clear everything and let the old system re-initialize
      const plantTypes = await ctx.db.query("plantTypes").collect();
      
      for (const plantType of plantTypes) {
        await ctx.db.delete(plantType._id);
      }
      
      return {
        success: true,
        message: "Rollback completed. Please re-run the old plant initialization.",
      };
    } catch (error) {
      return {
        success: false,
        message: "Rollback failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// Clean up function to remove plants with invalid references
export const cleanupInvalidPlants = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🧹 Cleaning up invalid plants...");
    
    const plants = await ctx.db.query("plants").collect();
    const plantTypes = await ctx.db.query("plantTypes").collect();
    const validPlantTypeIds = new Set(plantTypes.map(pt => pt._id));
    
    let cleanedCount = 0;
    
    for (const plant of plants) {
      // Skip ultra mushrooms and special plants
      if (plant.plantTypeId === "ultra_mushroom" || typeof plant.plantTypeId === "string") {
        continue;
      }
      
      // Remove plants with invalid plantTypeId references
      if (!validPlantTypeIds.has(plant.plantTypeId)) {
        await ctx.db.delete(plant._id);
        cleanedCount++;
      }
    }
    
    return {
      success: true,
      message: `Cleaned up ${cleanedCount} invalid plants`,
      cleanedCount,
    };
  },
});

// Delete plants in small batches
export const resetPlants = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🌱 Deleting plants batch...");
    const plants = await ctx.db.query("plants").take(50);
    
    for (const plant of plants) {
      await ctx.db.delete(plant._id);
    }
    
    return {
      deleted: plants.length,
      hasMore: plants.length === 50,
    };
  },
});

// Delete activities in small batches
export const resetActivities = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🏃‍♂️ Deleting activities batch...");
    const activities = await ctx.db.query("activities").take(50);
    
    for (const activity of activities) {
      await ctx.db.delete(activity._id);
    }
    
    return {
      deleted: activities.length,
      hasMore: activities.length === 50,
    };
  },
});

// Delete gardens and plant types (small collections)
export const resetGardensAndPlantTypes = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🏡 Deleting gardens and plant types...");
    
    const gardens = await ctx.db.query("gardenLayout").take(100);
    const plantTypes = await ctx.db.query("plantTypes").take(200);
    
    for (const garden of gardens) {
      await ctx.db.delete(garden._id);
    }
    
    for (const plantType of plantTypes) {
      await ctx.db.delete(plantType._id);
    }
    
    return {
      gardensDeleted: gardens.length,
      plantTypesDeleted: plantTypes.length,
    };
  },
});

// Reset user profiles
export const resetUserProfiles = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("👤 Resetting user profiles...");
    const profiles = await ctx.db.query("userProfiles").take(50);
    
    for (const profile of profiles) {
      await ctx.db.patch(profile._id, {
        totalDistance: 0,
        totalWorkouts: 0,
        totalCalories: 0,
        unlockedPlantTypes: [],
        updatedAt: new Date().toISOString(),
      });
    }
    
    return {
      profilesReset: profiles.length,
    };
  },
});

// Orchestrator function - call this to start the reset process
export const resetAllData = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🔥 Starting complete data reset orchestration...");
    
    // Just start the process and return immediately
    // The UI will need to call the individual reset functions multiple times
    return {
      success: true,
      message: "Reset process initiated. Use individual reset functions to complete.",
      instructions: [
        "Call resetPlants() repeatedly until hasMore = false",
        "Call resetActivities() repeatedly until hasMore = false", 
        "Call resetGardensAndPlantTypes() once",
        "Call resetUserProfiles() once"
      ]
    };
  },
});

// Query to get current data counts before reset
export const getDataCounts = query({
  args: {},
  handler: async (ctx) => {
    const plants = await ctx.db.query("plants").collect();
    const activities = await ctx.db.query("activities").collect();
    const gardens = await ctx.db.query("gardenLayout").collect();
    const plantTypes = await ctx.db.query("plantTypes").collect();
    const profiles = await ctx.db.query("userProfiles").collect();
    
    return {
      plants: plants.length,
      activities: activities.length,
      gardens: gardens.length,
      plantTypes: plantTypes.length,
      profiles: profiles.length,
      total: plants.length + activities.length + gardens.length + plantTypes.length,
    };
  },
});
