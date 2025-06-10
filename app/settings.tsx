import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import DatabaseHealthService from '@/services/DatabaseHealthService';
import DatabaseStravaService from '@/services/DatabaseStravaService';
import { useAuthActions } from "@convex-dev/auth/react";
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useConvex, useConvexAuth, useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();

  // Convex queries and mutations
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const updateSyncPreferences = useMutation(api.userProfile.updateSyncPreferences);
  const updateMetricSystem = useMutation(api.userProfile.updateMetricSystem);

  const [isLoading, setIsLoading] = useState(true);
  const [healthService, setHealthService] = useState<DatabaseHealthService | null>(null);
  const [stravaService, setStravaService] = useState<DatabaseStravaService | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isStravaAuthenticated, setIsStravaAuthenticated] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);

  useEffect(() => {
    if (isAuthenticated && convex) {
      const healthSvc = new DatabaseHealthService(convex);
      const stravaSvc = new DatabaseStravaService(convex);
      setHealthService(healthSvc);
      setStravaService(stravaSvc);

      // Check Strava authentication status
      stravaSvc.isAuthenticated().then(setIsStravaAuthenticated).catch(() => setIsStravaAuthenticated(false));
    }
    if (profile) {
      setIsLoading(false);
    }
  }, [isAuthenticated, convex, profile]);

  const handleHealthKitToggle = async (enabled: boolean) => {
    try {
      setIsLoading(true);
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
              'Please enable Health permissions in your iPhone Settings:\n\n1. Open Settings\n2. Scroll down and tap on "Privacy & Security"\n3. Tap on "Health"\n4. Find "Koko" and enable all permissions',
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

  const handleAutoSyncToggle = async (enabled: boolean) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await updateSyncPreferences({ autoSyncEnabled: enabled });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error updating auto sync:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update auto sync setting');
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
    if (!stravaService) return;

    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const success = await stravaService.authenticate();
      if (success) {
        setIsStravaAuthenticated(true);
        await updateSyncPreferences({ stravaSyncEnabled: true });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Successfully connected to Strava!');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', 'Failed to connect to Strava. Please try again.');
      }
    } catch (error) {
      console.error('Error connecting to Strava:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to connect to Strava. Please try again.');
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
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await signOut();
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await updateMetricSystem({ metricSystem: useMetric ? "metric" : "imperial" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error updating metric system:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update metric system preference');
    }
  };

  const handleGoBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
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
        {/* Account Section */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity
            style={styles.section}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // Navigate to profile editing or account details
              Alert.alert('Coming Soon', 'Profile editing features are coming soon!');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.sectionContent}>
              <Text style={styles.optionText}>Edit Profile</Text>
              <FontAwesome5 name="user-edit" size={20} color={Theme.colors.text.primary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Preferences Section */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>Preferences</Text>

          {/* Metric System Toggle */}
          <View style={styles.section}>
            <View style={styles.sectionContent}>
              <View style={styles.syncOptionContent}>
                <View style={styles.syncOptionHeader}>
                  <FontAwesome5 name="ruler" size={20} color={Theme.colors.accent.primary} />
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
        </View>

        {/* Data Sync Section */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>Data Source</Text>
          <Text style={styles.sectionDescription}>
            Choose your primary data source for running activities. Only one source can be active at a time to prevent duplicates.
          </Text>

          {/* HealthKit Sync Toggle */}
          {Platform.OS === 'ios' && (
            <View style={styles.section}>
              <View style={styles.sectionContent}>
                <View style={styles.syncOptionContent}>
                  <View style={styles.syncOptionHeader}>
                    <FontAwesome5 name="heartbeat" size={20} color={Theme.colors.status.error} />
                    <Text style={styles.syncOptionTitle}>Apple HealthKit</Text>
                  </View>
                  <Text style={styles.syncOptionDescription}>
                    Sync running activities from the Health app
                  </Text>
                </View>
                <Switch
                  value={profile?.healthKitSyncEnabled ?? false}
                  onValueChange={handleHealthKitToggle}
                  trackColor={{ false: Theme.colors.background.tertiary, true: Theme.colors.status.success }}
                  thumbColor={Theme.colors.text.primary}
                  ios_backgroundColor={Theme.colors.background.tertiary}
                  disabled={isLoading}
                />
              </View>
            </View>
          )}

          {/* Strava Sync */}
          {isStravaAuthenticated ? (
            <View style={styles.section}>
              <View style={styles.sectionContent}>
                <View style={styles.syncOptionContent}>
                  <View style={styles.syncOptionHeader}>
                    <FontAwesome5 name="running" size={20} color={Theme.colors.accent.primary} />
                    <Text style={styles.syncOptionTitle}>Strava</Text>
                    <View style={[styles.comingSoonBadge, { backgroundColor: Theme.colors.status.success }]}>
                      <Text style={styles.comingSoonText}>Connected</Text>
                    </View>
                  </View>
                  <Text style={styles.syncOptionDescription}>
                    Sync activities from your Strava account
                  </Text>
                </View>
                <Switch
                  value={profile?.stravaSyncEnabled ?? false}
                  onValueChange={handleStravaSyncToggle}
                  trackColor={{ false: Theme.colors.background.tertiary, true: Theme.colors.status.success }}
                  thumbColor={Theme.colors.text.primary}
                  ios_backgroundColor={Theme.colors.background.tertiary}
                  disabled={isLoading}
                />
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.section]}
              onPress={handleStravaConnect}
              activeOpacity={0.7}
            >
              <View style={styles.sectionContent}>
                <View style={styles.syncOptionContent}>
                  <View style={styles.syncOptionHeader}>
                    <FontAwesome5 name="running" size={20} color={Theme.colors.accent.primary} />
                    <Text style={styles.syncOptionTitle}>Strava</Text>
                  </View>
                  <Text style={styles.syncOptionDescription}>
                    Connect to sync activities from your Strava account
                  </Text>
                </View>
                <FontAwesome5 name="chevron-right" size={20} color={Theme.colors.text.primary} />
              </View>
            </TouchableOpacity>
          )}

          {/* Auto Sync Toggle */}
          {(profile?.healthKitSyncEnabled || profile?.stravaSyncEnabled) && (
            <View style={styles.section}>
              <View style={styles.sectionContent}>
                <View style={styles.syncOptionContent}>
                  <View style={styles.syncOptionHeader}>
                    <FontAwesome5 name="sync" size={20} color={Theme.colors.accent.primary} />
                    <Text style={styles.syncOptionTitle}>Auto Sync</Text>
                  </View>
                  <Text style={styles.syncOptionDescription}>
                    Automatically sync when opening the app
                  </Text>
                </View>
                <Switch
                  value={profile?.autoSyncEnabled ?? false}
                  onValueChange={handleAutoSyncToggle}
                  trackColor={{ false: Theme.colors.background.tertiary, true: Theme.colors.status.success }}
                  thumbColor={Theme.colors.text.primary}
                  ios_backgroundColor={Theme.colors.background.tertiary}
                />
              </View>
            </View>
          )}

          {/* HealthKit Manual Sync Button */}
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

          {/* Strava Manual Sync Button */}
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



          {/* Strava Disconnect Button */}
          {isStravaAuthenticated && (
            <TouchableOpacity
              style={styles.section}
              onPress={handleStravaDisconnect}
              activeOpacity={0.7}
            >
              <View style={styles.sectionContent}>
                <View style={styles.syncOptionContent}>
                  <View style={styles.syncOptionHeader}>
                    <FontAwesome5 name="unlink" size={20} color={Theme.colors.status.error} />
                    <Text style={[styles.syncOptionTitle, { color: Theme.colors.status.error }]}>
                      Disconnect Strava
                    </Text>
                  </View>
                  <Text style={styles.syncOptionDescription}>
                    Remove Strava connection and disable syncing
                  </Text>
                </View>
                <FontAwesome5 name="chevron-right" size={20} color={Theme.colors.status.error} />
              </View>
            </TouchableOpacity>
          )}

          {/* Current Data Source Info */}
          {(profile?.healthKitSyncEnabled || profile?.stravaSyncEnabled) && (
            <View style={styles.infoSection}>
              <FontAwesome5 name="info-circle" size={16} color={Theme.colors.status.success} />
              <Text style={styles.infoText}>
                {profile?.healthKitSyncEnabled
                  ? 'HealthKit is your active data source. Switch to Strava anytime if you prefer.'
                  : 'Strava is your active data source. Switch to HealthKit anytime if you prefer.'
                }
              </Text>
            </View>
          )}

          {/* No Data Source Info */}
          {!profile?.healthKitSyncEnabled && !profile?.stravaSyncEnabled && (
            <View style={styles.infoSection}>
              <FontAwesome5 name="info-circle" size={16} color={Theme.colors.text.tertiary} />
              <Text style={styles.infoText}>
                {Platform.OS === 'ios'
                  ? 'Choose HealthKit or Strava as your primary data source to automatically track your runs.'
                  : 'Connect to Strava to automatically track your runs.'
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
        </View>

        {/* Data Management Section */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>Data Management</Text>

          {/* Smart Deduplication Button - Always show if both sources have been used */}
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
                    color={Theme.colors.accent.primary}
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
              <FontAwesome5 name="chevron-right" size={20} color={Theme.colors.accent.primary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.section}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert('Coming Soon', 'Health data export features are coming soon!');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.sectionContent}>
              <Text style={styles.optionText}>Export Data</Text>
              <FontAwesome5 name="download" size={20} color={Theme.colors.text.primary} />
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
              Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/');
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
              Alert.alert('Coming Soon', 'Privacy policy will be available soon!');
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
              Linking.openURL('mailto:support@koko.app');
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

        {/* Bottom spacing for tab bar */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </LinearGradient>
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
    paddingHorizontal: Theme.spacing.xl,
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
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.border.primary,
    ...Theme.shadows.small,
  },
  sectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Theme.spacing.lg,
  },
  optionText: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
    flex: 1,
  },
  infoSection: {
    backgroundColor: Theme.colors.background.secondary,
    marginHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.medium,
    padding: Theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...Theme.shadows.small,
    borderWidth: 1,
    borderColor: Theme.colors.border.primary,
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
  },
  syncOptionTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
    marginLeft: Theme.spacing.sm,
  },
  syncOptionDescription: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.tertiary,
    marginLeft: 28, // Align with title
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
  bottomSpacing: {
    height: 100,
  },
  closeButton: {
    padding: Theme.spacing.sm,
  },
}); 