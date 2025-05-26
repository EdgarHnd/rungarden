import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import HealthService, { HealthStats, RunningActivity } from '../services/HealthService';

export default function HealthDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<RunningActivity[]>([]);
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [hasPermissions, setHasPermissions] = useState(false);

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
        <Text style={styles.error}>Apple HealthKit is only available on iOS devices.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (!hasPermissions) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Health Access Required</Text>
        <Text style={styles.description}>
          To track your running activities, Koko needs access to your health data.
        </Text>
        <View style={styles.buttonContainer}>
          <Button
            title="Grant Health Access"
            onPress={requestPermissions}
          />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
        <View style={styles.buttonContainer}>
          <Button
            title="Try Again"
            onPress={checkPermissions}
          />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
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
          <Text style={styles.noData}>No running activities found</Text>
        ) : (
          activities.map((activity) => (
            <View key={activity.uuid} style={styles.activityCard}>
              <View style={styles.activityHeader}>
                <Text style={styles.activityType}>{activity.workoutName || 'Running'}</Text>
                <Text style={styles.activityDate}>{formatDate(activity.startDate)}</Text>
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
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#ffffff',
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  activitiesContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  activityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activityType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  activityDate: {
    fontSize: 14,
    color: '#666',
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
    fontWeight: '600',
    color: '#333',
  },
  activityLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  error: {
    color: '#ff3b30',
    textAlign: 'center',
    margin: 16,
    fontSize: 16,
  },
  noData: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 24,
  },
  buttonContainer: {
    marginTop: 20,
    width: '80%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
});
