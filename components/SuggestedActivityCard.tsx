import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useQuery } from 'convex/react';
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

  const isRestDay = plannedWorkout.type === 'rest';
  const isCompleted = isRestDay && isRestDayCompleted;
  const workoutTitle = getWorkoutTitle(plannedWorkout);
  const workoutSubtitle = getWorkoutSubtitle(plannedWorkout);
  const workoutEmoji = getWorkoutEmoji(plannedWorkout.type, plannedWorkout.isDefault);
  const workoutIntensity = getWorkoutIntensity(plannedWorkout.type, plannedWorkout.isDefault);

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
            {isToday && ((preferTimeOverDistance && plannedWorkout.duration) || (!preferTimeOverDistance && plannedWorkout.distance && plannedWorkout.distance > 0))
              ? preferTimeOverDistance
                ? `${workoutTitle} • ${plannedWorkout.duration || 'Flexible'}`
                : `${workoutTitle} • ${formatDistance(plannedWorkout.distance!, isMetric)}`
              : workoutTitle
            }
          </Text>
          <Text style={styles.subtitle}>{workoutSubtitle}</Text>
        </View>
        <View style={[styles.intensityBadge, { backgroundColor: getIntensityColor(workoutIntensity) }]}>
          <Text style={styles.intensityText}>{workoutIntensity}</Text>
        </View>
      </View>

      <Text style={styles.description}>{plannedWorkout.description}</Text>

      {isToday ? (
        <View style={styles.startButtonContainer}>
          <TouchableOpacity
            style={[
              styles.startButton,
              { backgroundColor: isRestDay ? Theme.colors.special.primary.coin : Theme.colors.accent.primary },
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
                  : '🧘‍♂️ START REST DAY'
                : '🏃‍♂️ START WORKOUT'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        plannedWorkout.type !== 'rest' && (
          <View style={styles.detailsRow}>
            {plannedWorkout.distance && plannedWorkout.distance > 0 ? (
              <>
                {/* Show either distance OR duration based on user preference */}
                {preferTimeOverDistance ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <View style={styles.detail}>
                      <Text style={styles.detailLabel}>Distance</Text>
                      <Text style={styles.detailValue}>{formatDistance(plannedWorkout.distance, isMetric)}</Text>
                    </View>
                    <View style={styles.detail}>
                      <Text style={styles.detailLabel}>Activity Type</Text>
                      <Text style={styles.detailValue}>
                        {plannedWorkout.isDefault ? 'Recovery' : plannedWorkout.type.charAt(0).toUpperCase() + plannedWorkout.type.slice(1).replace('-', ' ')}
                      </Text>
                    </View>
                  </>
                )}
              </>
            ) : (
              <>
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
    borderColor: Theme.colors.accent.primary,
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