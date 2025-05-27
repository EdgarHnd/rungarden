import { RunningActivity } from '@/services/HealthService';
import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface ActivityDetailModalProps {
  activity: RunningActivity | null;
  isVisible: boolean;
  onClose: () => void;
  formatDistance: (meters: number) => string;
  formatPace: (pace: number) => string;
  formatDate: (dateString: string) => string;
}

export default function ActivityDetailModal({
  activity,
  isVisible,
  onClose,
  formatDistance,
  formatPace,
  formatDate,
}: ActivityDetailModalProps) {
  if (!activity) return null;

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDetailedDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculatePace = (duration: number, distance: number) => {
    const paceMinPerKm = (duration / (distance / 1000));
    return paceMinPerKm;
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Done</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Activity Details</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Activity Title */}
          <View style={styles.titleSection}>
            <Text style={styles.activityTitle}>
              {activity.workoutName || 'Running'}
            </Text>
            <Text style={styles.activityDate}>
              {formatDetailedDate(activity.startDate)}
            </Text>
          </View>

          {/* Main Stats */}
          <View style={styles.mainStatsContainer}>
            <View style={styles.mainStat}>
              <Text style={styles.mainStatValue}>
                {formatDistance(activity.distance)}
              </Text>
              <Text style={styles.mainStatLabel}>Distance</Text>
            </View>
            <View style={styles.mainStat}>
              <Text style={styles.mainStatValue}>
                {formatDuration(activity.duration)}
              </Text>
              <Text style={styles.mainStatLabel}>Duration</Text>
            </View>
            <View style={styles.mainStat}>
              <Text style={styles.mainStatValue}>
                {formatPace(calculatePace(activity.duration, activity.distance))}
              </Text>
              <Text style={styles.mainStatLabel}>Avg Pace</Text>
            </View>
          </View>

          {/* Additional Stats */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statCardTitle}>Energy</Text>
              <Text style={styles.statCardValue}>{activity.calories}</Text>
              <Text style={styles.statCardUnit}>calories</Text>
            </View>

            {activity.averageHeartRate && (
              <View style={styles.statCard}>
                <Text style={styles.statCardTitle}>Heart Rate</Text>
                <Text style={styles.statCardValue}>
                  {Math.round(activity.averageHeartRate)}
                </Text>
                <Text style={styles.statCardUnit}>avg bpm</Text>
              </View>
            )}



            <View style={styles.statCard}>
              <Text style={styles.statCardTitle}>Distance</Text>
              <Text style={styles.statCardValue}>
                {(activity.distance / 1000).toFixed(2)}
              </Text>
              <Text style={styles.statCardUnit}>kilometers</Text>
            </View>
          </View>

          {/* Performance Insights */}
          <View style={styles.insightsSection}>
            <Text style={styles.sectionTitle}>Performance</Text>
            <View style={styles.insightCard}>
              <Text style={styles.insightTitle}>Workout Summary</Text>
              <Text style={styles.insightText}>
                You completed a {formatDistance(activity.distance)} run in{' '}
                {formatDuration(activity.duration)} at an average pace of{' '}
                {formatPace(calculatePace(activity.duration, activity.distance))}.
                {activity.calories && ` You burned ${activity.calories} calories.`}
              </Text>
            </View>

            {activity.averageHeartRate && (
              <View style={styles.insightCard}>
                <Text style={styles.insightTitle}>Heart Rate Zone</Text>
                <Text style={styles.insightText}>
                  Your average heart rate was {Math.round(activity.averageHeartRate)} bpm during this workout.
                </Text>
              </View>
            )}
          </View>

          {/* Activity ID (for debugging/technical info) */}
          <View style={styles.technicalSection}>
            <Text style={styles.technicalTitle}>Activity ID</Text>
            <Text style={styles.technicalText}>{activity.uuid}</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e7',
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontFamily: 'SF-Pro-Rounded-Medium',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#333',
  },
  placeholder: {
    width: 60, // Same width as close button for centering
  },
  content: {
    flex: 1,
  },
  titleSection: {
    padding: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e7',
  },
  activityTitle: {
    fontSize: 28,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#333',
    marginBottom: 8,
  },
  activityDate: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'SF-Pro-Rounded-Regular',
  },
  mainStatsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e7',
  },
  mainStat: {
    flex: 1,
    alignItems: 'center',
  },
  mainStatValue: {
    fontSize: 24,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  mainStatLabel: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'SF-Pro-Rounded-Medium',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '48%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statCardTitle: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'SF-Pro-Rounded-Medium',
    marginBottom: 8,
  },
  statCardValue: {
    fontSize: 20,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#333',
    marginBottom: 4,
  },
  statCardUnit: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'SF-Pro-Rounded-Regular',
  },
  insightsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#333',
    marginBottom: 16,
  },
  insightCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  insightTitle: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#333',
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    fontFamily: 'SF-Pro-Rounded-Regular',
  },
  technicalSection: {
    padding: 20,
    paddingBottom: 40,
  },
  technicalTitle: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'SF-Pro-Rounded-Medium',
    marginBottom: 8,
  },
  technicalText: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'SF-Pro-Text-Mono',
    backgroundColor: '#f5f5f7',
    padding: 12,
    borderRadius: 8,
  },
}); 