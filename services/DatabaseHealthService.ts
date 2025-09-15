import { ConvexReactClient } from "convex/react";
import { api } from '../convex/_generated/api';
import { Doc } from '../convex/_generated/dataModel';
import HealthService, { RunningActivity } from './HealthService';

// Use proper Convex types instead of custom interfaces
type DatabaseActivity = Doc<"activities">;
type UserProfile = Doc<"userProfiles">;

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  deleted?: number; // Number of deleted activities
  lastSyncDate: string;
  distanceGained?: number;
  coinsGained?: number; // Coins gained from new activities
  leveledUp?: boolean;
  newLevel?: number;
  oldLevel?: number;
  plantsAwarded?: number; // Plants awarded during sync
  newAnchor?: string; // For efficient syncing
}

class DatabaseHealthService {
  private convexClient: ConvexReactClient;
  private backgroundSubscription: (() => void) | string | null = null;

  constructor(convexClient: ConvexReactClient) {
    this.convexClient = convexClient;
  }

  /**
   * Initialize HealthKit permissions
   */
  async initializeHealthKit(): Promise<boolean> {
    return HealthService.initializeHealthKit();
  }

  /**
   * Check if we have the required HealthKit permissions
   */
  async hasRequiredPermissions(): Promise<boolean> {
    return HealthService.hasRequiredPermissions();
  }

