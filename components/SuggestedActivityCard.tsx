import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface PlannedWorkout {
  scheduledDate: string;
  type?: string; // For backward compatibility
  duration?: string; // For backward compatibility
  description: string; // For backward compatibility
  target?: string;
  status: string;
  distance?: number;
  workoutId?: string | null;
  isDefault?: boolean;
  // New structure from enriched queries
  workout?: {
    type: string;
    description: string;
    steps: Array<{
      order: number;
      label?: string;
      duration?: string;
      distance?: number;
      pace?: number;
      effort?: string;
      target?: string;
      notes?: string;
    }>;
  };
}

interface SuggestedActivityCardProps {
  plannedWorkout: PlannedWorkout;
  weeklyProgress?: number;
  weeklyGoal?: string;
  onPress?: () => void;
  isToday?: boolean;
  isRestDayCompleted?: boolean;
}

// Helper function to format distance based on metric system preference
const formatDistance = (distanceMeters: number, isMetric: boolean): string => {
  if (!distanceMeters || distanceMeters === 0) return '';

  if (isMetric) {
    const km = distanceMeters / 1000;
    return `${km.toFixed(1)}km`;
  } else {
    const miles = (distanceMeters / 1000) * 0.621371;
    return `${miles.toFixed(1)}mi`;
  }
};

