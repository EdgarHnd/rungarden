import ActivityDetailModal from '@/components/ActivityDetailModal';
import HealthService, { HealthStats, RunningActivity } from '@/services/HealthService';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function RunsScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<RunningActivity[]>([]);
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<RunningActivity | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      // Try to load health data directly
      await loadHealthData();
      setHasPermissions(true);
    } catch (err) {
      // If loading fails, assume we need permissions
      setHasPermissions(false);
      setIsLoading(false);
    }
  };

  const requestPermissions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Initialize HealthKit and request permissions
      await HealthService.initializeHealthKit();
      setHasPermissions(true);
      await loadHealthData();
    } catch (err) {
      console.error('Error requesting permissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to request permissions');
      setHasPermissions(false);

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

  const loadHealthData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get running activities for the last 30 days
      const runningActivities = await HealthService.getRunningActivities(30);
      // Sort activities by date in descending order (most recent first)
      const sortedActivities = runningActivities.sort((a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
      setActivities(sortedActivities);

      // Calculate stats from activities
      const healthStats = HealthService.calculateHealthStats(sortedActivities);
      setStats(healthStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load health data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivityPress = (activity: RunningActivity) => {
    setSelectedActivity(activity);
    setIsModalVisible(true);
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

  if (isLoading) {
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

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Activities</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={checkPermissions}>
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
        <Text style={styles.headerSubtitle}>Your running history</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
              <Text style={styles.statValue}>{formatPace(stats.averagePace)}</Text>
              <Text style={styles.statLabel}>Avg Pace</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.totalCalories}</Text>
              <Text style={styles.statLabel}>Calories</Text>
            </View>
          </View>
        )}

        {/* Activities List */}
        <View style={styles.activitiesContainer}>
          <Text style={styles.sectionTitle}>Recent Activities</Text>
          {activities.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>🏃‍♂️</Text>
              <Text style={styles.emptyStateTitle}>No activities yet</Text>
              <Text style={styles.emptyStateSubtitle}>Start running to see your activities here</Text>
            </View>
          ) : (
            activities.map((activity) => (
              <TouchableOpacity
                key={activity.uuid}
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
                  {activity.averageHeartRate && (
                    <View style={styles.activityStat}>
                      <Text style={styles.activityValue}>
                        {Math.round(activity.averageHeartRate)}
                      </Text>
                      <Text style={styles.activityLabel}>Avg HR</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Activity Detail Modal */}
      <ActivityDetailModal
        activity={selectedActivity}
        isVisible={isModalVisible}
        onClose={() => {
          setIsModalVisible(false);
          setSelectedActivity(null);
        }}
        formatDistance={formatDistance}
        formatPace={formatPace}
        formatDate={formatDate}
      />
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
  headerSubtitle: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Medium',
    color: '#000',
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