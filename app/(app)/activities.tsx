import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function ActivitiesScreen() {
  const { isAuthenticated } = useConvexAuth();

  // Use the Convex query directly instead of the old HealthKit-specific approach
  const activitiesForYear = useQuery(api.activities.getUserActivitiesForYear, {
    year: 2025,
    limit: 100,
  });

  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const stats = useQuery(api.activities.getActivityStats, { days: 365 });

  // Add the delete mutation
  const deleteActivity = useMutation(api.activities.deleteActivity);

  const handleActivityPress = (activity: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Convert database activity to the format expected by the activity detail screen
    const activityForDetail = {
      uuid: activity.healthKitUuid || `strava_${activity.stravaId}`,
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

  const handleRefresh = async () => {
    // Trigger a re-fetch by invalidating the queries
    // The user can manually sync in Settings if needed
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDeleteActivity = (activity: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Delete Activity',
      `Are you sure you want to delete this ${activity.workoutName || 'running'} activity from ${formatDate(activity.startDate)}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteActivity({ activityId: activity._id });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error('Error deleting activity:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to delete activity. Please try again.');
            }
          },
        },
      ]
    );
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

  const getActivityIcon = (activity: any) => {
    if (activity.source === 'strava') return '🟠'; // Orange circle for Strava
    if (activity.source === 'healthkit') return '❤️'; // Heart for HealthKit
    return '🏃‍♂️'; // Default running icon
  };

  // Loading state
  if (!isAuthenticated || activitiesForYear === undefined || profile === undefined) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Activities</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Theme.colors.accent.primary} />
          <Text style={styles.loadingText}>Loading your activities...</Text>
        </View>
      </View>
    );
  }

  // No data source configured
  if (!profile.healthKitSyncEnabled && !profile.stravaSyncEnabled) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Activities</Text>
        </View>
        <View style={styles.permissionContainer}>
          <Text style={styles.title}>Connect a Data Source</Text>
          <Text style={styles.description}>
            Connect to HealthKit or Strava in Settings to start tracking your running activities.
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
          {/* <View style={styles.dataSourceIndicator}>
            {profile.healthKitSyncEnabled && <Text style={styles.sourceIcon}>❤️</Text>}
            {profile.stravaSyncEnabled && <Text style={styles.sourceIcon}>🟠</Text>}
          </View> */}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={handleRefresh}
            tintColor={Theme.colors.accent.primary}
          />
        }
      >
        {/* Stats Summary */}
        {stats && (
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.totalWorkouts}</Text>
              <Text style={styles.statLabel}>Workouts</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{formatDistance(stats.totalDistance)}</Text>
              <Text style={styles.statLabel}>Total Distance</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.totalCalories}</Text>
              <Text style={styles.statLabel}>Calories</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {stats.averagePace > 0 ? formatPace(stats.averagePace) : '--'}
              </Text>
              <Text style={styles.statLabel}>Avg Pace</Text>
            </View>
          </View>
        )}

        {/* Activities List */}
        <View style={styles.activitiesContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activities</Text>
            <Text style={styles.sectionHint}>Long press to delete</Text>
          </View>
          {activitiesForYear?.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>🏃‍♂️</Text>
              <Text style={styles.emptyStateTitle}>No activities yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                Start running and sync your activities to see them here. Pull down to refresh or check Settings to sync manually.
              </Text>
            </View>
          ) : (
            activitiesForYear?.map((activity) => (
              <TouchableOpacity
                key={activity._id}
                style={styles.activityCard}
                onPress={() => handleActivityPress(activity)}
                onLongPress={() => handleDeleteActivity(activity)}
                activeOpacity={0.7}
              >
                <View style={styles.activityHeader}>
                  <View style={styles.activityTitleContainer}>
                    <View style={styles.activityTitle}>
                      <Text style={styles.activityType}>{activity.workoutName || 'Running'}</Text>
                      {/* <Text style={styles.sourceIndicator}>{getActivityIcon(activity)}</Text> */}
                    </View>
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

        {/* Data Source Info */}
        <View style={styles.dataSourceInfo}>
          <Text style={styles.dataSourceText}>
            {profile.healthKitSyncEnabled && profile.stravaSyncEnabled
              ? 'Showing activities from HealthKit ❤️ and Strava 🟠'
              : profile.healthKitSyncEnabled
                ? 'Showing activities from HealthKit ❤️'
                : 'Showing activities from Strava 🟠'
            }
          </Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/settings');
            }}
          >
            <Text style={styles.manageSourcesText}>Manage data sources</Text>
          </TouchableOpacity>
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
    justifyContent: 'space-between',
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
  },
  dataSourceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceIcon: {
    fontSize: 16,
    marginLeft: 4,
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
    paddingBottom: Theme.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  sectionHint: {
    fontSize: 12,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.tertiary,
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
    lineHeight: 24,
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
  activityTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  activityType: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    flex: 1,
  },
  sourceIndicator: {
    fontSize: 14,
    marginLeft: 8,
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
  dataSourceInfo: {
    padding: Theme.spacing.lg,
    alignItems: 'center',
    paddingBottom: Theme.spacing.xxxl,
  },
  dataSourceText: {
    fontSize: 14,
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.regular,
    textAlign: 'center',
    marginBottom: 8,
  },
  manageSourcesText: {
    fontSize: 14,
    color: Theme.colors.accent.primary,
    fontFamily: Theme.fonts.medium,
    textAlign: 'center',
  },
}); 