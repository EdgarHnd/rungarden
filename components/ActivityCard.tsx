import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { formatDistance, formatDuration } from '@/utils/formatters';
import { useQuery } from 'convex/react';
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface ActivityCardProps {
  activity: any;
  handleActivityPress: (activity: any) => void;
}

import { getImageSource } from '@/utils/plantImageMapping';

export const ActivityCard = ({
  activity,
  handleActivityPress
}: ActivityCardProps) => {
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const metricSystem = (profile?.metricSystem ?? 'metric') as 'metric' | 'imperial';

  // Get plant associated with this activity
  const activityPlant = useQuery(api.plants.getPlantByActivityId, {
    activityId: activity._id,
  });

  return (
    <TouchableOpacity
      style={styles.activityCard}
      onPress={() => handleActivityPress(activity)}
      activeOpacity={0.8}
    >
      <View style={styles.cardContent}>
        {/* Top Row - Date and Duration */}
        <View style={styles.topRow}>
          <View style={styles.dateContainer}>
            <Text style={styles.dayOfWeek}>
              {new Date(activity.startDate).toLocaleDateString('en-US', { weekday: 'long' })}
            </Text>
            <Text style={styles.runDate}>
              {new Date(activity.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </View>
          <Text style={styles.durationText}>
            {formatDuration(activity.duration)}
          </Text>
        </View>

        {/* Bottom Row - Plant and Distance */}
        <View style={styles.bottomRow}>
          <Image
            source={getImageSource(activityPlant?.plantType?.imagePath, activityPlant?.plantType?.distanceRequired)}
            style={styles.plantImage}
            resizeMode="contain"
          />
          <Text style={styles.distanceText}>
            {formatDistance(activity.distance, metricSystem)}
          </Text>
        </View>
      </View>
    </TouchableOpacity >
  );
};

const styles = StyleSheet.create({
  activityCard: {
    backgroundColor: "white",
    borderRadius: Theme.borderRadius.xl,
    borderWidth: 3,
    borderColor: Theme.colors.text.primary,
    marginVertical: Theme.spacing.xs,
  },
  cardContent: {
    flexDirection: 'column',
    padding: Theme.spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  dayOfWeek: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  runDate: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
  },
  distanceText: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  plantImage: {
    width: 80,
    height: 80,
  },
  durationText: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
  },
}); 