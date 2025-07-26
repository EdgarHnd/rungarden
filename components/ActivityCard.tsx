import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { formatDate, formatDistance, formatDuration, formatPace } from '@/utils/formatters';
import { FontAwesome6 } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface ActivityCardProps {
  activity: any;
  handleActivityPress: (activity: any) => void;
}

export const ActivityCard = ({
  activity,
  handleActivityPress
}: ActivityCardProps) => {
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const metricSystem = (profile?.metricSystem ?? 'metric') as 'metric' | 'imperial';

  return (
    <TouchableOpacity
      style={styles.activityCard}
      onPress={() => handleActivityPress(activity)}
      activeOpacity={0.7}
    >
      <View style={styles.activityHeader}>
        <View style={styles.activityTitleContainer}>
          <Text style={styles.activityType}>{activity.workoutName || 'Running'}</Text>
          <Text style={styles.activityDate}>{formatDate(activity.startDate)}</Text>
        </View>
        <FontAwesome6 name="chevron-right" size={18} color="#fff" />
      </View>
      <View style={styles.activityStats}>
        <View style={styles.activityStat}>
          <Text style={styles.activityValue}>
            {formatDistance(activity.distance, metricSystem)}
          </Text>
          <Text style={styles.activityLabel}>Distance</Text>
        </View>
        <View style={styles.activityStat}>
          <Text style={styles.activityValue}>{formatDuration(activity.duration)}</Text>
          <Text style={styles.activityLabel}>Duration</Text>
        </View>
        <View style={styles.activityStat}>
          <Text style={styles.activityValue}>{activity.calories}</Text>
          <Text style={styles.activityLabel}>Calories</Text>
        </View>
        {activity.distance > 0 && activity.duration > 0 && (
          <View style={styles.activityStat}>
            <Text style={styles.activityValue}>
              {formatPace(activity.duration, activity.distance, metricSystem)}
            </Text>
            <Text style={styles.activityLabel}>Pace</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  activityCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  activityTitleContainer: {
    flex: 1,
  },
  activityType: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    marginBottom: 2,
  },
  activityDate: {
    fontSize: 12,
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.regular,
  },
  chevron: {
    fontSize: 20,
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
    fontSize: 14,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
  },
  activityLabel: {
    fontSize: 10,
    color: Theme.colors.text.tertiary,
    marginTop: 2,
    fontFamily: Theme.fonts.regular,
  },
}); 