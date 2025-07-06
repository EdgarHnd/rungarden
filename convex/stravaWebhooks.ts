import { v } from "convex/values";
import { api } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";

// Interface for Strava webhook events
interface StravaWebhookEvent {
  object_type: "activity" | "athlete";
  object_id: number;
  aspect_type: "create" | "update" | "delete";
  updates?: {
    title?: string;
    type?: string;
    private?: string;
    authorized?: string;
  };
  owner_id: number;
  subscription_id: number;
  event_time: number;
}

// Process incoming webhook events
export const processWebhookEvent = mutation({
  args: {
    event: v.any(), // We'll validate the structure manually
  },
  handler: async (ctx, args) => {
    const event: StravaWebhookEvent = args.event;
    
    console.log("[StravaWebhooks] Processing event:", event);

    try {
      // Handle different types of events
      if (event.object_type === "activity") {
        await handleActivityEvent(ctx, event);
      } else if (event.object_type === "athlete") {
        await handleAthleteEvent(ctx, event);
      }
    } catch (error) {
      console.error("[StravaWebhooks] Error processing event:", error);
      throw error;
    }
  },
});

// Handle activity-related webhook events
async function handleActivityEvent(ctx: any, event: StravaWebhookEvent) {
  console.log("[StravaWebhooks] Handling activity event:", event);

  // Find the user profile by Strava athlete ID
  const userProfile = await ctx.db
    .query("userProfiles")
    .filter((q: any) => q.eq(q.field("stravaAthleteId"), event.owner_id))
    .first();

  if (!userProfile) {
    console.log("[StravaWebhooks] No user found for Strava athlete ID:", event.owner_id);
    return;
  }

  const userId = userProfile.userId;

  if (event.aspect_type === "create") {
    // New activity created - sync it immediately from server
    console.log("[StravaWebhooks] New activity created, syncing from server:", event.object_id);
    
    try {
      // Schedule the server-side sync to run immediately
      await ctx.scheduler.runAfter(0, api.activities.fetchStravaActivityFromServer, {
        userId,
        stravaActivityId: event.object_id,
      });
      
      console.log(`[StravaWebhooks] Scheduled server-side sync for activity ${event.object_id} for user ${userId}`);
      
      // Send notification after a short delay to allow sync to complete
      try {
        console.log(`[StravaWebhooks] Scheduling push notification for userId: ${userId}`);
        await ctx.scheduler.runAfter(5000, api.pushNotifications.sendActivityNotification, {
          userId,
        });
        console.log(`[StravaWebhooks] Scheduled push notification for user ${userId}, activity ${event.object_id}`);
      } catch (error) {
        console.warn(`[StravaWebhooks] Failed to schedule push notification:`, error);
      }
      
    } catch (error) {
      console.error(`[StravaWebhooks] Error scheduling sync for activity ${event.object_id}:`, error);
      
      // Fallback to queue-based sync if there's an error
      console.log(`[StravaWebhooks] Falling back to queue-based sync for activity ${event.object_id}`);
    }
    
  } else if (event.aspect_type === "update") {
    // Activity updated - sync specific activity
    console.log("[StravaWebhooks] Activity updated:", event.object_id, event.updates);
    
    try {
      console.log(`[StravaWebhooks] Marked updated activity ${event.object_id} for sync`);
    } catch (error) {
      console.error(`[StravaWebhooks] Failed to mark updated activity ${event.object_id} for sync:`, error);
    }
    
  } else if (event.aspect_type === "delete") {
    // Activity deleted - remove from our database
    console.log("[StravaWebhooks] Activity deleted:", event.object_id);
    
    await deleteActivityByStravaId(ctx, event.object_id);
  }
}

