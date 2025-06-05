import * as SecureStore from 'expo-secure-store';
import { openAuthSessionAsync } from 'expo-web-browser';
import { Linking } from 'react-native';

export interface StravaActivity {
  id: number;
  name: string;
  distance: number; // in meters
  moving_time: number; // in seconds
  elapsed_time: number; // in seconds
  total_elevation_gain: number;
  type: string;
  start_date: string;
  start_date_local: string;
  timezone: string;
  location_city?: string;
  location_state?: string;
  location_country?: string;
  achievement_count: number;
  kudos_count: number;
  comment_count: number;
  athlete_count: number;
  photo_count: number;
  trainer: boolean;
  commute: boolean;
  manual: boolean;
  private: boolean;
  flagged: boolean;
  gear_id?: string;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  kilojoules?: number;
}

export interface StravaAthlete {
  id: number;
  username?: string;
  resource_state: number;
  firstname: string;
  lastname: string;
  bio?: string;
  city?: string;
  state?: string;
  country?: string;
  sex?: string;
  premium: boolean;
  summit: boolean;
  created_at: string;
  updated_at: string;
  badge_type_id: number;
  weight?: number;
  profile_medium?: string;
  profile?: string;
  friend?: string;
  follower?: string;
}

export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string;
}

export interface RunningActivity {
  uuid: string;
  startDate: string;
  endDate: string;
  duration: number; // in minutes
  distance: number; // in meters
  calories: number;
  averageHeartRate?: number;
  workoutName?: string;
}

class StravaService {
  private static readonly CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID || 'your_strava_client_id';
  private static readonly CLIENT_SECRET = process.env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET || 'your_strava_client_secret';
  private static readonly API_BASE_URL = 'https://www.strava.com/api/v3';
  private static readonly AUTH_URL = 'https://www.strava.com/oauth/authorize';
  private static readonly MOBILE_AUTH_URL = 'https://www.strava.com/oauth/mobile/authorize';
  private static readonly TOKEN_URL = 'https://www.strava.com/oauth/token';
  private static readonly APP_DOMAIN = 'www.trykoko.app';
  
  private static readonly SECURE_STORE_KEYS = {
    ACCESS_TOKEN: 'strava_access_token',
    REFRESH_TOKEN: 'strava_refresh_token',
    EXPIRES_AT: 'strava_expires_at',
    SCOPE: 'strava_scope',
  };

  /**
   * Check if user is authenticated with Strava
   */
  static async isAuthenticated(): Promise<boolean> {
    try {
      const accessToken = await SecureStore.getItemAsync(this.SECURE_STORE_KEYS.ACCESS_TOKEN);
      const expiresAt = await SecureStore.getItemAsync(this.SECURE_STORE_KEYS.EXPIRES_AT);
      
      if (!accessToken || !expiresAt) {
        return false;
      }
      
      const now = Math.floor(Date.now() / 1000);
      return parseInt(expiresAt) > now;
    } catch (error) {
      console.error('[StravaService] Error checking authentication:', error);
      return false;
    }
  }

  /**
   * Authenticate with Strava using OAuth 2.0 Mobile Flow (similar to iOS implementation)
   */
  static async authenticate(): Promise<boolean> {
    try {
      const redirectUri = 'koko://' + this.APP_DOMAIN;
      const scope = 'read,activity:read_all';
      
      // Try to open Strava app first (like the iOS implementation)
      const appOAuthUrl = `strava://oauth/mobile/authorize?client_id=${this.CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&approval_prompt=auto&scope=${scope}`;
      
      console.log('[StravaService] Trying to open Strava app...');
      console.log('[StravaService] App OAuth URL:', appOAuthUrl);
      
      // Try to check if Strava app is available
      let canOpenStravaApp = false;
      try {
        canOpenStravaApp = await Linking.canOpenURL('strava://');
        console.log('[StravaService] Can open Strava app:', canOpenStravaApp);
      } catch (error) {
        console.log('[StravaService] Error checking Strava app availability:', error);
        canOpenStravaApp = false;
      }
      // TODO: Remove this
      //canOpenStravaApp = false;

      
      if (canOpenStravaApp) {
        console.log('[StravaService] Strava app is available, opening app...');
        
        // Listen for the redirect back to our app
        const handleUrl = (event: { url: string }) => {
          console.log('[StravaService] Received URL from Strava app:', event.url);
          this.handleOAuthCallback(event.url);
        };
        
        const subscription = Linking.addEventListener('url', handleUrl);
        
        try {
          await Linking.openURL(appOAuthUrl);
          
          // Return a promise that resolves when we get the callback
          return new Promise((resolve) => {
            const timeout = setTimeout(() => {
              subscription?.remove();
              console.log('[StravaService] Timeout waiting for Strava app callback');
              resolve(false);
            }, 60000); // 60 second timeout
            
            // Store the resolve function to call it when we get the callback
            this.authPromiseResolve = (success: boolean) => {
              clearTimeout(timeout);
              subscription?.remove();
              resolve(success);
            };
          });
          
        } catch (error) {
          subscription?.remove();
          throw error;
        }
        
      } else {
        console.log('[StravaService] Strava app not available, using web OAuth...');
        
        // Fall back to web OAuth using SFAuthenticationSession equivalent
        const webOAuthUrl = `${this.MOBILE_AUTH_URL}?client_id=${this.CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&approval_prompt=auto&scope=${scope}`;
        
        console.log('[StravaService] Web OAuth URL:', webOAuthUrl);
        
        const result = await openAuthSessionAsync(webOAuthUrl, redirectUri);
        
        console.log('[StravaService] Web auth result:', result);
        
        if (result.type === 'success' && result.url) {
          return await this.handleOAuthCallback(result.url);
        }
        
        return false;
      }
      
    } catch (error) {
      console.error('[StravaService] Error during authentication:', error);
      return false;
    }
  }
  
