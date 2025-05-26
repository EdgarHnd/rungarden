import WeeklyProgressBar from '@/components/WeeklyProgressBar';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
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

      <WeeklyProgressBar weeklyProgress={weeklyProgress} weeklyGoal={weeklyGoal} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  emoji: {
    fontSize: 32,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#111827',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: 'SF-Pro-Rounded-Medium',
  },
  intensityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  intensityText: {
    fontSize: 12,
    color: 'white',
    fontFamily: 'SF-Pro-Rounded-Bold',
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'SF-Pro-Rounded-Regular',
    lineHeight: 22,
    marginBottom: 20,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 20,
  },
  detail: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: 'SF-Pro-Rounded-Medium',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#111827',
    fontFamily: 'SF-Pro-Rounded-Bold',
  },
}); 