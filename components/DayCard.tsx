import RestCelebrationModal from '@/components/RestCelebrationModal';
import RestWorkoutCard from '@/components/RestWorkoutCard';
import SuggestedActivityCard from '@/components/SuggestedActivityCard';
import WorkoutCard from '@/components/WorkoutCard';
import Theme from '@/constants/theme';
import { SuggestedActivity, getActivityType, isDatabasePlannedWorkout, isGeneratedActivity } from '@/constants/types';
import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';
import { formatDistanceValue, formatPace } from '@/utils/formatters';
import { useMutation, useQuery } from 'convex/react';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

interface DayCardProps {
  date: string;
  activities: Doc<"activities">[];
  plannedWorkout?: SuggestedActivity | null;
  restActivity?: Doc<"restActivities">;
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
  restActivity,
  streakInfo,
  isRestDayCompleted,
}: DayCardProps) {
  const [showRestCelebrationModal, setShowRestCelebrationModal] = useState(false);
  const completeRestDay = useMutation(api.userProfile.completeRestDay);
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const metricSystem = (profile?.metricSystem ?? 'metric') as 'metric' | 'imperial';

  // Check if there are activities that match this planned workout
  const hasLinkedActivities = activities.length > 0 && plannedWorkout && isDatabasePlannedWorkout(plannedWorkout) && plannedWorkout.status === 'completed';
  const workoutType = plannedWorkout ? getActivityType(plannedWorkout) : 'run';

  const handleActivityPress = (activity: Doc<"activities">) => {
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

  const handleTrainingPress = async (plannedWorkout: SuggestedActivity) => {
    // If it's a rest day, complete it directly
    if (workoutType === 'rest') {
      try {
        const result = await completeRestDay({
          date: plannedWorkout.scheduledDate,
          notes: undefined // Could add note input in the future
        });
        if (result.success || result.alreadyCompleted) {
          setShowRestCelebrationModal(true);
        }
      } catch (e) {
        console.error("Failed to complete rest day", e);
      }
      return;
    }

    // Handle simple schedule runs
    if (isGeneratedActivity(plannedWorkout) && plannedWorkout.isSimpleScheduleRun) {
      handleSimpleRunPress();
      return;
    }

    // Navigate to training detail only for database planned workouts
    if (isDatabasePlannedWorkout(plannedWorkout)) {
      router.push({
        pathname: '/training-detail',
        params: {
          scheduleWorkoutId: plannedWorkout._id
        }
      });
    } else {
      // For generated activities, show a helpful message
      Alert.alert("Training Plan", "This is a suggested activity. Connect to a structured training plan for detailed workouts.");
    }
  };

  const handleSimpleRunPress = async () => {
    // nice alert saying the recording feature is coming soon
    Alert.alert("Recording coming soon", "For now, use the Strava or Apple Health integration to log your runs.");
  };

  // Check if this day is today
  const isToday = date === new Date().toISOString().split('T')[0];

  return (
    <View style={styles.dayCard}>
      {activities.map((activity, index) => (
        <View key={activity._id || `activity-${index}-${activity.startDate}`}>
          {/* Show linkage indicator if this activity is linked to the planned workout */}
          {hasLinkedActivities && index === 0 && (
            <View style={styles.linkageIndicator}>
              <Text style={styles.linkageText}>
                Completed: {getWorkoutDisplayName(workoutType)}
              </Text>
            </View>
          )}
          <WorkoutCard
            title={
              hasLinkedActivities && index === 0
                ? `${getWorkoutDisplayName(workoutType)} (Completed)`
                : (activity.workoutName || "Running")
            }
            distance={formatDistanceValue(activity.distance, metricSystem)}
            duration={`${activity.duration}`}
            pace={formatPace(activity.duration, activity.distance, metricSystem)}
            calories={`${activity.calories}`}
            weeklyProgress={parseFloat(formatDistanceValue(activity.distance, metricSystem))}
            weeklyGoal="20"
            onPress={() => handleActivityPress(activity)}
            distanceInMeters={activity.distance}
          />
        </View>
      ))}

      {/* Completed Rest Activity Card */}
      {restActivity && (
        <RestWorkoutCard
          restActivity={restActivity}
          onPress={() => { }}
        />
      )}

      {/* Planned Workout (including rest days and simple schedule workouts) */}
      {plannedWorkout && !hasLinkedActivities && activities.length === 0 && !restActivity && (
        <SuggestedActivityCard
          plannedWorkout={plannedWorkout}
          onPress={(() => {
            const activityType = getActivityType(plannedWorkout);
            return (activityType === 'rest' && (!isToday || isRestDayCompleted)) ? undefined : () => handleTrainingPress(plannedWorkout);
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