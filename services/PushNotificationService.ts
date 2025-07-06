import { api } from '@/convex/_generated/api';
import { ConvexReactClient } from 'convex/react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Type definitions for notifications (for when expo-notifications is available)
interface NotificationPermissions {
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
}

interface ExpoPushToken {
  data: string;
  type: string;
}

interface NotificationContent {
  title?: string;
  body?: string;
  data?: any;
}

interface NotificationRequest {
  content: NotificationContent;
}

interface Notification {
  request: NotificationRequest;
}

interface NotificationResponse {
  notification: Notification;
}

interface NotificationSubscription {
  remove: () => void;
}

// Lazy load expo-notifications to handle cases where it's not installed
let Notifications: any = null;
let Device: any = null;

try {
  // Try to import expo-notifications and expo-device
  Notifications = require('expo-notifications');
  Device = require('expo-device');

  // Configure notification behavior if available
  if (Notifications?.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
} catch (error) {
  console.log('[PushNotifications] expo-notifications not available:', error);
}

export interface PushNotificationPermissions {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
}

export class PushNotificationService {
  private convex: ConvexReactClient;

  constructor(convex: ConvexReactClient) {
    this.convex = convex;
  }

  /**
   * Check if push notifications are supported
   */
  private isSupported(): boolean {
    return Notifications !== null && Device !== null;
  }

  /**
   * Register for push notifications and store token in Convex
   */
  async registerForPushNotifications(): Promise<{
    success: boolean;
    token?: string;
    error?: string;
  }> {
    try {
      if (!this.isSupported()) {
        return { success: false, error: 'Push notifications not supported - expo-notifications not installed' };
      }

      // Check if device supports push notifications
      if (!Device.isDevice) {
        console.log('[PushNotifications] Must use physical device for Push Notifications');
        return { success: false, error: 'Must use physical device for Push Notifications' };
      }

      // Check current permission status
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Ask for permission if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[PushNotifications] Failed to get push token for push notification!');
        return { success: false, error: 'Permission not granted' };
      }

      // Get the token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? undefined;
      const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

      console.log('[PushNotifications] Push token:', token.data);

      // Store token in Convex
      try {
        await this.convex.mutation(api.userProfile.updatePushNotificationSettings, {
          token: token.data,
          enabled: true,
        });

        console.log('[PushNotifications] Successfully registered and stored push token');
        return { success: true, token: token.data };
      } catch (error: any) {
        // Ignore unauthenticated error during onboarding; token will be stored after sign-in
        if (typeof error?.message === 'string' && error.message.includes('Not authenticated')) {
          console.log('[PushNotifications] User not authenticated yet – skipping token upload for now');
          return { success: true, token: token.data };
        }
        console.error('[PushNotifications] Failed to store push token:', error);
        return { success: false, error: 'Failed to store token' };
      }

    } catch (error) {
      console.error('[PushNotifications] Error registering for push notifications:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Check current permission status
   */
  async getPermissionStatus(): Promise<PushNotificationPermissions> {
    if (!this.isSupported()) {
      return { granted: false, canAskAgain: false, status: 'unsupported' };
    }

    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    
    return {
      granted: status === 'granted',
      canAskAgain,
      status,
    };
  }

  /**
   * Enable push notifications
   */
  async enablePushNotifications(): Promise<boolean> {
    try {
      await this.convex.mutation(api.userProfile.updatePushNotificationSettings, {
        enabled: true,
      });
      return true;
    } catch (error) {
      console.error('[PushNotifications] Failed to enable push notifications:', error);
      return false;
    }
  }

  /**
   * Disable push notifications
   */
  async disablePushNotifications(): Promise<boolean> {
    try {
      await this.convex.mutation(api.userProfile.updatePushNotificationSettings, {
        enabled: false,
      });
      return true;
    } catch (error) {
      console.error('[PushNotifications] Failed to disable push notifications:', error);
      return false;
    }
  }

  /**
   * Unregister from push notifications completely
   */
  async unregisterPushNotifications(): Promise<boolean> {
    try {
      await this.convex.mutation(api.userProfile.updatePushNotificationSettings, {
        token: undefined,
        enabled: false,
      });
      return true;
    } catch (error) {
      console.error('[PushNotifications] Failed to unregister push notifications:', error);
      return false;
    }
  }

  /**
   * Send a test notification
   */
  async sendTestNotification(userId: string): Promise<boolean> {
    try {
      const result = await this.convex.action(api.pushNotifications.sendActivityNotification, {
        userId,
      });
      return result.success;
    } catch (error) {
      console.error('[PushNotifications] Failed to send test notification:', error);
      return false;
    }
  }

  /**
   * Set up notification listeners
   */
  setupNotificationListeners(onNotificationTap?: (data: any) => void) {
    if (!this.isSupported()) {
      console.warn('[PushNotifications] Cannot setup listeners - expo-notifications not available');
      return { notificationListener: null, responseListener: null };
    }

    // Listen for notifications received while app is foregrounded
    const notificationListener = Notifications.addNotificationReceivedListener((notification: Notification) => {
      console.log('[PushNotifications] Notification received while app is active:', notification);
      
      // Handle the notification data
      const { data } = notification.request.content;
      if (data?.type === 'new_activity') {
        // Could trigger a refresh of activities here
        console.log('[PushNotifications] New activity notification received');
      } else if (data?.type === 'achievement') {
        // Could show achievement modal here
        console.log('[PushNotifications] Achievement notification received');
      }
    });

    // Listen for user tapping on notification
    const responseListener = Notifications.addNotificationResponseReceivedListener((response: NotificationResponse) => {
      console.log('[PushNotifications] Notification tapped:', response);
      
      const { data } = response.notification.request.content;
      
      if (data?.type === 'new_activity' && data?.action === 'open_celebration') {
        // Trigger the celebration modal with the activity data
        console.log('[PushNotifications] Opening celebration modal for activity:', data.activityData);
        if (onNotificationTap) {
          onNotificationTap(data);
        }
      } else if (data?.type === 'achievement') {
        // Navigate to achievements or profile
        console.log('[PushNotifications] User tapped achievement notification');
        if (onNotificationTap) {
          onNotificationTap(data);
        }
      }
    });

    return {
      notificationListener,
      responseListener,
    };
  }

  /**
   * Remove notification listeners
   */
  removeNotificationListeners(listeners: {
    notificationListener: NotificationSubscription | null;
    responseListener: NotificationSubscription | null;
  }) {
    if (!this.isSupported()) return;

    if (listeners.notificationListener) {
      Notifications.removeNotificationSubscription(listeners.notificationListener);
    }
    if (listeners.responseListener) {
      Notifications.removeNotificationSubscription(listeners.responseListener);
    }
  }

  /**
   * Configure notification channels (Android)
   */
  async configureNotificationChannels() {
    if (!this.isSupported() || Platform.OS !== 'android') return;

    try {
      await Notifications.setNotificationChannelAsync('activities', {
        name: 'Activity Updates',
        description: 'Notifications about new running activities',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF0000',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('achievements', {
        name: 'Achievements',
        description: 'Notifications about unlocked achievements',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFD700',
        sound: 'default',
      });
    } catch (error) {
      console.error('[PushNotifications] Failed to configure notification channels:', error);
    }
  }
} 