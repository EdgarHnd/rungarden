import SuggestedActivityCard from '@/components/SuggestedActivityCard';
import WorkoutCard from '@/components/WorkoutCard';
import Theme from '@/constants/theme';
import { RunningActivity } from '@/services/HealthService';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Activity {
  type: 'run' | 'rest';
  title: string;
  description: string;
  duration: string;
  intensity: 'Easy' | 'Medium' | 'Hard';
  emoji: string;
}

interface DayCardProps {
  date: string;
  activities: RunningActivity[];
  suggestedActivity: Activity;
  formatDistance: (meters: number) => string;
  formatPace: (duration: number, distance: number) => string;
}

export default function DayCard({
  date,
  activities,
  suggestedActivity,
  formatDistance,
  formatPace
}: DayCardProps) {
  const handleActivityPress = (activity: RunningActivity) => {
    router.push({
      pathname: '/activity-detail',
      params: {
        activity: JSON.stringify(activity)
      }
    });
  };

  const handleTrainingPress = (training: Activity) => {
    router.push({
      pathname: '/training-detail',
      params: {
        activity: JSON.stringify(training)
      }
    });
  };

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
      {/* Suggested Activity */}
      <SuggestedActivityCard
        activity={suggestedActivity}
        onPress={() => handleTrainingPress(suggestedActivity)}
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