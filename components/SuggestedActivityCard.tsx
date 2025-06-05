import Theme from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Activity {
  type: 'run' | 'rest';
  title: string;
  description: string;
  duration: string;
  intensity: 'Easy' | 'Medium' | 'Hard';
  emoji: string;
}

interface SuggestedActivityCardProps {
  activity: Activity;
  weeklyProgress?: number;
  weeklyGoal?: string;
  onPress?: () => void;
}

// Simple 7-day training plan - alternating running and rest days
const weeklyPlan: Activity[] = [
  {
    type: 'run',
    title: 'Easy Run',
    description: 'Start your week with a comfortable pace run to build base fitness',
    duration: '30-40 min',
    intensity: 'Easy',
    emoji: '🏃‍♂️'
  },
  {
    type: 'rest',
    title: 'Active Recovery',
    description: 'Stretching, light walking, and mobility work for recovery',
    duration: '20-30 min',
    intensity: 'Easy',
    emoji: '🧘‍♀️'
  },
  {
    type: 'run',
    title: 'Interval Training',
    description: '6x 400m intervals with 90s recovery between each',
    duration: '35 min',
    intensity: 'Hard',
    emoji: '⚡'
  },
  {
    type: 'rest',
    title: 'Recovery & Stretching',
    description: 'Full body stretching routine and foam rolling',
    duration: '25 min',
    intensity: 'Easy',
    emoji: '🤸‍♂️'
  },
  {
    type: 'run',
    title: 'Tempo Run',
    description: 'Sustained effort at comfortably hard pace',
    duration: '25 min',
    intensity: 'Hard',
    emoji: '🔥'
  },
  {
    type: 'run',
    title: 'Long Run',
    description: 'Build endurance with a longer, steady-paced run',
    duration: '45-60 min',
    intensity: 'Hard',
    emoji: '🏃‍♂️'
  },
  {
    type: 'rest',
    title: 'Rest Day',
    description: 'Complete rest or gentle yoga for full recovery',
    duration: 'As needed',
    intensity: 'Easy',
    emoji: '😴'
  }
];

export function getTodaysSuggestedActivity(): Activity {
  const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
  return weeklyPlan[today];
}

export default function SuggestedActivityCard({
  activity,
  weeklyProgress = 5.2,
  weeklyGoal = "20",
  onPress
}: SuggestedActivityCardProps) {
  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case 'Easy': return '#10B981';
      case 'Medium': return '#F59E0B';
      case 'Hard': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <Text style={styles.emoji}>{activity.emoji}</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>{activity.title}</Text>
          <Text style={styles.subtitle}>Suggested for today</Text>
        </View>
        <View style={[styles.intensityBadge, { backgroundColor: getIntensityColor(activity.intensity) }]}>
          <Text style={styles.intensityText}>{activity.intensity}</Text>
        </View>
      </View>

      <Text style={styles.description}>{activity.description}</Text>

      <View style={styles.detailsRow}>
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>Duration</Text>
          <Text style={styles.detailValue}>{activity.duration}</Text>
        </View>
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>Activity Type</Text>
          <Text style={styles.detailValue}>{activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    marginVertical: Theme.spacing.sm,
    width: Dimensions.get('window').width - 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  emoji: {
    fontSize: 32,
    marginRight: Theme.spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.medium,
  },
  intensityBadge: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.medium,
  },
  intensityText: {
    fontSize: 12,
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
  },
  description: {
    fontSize: 16,
    color: Theme.colors.text.secondary,
    fontFamily: Theme.fonts.regular,
    lineHeight: 22,
    marginBottom: Theme.spacing.xl,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: Theme.spacing.xl,
  },
  detail: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.medium,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
  },
}); 