  private static authPromiseResolve: ((success: boolean) => void) | null = null;
  
  /**
   * Handle OAuth callback URL and extract authorization code
   */
  private static async handleOAuthCallback(callbackUrl: string): Promise<boolean> {
    try {
      console.log('[StravaService] Processing callback URL:', callbackUrl);
      
      const url = new URL(callbackUrl);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      
      if (error) {
        console.error('[StravaService] OAuth error:', error);
        if (this.authPromiseResolve) {
          this.authPromiseResolve(false);
          this.authPromiseResolve = null;
        }
        return false;
      }
      
      if (code) {
        console.log('[StravaService] Received authorization code');
        const success = await this.exchangeCodeForTokens(code);
        if (this.authPromiseResolve) {
          this.authPromiseResolve(success);
          this.authPromiseResolve = null;
        }
        return success;
      }
      
      console.log('[StravaService] No code received in callback');
      if (this.authPromiseResolve) {
        this.authPromiseResolve(false);
        this.authPromiseResolve = null;
      }
      return false;
      
    } catch (error) {
      console.error('[StravaService] Error processing OAuth callback:', error);
      if (this.authPromiseResolve) {
        this.authPromiseResolve(false);
        this.authPromiseResolve = null;
      }
      return false;
    }
  }

  /**
   * Exchange authorization code for access tokens
   */
  private static async exchangeCodeForTokens(code: string): Promise<boolean> {
    try {
      const response = await fetch(this.TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.CLIENT_ID,
          client_secret: this.CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
        }).toString(),
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status}`);
      }

      const tokens: StravaTokens = await response.json();
      
      await this.storeTokens(tokens);
      console.log('[StravaService] Successfully stored tokens');
      
      return true;
    } catch (error) {
      console.error('[StravaService] Error exchanging code for tokens:', error);
      return false;
    }
  }

  /**
   * Store tokens securely
   */
  private static async storeTokens(tokens: StravaTokens): Promise<void> {
    console.log('[StravaService] Storing tokens:', { 
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresAt: tokens.expires_at,
      scope: tokens.scope 
    });
    
    await Promise.all([
      SecureStore.setItemAsync(this.SECURE_STORE_KEYS.ACCESS_TOKEN, String(tokens.access_token)),
      SecureStore.setItemAsync(this.SECURE_STORE_KEYS.REFRESH_TOKEN, String(tokens.refresh_token)),
      SecureStore.setItemAsync(this.SECURE_STORE_KEYS.EXPIRES_AT, String(tokens.expires_at)),
      SecureStore.setItemAsync(this.SECURE_STORE_KEYS.SCOPE, String(tokens.scope)),
    ]);
  }

  /**
   * Get valid access token (refreshes if necessary)
   */
  private static async getValidAccessToken(): Promise<string | null> {
    try {
      const accessToken = await SecureStore.getItemAsync(this.SECURE_STORE_KEYS.ACCESS_TOKEN);
      const expiresAt = await SecureStore.getItemAsync(this.SECURE_STORE_KEYS.EXPIRES_AT);
      
      if (!accessToken || !expiresAt) {
        return null;
      }
      
      const now = Math.floor(Date.now() / 1000);
      const expirationTime = parseInt(expiresAt);
      
      // If token expires in less than 10 minutes, refresh it
      if (expirationTime - now < 600) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          return await SecureStore.getItemAsync(this.SECURE_STORE_KEYS.ACCESS_TOKEN);
        }
        return null;
      }
      
      return accessToken;
    } catch (error) {
      console.error('[StravaService] Error getting valid access token:', error);
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private static async refreshAccessToken(): Promise<boolean> {
    try {
      const refreshToken = await SecureStore.getItemAsync(this.SECURE_STORE_KEYS.REFRESH_TOKEN);
      
      if (!refreshToken) {
        return false;
      }
      
      const response = await fetch(this.TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.CLIENT_ID,
          client_secret: this.CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const tokens: StravaTokens = await response.json();
      
      await this.storeTokens(tokens);
      console.log('[StravaService] Successfully refreshed tokens');
      
      return true;
    } catch (error) {
      console.error('[StravaService] Error refreshing access token:', error);
      return false;
    }
  }

  /**
   * Make authenticated API request to Strava
   */
  private static async makeApiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const accessToken = await this.getValidAccessToken();
    
    if (!accessToken) {
      throw new Error('No valid access token available');
    }
    
    const response = await fetch(`${this.API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get authenticated athlete information
   */
  static async getAthlete(): Promise<StravaAthlete> {
    try {
      return await this.makeApiRequest<StravaAthlete>('/athlete');
    } catch (error) {
      console.error('[StravaService] Error fetching athlete:', error);
      throw error;
    }
  }

  /**
   * Get running activities from Strava (from January 1st, 2025)
   */
  static async getRunningActivities(days: number = 30): Promise<RunningActivity[]> {
    try {
      // Hardcode start date to January 1st, 2025 (same as HealthKit)
      const startDate = new Date(2025, 0, 1); // January 1st, 2025
      const after = Math.floor(startDate.getTime() / 1000);
      
      const activities = await this.makeApiRequest<StravaActivity[]>(
        `/athlete/activities?after=${after}&per_page=100`
      );

      // Filter for running activities and convert to our format
      const runningActivities = activities
        .filter(activity => 
          activity.type === 'Run' || 
          activity.type === 'TrailRun' ||
          activity.type === 'Treadmill'
        )
        .map((activity): RunningActivity => {
          const startDate = new Date(activity.start_date);
          const endDate = new Date(startDate.getTime() + activity.elapsed_time * 1000);
          
          return {
            uuid: `strava_${activity.id}`,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            duration: Math.round(activity.moving_time / 60), // Convert seconds to minutes
            distance: Math.round(activity.distance), // Already in meters
            calories: activity.calories || this.estimateCalories(activity.distance, activity.moving_time),
            averageHeartRate: activity.average_heartrate,
            workoutName: activity.name,
          };
        });

      console.log(`[StravaService] Fetched ${runningActivities.length} running activities`);
      return runningActivities;
    } catch (error) {
      console.error('[StravaService] Error fetching activities:', error);
      throw error;
    }
  }

  /**
   * Estimate calories if not provided by Strava
   * Basic estimation: ~0.75 calories per kg per km for running
   */
  private static estimateCalories(distance: number, duration: number): number {
    // Assume average weight of 70kg for estimation
    const averageWeight = 70;
    const distanceKm = distance / 1000;
    return Math.round(averageWeight * distanceKm * 0.75);
  }

  /**
   * Disconnect from Strava (remove stored tokens)
   */
  static async disconnect(): Promise<void> {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(this.SECURE_STORE_KEYS.ACCESS_TOKEN),
        SecureStore.deleteItemAsync(this.SECURE_STORE_KEYS.REFRESH_TOKEN),
        SecureStore.deleteItemAsync(this.SECURE_STORE_KEYS.EXPIRES_AT),
        SecureStore.deleteItemAsync(this.SECURE_STORE_KEYS.SCOPE),
      ]);
      console.log('[StravaService] Successfully disconnected');
    } catch (error) {
      console.error('[StravaService] Error disconnecting:', error);
      throw error;
    }
  }

  /**
   * Get athlete stats (similar to HealthService calculateHealthStats)
   */
  static async getAthleteStats(): Promise<{
    totalDistance: number;
    totalWorkouts: number;
    averagePace: number;
    totalCalories: number;
  }> {
    try {
      const activities = await this.getRunningActivities(); // Get all data from 2025
      
      if (activities.length === 0) {
        return {
          totalDistance: 0,
          totalWorkouts: 0,
          averagePace: 0,
          totalCalories: 0,
        };
      }

      const totalDistance = activities.reduce((sum, activity) => sum + activity.distance, 0);
      const totalCalories = activities.reduce((sum, activity) => sum + activity.calories, 0);
      const totalTime = activities.reduce((sum, activity) => sum + activity.duration, 0);

      // Calculate average pace in minutes per kilometer
      const averagePace = totalDistance > 0 ? (totalTime / (totalDistance / 1000)) : 0;

      return {
        totalDistance: Math.round(totalDistance),
        totalWorkouts: activities.length,
        averagePace: Math.round(averagePace * 10) / 10,
        totalCalories: Math.round(totalCalories),
      };
    } catch (error) {
      console.error('[StravaService] Error calculating stats:', error);
      throw error;
    }
  }
}

export default StravaService; 