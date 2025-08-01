import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface WorkoutCardProps {
  title?: string;
  distance?: string;
  duration?: string;
  pace?: string;
  calories?: string;
  weeklyProgress?: number;
  weeklyGoal?: string;
  onPress?: () => void;
  distanceInMeters?: number;
}

export default function WorkoutCard({
  title = "Morning Run",
  distance = "6.79",
  duration = "36:41",
  pace = "5:24",
  calories = "486",
  weeklyProgress = 6.8,
  weeklyGoal = "20",
  onPress,
  distanceInMeters
}: WorkoutCardProps) {
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const isMetric = (profile?.metricSystem ?? 'metric') === 'metric';

  const formatDistance = (distanceKm: string, meters?: number) => {
    if (meters !== undefined) {
      if (isMetric) {
        const km = meters / 1000;
        return km.toFixed(2);
      } else {
        const miles = (meters / 1000) * 0.621371;
        return miles.toFixed(2);
      }
    }

    const numericDistance = parseFloat(distanceKm);
    if (!isMetric) {
      const miles = numericDistance * 0.621371;
      return miles.toFixed(2);
    }
    return distanceKm;
  };

  const getDistanceUnit = () => {
    return isMetric ? 'km' : 'mi';
  };

  const formatPaceDisplay = (paceStr: string) => {
    if (!paceStr.includes('/')) {
      const [minutes, seconds] = paceStr.split(':').map(Number);
      const totalMinutes = minutes + seconds / 60;

      if (!isMetric) {
        const mileTime = totalMinutes / 1.609344;
        const newMinutes = Math.floor(mileTime);
        const newSeconds = Math.round((mileTime - newMinutes) * 60);
        return `${newMinutes}:${newSeconds.toString().padStart(2, '0')} /mi`;
      } else {
        return `${paceStr} /km`;
      }
    }

    const [time, unit] = paceStr.split(' /');
    if (!isMetric && unit === 'km') {
      const [minutes, seconds] = time.split(':').map(Number);
      const totalMinutes = minutes + seconds / 60;
      const mileTime = totalMinutes / 1.609344;
      const newMinutes = Math.floor(mileTime);
      const newSeconds = Math.round((mileTime - newMinutes) * 60);
      return `${newMinutes}:${newSeconds.toString().padStart(2, '0')} /mi`;
    } else if (isMetric && unit === 'mi') {
      const [minutes, seconds] = time.split(':').map(Number);
      const totalMinutes = minutes + seconds / 60;
      const kmTime = totalMinutes * 1.609344;
      const newMinutes = Math.floor(kmTime);
      const newSeconds = Math.round((kmTime - newMinutes) * 60);
      return `${newMinutes}:${newSeconds.toString().padStart(2, '0')} /km`;
    }

    return paceStr;
  };

  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  return (
    <TouchableOpacity
      style={styles.workoutCard}
      onPress={handlePress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <Text style={styles.workoutTitle}>{title}</Text>
      <Text style={styles.distance}>{formatDistance(distance, distanceInMeters)} {getDistanceUnit()}</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>⏱ {duration} min</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>⚡ {formatPaceDisplay(pace)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>🍦 {calories} kcal</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  workoutCard: {
    backgroundColor: Theme.colors.background.primary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    marginVertical: Theme.spacing.sm,
    width: Dimensions.get('window').width - 40,
  },
  workoutTitle: {
    fontSize: 20,
    color: Theme.colors.text.tertiary,
    marginBottom: Theme.spacing.sm,
    fontFamily: Theme.fonts.medium,
  },
  distance: {
    fontSize: 50,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.sm,
    letterSpacing: -2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: Theme.spacing.md,
    gap: 24,
  },
  stat: {
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
  },
}); 