  /**
   * Initial sync from HealthKit with proper celebration marking for old activities
   */
  async initialSyncFromHealthKit(days: number = 365): Promise<SyncResult> {
    try {
      console.log('[DatabaseHealthService] Starting initial HealthKit sync...');
      
      // Determine if this is the initial sync
      const profile = await this.getUserProfile();
      const initialSync = !(profile && (profile as any).healthKitInitialSyncCompleted);
      console.log(`[DatabaseHealthService] Initial sync detected: ${initialSync}`);
      
      // Get activities for current year only
      const currentYear = new Date().getFullYear();
      const startOfYear = new Date(currentYear, 0, 1);
      const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);
      
      const { activities, newAnchor, deletedActivities } = await HealthService.getRunningActivitiesWithAnchor(days);
      
      // Filter activities to current year only
      const currentYearActivities = activities.filter(activity => {
        const activityDate = new Date(activity.startDate);
        return activityDate >= startOfYear && activityDate <= endOfYear;
      });
      
      console.log(`[DatabaseHealthService] Retrieved ${currentYearActivities.length} activities from ${currentYear}, ${deletedActivities.length} deleted`);
      
      if (currentYearActivities.length === 0) {
        // Mark initial sync as completed even if no activities
        if (initialSync) {
          try {
            await this.convexClient.mutation(api.userProfile.updateProfile, {
              healthKitInitialSyncCompleted: true,
            });
            console.log('[DatabaseHealthService] Marked HealthKit initial sync as completed (no activities)');
          } catch (profileError) {
            console.warn('[DatabaseHealthService] Failed to mark initial sync completed (auth issue):', profileError);
            // Don't throw - we can still return a successful result
          }
        }
        
        return {
          created: 0,
          updated: 0,
          skipped: 0,
          lastSyncDate: new Date().toISOString(),
          distanceGained: 0,
          plantsAwarded: 0,
          newAnchor
        };
      }

      // Transform to database format
      const activitiesForDb = currentYearActivities.map((activity: RunningActivity) => ({
        healthKitUuid: activity.uuid,
        startDate: activity.startDate,
        endDate: activity.endDate,
        duration: activity.duration,
        distance: activity.distance,
        calories: activity.calories,
        averageHeartRate: activity.averageHeartRate,
        workoutName: activity.workoutName,
      }));

      console.log(`[DatabaseHealthService] Initial syncing ${activitiesForDb.length} activities to database`);

      // Use the plant-awarding mutation for initial sync
      const syncResult = await this.convexClient.mutation(api.activities.syncActivitiesFromHealthKitWithPlants, {
        activities: activitiesForDb,
        deletedUuids: deletedActivities,
      });

      // Mark initial sync as completed (only if we actually had activities to sync)
      if (initialSync && syncResult.created > 0) {
        try {
          await this.convexClient.mutation(api.userProfile.updateProfile, {
            healthKitInitialSyncCompleted: true,
          });
          console.log('[DatabaseHealthService] Marked HealthKit initial sync as completed (with activities)');
        } catch (profileError) {
          console.warn('[DatabaseHealthService] Failed to mark initial sync completed (auth issue), but sync was successful:', profileError);
          // Don't throw - the sync itself was successful, just the profile update failed
        }
      }

      console.log(`[DatabaseHealthService] Initial sync completed:`, syncResult);

      return {
        ...syncResult,
        lastSyncDate: new Date().toISOString(),
        newAnchor,
      };

    } catch (error) {
      console.error('[DatabaseHealthService] Error during initial sync:', error);
      throw error;
    }
  }

  /**
   * Sync activities from HealthKit to database with plant awarding
   */
  async syncActivitiesFromHealthKit(days: number = 30, anchor?: string): Promise<SyncResult> {
    try {
      console.log('[DatabaseHealthService] Starting HealthKit sync...');
      
      // Determine if this is the initial sync
      const profile = await this.getUserProfile();
      const initialSync = !(profile?.healthKitInitialSyncCompleted);
      console.log(`[DatabaseHealthService] Initial sync detected: ${initialSync}`);
      
      // Get activities with anchor for efficient syncing
      const { activities, newAnchor, deletedActivities } = await HealthService.getRunningActivitiesWithAnchor(days, anchor);
      
      console.log(`[DatabaseHealthService] Retrieved ${activities.length} activities, ${deletedActivities.length} deleted`);
      
      // Log first few activities for debugging
      if (activities.length > 0) {
        console.log('[DatabaseHealthService] Sample activities:', activities.slice(0, 3).map(a => ({
          uuid: a.uuid.substring(0, 8),
          distance: a.distance,
          duration: a.duration,
          workoutName: a.workoutName
        })));
      }
      
      if (activities.length === 0 && deletedActivities.length === 0) {
        console.log('[DatabaseHealthService] No new or deleted activities found');
        return {
          created: 0,
          updated: 0,
          skipped: 0,
          lastSyncDate: new Date().toISOString(),
          distanceGained: 0,
          leveledUp: false,
          newAnchor
        };
      }

      // Transform to database format
      const activitiesForDb = activities.map((activity: RunningActivity) => ({
        healthKitUuid: activity.uuid,
        startDate: activity.startDate,
        endDate: activity.endDate,
        duration: activity.duration,
        distance: activity.distance,
        calories: activity.calories,
        averageHeartRate: activity.averageHeartRate,
        workoutName: activity.workoutName,
      }));

      console.log(`[DatabaseHealthService] Syncing ${activitiesForDb.length} activities to database`);

      // Use the plant-awarding mutation for initial sync
      const syncResult = await this.convexClient.mutation(api.activities.syncActivitiesFromHealthKitWithPlants, {
        activities: activitiesForDb,
        deletedUuids: deletedActivities,
      });

      // Mark initial sync as completed if this was initial sync
      if (initialSync) {
        try {
          await this.convexClient.mutation(api.userProfile.updateProfile, {
            healthKitInitialSyncCompleted: true,
          });
          console.log('[DatabaseHealthService] Marked HealthKit initial sync as completed');
        } catch (profileError) {
          console.warn('[DatabaseHealthService] Failed to mark initial sync completed (auth issue), but sync was successful:', profileError);
          // Don't throw - the sync itself was successful, just the profile update failed
          // This can happen due to timing issues with authentication
        }
      }

      console.log('[DatabaseHealthService] Sync completed:', syncResult);
      return {
        ...syncResult,
        lastSyncDate: new Date().toISOString(),
        newAnchor
      };
    } catch (error) {
      console.error('Error syncing activities from HealthKit:', error);
      throw error;
    }
  }

  /**
   * Force sync from HealthKit with plant awarding (for manual sync button)
   */
  async forceSyncFromHealthKitWithPlants(days: number = 30): Promise<SyncResult> {
    return this.syncActivitiesFromHealthKit(days);
  }

  /**
   * Enable auto-sync by subscribing to HealthKit changes and enabling background delivery
   */
  async enableAutoSync(): Promise<boolean> {
    try {
      console.log('[DatabaseHealthService] Enabling auto-sync...');
      
      // First ensure we have permissions
      const hasPermissions = await this.hasRequiredPermissions();
      if (!hasPermissions) {
        console.log('[DatabaseHealthService] Auto-sync requires HealthKit permissions');
        return false;
      }

      // Enable background delivery for HealthKit data
      const backgroundDeliveryEnabled = await HealthService.enableBackgroundDelivery();
      if (backgroundDeliveryEnabled) {
        console.log('[DatabaseHealthService] Background delivery enabled successfully');
      } else {
        console.warn('[DatabaseHealthService] Background delivery could not be enabled, but continuing with auto-sync');
      }
      
      // Set up background subscription for real-time updates
      try {
        this.backgroundSubscription = HealthService.subscribeToWorkoutChanges(async () => {
          console.log('[DatabaseHealthService] Auto-sync triggered by HealthKit change');
          try {
            // Get the user's stored anchor for efficient syncing
            const profile = await this.getUserProfile();
            const anchor = profile?.healthKitSyncAnchor;
            
            // Sync new data
            const syncResult = await this.syncActivitiesFromHealthKit(30, anchor);
            
            // Update the stored anchor
            if (syncResult.newAnchor) {
              await this.convexClient.mutation(api.userProfile.updateSyncPreferences, {
                healthKitSyncAnchor: syncResult.newAnchor,
                lastHealthKitSync: new Date().toISOString()
              });
            }

            console.log('[DatabaseHealthService] Auto-sync completed:', syncResult);
          } catch (error) {
            console.error('[DatabaseHealthService] Auto-sync error:', error);
          }
        });
        console.log('[DatabaseHealthService] Background subscription set up successfully');
      } catch (subscriptionError) {
        console.warn('[DatabaseHealthService] Background subscription failed, but auto-sync is still enabled:', subscriptionError);
      }

      console.log('[DatabaseHealthService] Auto-sync enabled - will sync via background delivery and app state changes');
      return true;
    } catch (error) {
      console.error('[DatabaseHealthService] Error enabling auto-sync:', error);
      return false;
    }
  }

  /**
   * Disable auto-sync
   */
  async disableAutoSync(): Promise<void> {
    console.log('[DatabaseHealthService] Disabling auto-sync...');
    
    // Disable background subscription
    if (this.backgroundSubscription) {
      if (typeof this.backgroundSubscription === 'function') {
        this.backgroundSubscription();
      }
      this.backgroundSubscription = null;
    }
    
    // Disable background delivery
    try {
      await HealthService.disableBackgroundDelivery();
      console.log('[DatabaseHealthService] Background delivery disabled');
    } catch (error) {
      console.warn('[DatabaseHealthService] Error disabling background delivery:', error);
    }
  }

  /**
   * Get user profile from database
   */
  async getUserProfile(): Promise<UserProfile | null> {
    try {
      return await this.convexClient.query(api.userProfile.getOrCreateProfile);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }

  /**
   * Get activities from database
   */
  async getActivitiesFromDatabase(days: number = 30, limit: number = 100): Promise<DatabaseActivity[]> {
    try {
      const year = new Date().getFullYear();
      return await this.convexClient.query(api.activities.getUserActivitiesForYear, {
        year,
        limit
      });
    } catch (error) {
      console.error('Error fetching activities from database:', error);
      throw error;
    }
  }

  /**
   * Sync activities if enabled (for app lifecycle events)
   */
  async syncActivitiesIfEnabled(days: number = 30): Promise<SyncResult | null> {
    const profile = await this.getUserProfile();
    
    if (profile?.healthKitSyncEnabled) {
      return this.syncActivitiesFromHealthKit(days, profile.healthKitSyncAnchor);
    }
    
    return null;
  }

  /**
   * Get activities with optional sync (for display purposes)
   */
  async getActivitiesWithOptionalSync(days: number = 30): Promise<DatabaseActivity[]> {
    // Simply return activities from database since auto-sync handles real-time updates
    return this.getActivitiesFromDatabase(days, 100);
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.disableAutoSync();
    HealthService.cleanup();
  }
}

export default DatabaseHealthService;