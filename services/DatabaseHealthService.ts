import { ConvexReactClient } from "convex/react";
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import HealthService, { HealthStats, RunningActivity } from './HealthService';
import LevelingService, { LevelInfo } from './LevelingService';

export interface DatabaseActivity {
  _id: string;
  userId: string;
  healthKitUuid: string;
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
  weekStartDay?: number; // 0 = Sunday, 1 = Monday
  createdAt: string;
  updatedAt: string;
}

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  lastSyncDate: string;
  distanceGained?: number;
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
   * Get user profile
   */
  async getUserProfile(): Promise<UserProfile | null> {
    try {
      const profile = await this.convexClient.query(api.userProfile.getOrCreateProfile);
      return profile as UserProfile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }

  /**
   * Get user's current level information
   */
  async getUserLevelInfo(): Promise<LevelInfo> {
    try {
      const profile = await this.getUserProfile();
      if (!profile) {
        // Return default level info for new users
        return LevelingService.calculateLevelInfo(0);
      }

      return LevelingService.calculateLevelInfo(profile.totalDistance);
    } catch (error) {
      console.error('Error fetching user level info:', error);
      throw error;
    }
  }

  /**
   * Update weekly goal
   */
  async updateWeeklyGoal(weeklyGoal: number): Promise<void> {
    try {
      await this.convexClient.mutation(api.userProfile.updateWeeklyGoal, {
        weeklyGoal,
      });
    } catch (error) {
      console.error('Error updating weekly goal:', error);
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
   * Get activities with automatic sync if needed
   */
  async getActivitiesWithAutoSync(days: number = 30): Promise<DatabaseActivity[]> {
    try {
      const profile = await this.getUserProfile();
      const now = new Date();
      const lastSync = profile?.lastSyncDate ? new Date(profile.lastSyncDate) : null;
      
      // Auto-sync if:
      // 1. Never synced before
      // 2. Last sync was more than 1 hour ago
      const shouldSync = !lastSync || 
        (now.getTime() - lastSync.getTime()) > (60 * 60 * 1000); // 1 hour

      if (shouldSync) {
        console.log('[DatabaseHealthService] Auto-syncing activities...');
        await this.syncActivitiesFromHealthKit(days);
      }

      // Return cached data from database
      return this.getActivitiesFromDatabase(days);
    } catch (error) {
      console.error('Error getting activities with auto-sync:', error);
      
      // Fallback to database data if sync fails
      try {
        return await this.getActivitiesFromDatabase(days);
      } catch (dbError) {
        console.error('Database fallback also failed:', dbError);
        throw error;
      }
    }
  }

  /**
   * Get activity statistics from database
   */
  async getActivityStats(days: number = 30): Promise<HealthStats> {
    try {
      const stats = await this.convexClient.query(api.activities.getActivityStats, {
        days,
      });
      
      return {
        totalDistance: stats.totalDistance,
        totalWorkouts: stats.totalWorkouts,
        averagePace: stats.averagePace,
        totalCalories: stats.totalCalories,
      };
    } catch (error) {
      console.error('Error fetching activity stats:', error);
      throw error;
    }
  }

  /**
   * Get current week's progress
   */
  async getCurrentWeekProgress() {
    try {
      return await this.convexClient.query(api.userProfile.getCurrentWeekProgress);
    } catch (error) {
      console.error('Error fetching week progress:', error);
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
   * Delete an activity
   */
  async deleteActivity(activityId: Id<"activities">): Promise<void> {
    try {
      await this.convexClient.mutation(api.activities.deleteActivity, {
        activityId,
      });
    } catch (error) {
      console.error('Error deleting activity:', error);
      throw error;
    }
  }

  /**
   * Check if sync is needed based on time elapsed
   */
  async isSyncNeeded(): Promise<boolean> {
    try {
      const profile = await this.getUserProfile();
      if (!profile?.lastSyncDate) return true;

      const lastSync = new Date(profile.lastSyncDate);
      const now = new Date();
      const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);
      
      return hoursSinceSync >= 1; // Sync if more than 1 hour
    } catch (error) {
      console.error('Error checking sync status:', error);
      return true; // Default to sync needed if error
    }
  }

  /**
   * Convert database activities to the format expected by existing components
   */
  formatActivitiesForLegacyComponents(dbActivities: DatabaseActivity[]): RunningActivity[] {
    return dbActivities.map(activity => ({
      uuid: activity.healthKitUuid,
      startDate: activity.startDate,
      endDate: activity.endDate,
      duration: activity.duration,
      distance: activity.distance,
      calories: activity.calories,
      averageHeartRate: activity.averageHeartRate,
      workoutName: activity.workoutName,
    }));
  }
}

export default DatabaseHealthService; 