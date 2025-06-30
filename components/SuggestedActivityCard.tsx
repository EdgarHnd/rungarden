import Theme from '@/constants/theme';
import { SuggestedActivity, getActivityDescription, getActivityDistance, getActivityDuration, getActivityType, isDefaultActivity, isGeneratedActivity } from '@/constants/types';
import { api } from '@/convex/_generated/api';
import { useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SuggestedActivityCardProps {
  plannedWorkout: SuggestedActivity;
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

// Helper function to get simple workout title
const getWorkoutTitle = (plannedWorkout: SuggestedActivity, isToday: boolean, isMissed: boolean): string => {
  const type = getActivityType(plannedWorkout);

  // Handle simple schedule workouts
  if (isGeneratedActivity(plannedWorkout) && plannedWorkout.isSimpleScheduleRun) {
    if (isMissed) return "Missed Run";
    return isToday ? "Today's Run Day" : "Run Day";
  }

  if (isGeneratedActivity(plannedWorkout) && (plannedWorkout.isSimpleScheduleRest || plannedWorkout.isDefault) && type === 'rest') {
    return 'Rest & Recovery';
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

  const baseTitle = (type && titleMap[type]) || (type ? type.charAt(0).toUpperCase() + type.slice(1) + ' Run' : 'Workout');

  // Add "Missed" prefix for missed workouts
  if (isMissed) {
    return `Missed ${baseTitle}`;
  }

  return baseTitle;
};

// Helper function to get workout subtitle
const getWorkoutSubtitle = (plannedWorkout: SuggestedActivity, isToday: boolean, isMissed: boolean): string => {
  // Handle simple schedule workouts
  if (isGeneratedActivity(plannedWorkout) && plannedWorkout.isSimpleScheduleRun) {
    if (isMissed) return 'You missed this run';
    return isToday ? 'Go for a run' : 'Tap to get your custom training plan';
  }

  if (isGeneratedActivity(plannedWorkout) && plannedWorkout.isSimpleScheduleRest) {
    return 'Simple schedule rest day';
  }

  if (isGeneratedActivity(plannedWorkout) && plannedWorkout.isDefault) {
    return 'Default rest day';
  }

  const type = getActivityType(plannedWorkout);
  if (type === 'run-walk') {
    return 'C25K Program';
  }

  if (isMissed) {
    return 'You missed this workout';
  }

  return 'From your training plan';
};

// Helper function to get workout description
const getWorkoutDescription = (plannedWorkout: SuggestedActivity, isToday: boolean, isMissed: boolean): string => {

  if (isMissed) {
    return 'You missed this workout. No worries, it happens to the best of us!';
  }

  if (isGeneratedActivity(plannedWorkout) && plannedWorkout.isSimpleScheduleRun) {
    return 'Go for a run! Perfect day for your weekly training.';
  }

  if (isGeneratedActivity(plannedWorkout) && plannedWorkout.isSimpleScheduleRest) {
    return 'Rest day - Perfect time for gentle stretching, foam rolling, or mobility work. Listen to your body and recover well!';
  };

  if (isToday) {
    return 'Go for a run! Perfect day for your weekly training.';
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
  // Helper function to check if this is a missed day
  const isMissedDay = () => {
    // Only consider non-rest, non-today days in the past as potentially missed
    const workoutType = getActivityType(plannedWorkout);
    if (workoutType === 'rest' || isToday) return false;

    // Check if this day is in the past
    const workoutDate = new Date(plannedWorkout.scheduledDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    workoutDate.setHours(0, 0, 0, 0);

    return workoutDate < today;
  };

  const isMissed = isMissedDay();
  // Get user profile for metric system preference
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const isMetric = (profile?.metricSystem ?? 'metric') === 'metric';

  // Get training profile for workout style preference  
  const trainingProfile = useQuery(api.trainingProfile.getTrainingProfile);
  const preferTimeOverDistance = trainingProfile?.preferTimeOverDistance ?? true;

  const handlePress = () => {
    if (onPress && !isMissed) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  // Extract workout data using type-safe helper functions
  const workoutType = getActivityType(plannedWorkout);
  const workoutDescription = getActivityDescription(plannedWorkout) || '';
  const workoutDuration = getActivityDuration(plannedWorkout);
  const workoutDistance = getActivityDistance(plannedWorkout);

  const isRestDay = workoutType === 'rest';
  const isCompleted = isRestDay && isRestDayCompleted;
  const workoutTitle = getWorkoutTitle(plannedWorkout, isToday, isMissed);
  const workoutSubtitle = getWorkoutSubtitle(plannedWorkout, isToday, isMissed);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isDefaultActivity(plannedWorkout) && styles.defaultCard,
        isToday && styles.todayCard,
        isCompleted && [{ borderColor: Theme.colors.background.tertiary }],
        isMissed && styles.missedCard
      ]}
      onPress={handlePress}
      activeOpacity={onPress && !isMissed ? 0.7 : 1}
      disabled={!onPress || isMissed}
    >
      <View style={styles.header}>
        {isRestDay && (
          <Image
            source={require('@/assets/images/blaze/blaze-sleep-icon.png')}
            style={styles.imageEmoji}
            resizeMode='contain'
          />
        )}
        {isMissed && (
          <Image
            source={require('@/assets/images/blaze/blazesad.png')}
            style={styles.imageEmoji}
            resizeMode='contain'
          />
        )}
        {!isRestDay && !isMissed && (
          <Image
            source={require('@/assets/images/blaze/blazerunning.png')}
            style={styles.imageEmoji}
            resizeMode='contain'
          />
        )}
        <View style={styles.headerText}>
          <Text style={[styles.title, isMissed && styles.missedText]}>
            {isToday && !isDefaultActivity(plannedWorkout) && ((preferTimeOverDistance && workoutDuration) || (!preferTimeOverDistance && workoutDistance && workoutDistance > 0))
              ? preferTimeOverDistance
                ? `${workoutTitle} • ${workoutDuration || 'Flexible'}`
                : `${workoutTitle} • ${formatDistance(workoutDistance!, isMetric)}`
              : workoutTitle
            }
          </Text>
          <Text style={[styles.subtitle, isMissed && styles.missedText]}>{workoutSubtitle}</Text>
        </View>
      </View>

      <Text style={styles.description}>{getWorkoutDescription(plannedWorkout, isToday, isMissed)}</Text>

      {isToday ? (
        <View style={styles.startButtonContainer}>
          <TouchableOpacity
            style={[
              styles.startButton,
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
                : (isGeneratedActivity(plannedWorkout) && plannedWorkout.isSimpleScheduleRun)
                  ? 'TAP TO START RUNNING'
                  : 'START WORKOUT'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        workoutType !== 'rest' && !(isGeneratedActivity(plannedWorkout) && plannedWorkout.isSimpleScheduleRun) && (
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
                        {isDefaultActivity(plannedWorkout) ? 'Recovery' : (workoutType ? workoutType.charAt(0).toUpperCase() + workoutType.slice(1).replace('-', ' ') : 'Workout')}
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
                        {isDefaultActivity(plannedWorkout) ? 'Recovery' : (workoutType ? workoutType.charAt(0).toUpperCase() + workoutType.slice(1).replace('-', ' ') : 'Workout')}
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
                    {isDefaultActivity(plannedWorkout) ? 'Recovery' : (workoutType ? workoutType.charAt(0).toUpperCase() + workoutType.slice(1).replace('-', ' ') : 'Workout')}
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
  imageEmoji: {
    width: 40,
    height: 40,
    marginRight: Theme.spacing.sm,
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
    backgroundColor: Theme.colors.special.primary.exp,
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
  missedCard: {
    backgroundColor: Theme.colors.background.secondary,
    opacity: 0.6,
  },
  missedText: {
    color: Theme.colors.text.muted,
  },
});