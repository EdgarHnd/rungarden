import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import DatabaseHealthService from '@/services/DatabaseHealthService';
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

  const [isLoading, setIsLoading] = useState(true);
  const [healthService, setHealthService] = useState<DatabaseHealthService | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (isAuthenticated && convex) {
      const service = new DatabaseHealthService(convex);
      setHealthService(service);
    }
    if (profile) {
      setIsLoading(false);
    }
  }, [isAuthenticated, convex, profile]);

  const handleHealthKitToggle = async (enabled: boolean) => {
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (enabled && Platform.OS === 'ios') {
        // Request HealthKit permissions when enabling
        if (healthService) {
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

  const handleStravaSync = () => {
    Alert.alert('Coming Soon', 'Strava integration is coming soon! This will allow you to sync your activities from Strava as an alternative to HealthKit.');
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

        {/* Data Sync Section */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>Data Sources</Text>
          <Text style={styles.sectionDescription}>
            Choose how you want to sync your running activities. You can enable multiple sources.
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

          {/* Strava Sync (Coming Soon) */}
          <TouchableOpacity
            style={[styles.section, styles.disabledSection]}
            onPress={handleStravaSync}
            activeOpacity={0.7}
          >
            <View style={styles.sectionContent}>
              <View style={styles.syncOptionContent}>
                <View style={styles.syncOptionHeader}>
                  <FontAwesome5 name="running" size={20} color={Theme.colors.accent.primary} />
                  <Text style={styles.syncOptionTitle}>Strava</Text>
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonText}>Soon</Text>
                  </View>
                </View>
                <Text style={styles.syncOptionDescription}>
                  Sync activities from your Strava account
                </Text>
              </View>
              <FontAwesome5 name="chevron-right" size={20} color={Theme.colors.text.primary} />
            </View>
          </TouchableOpacity>

          {/* Auto Sync Toggle */}
          {profile?.healthKitSyncEnabled && (
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

          {/* Manual Sync Button */}
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
                      {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </Text>
                  </View>
                  <Text style={styles.syncOptionDescription}>
                    {profile?.lastHealthKitSync
                      ? `Last sync: ${new Date(profile.lastHealthKitSync).toLocaleString()}`
                      : 'Manually sync your activities now'
                    }
                  </Text>
                </View>
                <FontAwesome5 name="chevron-right" size={20} color={Theme.colors.accent.primary} />
              </View>
            </TouchableOpacity>
          )}

          {/* Sync Status Info */}
          {!profile?.healthKitSyncEnabled && Platform.OS === 'ios' && (
            <View style={styles.infoSection}>
              <FontAwesome5 name="info-circle" size={16} color={Theme.colors.text.tertiary} />
              <Text style={styles.infoText}>
                Enable HealthKit sync to automatically track your runs from the Health app.
              </Text>
            </View>
          )}

          {Platform.OS !== 'ios' && (
            <View style={styles.infoSection}>
              <FontAwesome5 name="info-circle" size={16} color={Theme.colors.text.tertiary} />
              <Text style={styles.infoText}>
                HealthKit is only available on iOS devices. Strava integration will be available soon for all platforms.
              </Text>
            </View>
          )}
        </View>

        {/* Health Data Section */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>Health Data</Text>
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