import Theme from '@/constants/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface WeeklyProgressBarProps {
  currentDistance: number;
  targetDistance: number;
}

export default function WeeklyProgressBar({ currentDistance, targetDistance }: WeeklyProgressBarProps) {
  const progressPercentage = Math.min((currentDistance / targetDistance) * 100, 100);

  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>Weekly Goal</Text>
        <Text style={styles.progress}>
          {currentDistance.toFixed(1)}km / {targetDistance}km
        </Text>
      </View>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progressPercentage}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Theme.spacing.sm,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.xs,
  },
  label: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  progress: {
    fontSize: 14,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
  },
  progressBar: {
    height: 8,
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.small,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.small,
  },
}); 