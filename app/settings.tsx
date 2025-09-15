import LoadingScreen from '@/components/LoadingScreen';
import DeduplicationModal from '@/components/modals/DeduplicationModal';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAnalytics } from '@/provider/AnalyticsProvider';
import { useSyncProvider } from '@/provider/SyncProvider';
import { PushNotificationService } from '@/services/PushNotificationService';
import { requestRating } from '@/services/RatingService';
import { useAuthActions } from "@convex-dev/auth/react";
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useConvex, useConvexAuth, useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Linking, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();
  const analytics = useAnalytics();

  // Sync provider
  const {
    connectHealthKit,
    disconnectHealthKit,
    syncHealthKitManually,
    connectStrava,
    disconnectStrava,
    syncStravaManually,
    isHealthKitSyncing,
    isStravaSyncing,
    isConnecting,
  } = useSyncProvider();

  // Convex queries and mutations
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const createProfile = useMutation(api.userProfile.createProfile);
  const updateSyncPreferences = useMutation(api.userProfile.updateSyncPreferences);
  const updateProfile = useMutation(api.userProfile.updateProfile);

  const [isLoading, setIsLoading] = useState(true);
  const [pushService, setPushService] = useState<PushNotificationService | null>(null);
  const [showDeduplicationModal, setShowDeduplicationModal] = useState(false);
  const [deduplicationSource, setDeduplicationSource] = useState<"healthkit" | "strava">("healthkit");

  // Optimistic state for toggles
  const [optimisticMetricSystem, setOptimisticMetricSystem] = useState<"metric" | "imperial" | null>(null);
  const [optimisticWeekStartDay, setOptimisticWeekStartDay] = useState<0 | 1 | null>(null);
  const [optimisticPushNotifications, setOptimisticPushNotifications] = useState<boolean | null>(null);
  const [optimisticAutoSync, setOptimisticAutoSync] = useState<boolean | null>(null);

  // Helper functions to get current values with optimistic state
  const getCurrentMetricSystem = () => optimisticMetricSystem ?? profile?.metricSystem ?? "metric";
  const getCurrentWeekStartDay = () => optimisticWeekStartDay ?? profile?.weekStartDay ?? 1;
  const getCurrentPushNotifications = () => optimisticPushNotifications ?? profile?.pushNotificationsEnabled ?? false;
  const getCurrentAutoSync = () => optimisticAutoSync ?? profile?.autoSyncEnabled ?? false;

  const handleSignOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await signOut();
    // Navigation is handled automatically by ConvexAuthProvider
  };

  /**
   * Attempt to open the specific Health privacy page in iOS Settings. If that fails, fall back to the
   * app-specific settings screen.
   */
  const openHealthSettings = async () => {
    try {
      const url = 'x-apple-health://';

      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
        return;
      }

    } catch (err) {
      console.warn('Unable to open iOS Settings:', err);
    }
  };

  useEffect(() => {
    const initializeServices = async () => {
      if (isAuthenticated && convex) {
        const pushSvc = new PushNotificationService(convex);
        setPushService(pushSvc);

        // Initialize push notification channels
        pushSvc.configureNotificationChannels();

        // If profile query has loaded but returned null, create a profile
        if (profile === null) {
          try {
            await createProfile({});
          } catch (error) {
            console.error('Error creating profile:', error);
          }
        }
      }
    };

    initializeServices();
  }, [isAuthenticated, convex, createProfile, profile]);

  // Separate effect to handle loading state
  useEffect(() => {
    if (profile !== undefined) {
      setIsLoading(false);
    }
  }, [profile]);

  const handleHealthKitConnect = async () => {
    try {
      analytics.track({ name: 'healthkit_connect_initiated' });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Check if Strava is currently enabled
      if (profile?.stravaSyncEnabled) {
        // Ask user about switching and handling conflicts
        Alert.alert(
          'Switch to HealthKit',
          'This will disable Strava sync to prevent duplicate activities. How would you like to handle existing activities?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Keep Strava Activities',
              onPress: async () => {
                await connectHealthKit();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                router.back(); // Close settings
              }
            },
            {
              text: 'Review & Deduplicate',
              style: 'destructive',
              onPress: () => {
                setDeduplicationSource("healthkit");
                setShowDeduplicationModal(true);
              }
            }
          ]
        );
        return;
      }

      await connectHealthKit();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back(); // Close settings
    } catch (error: any) {
      console.error('Error connecting HealthKit:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', `Failed to connect to HealthKit: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleManualSync = async () => {
    try {
      analytics.track({ name: 'manual_sync_triggered', properties: { source: 'healthkit' } });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await syncHealthKitManually();
    } catch (error: any) {
      console.error('Error during manual sync:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Sync Failed', error?.message || 'Failed to sync activities from HealthKit');
    }
  };

  const handleAutoSyncToggle = async (enabled: boolean) => {
    // Optimistic update
    setOptimisticAutoSync(enabled);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    analytics.track({ name: 'auto_sync_toggled', properties: { enabled } });

    try {
      if (enabled) {
        // Enable auto-sync requires HealthKit to be connected first
        if (!profile?.healthKitSyncEnabled) {
          setOptimisticAutoSync(null);
          Alert.alert(
            'HealthKit Required',
            'Auto-sync requires HealthKit to be connected first. Please connect to HealthKit and try again.',
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }

        // Auto-sync is managed by the system when HealthKit is connected
        // No additional setup needed - just update the preference
      } else {
        // Auto-sync disabled - just update the preference
      }

      // Update profile in database
      await updateProfile({ autoSyncEnabled: enabled });

      // Clear optimistic state on success
      setOptimisticAutoSync(null);
    } catch (error) {
      console.error('Error updating auto-sync:', error);
      // Revert optimistic state on error
      setOptimisticAutoSync(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update auto-sync preference');
    }
  };

  // Strava handlers
  const handleStravaConnect = async () => {
    try {
      analytics.track({ name: 'strava_connect_initiated' });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Check if HealthKit is currently enabled
      if (profile?.healthKitSyncEnabled) {
        // Ask user about switching and handling conflicts
        Alert.alert(
          'Switch to Strava',
          'This will disable HealthKit sync to prevent duplicate activities. How would you like to handle existing activities?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Keep HealthKit Activities',
              onPress: async () => {
                await connectStrava();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                router.back(); // Close settings
              }
            },
            {
              text: 'Review & Deduplicate',
              style: 'destructive',
              onPress: () => {
                setDeduplicationSource("strava");
                setShowDeduplicationModal(true);
              }
            }
          ]
        );
        return;
      }

      await connectStrava();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back(); // Close settings
    } catch (error: any) {
      console.error('Error connecting Strava:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', `Failed to connect to Strava: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleStravaDisconnect = async () => {
    Alert.alert(
      'Disconnect Strava',
      'This will stop syncing activities from Strava. Your existing activities will remain in your garden.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              analytics.track({ name: 'strava_disconnect' });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await disconnectStrava();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Disconnected', 'Strava has been disconnected successfully.');
            } catch (error: any) {
              console.error('Error disconnecting Strava:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', `Failed to disconnect Strava: ${error?.message || 'Unknown error'}`);
            }
          }
        }
      ]
    );
  };

  const handleStravaManualSync = async () => {
    try {
      analytics.track({ name: 'manual_sync_triggered', properties: { source: 'strava' } });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await syncStravaManually();
    } catch (error: any) {
      console.error('Error during Strava manual sync:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Sync Failed', error?.message || 'Failed to sync activities from Strava');
    }
  };













  /**
   * Select RunGarden in-app recording as the primary source (disables Strava & HealthKit)
   */
  const handleRunGardenSelect = async () => {
    try {
      // If HealthKit or Strava is active, confirm the switch
      if (profile?.healthKitSyncEnabled || profile?.stravaSyncEnabled) {
        Alert.alert(
          'Switch to RunGarden',
          'This will disable syncing from HealthKit and Strava to prevent duplicate activities. How would you like to handle existing activities?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Keep Existing Activities',
              onPress: async () => {
                await handleSwitchToRunGarden();
              }
            },
            {
              text: 'Sync & Deduplicate',
              style: 'destructive',
              onPress: async () => {
                // TODO: Implement deduplication logic
                await handleSwitchToRunGarden();
                Alert.alert('Note', 'Activity deduplication will be implemented in a future update.');
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error selecting RunGarden:', error);
    }
  };

  const handleSwitchToRunGarden = async () => {
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Disable both HealthKit and Strava
      await updateSyncPreferences({
        healthKitSyncEnabled: false,
        lastHealthKitSync: undefined,
        healthKitSyncAnchor: undefined,
        stravaSyncEnabled: false,
        stravaAccessToken: undefined,
        stravaRefreshToken: undefined,
        stravaTokenExpiresAt: undefined,
        stravaAthleteId: undefined,
        autoSyncEnabled: false,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success! ✅', 'RunGarden is now your active data source. You can record runs directly in the app.');
    } catch (err) {
      console.error('Error switching to RunGarden:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to switch data source');
    } finally {
      setIsLoading(false);
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

  const handleMetricSystemToggle = async (isMetric: boolean) => {
    const system = isMetric ? "metric" : "imperial";

    // Optimistic update
    setOptimisticMetricSystem(system);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    analytics.track({ name: 'metric_system_toggled', properties: { metric_enabled: isMetric } });

    try {
      await updateProfile({ metricSystem: system });
      // Clear optimistic state on success
      setOptimisticMetricSystem(null);
    } catch (error) {
      console.error('Error updating metric system:', error);
      // Revert optimistic state on error
      setOptimisticMetricSystem(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update metric system preference');
    }
  };

  const handleFirstDayOfWeekToggle = async (isMonday: boolean) => {
    const startDay = isMonday ? 1 : 0;

    // Optimistic update
    setOptimisticWeekStartDay(startDay);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    analytics.track({ name: 'first_day_of_week_toggled', properties: { start_with_monday: isMonday } });

    try {
      await updateProfile({ weekStartDay: startDay });
      // Clear optimistic state on success
      setOptimisticWeekStartDay(null);
    } catch (error) {
      console.error('Error updating first day of week:', error);
      // Revert optimistic state on error
      setOptimisticWeekStartDay(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update first day of week preference');
    }
  };

  const handlePushNotificationsToggle = async (enabled: boolean) => {
    // Optimistic update
    setOptimisticPushNotifications(enabled);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    analytics.track({ name: 'push_notifications_toggled', properties: { enabled } });

    try {
      if (enabled) {
        // Request permission and enable notifications
        if (pushService) {
          const result = await pushService.registerForPushNotifications();
          if (!result.success) {
            // Revert optimistic state if permission denied
            setOptimisticPushNotifications(null);
            Alert.alert(
              'Permission Required',
              'Please enable notifications in your device settings to receive garden updates.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() }
              ]
            );
            return;
          }
        }
      } else {
        // Disable notifications
        if (pushService) {
          await pushService.disablePushNotifications();
        }
      }

      // Update profile in database
      await updateProfile({ pushNotificationsEnabled: enabled });

      // Clear optimistic state on success
      setOptimisticPushNotifications(null);
    } catch (error) {
      console.error('Error updating push notifications:', error);
      // Revert optimistic state on error
      setOptimisticPushNotifications(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update push notification preference');
    }
  };



  const handleGoBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };


  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isHealthKitSyncing || isStravaSyncing) {
    return (
      <LinearGradient
        colors={[Theme.colors.background.primary, Theme.colors.background.secondary, Theme.colors.background.primary]}
        style={styles.container}
      >
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Syncing Your Runs...</Text>
          <Text style={styles.loadingSubtext}>This may take a moment for large activity histories</Text>
        </View>
      </LinearGradient>
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
        {/* Distance Units */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionHeader}>DISTANCE UNITS</Text>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => {
              Alert.alert(
                'Distance Units',
                'Choose your preferred distance units',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Kilometers',
                    onPress: () => handleMetricSystemToggle(true)
                  },
                  {
                    text: 'Miles',
                    onPress: () => handleMetricSystemToggle(false)
                  }
                ]
              );
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.settingLabel}>Distance Units</Text>
            <View style={styles.settingValue}>
              <Text style={styles.settingValueText}>
                {getCurrentMetricSystem() === "metric" ? "Kilometers" : "Miles"}
              </Text>
              <FontAwesome5 name="chevron-down" size={16} color={Theme.colors.accent.primary} />
            </View>
          </TouchableOpacity>

        </View>

        {/* Data Source */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionHeader}>DATA SOURCE</Text>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => {
              Alert.alert(
                'Data Source',
                'Choose your primary data source',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'RunGarden',
                    onPress: handleRunGardenSelect
                  },
                  ...(Platform.OS === 'ios' ? [{
                    text: 'Apple Health',
                    onPress: handleHealthKitConnect
                  }] : [])
                ]
              );
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.settingLabel}>Data Source</Text>
            <View style={styles.settingValue}>
              <Text style={styles.settingValueText}>
                {profile?.healthKitSyncEnabled ? 'Apple Health' : profile?.stravaSyncEnabled ? 'Strava' : 'RunGarden'}
              </Text>
              <FontAwesome5 name="chevron-down" size={16} color={Theme.colors.accent.primary} />
            </View>
          </TouchableOpacity>


        </View>

        {/* Apple Health Integration */}
        {Platform.OS === 'ios' && (
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionHeader}>APPLE HEALTH INTEGRATION</Text>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Apple Health Connected</Text>
              <View style={[styles.statusBadge, { backgroundColor: profile?.healthKitSyncEnabled ? Theme.colors.status.success : Theme.colors.background.tertiary }]}>
                <Text style={[styles.statusText, { color: profile?.healthKitSyncEnabled ? '#FFFFFF' : Theme.colors.text.tertiary }]}>
                  {profile?.healthKitSyncEnabled ? 'Connected' : 'Not Connected'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Support */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionHeader}>SUPPORT</Text>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={async () => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                analytics.track({ name: 'rate_app_tapped' });
                await requestRating(true); // Pass true for manual request
              } catch (error) {
                console.error('Error requesting rating:', error);
                Alert.alert('Error', 'Unable to open rating dialog. Please rate us in the App Store.');
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.settingWithIcon}>
              <FontAwesome5 name="star" size={20} color={Theme.colors.accent.primary} />
              <Text style={styles.settingLabel}>Help us by rating us 5 stars</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color={Theme.colors.text.tertiary} />
          </TouchableOpacity>
        </View>

        {/* Hide all the old complex sections */}
        {false && (
          <View>
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
                                lastHealthKitSync: undefined,
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
                    handleHealthKitConnect();
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
                        <View style={[styles.comingSoonBadge, { backgroundColor: Theme.colors.accent.primary }]}>
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
            {/* Manual Sync Button - Only show for connected sources */}
            {profile?.healthKitSyncEnabled && (
              <TouchableOpacity
                style={[styles.section, isHealthKitSyncing && styles.disabledSection]}
                onPress={handleManualSync}
                activeOpacity={0.7}
                disabled={isHealthKitSyncing}
              >
                <View style={styles.sectionContent}>
                  <View style={styles.syncOptionContent}>
                    <View style={styles.syncOptionHeader}>
                      <FontAwesome5
                        name={isHealthKitSyncing ? "spinner" : "sync"}
                        size={20}
                        color={Theme.colors.accent.primary}
                        style={isHealthKitSyncing ? { transform: [{ rotate: '0deg' }] } : undefined}
                      />
                      <Text style={styles.syncOptionTitle}>
                        {isHealthKitSyncing ? 'Syncing HealthKit...' : 'Sync HealthKit Now'}
                      </Text>
                    </View>
                    <Text style={styles.syncOptionDescription}>
                      {profile?.lastHealthKitSync
                        ? `Last sync: ${new Date(profile?.lastHealthKitSync ?? '').toLocaleString()}`
                        : 'Sync your HealthKit activities and grow plants'
                      }
                    </Text>
                  </View>
                  <FontAwesome5 name="chevron-right" size={20} color={Theme.colors.accent.primary} />
                </View>
              </TouchableOpacity>
            )}

            {/* Auto-Sync Toggle */}
            {profile?.healthKitSyncEnabled && (
              <View style={styles.section}>
                <View style={styles.sectionContent}>
                  <View style={styles.syncOptionContent}>
                    <View style={styles.syncOptionHeader}>
                      <FontAwesome5 name="magic" size={20} color={Theme.colors.text.primary} />
                      <Text style={styles.syncOptionTitle}>Auto-Sync HealthKit</Text>
                    </View>
                    <Text style={styles.syncOptionDescription}>
                      {getCurrentAutoSync() ? 'Automatically sync new runs in the background' : 'Enable automatic background syncing'}
                    </Text>
                  </View>
                  <Switch
                    value={getCurrentAutoSync()}
                    onValueChange={handleAutoSyncToggle}
                    trackColor={{ false: Theme.colors.background.tertiary, true: Theme.colors.accent.primary }}
                    thumbColor={Theme.colors.background.primary}
                    ios_backgroundColor={Theme.colors.background.tertiary}
                    disabled={isConnecting}
                  />
                </View>
              </View>
            )}

            {/* Current Data Source Info */}
            {profile?.healthKitSyncEnabled && (
              <View style={styles.infoSection}>
                <FontAwesome5 name="info-circle" size={16} color={Theme.colors.status.success} />
                <Text style={styles.infoText}>
                  HealthKit is your active data source. {getCurrentAutoSync() ? 'Auto-sync will automatically detect new runs and award plants.' : 'Use manual sync or enable auto-sync for automatic updates.'}
                </Text>
              </View>
            )}

            {/* Strava Sync - Temporarily Disabled */}
            <View style={[styles.section, { opacity: 0.6 }]}>
              <View style={styles.sectionContent}>
                <View style={styles.syncOptionContent}>
                  <View style={styles.syncOptionHeader}>
                    <Image source={require('@/assets/images/icons/strava.png')} style={styles.iconImage} />
                    <Text style={styles.syncOptionTitle}>Strava</Text>
                    <View style={[styles.comingSoonBadge, { backgroundColor: Theme.colors.status.warning }]}>
                      <Text style={styles.comingSoonText}>Coming Soon</Text>
                    </View>
                  </View>
                  <Text style={styles.syncOptionDescription}>
                    Strava integration is temporarily unavailable while we improve the experience
                  </Text>
                </View>
                <FontAwesome5
                  name="clock"
                  size={20}
                  color={Theme.colors.text.tertiary}
                />
              </View>
            </View>

            {/* Manual Strava Sync Button - Temporarily Disabled */}
            {/* {profile?.stravaSyncEnabled && (
            <TouchableOpacity
              style={[styles.section, isStravaSyncing && styles.disabledSection]}
              onPress={handleStravaManualSync}
              activeOpacity={0.7}
              disabled={isStravaSyncing}
            >
              <View style={styles.sectionContent}>
                <View style={styles.syncOptionContent}>
                  <View style={styles.syncOptionHeader}>
                    <FontAwesome5
                      name={isStravaSyncing ? "spinner" : "sync"}
                      size={20}
                      color={Theme.colors.accent.primary}
                      style={isStravaSyncing ? { transform: [{ rotate: '0deg' }] } : undefined}
                    />
                    <Text style={styles.syncOptionTitle}>
                      {isStravaSyncing ? 'Syncing Strava...' : 'Sync Strava Now'}
                    </Text>
                  </View>
                  <Text style={styles.syncOptionDescription}>
                    {profile?.lastStravaSync
                      ? `Last sync: ${new Date(profile.lastStravaSync).toLocaleString()}`
                      : 'Sync your Strava activities and grow plants'
                    }
                  </Text>
                </View>
                <FontAwesome5 name="chevron-right" size={20} color={Theme.colors.accent.primary} />
              </View>
            </TouchableOpacity>
          )} */}

            {/* Strava Data Source Info - Temporarily Disabled */}
            {/* {profile?.stravaSyncEnabled && (
            <View style={styles.infoSection}>
              <FontAwesome5 name="info-circle" size={16} color={Theme.colors.status.success} />
              <Text style={styles.infoText}>
                Strava is your active data source. New activities will be automatically synced via webhooks and award plants.
              </Text>
            </View>
          )} */}

            {/* Dev Only: Webhook Check Button - Temporarily Disabled */}
            {/* {__DEV__ && profile?.stravaSyncEnabled && (
            <TouchableOpacity
              style={[styles.section, { backgroundColor: Theme.colors.background.secondary }]}
              onPress={async () => {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.alert('Info', 'Webhook management is handled automatically when connecting to Strava. No manual setup required.');
                } catch (error) {
                  console.error('Error in webhook info display:', error);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.sectionContent}>
                <View style={styles.syncOptionContent}>
                  <View style={styles.syncOptionHeader}>
                    <FontAwesome5 name="bug" size={20} color={Theme.colors.status.warning} />
                    <Text style={[styles.syncOptionTitle, { color: Theme.colors.status.warning }]}>
                      [DEV] Check Webhook
                    </Text>
                  </View>
                  <Text style={styles.syncOptionDescription}>
                    Check if Strava webhook is properly configured
                  </Text>
                </View>
                <FontAwesome5 name="chevron-right" size={20} color={Theme.colors.status.warning} />
              </View>
            </TouchableOpacity>
          )} */}

            {/* No Data Source Info */}
            {!profile?.healthKitSyncEnabled && !profile?.stravaSyncEnabled && (
              <View style={styles.infoSection}>
                <FontAwesome5 name="info-circle" size={16} color={Theme.colors.text.tertiary} />
                <Text style={styles.infoText}>
                  {Platform.OS === 'ios'
                    ? 'Connect to HealthKit or Strava to automatically track your runs, or use RunGarden\'s built-in recorder.'
                    : 'Connect to Strava to automatically track your runs, or use RunGarden\'s built-in recorder.'
                  }
                </Text>
              </View>
            )}


          </View>
        )}

        {/* Legal Section */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>Legal</Text>

          <TouchableOpacity
            style={styles.section}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Linking.openURL('https://www.rungarden.app/terms');
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
              Linking.openURL('https://www.rungarden.app/privacy');
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
              Linking.openURL('mailto:support@rungarden.app');
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
          {/* Sign Out */}
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <FontAwesome5 name="sign-out-alt" size={18} color={Theme.colors.status.error} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
          >
            <FontAwesome5 name="trash-alt" size={20} color={Theme.colors.status.error} />
            <Text style={styles.signOutText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView >
      {/* Deduplication Modal */}
      <DeduplicationModal
        isVisible={showDeduplicationModal}
        onClose={() => setShowDeduplicationModal(false)}
        onComplete={async () => {
          try {
            if (deduplicationSource === "healthkit") {
              await connectHealthKit();
            } else {
              await connectStrava();
            }
            router.back(); // Close settings
          } catch (error: any) {
            console.error('Error in deduplication complete:', error);
            Alert.alert('Error', `Failed to complete setup: ${error?.message || 'Unknown error'}`);
          }
        }}
        sourceToKeep={deduplicationSource}
      />
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
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    marginTop: Theme.spacing.md,
    textAlign: 'center',
    paddingHorizontal: Theme.spacing.xl,
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
    gap: Theme.spacing.lg,
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
    color: '#FFFFFF', // White text for contrast on red background
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
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: Theme.colors.background.secondary,
    borderWidth: 1,
    borderColor: Theme.colors.status.error,
  },
  signOutText: {
    fontSize: 16,
    color: Theme.colors.status.error,
    marginLeft: 8,
    fontWeight: '600',
  },
  // New minimal styles
  sectionHeader: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    letterSpacing: 0.5,
    marginBottom: Theme.spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.medium,
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.lg,
    marginBottom: Theme.spacing.sm,
  },
  settingLabel: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  settingValueText: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.accent.primary,
  },
  currentlyUsing: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.secondary,
    marginBottom: Theme.spacing.md,
  },
  statusBadge: {
    borderRadius: Theme.borderRadius.small,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
  },
  settingWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
}); 