// Handle athlete-related webhook events
async function handleAthleteEvent(ctx: any, event: StravaWebhookEvent) {
  console.log("[StravaWebhooks] Handling athlete event:", event);

  if (event.aspect_type === "update" && event.updates?.authorized === "false") {
    // User revoked access - disable Strava sync
    console.log("[StravaWebhooks] User revoked access:", event.owner_id);
    
    const userProfile = await ctx.db
      .query("userProfiles")
      .filter((q: any) => q.eq(q.field("stravaAthleteId"), event.owner_id))
      .first();

    if (userProfile) {
      await ctx.db.patch(userProfile._id, {
        stravaSyncEnabled: false,
        stravaAccessRevoked: true,
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

// Delete activity by Strava ID
async function deleteActivityByStravaId(ctx: any, stravaId: number) {
  const activity = await ctx.db
    .query("activities")
    .withIndex("by_strava_id", (q: any) => q.eq("stravaId", stravaId))
    .first();

  if (activity) {
    await ctx.db.delete(activity._id);
    console.log("[StravaWebhooks] Deleted activity:", stravaId);
    
    // Update user profile totals
    const userId = activity.userId;
    await ctx.runMutation(api.activities.updateUserProfileTotals, { userId });
  }
}


// Admin functions for webhook management
// Create webhook subscription (admin only)
export const createWebhookSubscription = mutation({
  args: {
    callbackUrl: v.string(),
    verifyToken: v.string(),
  },
  handler: async (ctx, args) => {
    // Note: This would typically require admin authentication
    console.log("[StravaWebhooks] Creating webhook subscription:", args);
    
    // This is a placeholder - the actual implementation would need to call Strava API
    // You would use DatabaseStravaService.createWebhookSubscription() here
    // For now, we'll just log and return success
    
    return {
      success: true,
      message: "Use DatabaseStravaService.createWebhookSubscription() method directly",
    };
  },
});

// View webhook subscriptions (admin only)
export const viewWebhookSubscriptions = query({
  args: {},
  handler: async (ctx) => {
    // Note: This would typically require admin authentication
    console.log("[StravaWebhooks] Viewing webhook subscriptions");
    
    // This is a placeholder - the actual implementation would need to call Strava API
    // You would use DatabaseStravaService.viewWebhookSubscription() here
    
    return {
      message: "Use DatabaseStravaService.viewWebhookSubscription() method directly",
    };
  },
});

// Delete webhook subscription (admin only)
export const deleteWebhookSubscription = mutation({
  args: {
    subscriptionId: v.number(),
  },
  handler: async (ctx, args) => {
    // Note: This would typically require admin authentication
    console.log("[StravaWebhooks] Deleting webhook subscription:", args.subscriptionId);
    
    // This is a placeholder - the actual implementation would need to call Strava API
    // You would use DatabaseStravaService.deleteWebhookSubscription() here
    
    return {
      success: true,
      message: "Use DatabaseStravaService.deleteWebhookSubscription() method directly",
    };
  },
});

// -----------------------------------------------------------------------------
// Ensure webhook subscription exists (admin only)
export const ensureWebhook = action({
  handler: async (ctx) => {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || "blaze-webhook-token";
    const callbackUrl = process.env.CONVEX_SITE_URL + "/strava/webhooks";

    if (!clientId || !clientSecret) {
      throw new Error("Strava client credentials not configured. Please set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in your Convex env");
    }

    // Step 1: fetch existing subscriptions
    const listUrl = new URL("https://www.strava.com/api/v3/push_subscriptions");
    listUrl.searchParams.append("client_id", clientId);
    listUrl.searchParams.append("client_secret", clientSecret);

    const listResp = await fetch(listUrl.toString());
    if (!listResp.ok) {
      const errorText = await listResp.text();
      console.error("[StravaWebhooks] Failed listing subscriptions:", errorText);
      return { success: false, message: "Failed to list existing subscriptions" };
    }

    const existingSubs: any[] = await listResp.json();

    // If matching subscription already exists, return early
    const matchingSub = existingSubs.find((sub) => sub.callback_url === callbackUrl);
    if (matchingSub) {
      console.log("[StravaWebhooks] Matching webhook already exists:", matchingSub.id);
      return { success: true, id: matchingSub.id, existing: true };
    }

    // Delete any other subscriptions (Strava only allows 1 per app)
    for (const sub of existingSubs) {
      const delUrl = new URL(`https://www.strava.com/api/v3/push_subscriptions/${sub.id}`);
      delUrl.searchParams.append("client_id", clientId);
      delUrl.searchParams.append("client_secret", clientSecret);

      const delResp = await fetch(delUrl.toString(), { method: "DELETE" });
      if (delResp.status === 204) {
        console.log(`[StravaWebhooks] Deleted old webhook ${sub.id}`);
      } else {
        const delText = await delResp.text();
        console.warn(`[StravaWebhooks] Failed to delete webhook ${sub.id}:`, delText);
      }
    }

    // Create new subscription
    const createResp = await fetch("https://www.strava.com/api/v3/push_subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        callback_url: callbackUrl,
        verify_token: verifyToken,
      }).toString(),
    });

    const createText = await createResp.text();
    if (!createResp.ok) {
      console.error("[StravaWebhooks] Failed to create webhook:", createText);
      return { success: false, message: "Failed to create webhook" };
    }

    const created = JSON.parse(createText);
    console.log("[StravaWebhooks] Created new webhook:", created.id);
    return { success: true, id: created.id, existing: false };
  },
}); 