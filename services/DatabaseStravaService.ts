import { ConvexReactClient } from "convex/react";
import { api } from '../convex/_generated/api';
import StravaService, { RunningActivity } from './StravaService';

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

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  lastSyncDate: string;
  distanceGained?: number;
  coinsGained?: number;
  leveledUp?: boolean;
  newLevel?: number;
  oldLevel?: number;
  newRuns?: any[]; // Track newly created activities
}

class DatabaseStravaService {
  private convexClient: ConvexReactClient;

  constructor(convexClient: ConvexReactClient) {
    this.convexClient = convexClient;
  }

  /**
   * Check if user is authenticated with Strava
   */
  async isAuthenticated(): Promise<boolean> {
    return StravaService.isAuthenticated();
  }

  /**
   * Authenticate with Strava
   */
  async authenticate(): Promise<boolean> {
    return StravaService.authenticate();
  }

  /**
   * Disconnect from Strava
   */
  async disconnect(): Promise<void> {
    await StravaService.disconnect();
    
    // Also update the user profile to disable Strava sync
    try {
      await this.convexClient.mutation(api.userProfile.updateSyncPreferences, {
        stravaSyncEnabled: false,
        lastStravaSync: null,
      });
    } catch (error) {
      console.error('Error updating Strava sync preference after disconnect:', error);
    }
  }

  /**
   * Get athlete information from Strava
   */
  async getAthlete() {
    try {
      return await StravaService.getAthlete();
    } catch (error) {
      console.error('Error fetching Strava athlete:', error);
      throw error;
    }
  }

  /**
   * Sync activities from Strava to database
   */
  async syncActivitiesFromStrava(days: number = 30): Promise<SyncResult> {
    try {
      // Check if user is authenticated
      const isAuth = await this.isAuthenticated();
      if (!isAuth) {
        throw new Error('Not authenticated with Strava');
      }

      // Get fresh data from Strava
      const stravaActivities = await StravaService.getRunningActivities(days);
      
      if (stravaActivities.length === 0) {
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
      const activitiesForDb = stravaActivities.map((activity: RunningActivity) => {
        // Extract Strava ID from UUID (format: "strava_<id>")
        const stravaId = parseInt(activity.uuid.replace('strava_', ''));
        
        return {
          stravaId,
          startDate: activity.startDate,
          endDate: activity.endDate,
          duration: activity.duration,
          distance: activity.distance,
          calories: activity.calories,
          averageHeartRate: activity.averageHeartRate,
          workoutName: activity.workoutName,
        };
      });

      // Sync to database
      const syncResult = await this.convexClient.mutation(
        api.activities.syncActivitiesFromStrava,
        { activities: activitiesForDb }
      );

      console.log('[DatabaseStravaService] Sync completed:', syncResult);
      return {
        ...syncResult,
        lastSyncDate: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error syncing activities from Strava:', error);
      throw error;
    }
  }

  /**
   * Force sync - useful for manual refresh
   */
  async forceSyncFromStrava(days: number = 30): Promise<SyncResult> {
    console.log('[DatabaseStravaService] Force syncing from Strava...');
    return this.syncActivitiesFromStrava(days);
  }

  /**
   * Check if Strava sync is enabled for the user
   */
  async isSyncEnabled(): Promise<boolean> {
    try {
      const profile = await this.convexClient.query(api.userProfile.getOrCreateProfile);
      return profile?.stravaSyncEnabled ?? false;
    } catch (error) {
      console.error('Error checking Strava sync status:', error);
      return false;
    }
  }

  /**
   * Enable or disable Strava sync
   */
  async setSyncEnabled(enabled: boolean): Promise<void> {
    try {
      await this.convexClient.mutation(api.userProfile.updateSyncPreferences, {
        stravaSyncEnabled: enabled,
        lastStravaSync: enabled ? undefined : null,
      });
      console.log(`[DatabaseStravaService] Strava sync ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating Strava sync preference:', error);
      throw error;
    }
  }

  /**
   * Sync activities only if Strava sync is enabled
   */
  async syncActivitiesIfEnabled(days: number = 30): Promise<SyncResult | null> {
    const isEnabled = await this.isSyncEnabled();
    if (!isEnabled) {
      console.log('[DatabaseStravaService] Strava sync is disabled, skipping sync');
      return null;
    }
    
    const isAuth = await this.isAuthenticated();
    if (!isAuth) {
      console.log('[DatabaseStravaService] Not authenticated with Strava, skipping sync');
      return null;
    }
    
    return this.syncActivitiesFromStrava(days);
  }

  /**
   * Get Strava activities from database (filtered by source)
   */
  async getStravaActivitiesFromDatabase(days: number = 30, limit: number = 30): Promise<DatabaseActivity[]> {
    try {
      console.log(`[DatabaseStravaService] Fetching Strava activities for ${days} days with limit ${limit}`);
      
      // Get all activities first, then filter by source
      const allActivities = await this.convexClient.query(api.activities.getUserActivities, {
        days,
        limit: limit * 2, // Get more since we'll filter
      });
      
      // Filter for Strava activities only
      const stravaActivities = allActivities.filter(activity => activity.source === 'strava');
      
      console.log(`[DatabaseStravaService] Fetched ${stravaActivities.length} Strava activities from database`);
      return stravaActivities.slice(0, limit) as DatabaseActivity[];
    } catch (error) {
      console.error('Error fetching Strava activities from database:', error);
      throw error;
    }
  }

  /**
   * Get Strava athlete stats
   */
  async getAthleteStats() {
    try {
      return await StravaService.getAthleteStats();
    } catch (error) {
      console.error('Error fetching Strava athlete stats:', error);
      throw error;
    }
  }
}

export default DatabaseStravaService; 