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
      setHasPermissions(true);

      // Then try to sync in background if needed
      if (Platform.OS === 'ios') {
        const syncNeeded = await service.isSyncNeeded();
        if (syncNeeded) {
          console.log('Background sync needed, attempting...');
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
        // Use auto-sync (will sync if needed)
        activitiesData = await service.getActivitiesWithAutoSync(30);
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
          <Text style={styles.title}>Health Access Required</Text>
          <Text style={styles.description}>
            To track your running activities, Koko needs access to your health data.
          </Text>
          <TouchableOpacity style={styles.button} onPress={requestPermissions}>
            <Text style={styles.buttonText}>Grant Health Access</Text>
          </TouchableOpacity>
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
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#000',
    marginBottom: 4,
  },
  headerSubtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Medium',
    color: '#000',
  },
  syncStatus: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#666',
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontFamily: 'SF-Pro-Rounded-Medium',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontFamily: 'SF-Pro-Rounded-Bold',
    marginBottom: 16,
    color: '#333',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    fontFamily: 'SF-Pro-Rounded-Regular',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#ffffff',
    marginVertical: 16,
    marginHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontFamily: 'SF-Pro-Rounded-Medium',
  },
  activitiesContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'SF-Pro-Rounded-Bold',
    marginBottom: 16,
    color: '#333',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'SF-Pro-Rounded-Regular',
  },
  activityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  activityTitleContainer: {
    flex: 1,
  },
  activityType: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#333',
    marginBottom: 4,
  },
  activityDate: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'SF-Pro-Rounded-Regular',
  },
  chevron: {
    fontSize: 24,
    color: '#007AFF',
    fontFamily: 'SF-Pro-Rounded-Medium',
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
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#333',
  },
  activityLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontFamily: 'SF-Pro-Rounded-Regular',
  },
  error: {
    color: '#ff3b30',
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Regular',
  },
}); 