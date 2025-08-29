import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { action } from "./_generated/server";

/**
 * Mutation: exchange OAuth authorization code for Strava tokens.
 * The client obtains `code` via the Strava OAuth redirect and calls this
 * mutation. We keep the client secret safely on the server.
 */
export const exchangeCode = action({
  args: {
    code: v.string(),
  },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Strava client credentials not configured in Convex env");
    }

    // Exchange the code for tokens
    const resp = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("[stravaAuth.exchangeCode] Token exchange failed:", txt);
      throw new Error("Strava token exchange failed");
    }

    const tokens = await resp.json();
    console.log("[stravaAuth.exchangeCode] Received tokens for user", userId);

    // Persist tokens in user profile
    await ctx.runMutation(api.userProfile.updateSyncPreferences, {
      stravaAccessToken: tokens.access_token,
      stravaRefreshToken: tokens.refresh_token,
      stravaTokenExpiresAt: tokens.expires_at,
      stravaAthleteId: tokens.athlete?.id ? Number(tokens.athlete.id) : undefined,
      stravaSyncEnabled: true,
      stravaInitialSyncCompleted: false,
    });

    // Note: Initial sync can be triggered manually by user in garden app

    return { success: true };
  },
}); 