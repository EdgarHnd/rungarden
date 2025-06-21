import Theme from '@/constants/theme';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface MonthHeaderProps {
  title: string;
  distance: string;
  runCount: number;
}

export const MonthHeader = ({ title, distance, runCount }: MonthHeaderProps) => (
  <View style={styles.stickyMonthHeader}>
    <View style={styles.monthHeader}>
      <Text style={styles.monthTitle}>{title}</Text>
      <View style={styles.monthStats}>
        <Text style={styles.monthDistance}>{distance}</Text>
        <Text style={styles.monthRunCount}>{runCount} runs</Text>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  stickyMonthHeader: {
    paddingHorizontal: Theme.spacing.xl,
    backgroundColor: Theme.colors.background.primary,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  monthTitle: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  monthStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  monthDistance: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.secondary,
  },
  monthRunCount: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
}); 