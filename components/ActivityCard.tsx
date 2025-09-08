import { api } from '@/convex/_generated/api';
import { formatDistance, formatDuration } from '@/utils/formatters';
import { useQuery } from 'convex/react';
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface ActivityCardProps {
  activity: any;
  handleActivityPress: (activity: any) => void;
}

// Helper function to get image source from path
const getImageSource = (imagePath: string) => {
  // Map image paths to actual require statements
  const imageMap: { [key: string]: any } = {
    'assets/images/plants/01.png': require('../assets/images/plants/01.png'),
    'assets/images/plants/carrot.png': require('../assets/images/plants/carrot.png'),
    'assets/images/plants/sakura.png': require('../assets/images/plants/sakura.png'),
  };

  return imageMap[imagePath] || null;
};

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
        {/* Left side - Date and Plant */}
        <View style={styles.leftSection}>
          <Text style={styles.dayOfWeek}>
            {new Date(activity.startDate).toLocaleDateString('en-US', { weekday: 'long' })}
          </Text>
          <Text style={styles.runDate}>
            {new Date(activity.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>

          {/* Plant Illustration */}
          <View style={styles.plantContainer}>
            {(() => {
              const imagePath = activityPlant?.plantType?.imagePath;
              const imageSource = imagePath ? getImageSource(imagePath) : null;

              if (imageSource) {
                return (
                  <Image
                    source={imageSource}
                    style={styles.plantImage}
                    resizeMode="contain"
                  />
                );
              } else {
                return (
                  <Text style={styles.plantEmoji}>
                    {activityPlant?.plantType?.emoji || '🌱'}
                  </Text>
                );
              }
            })()}
          </View>
        </View>

        {/* Right side - Stats */}
        <View style={styles.rightSection}>
          <Text style={styles.distanceText}>
            DISTANCE {formatDistance(activity.distance, metricSystem)}
          </Text>
          <Text style={styles.paceText}>
            PACE {activity.duration > 0 ? Math.round((activity.duration / 60) / (activity.distance / 1000)) : 0}:{String(Math.round(((activity.duration / 60) / (activity.distance / 1000) % 1) * 60)).padStart(2, '0')} /km
          </Text>
          <Text style={styles.durationText}>
            DURATION {formatDuration(activity.duration)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  activityCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#000000',
    marginVertical: 8,
  },
  cardContent: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  rightSection: {
    flex: 2,
    alignItems: 'flex-end',
    paddingLeft: 20,
  },
  dayOfWeek: {
    fontSize: 20,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  runDate: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#666666',
    marginBottom: 16,
  },
  plantContainer: {
    alignItems: 'center',
  },
  plantEmoji: {
    fontSize: 48,
  },
  plantImage: {
    width: 48,
    height: 48,
  },
  distanceText: {
    fontSize: 12,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#000000',
    marginBottom: 6,
    letterSpacing: 1,
    textAlign: 'right',
  },
  paceText: {
    fontSize: 12,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#000000',
    marginBottom: 6,
    letterSpacing: 1,
    textAlign: 'right',
  },
  durationText: {
    fontSize: 12,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#000000',
    letterSpacing: 1,
    textAlign: 'right',
  },
}); 