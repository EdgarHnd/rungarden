import WeeklyProgressBar from '@/components/WeeklyProgressBar';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  return (
    <TouchableOpacity
      style={styles.workoutCard}
      onPress={onPress}
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

      <WeeklyProgressBar weeklyProgress={weeklyProgress} weeklyGoal={weeklyGoal} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  workoutCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  workoutTitle: {
    fontSize: 20,
    color: '#9CA3AF',
    marginBottom: 8,
    fontFamily: 'SF-Pro-Rounded-Medium',
  },
  distance: {
    fontSize: 50,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 12,
    gap: 24,
  },
  stat: {
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Medium',
    color: '#6B7280',
  },
}); 