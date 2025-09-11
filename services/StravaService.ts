import { ConvexReactClient } from 'convex/react';
import * as SecureStore from 'expo-secure-store';
import { openAuthSessionAsync } from 'expo-web-browser';
import { api } from '../convex/_generated/api';

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

class StravaService {
  private static readonly CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID || 'your_strava_client_id';
  private static readonly CLIENT_SECRET = process.env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET || 'your_strava_client_secret';
  private static readonly API_BASE_URL = 'https://www.strava.com/api/v3';
  private static readonly AUTH_URL = 'https://www.strava.com/oauth/authorize';
  private static readonly MOBILE_AUTH_URL = 'https://www.strava.com/oauth/mobile/authorize';
  private static readonly TOKEN_URL = 'https://www.strava.com/oauth/token';
  private static readonly APP_DOMAIN = 'www.rungarden.app';
  
  private static readonly SECURE_STORE_KEYS = {
    ACCESS_TOKEN: 'strava_access_token',
    REFRESH_TOKEN: 'strava_refresh_token',
    EXPIRES_AT: 'strava_expires_at',
    SCOPE: 'strava_scope',
  };

  // We temporarily store the convex client used for the current auth attempt
  private static _convex: ConvexReactClient | null = null;

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
   * Authenticate with Strava using OAuth 2.0 Web Flow
   */
  static async authenticate(convexClient: ConvexReactClient): Promise<boolean> {
    try {
      const redirectUri = 'rungarden://' + this.APP_DOMAIN;
      const scope = 'read,activity:read_all';
      
      // Save convex client so handleOAuthCallback can use it
      this._convex = convexClient;
      
      console.log('[StravaService] Starting web OAuth authentication...');
      
      // Use web OAuth for reliable authentication
      const webOAuthUrl = `${this.AUTH_URL}?client_id=${this.CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&approval_prompt=auto&scope=${scope}`;
      
      console.log('[StravaService] Web OAuth URL:', webOAuthUrl);
      
      const result = await openAuthSessionAsync(webOAuthUrl, redirectUri);
      
      console.log('[StravaService] Web auth result:', result);
      
      if (result.type === 'success' && result.url) {
        return await this.handleOAuthCallback(result.url);
      }
      
      console.log('[StravaService] Authentication cancelled or failed');
      return false;
      
    } catch (error) {
      console.error('[StravaService] Error during authentication:', error);
      return false;
    }
  }
  
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
        return false;
      }
      
      if (code) {
        console.log('[StravaService] Received authorization code');
        // Send the code to backend to exchange for tokens securely
        if (!this._convex) throw new Error('Convex client missing');
        const res = await this._convex.action(api.stravaAuth.exchangeCode, { code });
        return !!res?.success;
      }
      
      console.log('[StravaService] No code received in callback');
      return false;
      
    } catch (error) {
      console.error('[StravaService] Error processing OAuth callback:', error);
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
  static async refreshAccessToken(): Promise<boolean> {
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
}

export default StravaService; 