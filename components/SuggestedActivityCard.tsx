import Theme from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface PlannedWorkout {
  scheduledDate: string;
  type: string;
  duration?: string;
  description: string;
  target?: string;
  status: string;
  distance?: number;
  workoutId?: string | null;
  isDefault?: boolean;
}

interface SuggestedActivityCardProps {
  plannedWorkout: PlannedWorkout;
  weeklyProgress?: number;
  weeklyGoal?: string;
  onPress?: () => void;
}

// Helper function to get workout emoji based on type
const getWorkoutEmoji = (type: string, isDefault?: boolean): string => {
  if (isDefault) return '🧘‍♀️';

  const emojiMap: Record<string, string> = {
    'run-walk': '🚶‍♂️🏃‍♂️',
    'easy': '🏃‍♂️',
    'tempo': '🔥',
    'intervals': '⚡',
    'long': '🏃‍♂️',
    'recovery': '🧘‍♀️',
    'cross-train': '🚴‍♂️',
    'rest': '😴',
    'race': '🏆'
  };
  return emojiMap[type] || '🏃‍♂️';
};

// Helper function to get workout intensity based on type
const getWorkoutIntensity = (type: string, isDefault?: boolean): 'Easy' | 'Medium' | 'Hard' => {
  if (isDefault) return 'Easy';

  const intensityMap: Record<string, 'Easy' | 'Medium' | 'Hard'> = {
    'run-walk': 'Easy',
    'easy': 'Easy',
    'recovery': 'Easy',
    'rest': 'Easy',
    'cross-train': 'Easy',
    'tempo': 'Medium',
    'long': 'Medium',
    'intervals': 'Hard',
    'race': 'Hard'
  };
  return intensityMap[type] || 'Medium';
};

// Helper function to get simple workout title
const getWorkoutTitle = (plannedWorkout: PlannedWorkout): string => {
  if (plannedWorkout.isDefault) {
    return 'Rest & Recovery';
  }

  const { type, description } = plannedWorkout;

  // For C25K workouts, extract the week info
  if (type === 'run-walk') {
    if (description.includes('Week 1')) return 'C25K Week 1';
    if (description.includes('Week 2')) return 'C25K Week 2';
    if (description.includes('Week 3')) return 'C25K Week 3';
    if (description.includes('Week 4')) return 'C25K Week 4';
    if (description.includes('Week 5')) return 'C25K Week 5';
    if (description.includes('Week 6')) return 'C25K Week 6';
    if (description.includes('Week 7')) return 'C25K Week 7';
    if (description.includes('Week 8')) return 'C25K Week 8';
    if (description.includes('Week 9')) return 'C25K Week 9';
    return 'C25K Training';
  }

  // For other workout types
  const titleMap: Record<string, string> = {
    'easy': 'Easy Run',
    'tempo': 'Tempo Run',
    'intervals': 'Interval Training',
    'long': 'Long Run',
    'recovery': 'Recovery Run',
    'cross-train': 'Cross Training',
    'rest': 'Rest Day',
    'race': 'Race Day'
  };

  return titleMap[type] || type.charAt(0).toUpperCase() + type.slice(1) + ' Run';
};

// Helper function to get workout subtitle
const getWorkoutSubtitle = (plannedWorkout: PlannedWorkout): string => {
  if (plannedWorkout.isDefault) {
    return 'Default rest day';
  }

  if (plannedWorkout.type === 'run-walk') {
    return 'C25K Program';
  }

  return 'From your training plan';
};

export default function SuggestedActivityCard({
  plannedWorkout,
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

  const workoutTitle = getWorkoutTitle(plannedWorkout);
  const workoutSubtitle = getWorkoutSubtitle(plannedWorkout);
  const workoutEmoji = getWorkoutEmoji(plannedWorkout.type, plannedWorkout.isDefault);
  const workoutIntensity = getWorkoutIntensity(plannedWorkout.type, plannedWorkout.isDefault);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        plannedWorkout.isDefault && styles.defaultCard
      ]}
      onPress={handlePress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <Text style={styles.emoji}>{workoutEmoji}</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>{workoutTitle}</Text>
          <Text style={styles.subtitle}>{workoutSubtitle}</Text>
        </View>
        <View style={[styles.intensityBadge, { backgroundColor: getIntensityColor(workoutIntensity) }]}>
          <Text style={styles.intensityText}>{workoutIntensity}</Text>
        </View>
      </View>

      <Text style={styles.description}>{plannedWorkout.description}</Text>

      <View style={styles.detailsRow}>
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>Duration</Text>
          <Text style={styles.detailValue}>{plannedWorkout.duration || 'Flexible'}</Text>
        </View>
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>Activity Type</Text>
          <Text style={styles.detailValue}>
            {plannedWorkout.isDefault ? 'Recovery' : plannedWorkout.type.charAt(0).toUpperCase() + plannedWorkout.type.slice(1).replace('-', ' ')}
          </Text>
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
  defaultCard: {
    backgroundColor: Theme.colors.background.secondary,
  },
  targetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Theme.spacing.md,
  },
  targetLabel: {
    fontSize: 14,
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.medium,
    marginRight: Theme.spacing.md,
  },
  targetText: {
    fontSize: 16,
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
  },
});