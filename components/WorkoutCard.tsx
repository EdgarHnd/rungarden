import Theme from '@/constants/theme';
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
}

export default function WorkoutCard({
  title = "Morning Run",
  distance = "6.79",
  duration = "36:41",
  pace = "5:24",
  calories = "486",
  weeklyProgress = 6.8,
  weeklyGoal = "20",
  onPress
}: WorkoutCardProps) {
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
      <Text style={styles.distance}>{distance} km</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>⏱ {duration} min</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>⚡ {pace} /km</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>🔥 {calories} Cal</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  workoutCard: {
    backgroundColor: Theme.colors.background.secondary,
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