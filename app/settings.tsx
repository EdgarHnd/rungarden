import LoadingScreen from '@/components/LoadingScreen';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAnalytics } from '@/provider/AnalyticsProvider';
import DatabaseHealthService from '@/services/DatabaseHealthService';

import { PushNotificationService } from '@/services/PushNotificationService';
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

  // Convex queries and mutations
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const createProfile = useMutation(api.userProfile.createProfile);
  const updateSyncPreferences = useMutation(api.userProfile.updateSyncPreferences);
  const updateProfile = useMutation(api.userProfile.updateProfile);

  const [isLoading, setIsLoading] = useState(true);
  const [healthService, setHealthService] = useState<DatabaseHealthService | null>(null);
  const [pushService, setPushService] = useState<PushNotificationService | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);



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
        const healthSvc = new DatabaseHealthService(convex);
        const pushSvc = new PushNotificationService(convex);
        setHealthService(healthSvc);
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
  }, [isAuthenticated, convex, createProfile]);

  // Separate effect to handle loading state
  useEffect(() => {
    if (profile !== undefined) {
      setIsLoading(false);
    }
  }, [profile]);

  const handleHealthKitConnect = async () => {
    try {
      setIsLoading(true);
      analytics.track({ name: 'healthkit_connect_initiated' });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Request HealthKit permissions when enabling
      if (Platform.OS === 'ios' && healthService) {
        try {
          const hasPermissions = await healthService.initializeHealthKit();
          console.log('[Settings] HealthKit permissions check:', hasPermissions);

          if (!hasPermissions) {
            // Still allow connection but warn user
            Alert.alert(
              'HealthKit Permissions',
              'HealthKit permission check indicates some permissions may not be granted. You can still enable HealthKit sync, but you may need to check your Health app permissions.\n\nWould you like to continue?',
              [
                {
                  text: 'Continue Anyway',
                  onPress: async () => {
                    await updateSyncPreferences({
                      healthKitSyncEnabled: true,
                      lastHealthKitSync: undefined,
                    });
                    Alert.alert('HealthKit Enabled', 'HealthKit sync enabled. Use "Fetch Last Run" to test if data can be read.');
                  }
                },
                { text: 'Open Health Settings', onPress: openHealthSettings },
                { text: 'Cancel', style: 'cancel' }
              ]
            );
            return;
          }
        } catch (initError: any) {
          console.error('[Settings] HealthKit init error:', initError);
          Alert.alert(
            'HealthKit Initialization Error',
            `There was an error initializing HealthKit: ${initError?.message || 'Unknown error'}\n\nYou can still try to enable sync.`,
            [
              {
                text: 'Enable Anyway',
                onPress: async () => {
                  await updateSyncPreferences({
                    healthKitSyncEnabled: true,
                    lastHealthKitSync: undefined,
                  });
                  Alert.alert('HealthKit Enabled', 'HealthKit sync enabled with warnings. Use "Fetch Last Run" to test.');
                }
              },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
          return;
        }
      }

      await updateSyncPreferences({
        healthKitSyncEnabled: true,
        lastHealthKitSync: undefined,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success! ✅', 'HealthKit connected successfully! You can now use "Fetch Last Run" to test the integration.');
    } catch (error: any) {
      console.error('Error connecting HealthKit:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', `Failed to connect to HealthKit: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };



  const handleManualSync = async () => {
    if (!profile?.healthKitSyncEnabled) {
      Alert.alert('HealthKit Not Connected', 'Please connect to HealthKit first.');
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

  const handleFetchLastRun = async () => {
    if (!healthService) {
      Alert.alert('HealthKit Not Available', 'HealthKit service is not initialized.');
      return;
    }

    try {
      setIsSyncing(true);
      analytics.track({ name: 'fetch_last_run_triggered' });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // For testing, let's try to fetch even if permissions might be "denied"
      if (Platform.OS === 'ios') {
        try {
          console.log('[Settings] Attempting to initialize HealthKit...');
          const hasPermissions = await healthService.initializeHealthKit();
          console.log('[Settings] HealthKit initialization result:', hasPermissions);

          if (!hasPermissions) {
            // Don't block - try anyway and let the user know what happened
            console.log('[Settings] Permissions check failed, but attempting fetch anyway...');
            Alert.alert(
              'Permission Check Failed',
              'HealthKit permission check failed, but attempting to fetch data anyway. If this fails, please check your Health app permissions for Run Garden.',
              [
                { text: 'Continue Anyway', style: 'default' },
                { text: 'Open Health Settings', onPress: openHealthSettings },
                { text: 'Cancel', style: 'cancel', onPress: () => { setIsSyncing(false); return; } }
              ]
            );
          }
        } catch (initError: any) {
          console.error('[Settings] HealthKit initialization error:', initError);
          Alert.alert(
            'HealthKit Error',
            `HealthKit initialization failed: ${initError?.message || 'Unknown error'}. Trying to fetch anyway...`
          );
        }
      }

      // Attempt to fetch the last run (limit to 1 activity)
      // For testing, we want to force plant awarding even for existing activities
      console.log('[Settings] Attempting to fetch from HealthKit with plant awarding...');
      const syncResult = await healthService.forceSyncFromHealthKitWithPlants(1);
      console.log('[Settings] Sync result:', syncResult);

      if (syncResult && (syncResult.created > 0 || syncResult.updated > 0)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const plantsAwarded = (syncResult as any).plantsAwarded || 0;
        Alert.alert(
          syncResult.created > 0 ? 'Last Run Fetched! 🎉' : 'Run Updated ✅',
          `Successfully processed your most recent run from HealthKit.\n\n` +
          `Created: ${syncResult.created} activities\n` +
          `Updated: ${syncResult.updated} activities\n` +
          `Distance: ${syncResult.distanceGained || 0}m\n` +
          `🌱 Plants awarded: ${plantsAwarded}\n\n` +
          `${plantsAwarded > 0 ? 'Check your garden to see your new plants!' : 'Distance may be too small for plant rewards.'}`
        );
      } else {
        Alert.alert(
          'No New Runs 📱',
          `No new runs found in HealthKit to import.\n\nTip: Make sure you have workout data in the Health app, and that Run Garden has access to read Workouts.`
        );
      }
    } catch (error: any) {
      console.error('Error fetching last run:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Fetch Failed ❌',
        `Failed to fetch your last run from HealthKit.\n\nError: ${error?.message || 'Unknown error'}\n\nTip: Check that Run Garden has permission to read Workouts in the Health app.`
      );
    } finally {
      setIsSyncing(false);
    }
  };













  /**
   * Select Run Garden in-app recording as the primary source (disables Strava & HealthKit)
   */
  const handleRunGardenSelect = async () => {
    try {
      // If HealthKit is active, confirm the switch
      if (profile?.healthKitSyncEnabled) {
        Alert.alert(
          'Switch to Run Garden',
          'This will disable syncing from HealthKit to prevent duplicate activities. Continue?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Switch',
              onPress: async () => {
                try {
                  setIsLoading(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  await updateSyncPreferences({
                    healthKitSyncEnabled: false,
                    lastHealthKitSync: undefined,
                  });
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch (err) {
                  console.error('Error switching to Run Garden:', err);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  Alert.alert('Error', 'Failed to switch data source');
                } finally {
                  setIsLoading(false);
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error selecting Run Garden:', error);
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

  const handleMetricSystemSelect = async (system: "metric" | "imperial") => {
    try {
      analytics.track({ name: 'metric_system_toggled', properties: { metric_enabled: system === "metric" } });
      await updateProfile({ metricSystem: system });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error updating metric system:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update metric system preference');
    }
  };

  const handleFirstDayOfWeekSelect = async (startDay: 0 | 1) => {
    try {
      analytics.track({ name: 'first_day_of_week_toggled', properties: { start_with_monday: startDay === 1 } });
      // TODO: Add weekStartDay to schema and implement
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error updating first day of week:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update first day of week preference');
    }
  };



  const handleGoBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };



  if (isLoading) {
    return <LoadingScreen />;
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
          <Text style={styles.sectionTitle}>Preferences</Text>
          <Text style={styles.sectionDescription}>
            Customize your app settings for units and calendar display.
          </Text>

          {/* Metric System Selection */}
          <View style={styles.section}>
            <View style={styles.sectionContent}>
              <View style={styles.syncOptionContent}>
                <View style={styles.syncOptionHeader}>
                  <FontAwesome5 name="pencil-ruler" size={20} color={Theme.colors.text.primary} />
                  <Text style={styles.syncOptionTitle}>Distance Units</Text>
                </View>
                <View style={styles.buttonPairWrapper}>
                  <View style={styles.buttonPairContainer}>
                    <TouchableOpacity
                      style={[
                        styles.selectionButton,
                        (profile?.metricSystem ?? "metric") === "metric" && styles.selectionButtonSelected
                      ]}
                      onPress={() => handleMetricSystemSelect("metric")}
                      disabled={isLoading}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.selectionButtonText,
                        (profile?.metricSystem ?? "metric") === "metric" && styles.selectionButtonTextSelected
                      ]}>
                        Metric
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.selectionButton,
                        (profile?.metricSystem ?? "metric") === "imperial" && styles.selectionButtonSelected
                      ]}
                      onPress={() => handleMetricSystemSelect("imperial")}
                      disabled={isLoading}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.selectionButtonText,
                        (profile?.metricSystem ?? "metric") === "imperial" && styles.selectionButtonTextSelected
                      ]}>
                        Imperial
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* First Day of Week Selection */}
          <View style={styles.section}>
            <View style={styles.sectionContent}>
              <View style={styles.syncOptionContent}>
                <View style={styles.syncOptionHeader}>
                  <FontAwesome5 name="calendar-week" size={20} color={Theme.colors.text.primary} />
                  <Text style={styles.syncOptionTitle}>First Day of Week</Text>
                </View>
                <View style={styles.buttonPairWrapper}>
                  <View style={styles.buttonPairContainer}>
                    <TouchableOpacity
                      style={[
                        styles.selectionButton,
                        true && styles.selectionButtonSelected
                      ]}
                      onPress={() => handleFirstDayOfWeekSelect(1)}
                      disabled={isLoading}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.selectionButtonText,
                        true && styles.selectionButtonTextSelected
                      ]}>
                        Monday
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.selectionButton,
                        false && styles.selectionButtonSelected
                      ]}
                      onPress={() => handleFirstDayOfWeekSelect(0)}
                      disabled={isLoading}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.selectionButtonText,
                        false && styles.selectionButtonTextSelected
                      ]}>
                        Sunday
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Push Notifications Toggle */}
          <View style={styles.section}>
            <View style={styles.sectionContent}>
              <View style={styles.syncOptionContent}>
                <View style={styles.syncOptionHeader}>
                  <FontAwesome5 name="bell" size={20} color={Theme.colors.text.primary} />
                  <Text style={styles.syncOptionTitle}>Push Notifications</Text>
                </View>
                <Text style={styles.syncOptionDescription}>
                  Get notified about your garden progress
                </Text>
              </View>
              <Switch
                value={false}
                onValueChange={() => { }}
                trackColor={{ false: Theme.colors.background.tertiary, true: Theme.colors.status.success }}
                thumbColor={Theme.colors.text.primary}
                ios_backgroundColor={Theme.colors.background.tertiary}
                disabled={true}
              />
            </View>
          </View>


        </View>

        {/* Data Source Section */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>Data Source</Text>
          <Text style={styles.sectionDescription}>
            Choose your primary data source for running activities. Only one source can be active at a time.
          </Text>

          {/* Run Garden In-App Recording */}
          <TouchableOpacity
            style={styles.section}
            onPress={handleRunGardenSelect}
            activeOpacity={0.7}
          >
            <View style={styles.sectionContent}>
              <View style={styles.syncOptionContent}>
                <View style={styles.syncOptionHeader}>
                  <Image source={require('@/assets/images/icon.png')} style={[styles.iconImage, { borderRadius: 10 }]} />
                  <Text style={styles.syncOptionTitle}>Run Garden In-App Recording</Text>
                  {!profile?.healthKitSyncEnabled && (
                    <View style={[styles.comingSoonBadge, { backgroundColor: Theme.colors.status.success }]}>
                      <Text style={styles.comingSoonText}>Selected</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.syncOptionDescription}>Record runs directly with Run Garden's built-in tracker</Text>
              </View>
              <FontAwesome5
                name={!profile?.healthKitSyncEnabled ? 'check' : 'chevron-right'}
                size={20}
                color={Theme.colors.text.primary}
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

          {/* Fetch Last Run Button - for testing */}
          <TouchableOpacity
            style={[styles.section, isSyncing && styles.disabledSection]}
            onPress={handleFetchLastRun}
            activeOpacity={0.7}
            disabled={isSyncing}
          >
            <View style={styles.sectionContent}>
              <View style={styles.syncOptionContent}>
                <View style={styles.syncOptionHeader}>
                  <FontAwesome5
                    name={isSyncing ? "spinner" : "play"}
                    size={20}
                    color={Theme.colors.status.warning}
                    style={isSyncing ? { transform: [{ rotate: '0deg' }] } : undefined}
                  />
                  <Text style={styles.syncOptionTitle}>
                    {isSyncing ? 'Fetching...' : 'Fetch Last Run (Test)'}
                  </Text>
                </View>
                <Text style={styles.syncOptionDescription}>
                  Test HealthKit integration by fetching your most recent run
                </Text>
              </View>
              <FontAwesome5 name="chevron-right" size={20} color={Theme.colors.status.warning} />
            </View>
          </TouchableOpacity>

          {/* Current Data Source Info */}
          {profile?.healthKitSyncEnabled && (
            <View style={styles.infoSection}>
              <FontAwesome5 name="info-circle" size={16} color={Theme.colors.status.success} />
              <Text style={styles.infoText}>
                HealthKit is your active data source. Activities sync automatically when added to Health app.
              </Text>
            </View>
          )}



          {/* No Data Source Info */}
          {!profile?.healthKitSyncEnabled && (
            <View style={styles.infoSection}>
              <FontAwesome5 name="info-circle" size={16} color={Theme.colors.text.tertiary} />
              <Text style={styles.infoText}>
                {Platform.OS === 'ios'
                  ? 'Connect to HealthKit to automatically track your runs, or use Run Garden\'s built-in recorder.'
                  : 'Use Run Garden\'s built-in recorder to track your runs.'
                }
              </Text>
            </View>
          )}


        </View>

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
  buttonPairWrapper: {
    marginTop: Theme.spacing.md,
    alignItems: 'flex-end',
  },
  buttonPairLabel: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    marginBottom: Theme.spacing.xs,
    textAlign: 'center',
  },
  buttonPairContainer: {
    flexDirection: 'row',
    borderRadius: Theme.borderRadius.medium,
    overflow: 'hidden',
    backgroundColor: Theme.colors.background.tertiary,
  },
  selectionButton: {
    flex: 1,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionButtonSelected: {
    backgroundColor: Theme.colors.special.primary.level,
  },
  selectionButtonText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  selectionButtonTextSelected: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.semibold,
  },
}); 