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

  /**
   * Create a Strava webhook subscription
   * This should only be called once per application
   */
  async createWebhookSubscription(callbackUrl: string, verifyToken: string): Promise<{ id: number } | null> {
    try {
      // Get Strava credentials from environment (same as StravaService)
      const clientId = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID;
      const clientSecret = process.env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        throw new Error('Strava client credentials not configured. Please set EXPO_PUBLIC_STRAVA_CLIENT_ID and EXPO_PUBLIC_STRAVA_CLIENT_SECRET');
      }

      console.log('[DatabaseStravaService] Creating webhook with:', {
        clientId: `${clientId.substring(0, 4)}...${clientId.substring(clientId.length - 4)}`,
        clientSecret: `${clientSecret.substring(0, 4)}...***`,
        callbackUrl,
        verifyToken
      });

      const response = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          callback_url: callbackUrl,
          verify_token: verifyToken,
        }),
      });

      const responseText = await response.text();
      console.log('[DatabaseStravaService] Strava API response:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });

      if (!response.ok) {
        console.error('[DatabaseStravaService] Failed to create webhook subscription:', responseText);
        return null;
      }

      const result = JSON.parse(responseText);
      console.log('[DatabaseStravaService] Webhook subscription created:', result);
      return result;
    } catch (error) {
      console.error('[DatabaseStravaService] Error creating webhook subscription:', error);
      return null;
    }
  }

  /**
   * View existing webhook subscription
   */
  async viewWebhookSubscription(): Promise<any> {
    try {
      const clientId = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID;
      const clientSecret = process.env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        throw new Error('Strava client credentials not configured. Please set EXPO_PUBLIC_STRAVA_CLIENT_ID and EXPO_PUBLIC_STRAVA_CLIENT_SECRET');
      }

      const url = new URL('https://www.strava.com/api/v3/push_subscriptions');
      url.searchParams.append('client_id', clientId);
      url.searchParams.append('client_secret', clientSecret);

      const response = await fetch(url.toString());

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DatabaseStravaService] Failed to view webhook subscription:', errorText);
        return null;
      }

      const result = await response.json();
      console.log('[DatabaseStravaService] Current webhook subscriptions:', result);
      return result;
    } catch (error) {
      console.error('[DatabaseStravaService] Error viewing webhook subscription:', error);
      return null;
    }
  }

  /**
   * Delete webhook subscription
   */
  async deleteWebhookSubscription(subscriptionId: number): Promise<boolean> {
    try {
      const clientId = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID;
      const clientSecret = process.env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        throw new Error('Strava client credentials not configured. Please set EXPO_PUBLIC_STRAVA_CLIENT_ID and EXPO_PUBLIC_STRAVA_CLIENT_SECRET');
      }

      const url = new URL(`https://www.strava.com/api/v3/push_subscriptions/${subscriptionId}`);
      url.searchParams.append('client_id', clientId);
      url.searchParams.append('client_secret', clientSecret);

      const response = await fetch(url.toString(), {
        method: 'DELETE',
      });

      if (response.status === 204) {
        console.log('[DatabaseStravaService] Webhook subscription deleted successfully');
        return true;
      } else {
        const errorText = await response.text();
        console.error('[DatabaseStravaService] Failed to delete webhook subscription:', errorText);
        return false;
      }
    } catch (error) {
      console.error('[DatabaseStravaService] Error deleting webhook subscription:', error);
      return false;
    }
  }

  /**
   * Store Strava athlete ID and tokens in user profile for webhook matching and server-side operations
   */
  async storeStravaAthleteId(userId: string): Promise<void> {
    try {
      const athlete = await StravaService.getAthlete();
      
      if (athlete && athlete.id) {
        // Get current tokens from secure storage
        const tokens = await this.getStoredTokens();
        
        await this.convexClient.mutation(api.userProfile.updateSyncPreferences, {
          stravaAthleteId: athlete.id,
          stravaAccessToken: tokens.accessToken,
          stravaRefreshToken: tokens.refreshToken,
          stravaTokenExpiresAt: tokens.expiresAt,
        });
        
        console.log(`[DatabaseStravaService] Stored Strava athlete ID ${athlete.id} and tokens for user ${userId}`);
      }
    } catch (error) {
      console.error('[DatabaseStravaService] Error storing Strava athlete ID and tokens:', error);
      throw error;
    }
  }

  /**
   * Get stored Strava tokens from secure storage
   */
  private async getStoredTokens(): Promise<{
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }> {
    try {
      // Import SecureStore dynamically since it's React Native specific
      const SecureStore = await import('expo-secure-store');
      
      const [accessToken, refreshToken, expiresAt] = await Promise.all([
        SecureStore.getItemAsync('strava_access_token'),
        SecureStore.getItemAsync('strava_refresh_token'),
        SecureStore.getItemAsync('strava_expires_at'),
      ]);

      return {
        accessToken: accessToken || undefined,
        refreshToken: refreshToken || undefined,
        expiresAt: expiresAt ? parseInt(expiresAt) : undefined,
      };
    } catch (error) {
      console.error('[DatabaseStravaService] Error getting stored tokens:', error);
      return {};
    }
  }

  /**
   * Create webhook with current Convex deployment URL
   */
  async createWebhook(): Promise<boolean> {
    try {
      // Use the current Convex site URL
      const callbackUrl = 'https://fast-dragon-309.convex.site/strava/webhooks';
      const verifyToken = 'koko-webhook-token';
      
      // First check if there are existing subscriptions
      console.log('[DatabaseStravaService] Checking for existing webhook subscriptions...');
      const existingSubscriptions = await this.viewWebhookSubscription();
      
      if (existingSubscriptions && existingSubscriptions.length > 0) {
        console.log(`[DatabaseStravaService] Found ${existingSubscriptions.length} existing subscriptions`);
        
        // Check if any of them have the same callback URL
        const matchingSubscription = existingSubscriptions.find((sub: any) => sub.callback_url === callbackUrl);
        
        if (matchingSubscription) {
          console.log(`[DatabaseStravaService] Found existing subscription with matching URL: ${matchingSubscription.id}`);
          return true; // Already have the correct webhook
        }
        
        // Only delete if we have a different callback URL
        console.log('[DatabaseStravaService] Deleting subscriptions with different callback URLs...');
        for (const sub of existingSubscriptions) {
          const deleted = await this.deleteWebhookSubscription(sub.id);
          if (deleted) {
            console.log(`[DatabaseStravaService] Deleted subscription ${sub.id}`);
          } else {
            console.warn(`[DatabaseStravaService] Failed to delete subscription ${sub.id}`);
            throw new Error(`Failed to delete existing subscription ${sub.id}`);
          }
        }
      }
      
      // Now create the new subscription
      console.log('[DatabaseStravaService] Creating new webhook subscription...');
      const result = await this.createWebhookSubscription(callbackUrl, verifyToken);
      
      if (result && result.id) {
        console.log(`[DatabaseStravaService] Successfully created webhook with ID: ${result.id}`);
        return true;
      } else {
        console.error('[DatabaseStravaService] Failed to create webhook - no ID returned');
        return false;
      }
    } catch (error) {
      console.error('[DatabaseStravaService] Error creating webhook:', error);
      return false;
    }
  }
}

export default DatabaseStravaService; 