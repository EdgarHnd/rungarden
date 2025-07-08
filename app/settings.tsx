import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAnalytics } from '@/provider/AnalyticsProvider';
import DatabaseHealthService from '@/services/DatabaseHealthService';
import DatabaseStravaService from '@/services/DatabaseStravaService';
import { PushNotificationService } from '@/services/PushNotificationService';
import { useAuthActions } from "@convex-dev/auth/react";
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useConvex, useConvexAuth, useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();
  const analytics = useAnalytics();

  // Convex queries and mutations
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const trainingProfile = useQuery(api.trainingProfile.getTrainingProfile);
  const updateSyncPreferences = useMutation(api.userProfile.updateSyncPreferences);
  const updateMetricSystem = useMutation(api.userProfile.updateMetricSystem);
  const updateTrainingProfile = useMutation(api.trainingProfile.updateTrainingProfile);
  const pushNotificationSettings = useQuery(api.userProfile.getPushNotificationSettings);

  const [isLoading, setIsLoading] = useState(true);
  const [healthService, setHealthService] = useState<DatabaseHealthService | null>(null);
  const [stravaService, setStravaService] = useState<DatabaseStravaService | null>(null);
  const [pushService, setPushService] = useState<PushNotificationService | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isStravaAuthenticated, setIsStravaAuthenticated] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);

  useEffect(() => {
    if (isAuthenticated && convex) {
      const healthSvc = new DatabaseHealthService(convex);
      const stravaSvc = new DatabaseStravaService(convex);
      const pushSvc = new PushNotificationService(convex);
      setHealthService(healthSvc);
      setStravaService(stravaSvc);
      setPushService(pushSvc);

      // Check Strava authentication status
      stravaSvc.isAuthenticated().then(setIsStravaAuthenticated).catch(() => setIsStravaAuthenticated(false));

      // Initialize push notification channels
      pushSvc.configureNotificationChannels();
    }
    if (profile) {
      setIsLoading(false);
    }
  }, [isAuthenticated, convex, profile]);

  const handleHealthKitToggle = async (enabled: boolean) => {
    try {
      setIsLoading(true);
      analytics.track({ name: 'healthkit_sync_toggled', properties: { enabled } });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (enabled) {
        // Check if Strava is currently enabled
        if (profile?.stravaSyncEnabled) {
          Alert.alert(
            'Switch Data Source',
            'Strava sync is currently enabled. Switching to HealthKit will disable Strava sync to prevent duplicate activities. Continue?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Switch to HealthKit',
                onPress: async () => {
                  await switchToHealthKit();
                }
              }
            ]
          );
          return;
        }

        // Request HealthKit permissions when enabling
        if (Platform.OS === 'ios' && healthService) {
          const hasPermissions = await healthService.initializeHealthKit();
          if (!hasPermissions) {
            Alert.alert(
              'Health Permissions Required',
              'Please enable Health permissions in your iPhone Settings:\n\n1. Open Settings\n2. Scroll down and tap on "Privacy & Security"\n3. Tap on "Health"\n4. Find "Blaze" and enable all permissions',
              [{ text: 'OK' }]
            );
            return;
          }
        }
      }

      await updateSyncPreferences({
        healthKitSyncEnabled: enabled,
        lastHealthKitSync: enabled ? undefined : null,
      });

      // Immediately perform initial sync to import existing runs
      if (healthService) {
        try {
          console.log('[Settings] Performing initial HealthKit sync for existing activities...');
          const syncResult = await healthService.forceSyncFromHealthKit(30);

          console.log('[Settings] HealthKit initial sync result:', syncResult);
          if (syncResult && (syncResult.created > 0 || syncResult.updated > 0 || (syncResult.distanceGained && syncResult.distanceGained > 0))) {
            // Success haptic handled later in Home screen via modal; just silent success
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        } catch (syncErr) {
          console.warn('[Settings] Initial HealthKit sync failed:', syncErr);
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error updating HealthKit sync:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update HealthKit sync setting');
    } finally {
      setIsLoading(false);
    }
  };

  const switchToHealthKit = async () => {
    try {
      setIsLoading(true);

      // Request HealthKit permissions
      if (Platform.OS === 'ios' && healthService) {
        const hasPermissions = await healthService.initializeHealthKit();
        if (!hasPermissions) {
          Alert.alert(
            'Health Permissions Required',
            'Please enable Health permissions in your iPhone Settings to use HealthKit as your data source.',
            [{ text: 'OK' }]
          );
          return;
        }
      }

      // Disable Strava, enable HealthKit
      await updateSyncPreferences({
        stravaSyncEnabled: false,
        healthKitSyncEnabled: true,
        lastStravaSync: null,
        lastHealthKitSync: undefined,
      });

      analytics.track({ name: 'data_source_switched', properties: { to: 'healthkit' } });
      // Perform initial sync
      if (healthService) {
        try {
          console.log('[Settings] Performing initial HealthKit sync after switching data source...');
          const syncResult = await healthService.forceSyncFromHealthKit(30);
          console.log('[Settings] HealthKit initial sync result:', syncResult);
        } catch (syncErr) {
          console.warn('[Settings] Initial HealthKit sync failed:', syncErr);
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Switched to HealthKit', 'Your primary data source is now HealthKit. Strava sync has been disabled.');
    } catch (error) {
      console.error('Error switching to HealthKit:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to switch to HealthKit');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSync = async () => {
    if (!profile?.healthKitSyncEnabled) {
      Alert.alert('HealthKit Sync Disabled', 'Please enable HealthKit sync first.');
      return;
    }

    if (!healthService) return;

    try {
      setIsSyncing(true);
      analytics.track({ name: 'manual_sync_triggered', properties: { source: 'healthkit' } });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const syncResult = await healthService.forceSyncFromHealthKit(30);

      if (syncResult) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Sync Complete',
          `Synced ${syncResult.created} new activities and updated ${syncResult.updated} existing ones.`
        );
      }
    } catch (error) {
      console.error('Error during manual sync:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Sync Failed', 'Failed to sync activities from HealthKit');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStravaConnect = async () => {
    if (!stravaService) return false;

    try {
      setIsLoading(true);
      analytics.track({ name: 'strava_connect_initiated' });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const success = await stravaService.authenticate();
      if (success) {
        setIsStravaAuthenticated(true);

        await updateSyncPreferences({ stravaSyncEnabled: true });

        // Automatically sync existing activities after successful connection
        try {
          console.log('[Settings] Performing initial Strava sync for existing activities...');
          const syncResult = await stravaService.forceSyncFromStrava(30);

          console.log('[Settings] Raw sync result:', syncResult);
          console.log('[Settings] Sync result details:', {
            created: syncResult?.created,
            updated: syncResult?.updated,
            skipped: syncResult?.skipped,
            distanceGained: syncResult?.distanceGained,
            leveledUp: syncResult?.leveledUp,
            newLevel: syncResult?.newLevel,
            oldLevel: syncResult?.oldLevel,
            hasAnyActivities: (syncResult?.created > 0 || syncResult?.updated > 0),
            hasDistance: (syncResult?.distanceGained && syncResult?.distanceGained > 0),
            shouldShowModal: (syncResult && (syncResult.created > 0 || syncResult.updated > 0 || (syncResult.distanceGained && syncResult.distanceGained > 0)))
          });

          // Show modal if any activities were processed (created OR updated) or if we gained distance
          // BUT only if initial sync hasn't been completed yet
          if (syncResult && (syncResult.created > 0 || syncResult.updated > 0 || (syncResult.distanceGained && syncResult.distanceGained > 0)) && !profile?.stravaInitialSyncCompleted) {
            console.log('[Settings] Initial sync has activities - celebration will show on main screen');
            // Don't show alert here - let the main screen modal handle the celebration
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            console.log('[Settings] No activities to sync, no distance gained, or initial sync already completed - showing simple success alert');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Success', 'Successfully connected to Strava!');
          }
        } catch (syncError) {
          console.warn('Initial sync failed but connection succeeded:', syncError);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Connected!', 'Successfully connected to Strava! You can manually sync activities in the settings.');
        }

        return true;
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', 'Failed to connect to Strava. Please try again.');
        return false;
      }
    } catch (error) {
      console.error('Error connecting to Strava:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to connect to Strava. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleHealthKitConnect = async () => {
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Request HealthKit permissions when enabling
      if (Platform.OS === 'ios' && healthService) {
        const hasPermissions = await healthService.initializeHealthKit();
        if (!hasPermissions) {
          Alert.alert(
            'Health Permissions Required',
            'Please enable Health permissions in your iPhone Settings:\n\n1. Open Settings\n2. Scroll down and tap on "Privacy & Security"\n3. Tap on "Health"\n4. Find "Blaze" and enable all permissions',
            [{ text: 'OK' }]
          );
          return;
        }
      }

      await updateSyncPreferences({
        healthKitSyncEnabled: true,
        lastHealthKitSync: undefined,
      });

      // Immediately perform initial sync to import existing runs
      if (healthService) {
        try {
          console.log('[Settings] Performing initial HealthKit sync for existing activities...');
          const syncResult = await healthService.forceSyncFromHealthKit(30);

          console.log('[Settings] HealthKit initial sync result:', syncResult);
          if (syncResult && (syncResult.created > 0 || syncResult.updated > 0 || (syncResult.distanceGained && syncResult.distanceGained > 0))) {
            // Success haptic handled later in Home screen via modal; just silent success
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        } catch (syncErr) {
          console.warn('[Settings] Initial HealthKit sync failed:', syncErr);
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error connecting HealthKit:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to connect to HealthKit');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStravaSyncEnable = async () => {
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await updateSyncPreferences({
        stravaSyncEnabled: true,
        lastStravaSync: undefined,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error enabling Strava sync:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to enable Strava sync');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStravaDisconnect = async () => {
    if (!stravaService) return;

    Alert.alert(
      'Disconnect Strava',
      'Are you sure you want to disconnect from Strava? This will disable syncing but keep your existing activities.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              analytics.track({ name: 'strava_disconnect_initiated' });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

              await stravaService.disconnect();
              setIsStravaAuthenticated(false);

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Disconnected', 'Successfully disconnected from Strava.');
            } catch (error) {
              console.error('Error disconnecting from Strava:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to disconnect from Strava.');
            } finally {
              setIsLoading(false);
            }
          }
        },
      ]
    );
  };

  const handleStravaSyncToggle = async (enabled: boolean) => {
    if (!stravaService) return;

    try {
      setIsLoading(true);
      analytics.track({ name: 'strava_sync_toggled', properties: { enabled } });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (enabled) {
        // Check if HealthKit is currently enabled
        if (profile?.healthKitSyncEnabled) {
          Alert.alert(
            'Switch Data Source',
            'HealthKit sync is currently enabled. Switching to Strava will disable HealthKit sync to prevent duplicate activities. Continue?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Switch to Strava',
                onPress: async () => {
                  await switchToStrava();
                }
              }
            ]
          );
          return;
        }

        // Need to authenticate first if not already authenticated
        if (!isStravaAuthenticated) {
          const success = await stravaService.authenticate();
          if (!success) {
            Alert.alert('Authentication Required', 'Please connect to Strava first to enable syncing.');
            return;
          }
          setIsStravaAuthenticated(true);
        }
      }

      await updateSyncPreferences({
        stravaSyncEnabled: enabled,
        lastStravaSync: enabled ? undefined : null,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error updating Strava sync:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update Strava sync setting');
    } finally {
      setIsLoading(false);
    }
  };

  const switchToStrava = async () => {
    try {
      setIsLoading(true);

      // Authenticate with Strava if needed
      if (!isStravaAuthenticated) {
        const success = await stravaService!.authenticate();
        if (!success) {
          Alert.alert('Authentication Failed', 'Please connect to Strava to use it as your data source.');
          return;
        }
        setIsStravaAuthenticated(true);
      }

      // Disable HealthKit, enable Strava
      await updateSyncPreferences({
        healthKitSyncEnabled: false,
        stravaSyncEnabled: true,
        lastHealthKitSync: null,
        lastStravaSync: undefined,
      });

      analytics.track({ name: 'data_source_switched', properties: { to: 'strava' } });
      // Perform initial sync
      if (stravaService) {
        try {
          console.log('[Settings] Performing initial Strava sync after switching data source...');
          const syncResult = await stravaService.forceSyncFromStrava(30);
          console.log('[Settings] Strava initial sync result:', syncResult);
        } catch (syncErr) {
          console.warn('[Settings] Initial Strava sync failed:', syncErr);
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Switched to Strava', 'Your primary data source is now Strava. HealthKit sync has been disabled.');
    } catch (error) {
      console.error('Error switching to Strava:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to switch to Strava');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStravaManualSync = async () => {
    if (!profile?.stravaSyncEnabled) {
      Alert.alert('Strava Sync Disabled', 'Please enable Strava sync first.');
      return;
    }

    if (!stravaService || !isStravaAuthenticated) {
      Alert.alert('Not Connected', 'Please connect to Strava first.');
      return;
    }

    try {
      setIsSyncing(true);
      analytics.track({ name: 'manual_sync_triggered', properties: { source: 'strava' } });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const syncResult = await stravaService.forceSyncFromStrava(30);

      if (syncResult) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Sync Complete',
          `Synced ${syncResult.created} new activities and updated ${syncResult.updated} existing ones from Strava.`
        );
      }
    } catch (error) {
      console.error('Error during Strava manual sync:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Sync Failed', 'Failed to sync activities from Strava');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSmartDeduplication = () => {
    Alert.alert(
      'Smart Deduplication',
      'This will scan your activities and remove duplicates between HealthKit and Strava data sources. Which source would you like to prioritize and keep?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Keep HealthKit ❤️',
          onPress: () => runDeduplication('healthkit')
        },
        {
          text: 'Keep Strava 🟠',
          onPress: () => runDeduplication('strava')
        }
      ]
    );
  };

  const runDeduplication = async (keepSource: 'healthkit' | 'strava') => {
    try {
      setIsDeduplicating(true);
      analytics.track({ name: 'deduplication_initiated', properties: { keep_source: keepSource } });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      console.log(`[Settings] Running deduplication, keeping ${keepSource} activities`);

      // Call the Convex mutation directly
      const result = await convex.mutation(api.migrations.removeDuplicateActivities, {
        keepSource
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const sourceName = keepSource === 'healthkit' ? 'HealthKit ❤️' : 'Strava 🟠';

      if (result.duplicatesRemoved === 0) {
        Alert.alert(
          'No Duplicates Found',
          'Great! No duplicate activities were found between your data sources.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Deduplication Complete',
          `Removed ${result.duplicatesRemoved} duplicate activities. Kept activities from ${sourceName}.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error during deduplication:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Deduplication Failed', 'Failed to remove duplicate activities. Please try again.');
    } finally {
      setIsDeduplicating(false);
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              analytics.track({ name: 'account_deletion_confirmed' });
              await signOut();
              // TODO: Call a backend function to delete user data from Convex
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Error", "Failed to delete account");
              console.error("Delete account error:", error);
            }
          }
        },
      ]
    );
  };

  const handleMetricSystemToggle = async (useMetric: boolean) => {
    try {
      analytics.track({ name: 'metric_system_toggled', properties: { metric_enabled: useMetric } });
      await updateMetricSystem({ metricSystem: useMetric ? "metric" : "imperial" });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error updating metric system:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update metric system preference');
    }
  };

  const handleWorkoutStyleToggle = async (preferTime: boolean) => {
    try {
      analytics.track({ name: 'workout_style_toggled', properties: { prefer_time: preferTime } });
      await updateTrainingProfile({ preferTimeOverDistance: preferTime });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error updating workout style:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update workout style preference');
    }
  };

  const handlePushNotificationToggle = async (enabled: boolean) => {
    if (!pushService) return;

    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      analytics.track({ name: 'push_notifications_toggled', properties: { enabled } });

      if (enabled) {
        // Register for push notifications
        const result = await pushService.registerForPushNotifications();
        if (!result.success) {
          Alert.alert(
            'Push Notification Setup Failed',
            result.error || 'Could not set up push notifications',
            [{ text: 'OK' }]
          );
          return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Push Notifications Enabled', 'You\'ll now receive notifications when new activities are synced!');
      } else {
        // Disable push notifications
        await pushService.disablePushNotifications();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error updating push notifications:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update push notification settings');
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestPushNotification = async () => {
    if (!pushService || !profile?.userId) return;

    try {
      analytics.track({ name: 'test_push_notification_sent' });
      await pushService.sendTestNotification(profile.userId);
      Alert.alert('Sent!', 'Test notification has been sent. It may take a moment to arrive.');
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const handleGoBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const createStravaWebhook = async () => {
    if (!stravaService) return;

    try {
      setIsLoading(true);
      analytics.track({ name: 'strava_webhook_created' });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const success = await stravaService.createWebhook();

      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Webhook Created', 'Real-time activity sync has been set up successfully!');
      } else {
        Alert.alert('Error', 'Failed to create webhook. Please try again.');
      }
    } catch (error) {
      console.error('Error creating Strava webhook:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to create webhook');
    } finally {
      setIsLoading(false);
    }
  };

  const testWebhookEndpoint = async () => {
    try {
      setIsLoading(true);
      analytics.track({ name: 'strava_webhook_tested' });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Test if our webhook endpoint is responding
      const testUrl = 'https://fast-dragon-309.convex.site/strava/webhooks?hub.verify_token=test&hub.challenge=test123&hub.mode=subscribe';

      const response = await fetch(testUrl);
      const text = await response.text();

      if (response.ok && text.includes('test123')) {
        Alert.alert('Webhook Endpoint OK', '✅ Your webhook endpoint is responding correctly!');
      } else {
        Alert.alert('Webhook Issue', `❌ Endpoint responded with: ${response.status}\n\n${text}`);
      }
    } catch (error) {
      console.error('Error testing webhook endpoint:', error);
      Alert.alert('Connection Error', '❌ Could not reach webhook endpoint');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[Theme.colors.background.primary, Theme.colors.background.secondary, Theme.colors.background.primary]}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleGoBack}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color={Theme.colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Preferences Section */}
        <View style={styles.sectionGroup}>
          {/* Metric System Toggle */}
          <View style={styles.section}>
            <View style={styles.sectionContent}>
              <View style={styles.syncOptionContent}>
                <View style={styles.syncOptionHeader}>
                  <FontAwesome5 name="pencil-ruler" size={20} color={Theme.colors.text.primary} />
                  <Text style={styles.syncOptionTitle}>Use Metric System</Text>
                </View>
                <Text style={styles.syncOptionDescription}>
                  {(profile?.metricSystem ?? "metric") === "metric"
                    ? "Display distances in kilometers"
                    : "Display distances in miles"
                  }
                </Text>
              </View>
              <Switch
                value={(profile?.metricSystem ?? "metric") === "metric"}
                onValueChange={handleMetricSystemToggle}
                trackColor={{ false: Theme.colors.background.tertiary, true: Theme.colors.status.success }}
                thumbColor={Theme.colors.text.primary}
                ios_backgroundColor={Theme.colors.background.tertiary}
                disabled={isLoading}
              />
            </View>
          </View>

          {/* Workout Style Toggle */}
          <View style={styles.section}>
            <View style={styles.sectionContent}>
              <View style={styles.syncOptionContent}>
                <View style={styles.syncOptionHeader}>
                  <FontAwesome5 name="clock" size={20} color={Theme.colors.text.primary} />
                  <Text style={styles.syncOptionTitle}>Workout Style (Distance vs Duration)</Text>
                </View>
                <Text style={styles.syncOptionDescription}>
                  {(trainingProfile?.preferTimeOverDistance ?? true)
                    ? "Time-based workouts (e.g., 20 min easy run)"
                    : "Distance-based workouts (e.g., 3km easy run)"
                  }
                </Text>
              </View>
              <Switch
                value={trainingProfile?.preferTimeOverDistance ?? true}
                onValueChange={handleWorkoutStyleToggle}
                trackColor={{ false: Theme.colors.background.tertiary, true: Theme.colors.status.success }}
                thumbColor={Theme.colors.text.primary}
                ios_backgroundColor={Theme.colors.background.tertiary}
                disabled={isLoading}
              />
            </View>
          </View>

          {/* Push Notifications Toggle */}
          {(profile?.healthKitSyncEnabled || profile?.stravaSyncEnabled) && (
            <View style={styles.section}>
              <View style={styles.sectionContent}>
                <View style={styles.syncOptionContent}>
                  <View style={styles.syncOptionHeader}>
                    <FontAwesome5 name="bell" size={20} color={Theme.colors.text.primary} />
                    <Text style={styles.syncOptionTitle}>Push Notifications</Text>
                  </View>
                  <Text style={styles.syncOptionDescription}>
                    Get notified when new activities are synced
                  </Text>
                </View>
                <Switch
                  value={pushNotificationSettings?.enabled ?? false}
                  onValueChange={handlePushNotificationToggle}
                  trackColor={{ false: Theme.colors.background.tertiary, true: Theme.colors.status.success }}
                  thumbColor={Theme.colors.text.primary}
                  ios_backgroundColor={Theme.colors.background.tertiary}
                  disabled={isLoading}
                />
              </View>
            </View>
          )}

          {/* Test Push Notification - Dev Only */}
          {pushNotificationSettings?.enabled && __DEV__ && (
            <TouchableOpacity
              style={styles.section}
              onPress={sendTestPushNotification}
              activeOpacity={0.7}
            >
              <View style={styles.sectionContent}>
                <View style={styles.syncOptionContent}>
                  <View style={styles.syncOptionHeader}>
                    <FontAwesome5 name="paper-plane" size={20} color={Theme.colors.text.primary} />
                    <Text style={styles.syncOptionTitle}>Send Test Notification</Text>
                  </View>
                  <Text style={styles.syncOptionDescription}>
                    Test if push notifications are working
                  </Text>
                </View>
                <FontAwesome5 name="chevron-right" size={20} color={Theme.colors.text.primary} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Data Source Section */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>Data Source</Text>
          <Text style={styles.sectionDescription}>
            Choose your primary data source for running activities. Only one source can be active at a time.
          </Text>
          {/* Strava Sync */}
          <TouchableOpacity
            style={styles.section}
            onPress={() => {
              if (isStravaAuthenticated && profile?.stravaSyncEnabled) {
                // Already connected - show disconnect option
                handleStravaDisconnect();
              } else if (isStravaAuthenticated) {
                // Authenticated but not syncing - enable sync
                if (profile?.healthKitSyncEnabled) {
                  Alert.alert(
                    'Switch to Strava',
                    'HealthKit is currently your active data source. Connecting to Strava will disconnect HealthKit to prevent duplicate activities. Continue?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Switch to Strava',
                        onPress: async () => {
                          await switchToStrava();
                        }
                      }
                    ]
                  );
                } else {
                  handleStravaSyncEnable();
                }
              } else {
                // Not authenticated - handle connection
                if (profile?.healthKitSyncEnabled) {
                  Alert.alert(
                    'Switch to Strava',
                    'HealthKit is currently your active data source. Connecting to Strava will disconnect HealthKit to prevent duplicate activities. Continue?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Switch to Strava',
                        onPress: async () => {
                          const success = await handleStravaConnect();
                          if (success) {
                            await switchToStrava();
                          }
                        }
                      }
                    ]
                  );
                } else {
                  handleStravaConnect();
                }
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.sectionContent}>
              <View style={styles.syncOptionContent}>
                <View style={styles.syncOptionHeader}>
                  <Image source={require('@/assets/images/icons/strava.png')} style={styles.iconImage} />
                  <Text style={styles.syncOptionTitle}>Strava</Text>
                  {isStravaAuthenticated && profile?.stravaSyncEnabled && (
                    <View style={[styles.comingSoonBadge, { backgroundColor: Theme.colors.status.success }]}>
                      <Text style={styles.comingSoonText}>Connected</Text>
                    </View>
                  )}
                  {!profile?.healthKitSyncEnabled && !profile?.stravaSyncEnabled && (
                    <View style={[styles.comingSoonBadge, { backgroundColor: Theme.colors.accent.primary }]}>
                      <Text style={styles.comingSoonText}>Recommended</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.syncOptionDescription}>
                  {isStravaAuthenticated && profile?.stravaSyncEnabled
                    ? 'Syncing activities from your Strava account (via webhooks)'
                    : isStravaAuthenticated
                      ? 'Connected but not syncing - tap to enable'
                      : 'Connect to sync activities from your Strava account'
                  }
                </Text>
              </View>
              <FontAwesome5
                name={isStravaAuthenticated && profile?.stravaSyncEnabled ? "unlink" : "chevron-right"}
                size={20}
                color={isStravaAuthenticated && profile?.stravaSyncEnabled ? Theme.colors.status.error : Theme.colors.text.primary}
              />
            </View>
          </TouchableOpacity>

          {/* HealthKit Sync */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.section}
              onPress={() => {
                if (profile?.healthKitSyncEnabled) {
                  // Already connected - show disconnect option
                  Alert.alert(
                    'Disconnect HealthKit',
                    'Are you sure you want to disconnect from HealthKit? This will disable syncing but keep your existing activities.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Disconnect',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            setIsLoading(true);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            await updateSyncPreferences({
                              healthKitSyncEnabled: false,
                              lastHealthKitSync: null,
                            });
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          } catch (error) {
                            console.error('Error disconnecting HealthKit:', error);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                            Alert.alert('Error', 'Failed to disconnect from HealthKit');
                          } finally {
                            setIsLoading(false);
                          }
                        }
                      }
                    ]
                  );
                } else {
                  // Not connected - handle connection
                  if (profile?.stravaSyncEnabled) {
                    Alert.alert(
                      'Switch to HealthKit',
                      'Strava is currently your active data source. Connecting to HealthKit will disconnect Strava to prevent duplicate activities. Continue?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Switch to HealthKit',
                          onPress: async () => {
                            await switchToHealthKit();
                          }
                        }
                      ]
                    );
                  } else {
                    handleHealthKitConnect();
                  }
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.sectionContent}>
                <View style={styles.syncOptionContent}>
                  <View style={styles.syncOptionHeader}>
                    <Image source={require('@/assets/images/icons/apple-health.png')} style={styles.iconImage} />
                    <Text style={styles.syncOptionTitle}>Apple HealthKit</Text>
                    {profile?.healthKitSyncEnabled && (
                      <View style={[styles.comingSoonBadge, { backgroundColor: Theme.colors.status.success }]}>
                        <Text style={styles.comingSoonText}>Connected</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.syncOptionDescription}>
                    {profile?.healthKitSyncEnabled
                      ? 'Syncing activities from the Health app'
                      : 'Connect to sync running activities from the Health app'
                    }
                  </Text>
                </View>
                <FontAwesome5
                  name={profile?.healthKitSyncEnabled ? "unlink" : "chevron-right"}
                  size={20}
                  color={profile?.healthKitSyncEnabled ? Theme.colors.status.error : Theme.colors.text.primary}
                />
              </View>
            </TouchableOpacity>
          )}

          {/* Manual Sync Buttons - Only show for connected sources */}
          {profile?.healthKitSyncEnabled && (
            <TouchableOpacity
              style={[styles.section, isSyncing && styles.disabledSection]}
              onPress={handleManualSync}
              activeOpacity={0.7}
              disabled={isSyncing}
            >
              <View style={styles.sectionContent}>
                <View style={styles.syncOptionContent}>
                  <View style={styles.syncOptionHeader}>
                    <FontAwesome5
                      name={isSyncing ? "spinner" : "download"}
                      size={20}
                      color={Theme.colors.accent.primary}
                      style={isSyncing ? { transform: [{ rotate: '0deg' }] } : undefined}
                    />
                    <Text style={styles.syncOptionTitle}>
                      {isSyncing ? 'Syncing HealthKit...' : 'Sync HealthKit Now'}
                    </Text>
                  </View>
                  <Text style={styles.syncOptionDescription}>
                    {profile?.lastHealthKitSync
                      ? `Last sync: ${new Date(profile.lastHealthKitSync).toLocaleString()}`
                      : 'Manually sync your HealthKit activities now'
                    }
                  </Text>
                </View>
                <FontAwesome5 name="chevron-right" size={20} color={Theme.colors.accent.primary} />
              </View>
            </TouchableOpacity>
          )}

          {profile?.stravaSyncEnabled && isStravaAuthenticated && (
            <TouchableOpacity
              style={[styles.section, isSyncing && styles.disabledSection]}
              onPress={handleStravaManualSync}
              activeOpacity={0.7}
              disabled={isSyncing}
            >
              <View style={styles.sectionContent}>
                <View style={styles.syncOptionContent}>
                  <View style={styles.syncOptionHeader}>
                    <FontAwesome5
                      name={isSyncing ? "spinner" : "download"}
                      size={20}
                      color={Theme.colors.accent.primary}
                      style={isSyncing ? { transform: [{ rotate: '0deg' }] } : undefined}
                    />
                    <Text style={styles.syncOptionTitle}>
                      {isSyncing ? 'Syncing Strava...' : 'Sync Strava Now'}
                    </Text>
                  </View>
                  <Text style={styles.syncOptionDescription}>
                    {profile?.lastStravaSync
                      ? `Last sync: ${new Date(profile.lastStravaSync).toLocaleString()}`
                      : 'Manually sync your Strava activities now'
                    }
                  </Text>
                </View>
                <FontAwesome5 name="chevron-right" size={20} color={Theme.colors.accent.primary} />
              </View>
            </TouchableOpacity>
          )}

          {/* Current Data Source Info */}
          {(profile?.healthKitSyncEnabled || profile?.stravaSyncEnabled) && (
            <View style={styles.infoSection}>
              <FontAwesome5 name="info-circle" size={16} color={Theme.colors.status.success} />
              <Text style={styles.infoText}>
                {profile?.healthKitSyncEnabled
                  ? 'HealthKit is your active data source. Activities sync automatically when added to Health app.'
                  : 'Strava is your active data source. Activities sync automatically via webhooks when you upload to Strava.'
                }
              </Text>
            </View>
          )}

          {/* Webhook Management for Strava - Dev Only */}
          {profile?.stravaSyncEnabled && isStravaAuthenticated && __DEV__ && (
            <>
              <TouchableOpacity
                style={styles.section}
                onPress={async () => {
                  if (!stravaService) return;

                  try {
                    setIsLoading(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

                    const subscriptions = await stravaService.viewWebhookSubscription();

                    if (subscriptions && subscriptions.length > 0) {
                      const sub = subscriptions[0];
                      Alert.alert(
                        'Webhook Status',
                        `✅ Active webhook found!\n\nID: ${sub.id}\nCallback URL: ${sub.callback_url}\nCreated: ${new Date(sub.created_at).toLocaleDateString()}`,
                        [{ text: 'OK' }]
                      );
                    } else {
                      Alert.alert(
                        'No Webhook Found',
                        'No active webhook subscription found. This means new activities won\'t sync automatically. Would you like to create one?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Create Webhook',
                            onPress: async () => {
                              await createStravaWebhook();
                            }
                          }
                        ]
                      );
                    }
                  } catch (error) {
                    console.error('Error checking webhook status:', error);
                    Alert.alert('Error', 'Failed to check webhook status');
                  } finally {
                    setIsLoading(false);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.sectionContent}>
                  <View style={styles.syncOptionContent}>
                    <View style={styles.syncOptionHeader}>
                      <FontAwesome5 name="broadcast-tower" size={20} color={Theme.colors.accent.primary} />
                      <Text style={styles.syncOptionTitle}>Check Webhook Status</Text>
                    </View>
                    <Text style={styles.syncOptionDescription}>
                      Verify if real-time sync is working
                    </Text>
                  </View>
                  <FontAwesome5 name="chevron-right" size={20} color={Theme.colors.accent.primary} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.section}
                onPress={testWebhookEndpoint}
                activeOpacity={0.7}
              >
                <View style={styles.sectionContent}>
                  <View style={styles.syncOptionContent}>
                    <View style={styles.syncOptionHeader}>
                      <FontAwesome5 name="plus-circle" size={20} color={Theme.colors.accent.primary} />
                      <Text style={styles.syncOptionTitle}>Test Webhook Endpoint</Text>
                    </View>
                    <Text style={styles.syncOptionDescription}>
                      Test if real-time sync is working
                    </Text>
                  </View>
                  <FontAwesome5 name="chevron-right" size={20} color={Theme.colors.accent.primary} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.section}
                onPress={createStravaWebhook}
                activeOpacity={0.7}
              >
                <View style={styles.sectionContent}>
                  <View style={styles.syncOptionContent}>
                    <View style={styles.syncOptionHeader}>
                      <FontAwesome5 name="link" size={20} color={Theme.colors.accent.primary} />
                      <Text style={styles.syncOptionTitle}>Create Webhook</Text>
                    </View>
                    <Text style={styles.syncOptionDescription}>
                      Set up real-time activity sync (only needed once)
                    </Text>
                  </View>
                  <FontAwesome5 name="chevron-right" size={20} color={Theme.colors.accent.primary} />
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* No Data Source Info */}
          {!profile?.healthKitSyncEnabled && !profile?.stravaSyncEnabled && (
            <View style={styles.infoSection}>
              <FontAwesome5 name="info-circle" size={16} color={Theme.colors.text.tertiary} />
              <Text style={styles.infoText}>
                {Platform.OS === 'ios'
                  ? 'Choose Strava or HealthKit as your primary data source to automatically track your runs. Strava is recommended for the best experience.'
                  : 'Connect to Strava to automatically track your runs and get the best experience.'
                }
              </Text>
            </View>
          )}

          {Platform.OS !== 'ios' && !isStravaAuthenticated && (
            <View style={styles.infoSection}>
              <FontAwesome5 name="info-circle" size={16} color={Theme.colors.text.tertiary} />
              <Text style={styles.infoText}>
                HealthKit is only available on iOS devices. Connect to Strava to sync your activities on any platform.
              </Text>
            </View>
          )}

          {/* Smart Deduplication Button */}
          <TouchableOpacity
            style={[styles.section, isDeduplicating && styles.disabledSection]}
            onPress={handleSmartDeduplication}
            activeOpacity={0.7}
            disabled={isDeduplicating}
          >
            <View style={styles.sectionContent}>
              <View style={styles.syncOptionContent}>
                <View style={styles.syncOptionHeader}>
                  <FontAwesome5
                    name={isDeduplicating ? "spinner" : "copy"}
                    size={20}
                    color={Theme.colors.text.primary}
                    style={isDeduplicating ? { transform: [{ rotate: '0deg' }] } : undefined}
                  />
                  <Text style={styles.syncOptionTitle}>
                    {isDeduplicating ? 'Removing Duplicates...' : 'Smart Deduplication'}
                  </Text>
                </View>
                <Text style={styles.syncOptionDescription}>
                  Remove duplicate activities between data sources
                </Text>
              </View>
              <FontAwesome5 name="chevron-right" size={20} color={Theme.colors.text.primary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Legal Section */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>Legal</Text>

          <TouchableOpacity
            style={styles.section}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Linking.openURL('https://www.blaze.run/terms');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.sectionContent}>
              <Text style={styles.optionText}>Terms and Conditions</Text>
              <FontAwesome5 name="chevron-right" size={20} color={Theme.colors.text.primary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.section}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Linking.openURL('https://www.blaze.run/privacy');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.sectionContent}>
              <Text style={styles.optionText}>Privacy Policy</Text>
              <FontAwesome5 name="chevron-right" size={20} color={Theme.colors.text.primary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.section}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Linking.openURL('mailto:support@blaze.run');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.sectionContent}>
              <Text style={styles.optionText}>Support</Text>
              <FontAwesome5 name="chevron-right" size={20} color={Theme.colors.text.primary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <TouchableOpacity
            style={[styles.section, styles.dangerSection]}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
          >
            <View style={styles.sectionContent}>
              <Text style={[styles.optionText, styles.dangerText]}>Delete Account</Text>
              <FontAwesome5 name="trash-alt" size={20} color={Theme.colors.status.error} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView >
    </LinearGradient >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    marginTop: Theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.xl,
    paddingBottom: Theme.spacing.lg,
  },
  title: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: Theme.spacing.lg,
  },
  sectionGroup: {
    marginBottom: Theme.spacing.xxxl,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.sm,
  },
  sectionDescription: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    marginBottom: Theme.spacing.lg,
    lineHeight: 20,
  },
  section: {
    marginBottom: Theme.spacing.md,
  },
  sectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md,
  },
  optionText: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
    flex: 1,
  },
  infoSection: {
    marginHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.sm,
    padding: Theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.tertiary,
    marginLeft: Theme.spacing.md,
    flex: 1,
    lineHeight: 20,
  },
  disabledSection: {
    backgroundColor: Theme.colors.background.tertiary,
    opacity: 0.7,
  },
  syncOptionContent: {
    flex: 1,
    marginRight: Theme.spacing.lg,
  },
  syncOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: Theme.spacing.md,
  },
  syncOptionTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
  },
  syncOptionDescription: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.tertiary,
    marginLeft: 32,
  },
  comingSoonBadge: {
    backgroundColor: Theme.colors.status.error,
    borderRadius: Theme.borderRadius.medium,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 2,
    marginLeft: Theme.spacing.sm,
  },
  comingSoonText: {
    fontSize: 10,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  dangerSection: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    borderWidth: 1,
    borderColor: Theme.colors.status.error,
    marginBottom: 100,
  },
  dangerText: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.status.error,
    flex: 1,
  },
  closeButton: {
    padding: Theme.spacing.sm,
  },
  iconImage: {
    width: 20,
    height: 20,
  },
}); 