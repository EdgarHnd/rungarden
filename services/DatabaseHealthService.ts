import { ConvexReactClient } from "convex/react";
import { api } from '../convex/_generated/api';
import HealthService, { RunningActivity } from './HealthService';

export interface DatabaseActivity {
  _id: string;
  userId: string;
  source?: 'healthkit' | 'strava';
  healthKitUuid?: string;
  stravaId?: number;
  startDate: string;
  endDate: string;
  duration: number;
  distance: number;
  calories: number;
  averageHeartRate?: number;
  workoutName?: string;
  pace?: number;
  syncedAt: string;
  createdAt: string;
}

export interface UserProfile {
  _id?: string;
  userId: string;
  weeklyGoal: number;
  totalDistance: number;
  totalWorkouts: number;
  totalCalories: number;
  lastSyncDate?: string;
  level: number;
  coins?: number; // Coins earned from running (1 coin per km)
  weekStartDay?: number; // 0 = Sunday, 1 = Monday
  // Sync preferences
  healthKitSyncEnabled?: boolean; // Whether HealthKit sync is enabled
  stravaSyncEnabled?: boolean; // Whether Strava sync is enabled
  lastHealthKitSync?: string; // Last HealthKit sync timestamp
  lastStravaSync?: string; // Last Strava sync timestamp
  createdAt: string;
  updatedAt: string;
}

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  lastSyncDate: string;
  distanceGained?: number;
  coinsGained?: number; // Coins gained from new activities
  leveledUp?: boolean;
  newLevel?: number;
  oldLevel?: number;
}

class DatabaseHealthService {
  private convexClient: ConvexReactClient;

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
   * Get activities from database (cached)
   */
  async getActivitiesFromDatabase(days: number = 30, limit: number = 30): Promise<DatabaseActivity[]> {
    try {
      console.log(`[DatabaseHealthService] Fetching activities for ${days} days with limit ${limit}`);
      const activities = await this.convexClient.query(api.activities.getUserActivities, {
        days,
        limit,
      });
      console.log(`[DatabaseHealthService] Fetched ${activities.length} activities from database`);
      return activities as DatabaseActivity[];
    } catch (error) {
      console.error('Error fetching activities from database:', error);
      throw error;
    }
  }

  /**
   * Sync activities from HealthKit to database
   */
  async syncActivitiesFromHealthKit(days: number = 30): Promise<SyncResult> {
    try {
      // Get fresh data from HealthKit
      const healthKitActivities = await HealthService.getRunningActivities(days);
      
      if (healthKitActivities.length === 0) {
        return {
          created: 0,
          updated: 0,
          skipped: 0,
          lastSyncDate: new Date().toISOString(),
          distanceGained: 0,
          leveledUp: false,
        };
      }

      // Transform to database format
      const activitiesForDb = healthKitActivities.map((activity: RunningActivity) => ({
        healthKitUuid: activity.uuid,
        startDate: activity.startDate,
        endDate: activity.endDate,
        duration: activity.duration,
        distance: activity.distance,
        calories: activity.calories,
        averageHeartRate: activity.averageHeartRate,
        workoutName: activity.workoutName,
      }));

      // Sync to database
      const syncResult = await this.convexClient.mutation(
        api.activities.syncActivitiesFromHealthKit,
        { activities: activitiesForDb }
      );

      console.log('[DatabaseHealthService] Sync completed:', syncResult);
      return {
        ...syncResult,
        lastSyncDate: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error syncing activities from HealthKit:', error);
      throw error;
    }
  }

  /**
   * Force sync - useful for manual refresh
   */
  async forceSyncFromHealthKit(days: number = 30): Promise<SyncResult> {
    console.log('[DatabaseHealthService] Force syncing from HealthKit...');
    return this.syncActivitiesFromHealthKit(days);
  }

  /**
   * Convert database activities to the format expected by existing components
   */
  formatActivitiesForLegacyComponents(dbActivities: DatabaseActivity[]): RunningActivity[] {
    return dbActivities.map(activity => ({
      uuid: activity.healthKitUuid || `strava_${activity.stravaId}` || activity._id,
      startDate: activity.startDate,
      endDate: activity.endDate,
      duration: activity.duration,
      distance: activity.distance,
      calories: activity.calories,
      averageHeartRate: activity.averageHeartRate,
      workoutName: activity.workoutName,
    }));
  }

  /**
   * Get user profile from database
   */
  async getUserProfile(): Promise<UserProfile> {
    try {
      const profile = await this.convexClient.query(api.userProfile.getOrCreateProfile);
      return profile as UserProfile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }

  /**
   * Check if HealthKit sync is enabled for the user
   */
  async isHealthKitSyncEnabled(): Promise<boolean> {
    try {
      const profile = await this.getUserProfile();
      return profile.healthKitSyncEnabled ?? false;
    } catch (error) {
      console.error('Error checking HealthKit sync status:', error);
      return false;
    }
  }



  /**
   * Enable or disable HealthKit sync
   */
  async setHealthKitSyncEnabled(enabled: boolean): Promise<void> {
    try {
      await this.convexClient.mutation(api.userProfile.updateSyncPreferences, {
        healthKitSyncEnabled: enabled,
        lastHealthKitSync: enabled ? undefined : null, // Clear sync timestamp when disabling
      });
      console.log(`[DatabaseHealthService] HealthKit sync ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating HealthKit sync preference:', error);
      throw error;
    }
  }



  /**
   * Sync activities only if HealthKit sync is enabled
   */
  async syncActivitiesIfEnabled(days: number = 30): Promise<SyncResult | null> {
    const isEnabled = await this.isHealthKitSyncEnabled();
    if (!isEnabled) {
      console.log('[DatabaseHealthService] HealthKit sync is disabled, skipping sync');
      return null;
    }
    
    return this.syncActivitiesFromHealthKit(days);
  }

  /**
   * Get activities from database (auto-sync is now handled via webhooks for Strava)
   */
  async getActivitiesWithOptionalSync(days: number = 30): Promise<DatabaseActivity[]> {
    // Simply return activities from database since webhooks handle real-time sync
    return this.getActivitiesFromDatabase(days, 100);
  }
}

export default DatabaseHealthService; 