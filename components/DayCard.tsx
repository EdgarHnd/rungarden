import SuggestedActivityCard from '@/components/SuggestedActivityCard';
import WorkoutCard from '@/components/WorkoutCard';
import { RunningActivity } from '@/services/HealthService';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import ActivityDetailModal from './ActivityDetailModal';
import TrainingDetailModal from './TrainingDetailModal';

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
  const [selectedActivity, setSelectedActivity] = useState<RunningActivity | null>(null);
  const [selectedTraining, setSelectedTraining] = useState<Activity | null>(null);
  const [isActivityModalVisible, setIsActivityModalVisible] = useState(false);
  const [isTrainingModalVisible, setIsTrainingModalVisible] = useState(false);



  const handleActivityPress = (activity: RunningActivity) => {
    setSelectedActivity(activity);
    setIsActivityModalVisible(true);
  };

  const handleTrainingPress = (training: Activity) => {
    setSelectedTraining(training);
    setIsTrainingModalVisible(true);
  };

  const formatDetailDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculatePace = (duration: number, distance: number) => {
    const paceMinPerKm = (duration / (distance / 1000));
    const minutes = Math.floor(paceMinPerKm);
    const seconds = Math.round((paceMinPerKm - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
  };

  return (
    <>
      <View style={styles.dayCard}>
        <ScrollView
          style={styles.activitiesScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.activitiesContainer}
        >
          {/* Recorded Activities */}
          {activities.map((activity) => (
            <WorkoutCard
              key={activity.uuid}
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
        </ScrollView>
      </View>

      {/* Activity Detail Modal */}
      <ActivityDetailModal
        activity={selectedActivity}
        isVisible={isActivityModalVisible}
        onClose={() => {
          setIsActivityModalVisible(false);
          setSelectedActivity(null);
        }}
        formatDistance={formatDistance}
        formatPace={(pace) => {
          const minutes = Math.floor(pace);
          const seconds = Math.round((pace - minutes) * 60);
          return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
        }}
        formatDate={formatDetailDate}
      />

      {/* Training Detail Modal */}
      <TrainingDetailModal
        activity={selectedTraining}
        isVisible={isTrainingModalVisible}
        onClose={() => {
          setIsTrainingModalVisible(false);
          setSelectedTraining(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  dayCard: {
    width: 350,
    height: 325,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },

  activitiesScroll: {
    flex: 1,
  },
  activitiesContainer: {

  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontFamily: 'SF-Pro-Rounded-Medium',
  },
}); 