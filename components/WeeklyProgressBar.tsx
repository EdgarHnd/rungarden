import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface WeeklyProgressBarProps {
  weeklyProgress: number;
  weeklyGoal: string;
}

export default function WeeklyProgressBar({ weeklyProgress, weeklyGoal }: WeeklyProgressBarProps) {
  const progressPercentage = (weeklyProgress / parseFloat(weeklyGoal)) * 100;

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>Weekly Goal</Text>
        <Text style={styles.progressText}>{weeklyProgress} / {weeklyGoal} km</Text>
      </View>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${Math.min(progressPercentage, 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  progressContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 16,
    color: '#9CA3AF',
    fontFamily: 'SF-Pro-Rounded-Medium',
  },
  progressText: {
    fontSize: 16,
    color: '#111827',
    fontFamily: 'SF-Pro-Rounded-Bold',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#D1D5DB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
}); 