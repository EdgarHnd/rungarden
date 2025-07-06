import { ConvexReactClient } from "convex/react";
import { api } from '../convex/_generated/api';
import StravaService from './StravaService';

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
    try {
      const profile = await this.convexClient.query(api.userProfile.getOrCreateProfile);
      return !!profile?.stravaSyncEnabled;
    } catch (error) {
      return false;
    }
  }

  /**
   * Sync tokens from local SecureStore to database
   */
  private async syncTokensToDatabase(): Promise<void> {
    try {
      const tokens = await this.getStoredTokens();
      
      if (!tokens.accessToken || !tokens.refreshToken || !tokens.expiresAt) {
        return;
      }

      // Get athlete info to also store athlete ID
      const athlete = await StravaService.getAthlete();
      
      await this.convexClient.mutation(api.userProfile.updateSyncPreferences, {
        stravaAccessToken: tokens.accessToken,
        stravaRefreshToken: tokens.refreshToken,
        stravaTokenExpiresAt: tokens.expiresAt,
        stravaAthleteId: athlete?.id,
      });

    } catch (error) {
    }
  }

  /**
   * Sync tokens from database to local SecureStore (for when tokens are refreshed server-side)
   */
  private async syncTokensFromDatabase(): Promise<void> {
    try {
      const profile = await this.convexClient.query(api.userProfile.getOrCreateProfile);
      
      if (!profile || !profile.stravaAccessToken || !profile.stravaRefreshToken || !profile.stravaTokenExpiresAt) {
        return;
      }

      // Import SecureStore dynamically since it's React Native specific
      const SecureStore = await import('expo-secure-store');
      
      await Promise.all([
        SecureStore.setItemAsync('strava_access_token', profile.stravaAccessToken),
        SecureStore.setItemAsync('strava_refresh_token', profile.stravaRefreshToken),
        SecureStore.setItemAsync('strava_expires_at', profile.stravaTokenExpiresAt.toString()),
      ]);

    } catch (error) {
      console.error('[DatabaseStravaService] Error syncing tokens from database:', error);
    }
  }

  /**
   * Authenticate with Strava
   */
  async authenticate(): Promise<boolean> {
    try {
      const success = await StravaService.authenticate(this.convexClient);
      
      // Backend already stored tokens and enabled sync

      return success;
    } catch (error) {
      console.error('[DatabaseStravaService] Error during authentication:', error);
      return false;
    }
  }

  /**
   * Disconnect from Strava
   */
  async disconnect(): Promise<void> {
    await StravaService.disconnect();
    
    // Also update the user profile to disable Strava sync and clear tokens
    try {
      await this.convexClient.mutation(api.userProfile.updateSyncPreferences, {
        stravaSyncEnabled: false,
        lastStravaSync: null,
        stravaInitialSyncCompleted: false, // Reset so they can get initial sync modal again if they reconnect
        stravaAccessToken: undefined,
        stravaRefreshToken: undefined,
        stravaTokenExpiresAt: undefined,
        stravaAthleteId: undefined,
        stravaAccessRevoked: true,
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
  async syncActivitiesFromStrava(days: number = 30, isRetry = false): Promise<SyncResult> {
    try {
      // Call server-side full sync
      const result = await this.convexClient.action(api.activities.fullStravaSyncServer, { days });
      return result;
    } catch (error) {
      console.error('Error syncing activities from Strava:', error);
      throw error;
    }
  }

  /**
   * Force sync - useful for manual refresh
   */
  async forceSyncFromStrava(days: number = 30): Promise<SyncResult> {
    return this.syncActivitiesFromStrava(days, false);
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

      if (!response.ok) {
        console.error('[DatabaseStravaService] Failed to create webhook subscription:', responseText);
        return null;
      }

      const result = JSON.parse(responseText);
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
        
      }
    } catch (error) {
      console.error('[DatabaseStravaService] Error storing Strava athlete ID and tokens:', error);
      throw error;
    }
  }

  /**
   * Proactively refresh tokens if they're close to expiring
   */
  async ensureValidTokens(): Promise<boolean> {
    try {
      const profile = await this.convexClient.query(api.userProfile.getOrCreateProfile);
      
      if (!profile || !profile.stravaTokenExpiresAt) {
        return false;
      }

      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = profile.stravaTokenExpiresAt - now;
      
      // If tokens expire in less than 30 minutes, refresh them
      if (timeUntilExpiry < 1800) {
        
        // Try to refresh using local tokens first
        const localRefreshed = await StravaService.refreshAccessToken();
        if (localRefreshed) {
          // Sync the refreshed tokens to database
          await this.syncTokensToDatabase();
          return true;
        }
        
        // If local refresh failed, the server-side refresh will handle it on next API call
      }

      return true;
    } catch (error) {
      console.error('[DatabaseStravaService] Error ensuring valid tokens:', error);
      return false;
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
      // Delegate webhook management to backend for better security
      const result = await this.convexClient.action(api.stravaWebhooks.ensureWebhook, {});

      return !!(result && result.success);
    } catch (error) {
      console.error('[DatabaseStravaService] Error creating webhook:', error);
      return false;
    }
  }

  /**
   * Debug method to check authentication status and token info
   */
  async debugAuthenticationStatus(): Promise<{
    localAuth: boolean;
    localTokens: {
      hasAccessToken: boolean;
      hasRefreshToken: boolean;
      expiresAt?: number;
      isExpired?: boolean;
      timeUntilExpiry?: number;
    };
    dbAuth: boolean;
    dbTokens: {
      hasAccessToken: boolean;
      hasRefreshToken: boolean;
      expiresAt?: number;
      isExpired?: boolean;
      timeUntilExpiry?: number;
      stravaSyncEnabled?: boolean;
      stravaAthleteId?: number;
    };
  }> {
    const now = Math.floor(Date.now() / 1000);
    
    // Check local authentication
    const localAuth = await StravaService.isAuthenticated();
    const localTokens = await this.getStoredTokens();
    
    // Check database authentication
    let dbAuth = false;
    let dbTokenInfo = {
      hasAccessToken: false,
      hasRefreshToken: false,
      expiresAt: undefined as number | undefined,
      isExpired: undefined as boolean | undefined,
      timeUntilExpiry: undefined as number | undefined,
      stravaSyncEnabled: false as boolean | undefined,
      stravaAthleteId: undefined as number | undefined,
    };
    
    try {
      const profile = await this.convexClient.query(api.userProfile.getOrCreateProfile);
      if (profile) {
        dbAuth = !!(profile.stravaSyncEnabled && profile.stravaAccessToken && profile.stravaRefreshToken);
        dbTokenInfo = {
          hasAccessToken: !!profile.stravaAccessToken,
          hasRefreshToken: !!profile.stravaRefreshToken,
          expiresAt: profile.stravaTokenExpiresAt,
          isExpired: profile.stravaTokenExpiresAt ? profile.stravaTokenExpiresAt <= now : undefined,
          timeUntilExpiry: profile.stravaTokenExpiresAt ? profile.stravaTokenExpiresAt - now : undefined,
          stravaSyncEnabled: profile.stravaSyncEnabled,
          stravaAthleteId: profile.stravaAthleteId,
        };
      }
    } catch (error) {
      console.error('[DatabaseStravaService] Error checking database auth:', error);
    }
    
    const localTokenInfo = {
      hasAccessToken: !!localTokens.accessToken,
      hasRefreshToken: !!localTokens.refreshToken,
      expiresAt: localTokens.expiresAt,
      isExpired: localTokens.expiresAt ? localTokens.expiresAt <= now : undefined,
      timeUntilExpiry: localTokens.expiresAt ? localTokens.expiresAt - now : undefined,
    };
    
    const debugInfo = {
      localAuth,
      localTokens: localTokenInfo,
      dbAuth,
      dbTokens: dbTokenInfo,
    };
    
    return debugInfo;
  }

  /**
   * Reset/clear all Strava authentication data (for debugging/recovery)
   */
  async resetAuthentication(): Promise<void> {
    
    try {
      // Clear local tokens
      await StravaService.disconnect();
      
      // Clear database tokens
      await this.convexClient.mutation(api.userProfile.updateSyncPreferences, {
        stravaSyncEnabled: false,
        stravaInitialSyncCompleted: false, // Reset so they can get initial sync modal again if they reconnect
        stravaAccessToken: undefined,
        stravaRefreshToken: undefined,
        stravaTokenExpiresAt: undefined,
        stravaAthleteId: undefined,
        stravaAccessRevoked: true,
        lastStravaSync: null,
      });
      
    } catch (error) {
      console.error('[DatabaseStravaService] Error resetting authentication:', error);
      throw error;
    }
  }
}

export default DatabaseStravaService; 