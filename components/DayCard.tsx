import RestCelebrationModal from '@/components/RestCelebrationModal';
import SuggestedActivityCard from '@/components/SuggestedActivityCard';
import WorkoutCard from '@/components/WorkoutCard';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { RunningActivity } from '@/services/HealthService';
import { useMutation } from 'convex/react';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

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

  const handleActivityPress = (activity: RunningActivity) => {
    router.push({
      pathname: '/activity-detail',
      params: {
        activity: JSON.stringify(activity)
      }
    });
  };

  const getWorkoutEmoji = (type: string): string => {
    const emojiMap: Record<string, string> = {
      'easy': '🏃‍♂️',
      'long': '🏃‍♂️',
      'rest': '😴',
      'race': '🏆',
    };
    return emojiMap[type] || '😴';
  };

  const getWorkoutDisplayName = (type: string): string => {
    const displayNames: Record<string, string> = {
      'easy': 'Easy Run',
      'long': 'Long Run',
      'rest': 'Rest Day',
      'race': 'Race Day',
    };
    return displayNames[type] || type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ');
  };

  const handleTrainingPress = async (plannedWorkout: any) => {
    // If it's a rest day, show the modal. Non-today rest days are disabled.
    if (plannedWorkout.type === 'rest') {
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

    // For non-rest days, continue with normal navigation to training-detail
    const trainingActivity = {
      type: plannedWorkout.type,
      title: getWorkoutDisplayName(plannedWorkout.type),
      description: plannedWorkout.description,
      duration: plannedWorkout.duration || '30 min',
      distance: plannedWorkout.distance || 0, // Keep in meters for reward calculation
      emoji: getWorkoutEmoji(plannedWorkout.type),
      date: plannedWorkout.scheduledDate // Add the actual scheduled date
    };

    router.push({
      pathname: '/training-detail',
      params: {
        activity: JSON.stringify(trainingActivity)
      }
    });
  };

  // Check if this day is today
  const isToday = date === new Date().toISOString().split('T')[0];

  return (
    <View style={styles.dayCard}>
      {activities.map((activity, index) => (
        <WorkoutCard
          key={activity.uuid || `activity-${index}-${activity.startDate}`}
          title={activity.workoutName || "Running"}
          distance={formatDistance(activity.distance)}
          duration={`${activity.duration}`}
          pace={formatPace(activity.duration, activity.distance)}
          calories={`${activity.calories}`}
          weeklyProgress={parseFloat(formatDistance(activity.distance))}
          weeklyGoal="20"
          onPress={() => handleActivityPress(activity)}
        />
      ))}
      {/* Planned Workout */}
      {plannedWorkout && (
        <SuggestedActivityCard
          plannedWorkout={plannedWorkout}
          onPress={(plannedWorkout.type === 'rest' && (!isToday || isRestDayCompleted)) ? undefined : () => handleTrainingPress(plannedWorkout)}
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
}); 