import { v } from "convex/values";
import { api } from "./_generated/api";
import { mutation, query } from "./_generated/server";

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
          activityData: {
            workoutName: "🎉 Congrats! New run completed - check it out!",
            distance: 5000, // Dummy data for notification structure
            duration: 30, // Dummy data for notification structure
            type: "run",
          },
        });
        console.log(`[StravaWebhooks] Scheduled push notification for user ${userId}, activity ${event.object_id}`);
      } catch (error) {
        console.warn(`[StravaWebhooks] Failed to schedule push notification:`, error);
      }
      
    } catch (error) {
      console.error(`[StravaWebhooks] Error scheduling sync for activity ${event.object_id}:`, error);
      
      // Fallback to queue-based sync if there's an error
      console.log(`[StravaWebhooks] Falling back to queue-based sync for activity ${event.object_id}`);
      await markUserForStravaSync(ctx, userId, event.object_id);
    }
    
  } else if (event.aspect_type === "update") {
    // Activity updated - sync specific activity
    console.log("[StravaWebhooks] Activity updated:", event.object_id, event.updates);
    
    try {
      await markUserForStravaSync(ctx, userId, event.object_id);
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

// Mark user for Strava sync (we'll create a pending sync queue)
async function markUserForStravaSync(ctx: any, userId: string, activityId?: number) {
  const now = new Date().toISOString();
  
  // Check if there's already a pending sync for this user
  const existingSync = await ctx.db
    .query("stravaSyncQueue")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .filter((q: any) => q.eq(q.field("status"), "pending"))
    .first();

  if (existingSync) {
    // Update existing sync with new activity ID if provided
    const activityIds = existingSync.activityIds || [];
    if (activityId && !activityIds.includes(activityId)) {
      activityIds.push(activityId);
      await ctx.db.patch(existingSync._id, {
        activityIds,
        updatedAt: now,
      });
    }
  } else {
    // Create new sync request
    await ctx.db.insert("stravaSyncQueue", {
      userId,
      activityIds: activityId ? [activityId] : [],
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  }

  // Send push notification for new activity (with 5 second delay to allow sync to complete first)
  if (activityId) {
    try {
      // Removed duplicate notification - this is handled in handleActivityEvent
      console.log(`[StravaWebhooks] Activity ${activityId} queued for sync for user ${userId}`);
    } catch (error) {
      console.warn(`[StravaWebhooks] Failed to queue activity ${activityId} for sync:`, error);
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

// Get pending Strava syncs for a user
export const getPendingStravaSyncs = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("stravaSyncQueue")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
  },
});

// Mark sync as completed
export const markSyncCompleted = mutation({
  args: {
    syncId: v.id("stravaSyncQueue"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.syncId, {
      status: "completed",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },
});

// Get all pending syncs (for background processing)
export const getAllPendingSyncs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("stravaSyncQueue")
      .filter((q) => q.eq(q.field("status"), "pending"))
      .order("desc")
      .take(20); // Limit to 20 for performance
  },
});

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