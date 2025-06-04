import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';
import DatabaseHealthService, { DatabaseActivity, SyncResult, UserProfile } from '@/services/DatabaseHealthService';
import { useConvex, useConvexAuth, useQuery } from "convex/react";
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function RunsScreen() {
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();
  const activitiesForYear = useQuery(api.activities.getUserActivitiesForYear, {
    year: 2025,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<Doc<"activities">[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [healthService, setHealthService] = useState<DatabaseHealthService | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    if (isAuthenticated && convex) {
      const service = new DatabaseHealthService(convex);
      setHealthService(service);
      checkPermissions(service);
    }
  }, [isAuthenticated, convex]);

  const checkPermissions = async (service: DatabaseHealthService) => {
    try {
      // Try to load data from database first
      await loadHealthData(service, false); // Load from cache first

      // Check if user has HealthKit sync enabled
      const isHealthKitEnabled = await service.isHealthKitSyncEnabled();

      if (!isHealthKitEnabled) {
        setHasPermissions(false);
        setError('HealthKit sync is disabled. Enable it in Settings to sync your workouts.');
        setIsLoading(false);
        return;
      }

      setHasPermissions(true);

      // Then try to sync in background if needed and auto-sync is enabled
      if (Platform.OS === 'ios') {
        const isAutoSyncEnabled = await service.isAutoSyncEnabled();
        if (isAutoSyncEnabled) {
          console.log('Auto-sync enabled, attempting background sync...');
          await syncInBackground(service);
        }
      }
    } catch (err) {
      console.error('Error checking permissions or loading data:', err);

      if (Platform.OS === 'ios') {
        // If database is empty, we need HealthKit permissions
        setHasPermissions(false);
      } else {
        setError('This feature requires iOS and Apple HealthKit');
      }
      setIsLoading(false);
    }
  };

  const requestPermissions = async () => {
    if (!healthService) return;

    try {
      setIsLoading(true);
      setError(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Initialize HealthKit and request permissions
      await healthService.initializeHealthKit();
      setHasPermissions(true);

      // Force sync after getting permissions
      const syncResult = await healthService.forceSyncFromHealthKit(30);
      setLastSyncResult(syncResult);

      await loadHealthData(healthService, false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Error requesting permissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to request permissions');
      setHasPermissions(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // Show alert with instructions if permissions are denied
      Alert.alert(
        'Health Permissions Required',
        'Please enable Health permissions in your iPhone Settings:\n\n1. Open Settings\n2. Scroll down and tap on "Privacy & Security"\n3. Tap on "Health"\n4. Find "Koko" and enable all permissions',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const syncInBackground = async (service: DatabaseHealthService) => {
    try {
      const syncResult = await service.forceSyncFromHealthKit(30);
      setLastSyncResult(syncResult);

      if (syncResult.created > 0 || syncResult.updated > 0) {
        // Reload data if there were changes
        await loadHealthData(service, false);
      }
    } catch (err) {
      console.error('Background sync failed:', err);
      // Don't show error to user for background sync failures
    }
  };

  const loadHealthData = async (service: DatabaseHealthService, forceSync: boolean = false) => {
    try {
      setIsLoading(true);
      setError(null);

      let activitiesData: DatabaseActivity[];

      if (forceSync) {
        // Force sync from HealthKit
        const syncResult = await service.forceSyncFromHealthKit(30);
        setLastSyncResult(syncResult);
        activitiesData = await service.getActivitiesFromDatabase(30, 50);
      } else {
        // Use optional sync (will sync if enabled)
        activitiesData = await service.getActivitiesWithOptionalSync(30);
      }

      // Sort activities by date in descending order (most recent first)
      const sortedActivities = activitiesData.sort((a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
      //setActivities(sortedActivities);

      // Get profile data for stats
      const profileData = await service.getUserProfile();
      setProfile(profileData);
    } catch (err) {
      console.error('Error loading health data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load health data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    if (!healthService) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRefreshing(true);
    await loadHealthData(healthService, true); // Force sync on refresh
  };

  const handleActivityPress = (activity: DatabaseActivity) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Convert database activity to the format expected by the activity detail screen
    const activityForDetail = {
      uuid: activity.healthKitUuid,
      startDate: activity.startDate,
      endDate: activity.endDate,
      duration: activity.duration,
      distance: activity.distance,
      calories: activity.calories,
      averageHeartRate: activity.averageHeartRate,
      workoutName: activity.workoutName,
    };

    router.push({
      pathname: '/activity-detail',
      params: {
        activity: JSON.stringify(activityForDetail)
      }
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDistance = (meters: number) => {
    const kilometers = meters / 1000;
    return `${kilometers.toFixed(2)} km`;
  };

  const formatPace = (pace: number) => {
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
  };

  if (Platform.OS !== 'ios') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Activities</Text>
        </View>
        <Text style={styles.error}>Apple HealthKit is only available on iOS devices.</Text>
      </View>
    );
  }

  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Activities</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.loadingText}>Loading your activities...</Text>
        </View>
      </View>
    );
  }

  if (!hasPermissions) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Activities</Text>
        </View>
        <View style={styles.permissionContainer}>
          <Text style={styles.title}>HealthKit Sync Required</Text>
          <Text style={styles.description}>
            To view your running activities, enable HealthKit sync in Settings.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/settings');
            }}
          >
            <Text style={styles.buttonText}>Open Settings</Text>
          </TouchableOpacity>
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={requestPermissions}
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>Request Permissions</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (error && activities.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Activities</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={() => healthService && loadHealthData(healthService, true)}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activities</Text>
        <View style={styles.headerSubtitleContainer}>
          <Text style={styles.headerSubtitle}>Your running history</Text>
          {lastSyncResult && (
            <Text style={styles.syncStatus}>
              Last sync: {lastSyncResult.created} new, {lastSyncResult.updated} updated
            </Text>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
      >
        {/* Stats Summary */}
        {profile && (
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{profile.totalWorkouts}</Text>
              <Text style={styles.statLabel}>Workouts</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{formatDistance(profile.totalDistance)}</Text>
              <Text style={styles.statLabel}>Total Distance</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{profile.totalCalories}</Text>
              <Text style={styles.statLabel}>Calories</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{formatDistance(profile.weeklyGoal)}</Text>
              <Text style={styles.statLabel}>Weekly Goal</Text>
            </View>
          </View>
        )}

        {/* Activities List */}
        <View style={styles.activitiesContainer}>
          <Text style={styles.sectionTitle}>Recent Activities</Text>
          {activitiesForYear?.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>🏃‍♂️</Text>
              <Text style={styles.emptyStateTitle}>No activities yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                {Platform.OS === 'ios'
                  ? 'Start running or pull down to sync from Health app'
                  : 'Start running to see your activities here'
                }
              </Text>
            </View>
          ) : (
            activitiesForYear?.map((activity) => (
              <TouchableOpacity
                key={activity._id}
                style={styles.activityCard}
                onPress={() => handleActivityPress(activity)}
                activeOpacity={0.7}
              >
                <View style={styles.activityHeader}>
                  <View style={styles.activityTitleContainer}>
                    <Text style={styles.activityType}>{activity.workoutName || 'Running'}</Text>
                    <Text style={styles.activityDate}>{formatDate(activity.startDate)}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
                <View style={styles.activityStats}>
                  <View style={styles.activityStat}>
                    <Text style={styles.activityValue}>
                      {formatDistance(activity.distance)}
                    </Text>
                    <Text style={styles.activityLabel}>Distance</Text>
                  </View>
                  <View style={styles.activityStat}>
                    <Text style={styles.activityValue}>{activity.duration} min</Text>
                    <Text style={styles.activityLabel}>Duration</Text>
                  </View>
                  <View style={styles.activityStat}>
                    <Text style={styles.activityValue}>{activity.calories}</Text>
                    <Text style={styles.activityLabel}>Calories</Text>
                  </View>
                  {activity.pace && (
                    <View style={styles.activityStat}>
                      <Text style={styles.activityValue}>
                        {formatPace(activity.pace)}
                      </Text>
                      <Text style={styles.activityLabel}>Pace</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
  },
  header: {
    paddingTop: 60,
    paddingBottom: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.xl,
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 4,
  },
  headerSubtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
  },
  syncStatus: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.tertiary,
    marginLeft: Theme.spacing.sm,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
  loadingText: {
    marginTop: Theme.spacing.lg,
    fontSize: 16,
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.medium,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
  title: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    marginBottom: Theme.spacing.lg,
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    marginBottom: Theme.spacing.xxxl,
    lineHeight: 24,
    fontFamily: Theme.fonts.regular,
  },
  button: {
    backgroundColor: Theme.colors.accent.primary,
    paddingHorizontal: Theme.spacing.xxxl,
    paddingVertical: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.medium,
    minWidth: 200,
  },
  buttonText: {
    color: Theme.colors.text.primary,
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: Theme.colors.text.muted,
    paddingHorizontal: Theme.spacing.xxxl,
    paddingVertical: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.medium,
    minWidth: 200,
    marginTop: Theme.spacing.lg,
  },
  secondaryButtonText: {
    color: Theme.colors.text.primary,
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: Theme.spacing.lg,
    backgroundColor: Theme.colors.background.secondary,
    marginVertical: Theme.spacing.lg,
    marginHorizontal: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.xl,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Theme.colors.text.tertiary,
    marginTop: 4,
    fontFamily: Theme.fonts.medium,
  },
  activitiesContainer: {
    padding: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xxxl,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    marginBottom: Theme.spacing.lg,
    color: Theme.colors.text.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: Theme.spacing.lg,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.sm,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    fontFamily: Theme.fonts.regular,
  },
  activityCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    marginBottom: Theme.spacing.md,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  activityTitleContainer: {
    flex: 1,
  },
  activityType: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    marginBottom: 4,
  },
  activityDate: {
    fontSize: 14,
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.regular,
  },
  chevron: {
    fontSize: 24,
    color: Theme.colors.accent.primary,
    fontFamily: Theme.fonts.medium,
  },
  activityStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activityStat: {
    alignItems: 'center',
    flex: 1,
  },
  activityValue: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
  },
  activityLabel: {
    fontSize: 12,
    color: Theme.colors.text.tertiary,
    marginTop: 4,
    fontFamily: Theme.fonts.regular,
  },
  error: {
    color: Theme.colors.status.error,
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 16,
    fontFamily: Theme.fonts.regular,
  },
}); 