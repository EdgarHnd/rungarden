import { v } from "convex/values";
import { api } from "./_generated/api";
import { action, internalMutation } from "./_generated/server";

// Expo Push Notification Types
interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: any;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  categoryId?: string;
  mutableContent?: boolean;
  priority?: 'default' | 'normal' | 'high';
  subtitle?: string;
  ttl?: number;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: any;
}

interface ExpoPushReceipt {
  status: 'ok' | 'error';
  message?: string;
  details?: any;
}

// Internal mutation to log notifications
export const logNotification = internalMutation({
  args: {
    userId: v.string(),
    type: v.string(),
    title: v.string(),
    body: v.string(),
    status: v.string(),
    sentAt: v.string(),
    expoPushTicket: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("pushNotificationLogs", args);
  },
});

// Send push notification for new Strava activity
export const sendActivityNotification = action({
  args: {
    userId: v.string(),
    activityData: v.object({
      workoutName: v.string(),
      distance: v.number(),
      duration: v.number(),
      type: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    try {
      // Get the specific user's profile using a query that accepts userId
      console.log(`[PushNotifications] Looking up profile for userId: ${args.userId}`);
      const profile = await ctx.runQuery(api.userProfile.getProfileByUserId, { userId: args.userId as any });

      console.log(`[PushNotifications] Found profile:`, {
        exists: !!profile,
        userId: profile?.userId,
        pushNotificationsEnabled: profile?.pushNotificationsEnabled,
        hasToken: !!profile?.pushNotificationToken,
        tokenLength: profile?.pushNotificationToken?.length
      });

      if (!profile || !profile.pushNotificationsEnabled || !profile.pushNotificationToken) {
        console.log(`[PushNotifications] User ${args.userId} doesn't have push notifications enabled or no token`);
        return { success: false, reason: "Push notifications not enabled or no token" };
      }

      const { activityData } = args;
      
      // Create notification message
      let title = "🎉 Congrats!";
      let body = "New run completed - check it out!";
      
      if (activityData.workoutName.includes("Congrats!")) {
        // Simple webhook notification - always use the simple message
        title = "🎉 Congrats!";
        body = "New run completed - check it out!";
      } else {
        // Detailed notification with data (for test notifications)
        const distanceKm = (activityData.distance / 1000).toFixed(2);
        const durationMin = Math.round(activityData.duration);
        
        title = "New Run Synced! 🏃‍♂️";
        body = activityData.workoutName 
          ? `${activityData.workoutName} - ${distanceKm}km in ${durationMin}min`
          : `${distanceKm}km run completed in ${durationMin}min`;
      }

      const message: ExpoPushMessage = {
        to: profile.pushNotificationToken,
        title,
        body,
        sound: 'default',
        data: {
          type: 'new_activity',
          action: 'open_celebration',
          activityData: {
            workoutName: activityData.workoutName,
            distance: activityData.distance,
            duration: activityData.duration,
            type: activityData.type,
          },
        },
        badge: 1,
        channelId: 'activities',
        priority: 'high',
        ttl: 3600, // 1 hour
      };

      // Send push notification
      const result = await sendExpoPushNotification([message]);
      
      if (result.success) {
        console.log(`[PushNotifications] Successfully sent notification to user ${args.userId}`);
        return { success: true, ticketId: result.tickets?.[0]?.id };
      } else {
        console.error(`[PushNotifications] Failed to send notification to user ${args.userId}:`, result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('[PushNotifications] Error sending activity notification:', error);
      return { success: false, error: (error as Error).message };
    }
  },
});

// Send achievement/milestone notification
export const sendAchievementNotification = action({
  args: {
    userId: v.string(),
    achievement: v.object({
      type: v.string(),
      title: v.string(),
      description: v.string(),
      emoji: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    try {
      // Get user's push notification settings
      const profile = await ctx.runQuery(api.userProfile.getOrCreateProfile, {});

      if (!profile || !profile.pushNotificationsEnabled || !profile.pushNotificationToken) {
        return { success: false, reason: "Push notifications not enabled or no token" };
      }

      const { achievement } = args;
      
      const message: ExpoPushMessage = {
        to: profile.pushNotificationToken,
        title: `${achievement.emoji || '🏆'} Achievement Unlocked!`,
        body: `${achievement.title} - ${achievement.description}`,
        sound: 'default',
        data: {
          type: 'achievement',
          achievementType: achievement.type,
        },
        badge: 1,
        channelId: 'achievements',
        priority: 'high',
        ttl: 86400, // 24 hours
      };

      const result = await sendExpoPushNotification([message]);
      
      if (result.success) {
        return { success: true, ticketId: result.tickets?.[0]?.id };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('[PushNotifications] Error sending achievement notification:', error);
      return { success: false, error: (error as Error).message };
    }
  },
});

// Helper function to send push notifications via Expo
async function sendExpoPushNotification(messages: ExpoPushMessage[]): Promise<{
  success: boolean;
  tickets?: ExpoPushTicket[];
  error?: string;
}> {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PushNotifications] Expo API error:', response.status, errorText);
      return { success: false, error: `Expo API error: ${response.status} ${errorText}` };
    }

    const result = await response.json();
    
    // Check if all tickets are OK
    const hasErrors = result.data?.some((ticket: ExpoPushTicket) => ticket.status === 'error');
    
    if (hasErrors) {
      const errorTickets = result.data.filter((ticket: ExpoPushTicket) => ticket.status === 'error');
      console.error('[PushNotifications] Some push notifications failed:', errorTickets);
    }

    return {
      success: !hasErrors,
      tickets: result.data,
      error: hasErrors ? 'Some notifications failed' : undefined,
    };
  } catch (error) {
    console.error('[PushNotifications] Network error sending push notification:', error);
    return { success: false, error: (error as Error).message };
  }
}

// Test push notification
export const sendTestNotification = action({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    return await ctx.runAction(api.pushNotifications.sendActivityNotification, {
      userId: args.userId,
      activityData: {
        workoutName: "Test Run",
        distance: 5000, // 5km
        duration: 25, // 25 minutes
        type: "run",
      },
    });
  },
}); 