// Helper function to get workout emoji based on type
const getWorkoutEmoji = (type: string, isDefault?: boolean): string => {
  if (isDefault) return '🧘‍♀️';

  const emojiMap: Record<string, string> = {
    'run-walk': '🚶‍♂️🏃‍♂️',
    'easy': '🏃‍♂️',
    'tempo': '🔥',
    'interval': '⚡',
    'intervals': '⚡',
    'long': '🏃‍♂️',
    'recovery': '🧘‍♀️',
    'cross-train': '🚴‍♂️',
    'strength': '💪',
    'rest': '😴',
    'race': '🏆',
    'run': '🏃‍♂️'
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
    'run': 'Easy',
    'tempo': 'Medium',
    'long': 'Medium',
    'strength': 'Medium',
    'interval': 'Hard',
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

  // Use new structure first, fallback to old structure
  const type = plannedWorkout.workout?.type || plannedWorkout.type;
  const description = plannedWorkout.workout?.description || plannedWorkout.description;

  // For C25K workouts, extract the week info
  if (type === 'run-walk') {
    if (description?.includes('Week 1')) return 'C25K Week 1';
    if (description?.includes('Week 2')) return 'C25K Week 2';
    if (description?.includes('Week 3')) return 'C25K Week 3';
    if (description?.includes('Week 4')) return 'C25K Week 4';
    if (description?.includes('Week 5')) return 'C25K Week 5';
    if (description?.includes('Week 6')) return 'C25K Week 6';
    if (description?.includes('Week 7')) return 'C25K Week 7';
    if (description?.includes('Week 8')) return 'C25K Week 8';
    if (description?.includes('Week 9')) return 'C25K Week 9';
    return 'C25K Training';
  }

  // For other workout types
  const titleMap: Record<string, string> = {
    'easy': 'Easy Run',
    'tempo': 'Tempo Run',
    'interval': 'Interval Training',
    'intervals': 'Interval Training',
    'long': 'Long Run',
    'recovery': 'Recovery Run',
    'cross-train': 'Cross Training',
    'strength': 'Strength Training',
    'rest': 'Rest Day',
    'race': 'Race Day',
    'run': 'Run'
  };

  return (type && titleMap[type]) || (type ? type.charAt(0).toUpperCase() + type.slice(1) + ' Run' : 'Workout');
};

// Helper function to get workout subtitle
const getWorkoutSubtitle = (plannedWorkout: PlannedWorkout): string => {
  if (plannedWorkout.isDefault) {
    return 'Default rest day';
  }

  const type = plannedWorkout.workout?.type || plannedWorkout.type;
  if (type === 'run-walk') {
    return 'C25K Program';
  }

  return 'From your training plan';
};

// Helper function to calculate total duration from workout steps
const calculateDurationFromSteps = (steps?: Array<{
  duration?: string;
  [key: string]: any;
}>): string | undefined => {
  if (!steps || steps.length === 0) return undefined;

  const durations = steps.map(step => step.duration).filter(Boolean);
  if (durations.length === 0) return undefined;

  // Sum up durations if they're all in minutes
  const totalMinutes = durations.reduce((sum, duration) => {
    const match = duration!.match(/(\d+)\s*min/);
    return sum + (match ? parseInt(match[1]) : 0);
  }, 0);

  if (totalMinutes > 0) {
    return `${totalMinutes} min`;
  }

  // If we can't sum them, return the first duration
  return durations[0];
};

// Helper function to calculate total distance from workout steps
const calculateDistanceFromSteps = (steps?: Array<{
  distance?: number;
  [key: string]: any;
}>): number | undefined => {
  if (!steps || steps.length === 0) return undefined;

  const totalDistance = steps.reduce((sum, step) => sum + (step.distance || 0), 0);
  return totalDistance > 0 ? totalDistance : undefined;
};

export default function SuggestedActivityCard({
  plannedWorkout,
  weeklyProgress = 5.2,
  weeklyGoal = "20",
  onPress,
  isToday = false,
  isRestDayCompleted = false,
}: SuggestedActivityCardProps) {
  // Get user profile for metric system preference
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const isMetric = (profile?.metricSystem ?? 'metric') === 'metric';

  // Get training profile for workout style preference  
  const trainingProfile = useQuery(api.trainingProfile.getTrainingProfile);
  const preferTimeOverDistance = trainingProfile?.preferTimeOverDistance ?? true;

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

  // Extract workout data from new nested structure, with fallback to old structure
  const workoutType = plannedWorkout.workout?.type || plannedWorkout.type || 'run';
  const workoutDescription = plannedWorkout.workout?.description || plannedWorkout.description || '';
  const workoutDuration = plannedWorkout.duration || calculateDurationFromSteps(plannedWorkout.workout?.steps);
  const workoutDistance = plannedWorkout.distance || calculateDistanceFromSteps(plannedWorkout.workout?.steps);

  const isRestDay = workoutType === 'rest';
  const isCompleted = isRestDay && isRestDayCompleted;
  const workoutTitle = getWorkoutTitle(plannedWorkout);
  const workoutSubtitle = getWorkoutSubtitle(plannedWorkout);
  const workoutEmoji = getWorkoutEmoji(workoutType, plannedWorkout.isDefault);
  const workoutIntensity = getWorkoutIntensity(workoutType, plannedWorkout.isDefault);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        plannedWorkout.isDefault && styles.defaultCard,
        isToday && styles.todayCard,
        isCompleted && [{ borderColor: Theme.colors.status.success }]
      ]}
      onPress={handlePress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <Text style={styles.emoji}>{workoutEmoji}</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>
            {isToday && ((preferTimeOverDistance && workoutDuration) || (!preferTimeOverDistance && workoutDistance && workoutDistance > 0))
              ? preferTimeOverDistance
                ? `${workoutTitle} • ${workoutDuration || 'Flexible'}`
                : `${workoutTitle} • ${formatDistance(workoutDistance!, isMetric)}`
              : workoutTitle
            }
          </Text>
          <Text style={styles.subtitle}>{workoutSubtitle}</Text>
        </View>
        {/* <View style={[styles.intensityBadge, { backgroundColor: getIntensityColor(workoutIntensity) }]}>
          <Text style={styles.intensityText}>{workoutIntensity}</Text>
        </View> */}
      </View>

      <Text style={styles.description}>{workoutDescription}</Text>

      {isToday ? (
        <View style={styles.startButtonContainer}>
          <TouchableOpacity
            style={[
              styles.startButton,
              { backgroundColor: isRestDay ? Theme.colors.special.primary.coin : Theme.colors.special.primary.exp },
              isCompleted && styles.completedButton
            ]}
            onPress={handlePress}
            activeOpacity={0.8}
            disabled={!onPress || isCompleted}
          >
            <Text style={[styles.startButtonText, isCompleted && styles.completedButtonText]}>
              {isRestDay
                ? isCompleted
                  ? 'COMPLETED'
                  : 'COMPLETE REST DAY'
                : 'START WORKOUT'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        workoutType !== 'rest' && (
          <View style={styles.detailsRow}>
            {workoutDistance && workoutDistance > 0 ? (
              <>
                {/* Show either distance OR duration based on user preference */}
                {preferTimeOverDistance ? (
                  <>
                    <View style={styles.detail}>
                      <Text style={styles.detailLabel}>Duration</Text>
                      <Text style={styles.detailValue}>{workoutDuration || 'Flexible'}</Text>
                    </View>
                    <View style={styles.detail}>
                      <Text style={styles.detailLabel}>Activity Type</Text>
                      <Text style={styles.detailValue}>
                        {plannedWorkout.isDefault ? 'Recovery' : (workoutType ? workoutType.charAt(0).toUpperCase() + workoutType.slice(1).replace('-', ' ') : 'Workout')}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.detail}>
                      <Text style={styles.detailLabel}>Distance</Text>
                      <Text style={styles.detailValue}>{formatDistance(workoutDistance, isMetric)}</Text>
                    </View>
                    <View style={styles.detail}>
                      <Text style={styles.detailLabel}>Activity Type</Text>
                      <Text style={styles.detailValue}>
                        {plannedWorkout.isDefault ? 'Recovery' : (workoutType ? workoutType.charAt(0).toUpperCase() + workoutType.slice(1).replace('-', ' ') : 'Workout')}
                      </Text>
                    </View>
                  </>
                )}
              </>
            ) : (
              <>
                <View style={styles.detail}>
                  <Text style={styles.detailLabel}>Duration</Text>
                  <Text style={styles.detailValue}>{workoutDuration || 'Flexible'}</Text>
                </View>
                <View style={styles.detail}>
                  <Text style={styles.detailLabel}>Activity Type</Text>
                  <Text style={styles.detailValue}>
                    {plannedWorkout.isDefault ? 'Recovery' : (workoutType ? workoutType.charAt(0).toUpperCase() + workoutType.slice(1).replace('-', ' ') : 'Workout')}
                  </Text>
                </View>
              </>
            )}
          </View>
        )
      )}
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
  todayCard: {
    borderWidth: 2,
    borderColor: Theme.colors.special.primary.exp,
    backgroundColor: Theme.colors.background.secondary,
  },
  startButtonContainer: {
    marginTop: Theme.spacing.lg,
  },
  startButton: {
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.xxl,
    borderRadius: Theme.borderRadius.large,
    width: '100%',
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.2)',
  },
  startButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background.secondary,
    textTransform: 'uppercase',
  },
  completedButton: {
    backgroundColor: '#047857',
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  completedButtonText: {
    color: Theme.colors.background.secondary,
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