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
    activityData: v.optional(v.object({
      distance: v.number(),
      duration: v.number(),
      calories: v.number(),
      startDate: v.string(),
      plantEmoji: v.optional(v.string()),
      plantName: v.optional(v.string()),
    })),
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

      // Create notification message
      // Always use a simple congrats message for new activities
      const title = "🎉 Congrats!";
      const body = "New run completed - check it out!";

      const message: ExpoPushMessage = {
        to: profile.pushNotificationToken,
        title,
        body,
        sound: 'default',
        data: {
          type: 'new_activity',
          action: 'open_celebration',
          activityData: args.activityData,
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

// Send push notification for new friend request
export const sendFriendRequestNotification = action({
  args: {
    toUserId: v.string(),
    fromName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      // Fetch recipient profile
      const profile = await ctx.runQuery(api.userProfile.getProfileByUserId, { userId: args.toUserId as any });

      if (!profile || !profile.pushNotificationsEnabled || !profile.pushNotificationToken) {
        return { success: false, reason: "Push notifications not enabled or no token" };
      }

      const title = "👋 New Friend Request";
      const body = args.fromName ? `${args.fromName} sent you a friend request!` : "You have a new friend request!";

      const message: ExpoPushMessage = {
        to: profile.pushNotificationToken,
        title,
        body,
        sound: 'default',
        data: { type: 'friend_request', url: `/add-friend` },
        badge: 1,
        channelId: 'friends',
        priority: 'high',
      };

      const result = await sendExpoPushNotification([message]);
      return result;
    } catch (error) {
      console.error('[PushNotifications] Error sending friend request notification:', error);
      return { success: false, error: (error as Error).message };
    }
  },
});

// Notify sender when friend request accepted
export const sendFriendAcceptNotification = action({
  args: {
    toUserId: v.string(),
    friendName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const profile = await ctx.runQuery(api.userProfile.getProfileByUserId, { userId: args.toUserId as any });

      if (!profile || !profile.pushNotificationsEnabled || !profile.pushNotificationToken) {
        return { success: false, reason: "Push notifications not enabled or no token" };
      }

      const title = "🤝 Friend Request Accepted";
      const body = args.friendName ? `${args.friendName} accepted your friend request!` : "Your friend request was accepted!";

      const message: ExpoPushMessage = {
        to: profile.pushNotificationToken,
        title,
        body,
        sound: 'default',
        data: { type: 'friend_request_accepted' },
        badge: 1,
        channelId: 'friends',
        priority: 'high',
      };

      const result = await sendExpoPushNotification([message]);
      return result;
    } catch (error) {
      console.error('[PushNotifications] Error sending friend accept notification:', error);
      return { success: false, error: (error as Error).message };
    }
  },
});

