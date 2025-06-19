import RestCelebrationModal from '@/components/RestCelebrationModal';
import SuggestedActivityCard from '@/components/SuggestedActivityCard';
import WorkoutCard from '@/components/WorkoutCard';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { RunningActivity } from '@/services/HealthService';
import { useMutation } from 'convex/react';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface DayCardProps {
  date: string;
  activities: RunningActivity[];
  plannedWorkout: any; // Direct planned workout from training plan
  formatDistance: (meters: number) => string;
  formatPace: (duration: number, distance: number) => string;
  streakInfo?: {
    currentStreak: number;
    longestStreak: number;
  };
  isRestDayCompleted?: boolean;
}

export default function DayCard({
  date,
  activities,
  plannedWorkout,
  formatDistance,
  formatPace,
  streakInfo,
  isRestDayCompleted,
}: DayCardProps) {
  const [showRestCelebrationModal, setShowRestCelebrationModal] = useState(false);
  const completeRestDay = useMutation(api.userProfile.completeRestDay);

  // Check if there are activities that match this planned workout
  const hasLinkedActivities = activities.length > 0 && plannedWorkout?.status === 'completed';
  const workoutType = plannedWorkout?.workout?.type || plannedWorkout?.type || 'run';

  const handleActivityPress = (activity: RunningActivity) => {
    router.push({
      pathname: '/activity-detail',
      params: {
        activity: JSON.stringify({
          ...activity,
          plannedWorkout: hasLinkedActivities ? plannedWorkout : undefined,
        })
      }
    });
  };

  const getWorkoutEmoji = (type: string): string => {
    const emojiMap: Record<string, string> = {
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

  const getWorkoutDisplayName = (type: string): string => {
    const displayNames: Record<string, string> = {
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
    return displayNames[type] || type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ');
  };

  // Helper function to calculate duration from workout steps
  const calculateDurationFromSteps = (steps?: Array<{ duration?: string;[key: string]: any; }>): string => {
    if (!steps || steps.length === 0) return '30 min';

    const durations = steps.map(step => step.duration).filter(Boolean);
    if (durations.length === 0) return '30 min';

    // Sum up durations if they're all in minutes
    const totalMinutes = durations.reduce((sum, duration) => {
      const match = duration!.match(/(\d+)\s*min/);
      return sum + (match ? parseInt(match[1]) : 0);
    }, 0);

    if (totalMinutes > 0) {
      return `${totalMinutes} min`;
    }

    // If we can't sum them, return the first duration
    return durations[0] || '30 min';
  };

  // Helper function to calculate distance from workout steps
  const calculateDistanceFromSteps = (steps?: Array<{ distance?: number;[key: string]: any; }>): number => {
    if (!steps || steps.length === 0) return 0;

    const totalDistance = steps.reduce((sum, step) => sum + (step.distance || 0), 0);
    return totalDistance;
  };

  const handleTrainingPress = async (plannedWorkout: any) => {
    // Extract workout type from new nested structure, with fallback to old structure
    const workoutType = plannedWorkout.workout?.type || plannedWorkout.type || 'run';
    const workoutDescription = plannedWorkout.workout?.description || plannedWorkout.description || '';
    const workoutDuration = plannedWorkout.duration || calculateDurationFromSteps(plannedWorkout.workout?.steps);
    const workoutDistance = plannedWorkout.distance || calculateDistanceFromSteps(plannedWorkout.workout?.steps);

    // If it's a rest day, show the modal. Non-today rest days are disabled.
    if (workoutType === 'rest') {
      try {
        const result = await completeRestDay({ date: plannedWorkout.scheduledDate });
        if (result.success || result.alreadyCompleted) {
          setShowRestCelebrationModal(true);
        }
      } catch (e) {
        console.error("Failed to complete rest day", e);
      }
      return;
    }

    // Navigate to training detail with the planned workout ID
    router.push({
      pathname: '/training-detail',
      params: {
        scheduleWorkoutId: plannedWorkout._id
      }
    });
  };

  // Check if this day is today
  const isToday = date === new Date().toISOString().split('T')[0];

  return (
    <View style={styles.dayCard}>
      {activities.map((activity, index) => (
        <View key={activity.uuid || `activity-${index}-${activity.startDate}`}>
          {/* Show linkage indicator if this activity is linked to the planned workout */}
          {hasLinkedActivities && index === 0 && (
            <View style={styles.linkageIndicator}>
              <Text style={styles.linkageText}>
                {getWorkoutEmoji(workoutType)} Completed: {getWorkoutDisplayName(workoutType)}
              </Text>
            </View>
          )}
          <WorkoutCard
            title={
              hasLinkedActivities && index === 0
                ? `${getWorkoutDisplayName(workoutType)} (Completed)`
                : (activity.workoutName || "Running")
            }
            distance={formatDistance(activity.distance)}
            duration={`${activity.duration}`}
            pace={formatPace(activity.duration, activity.distance)}
            calories={`${activity.calories}`}
            weeklyProgress={parseFloat(formatDistance(activity.distance))}
            weeklyGoal="20"
            onPress={() => handleActivityPress(activity)}
          />
        </View>
      ))}
      {/* Planned Workout */}
      {plannedWorkout && !hasLinkedActivities && (
        <SuggestedActivityCard
          plannedWorkout={plannedWorkout}
          onPress={(() => {
            const workoutType = plannedWorkout.workout?.type || plannedWorkout.type || 'run';
            return (workoutType === 'rest' && (!isToday || isRestDayCompleted)) ? undefined : () => handleTrainingPress(plannedWorkout);
          })()}
          isToday={isToday}
          isRestDayCompleted={isRestDayCompleted}
        />
      )}

      {/* Rest Celebration Modal */}
      <RestCelebrationModal
        visible={showRestCelebrationModal}
        onClose={() => setShowRestCelebrationModal(false)}
        streakInfo={streakInfo}
      />

      {/* Empty state for past days with no activities */}
      {/* {activities.length === 0 && new Date(date) < new Date(new Date().toISOString().split('T')[0]) && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No activities recorded</Text>
          </View>
        )} */}
    </View>
  );
}

const styles = StyleSheet.create({
  dayCard: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: 10,
    marginBottom: 100,
    minHeight: 400,
    backgroundColor: Theme.colors.background.primary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: Theme.colors.text.muted,
    fontFamily: Theme.fonts.medium,
    marginBottom: Theme.spacing.lg,
  },
  linkageIndicator: {
    backgroundColor: Theme.colors.background.secondary,
    padding: Theme.spacing.sm,
    borderRadius: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Theme.colors.accent.primary,
  },
  linkageText: {
    fontSize: 12,
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.medium,
    textAlign: 'center',
  },
}); 