// Send simple schedule reminder notification
export const sendSimpleScheduleReminder = action({
  args: {
    userId: v.string(),
    dayName: v.string(), // "Mon", "Tue", etc.
    runsPerWeek: v.number(),
  },
  handler: async (ctx, args) => {
    try {
      // Get user's push notification settings
      const profile = await ctx.runQuery(api.userProfile.getProfileByUserId, { userId: args.userId as any });

      if (!profile || !profile.pushNotificationsEnabled || !profile.pushNotificationToken) {
        console.log(`[PushNotifications] User ${args.userId} doesn't have push notifications enabled or no token`);
        return { success: false, reason: "Push notifications not enabled or no token" };
      }

      // Create motivational reminder message
      const titles = [
        "🔥 Time to run!",
        "🏃‍♂️ Today's run day!",
        "💪 Training day!",
      ];
      
      const bodies = [
        `Ready for your ${args.dayName} run? Keep that flame burning! 🔥`,
        `${args.dayName} training day! Time to grow your garden! 🌱`,
        `Time for your ${args.dayName} run! ${args.runsPerWeek} runs this week = flame alive! 🏃‍♂️`,
        `${args.dayName} run day! Every run keeps your streak growing! 💪`,
        `Let's crush this ${args.dayName} workout! Your flame depends on it! 🔥`
      ];

      const title = titles[Math.floor(Math.random() * titles.length)];
      const body = bodies[Math.floor(Math.random() * bodies.length)];

      const message: ExpoPushMessage = {
        to: profile.pushNotificationToken,
        title,
        body,
        sound: 'default',
        data: {
          type: 'schedule_reminder',
          dayName: args.dayName,
          runsPerWeek: args.runsPerWeek,
        },
        badge: 1,
        channelId: 'schedule',
        priority: 'normal',
        ttl: 14400, // 4 hours - reminder expires after 4 hours
      };

      const result = await sendExpoPushNotification([message]);
      
      // ────────────── Schedule the next occurrence (1 week later)
      try {
        const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
        await ctx.scheduler.runAfter(ONE_WEEK_MS, api.pushNotifications.sendSimpleScheduleReminder, {
          userId: args.userId,
          dayName: args.dayName,
          runsPerWeek: args.runsPerWeek,
        });
        console.log(`[PushNotifications] Next ${args.dayName} reminder scheduled for user ${args.userId}`);
      } catch (scheduleError) {
        console.error('[PushNotifications] Failed to schedule next weekly reminder:', scheduleError);
      }
      
      if (result.success) {
        return { success: true, ticketId: result.tickets?.[0]?.id };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('[PushNotifications] Error sending schedule reminder:', error);
      return { success: false, error: (error as Error).message };
    }
  },
});

// Schedule notifications for simple training schedule
export const scheduleSimpleTrainingNotifications = action({
  args: {
    userId: v.string(),
    runsPerWeek: v.number(),
    preferredDays: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      console.log(`[PushNotifications] Scheduling notifications for user ${args.userId}`);

      const dayNameToNumber: Record<string, number> = {
        'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
      };

      const now = new Date();

      // Default reminder time: 9:00 AM local time
      const REMINDER_HOUR = 9;
      const REMINDER_MINUTE = 0;

      const scheduledDays: string[] = [];

      for (const dayName of args.preferredDays) {
        const targetDayNum = dayNameToNumber[dayName];
        if (targetDayNum === undefined) continue;

        // Calculate days until next occurrence of the target day
        let daysUntil = (targetDayNum - now.getDay() + 7) % 7;
        // If today is the day but it's already past the reminder time, schedule for next week
        const todayIsTarget = daysUntil === 0;
        const nowTimeMinutes = now.getHours() * 60 + now.getMinutes();
        const reminderTimeMinutes = REMINDER_HOUR * 60 + REMINDER_MINUTE;
        if (todayIsTarget && nowTimeMinutes >= reminderTimeMinutes) {
          daysUntil = 7;
        }

        const firstReminderDate = new Date(now);
        firstReminderDate.setDate(now.getDate() + daysUntil);
        firstReminderDate.setHours(REMINDER_HOUR, REMINDER_MINUTE, 0, 0);

        const delayMs = firstReminderDate.getTime() - now.getTime();
        if (delayMs < 0) continue; // safety check

        await ctx.scheduler.runAfter(delayMs, api.pushNotifications.sendSimpleScheduleReminder, {
          userId: args.userId,
          dayName,
          runsPerWeek: args.runsPerWeek,
        });

        scheduledDays.push(dayName);
        console.log(`[PushNotifications] Scheduled first reminder for ${dayName} in ${Math.round(delayMs/3600000)} hrs`);
      }

      return { 
        success: true, 
        message: `Notifications scheduled for ${scheduledDays.length} preferred days`,
        scheduledDays,
        runsPerWeek: args.runsPerWeek
      };
    } catch (error) {
      console.error('[PushNotifications] Error scheduling notifications:', error);
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

// Send push notification with activity data for celebration modal
export const sendActivityNotificationWithData = action({
  args: {
    userId: v.string(),
    stravaActivityId: v.number(),
  },
  handler: async (ctx, args): Promise<any> => {
    try {
      console.log(`[PushNotifications] Fetching activity data for notification: ${args.stravaActivityId}`);
      
      // Get the activity from database
      const activity: any = await ctx.runQuery(api.activities.getActivityByStravaId, {
        stravaId: args.stravaActivityId,
      });

      if (!activity) {
        console.log(`[PushNotifications] Activity not found: ${args.stravaActivityId}`);
        // Fallback to simple notification
        return ctx.runAction(api.pushNotifications.sendActivityNotification, {
          userId: args.userId,
        });
      }

      let plantData: any = null;
      
      // Get plant data if activity has a plant
      if (activity.plantEarned) {
        try {
          const plant: any = await ctx.runQuery(api.plants.getPlantById, {
            plantId: activity.plantEarned,
          });
          
          if (plant && plant.plantType) {
            plantData = {
              plantEmoji: plant.plantType.emoji,
              plantName: plant.plantType.name,
            };
          }
        } catch (error) {
          console.warn(`[PushNotifications] Could not fetch plant data:`, error);
        }
      }

      // Send notification with activity data
      return ctx.runAction(api.pushNotifications.sendActivityNotification, {
        userId: args.userId,
        activityData: {
          distance: activity.distance,
          duration: activity.duration,
          calories: activity.calories,
          startDate: activity.startDate,
          plantEmoji: plantData?.plantEmoji,
          plantName: plantData?.plantName,
        },
      });

    } catch (error) {
      console.error(`[PushNotifications] Error sending activity notification with data:`, error);
      // Fallback to simple notification
      return ctx.runAction(api.pushNotifications.sendActivityNotification, {
        userId: args.userId,
      });
    }
  }
});

// Test push notification
export const sendTestNotification = action({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    return await ctx.runAction(api.pushNotifications.sendActivityNotification, {
      userId: args.userId,
    });
  },
}); 