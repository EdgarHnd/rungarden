import Theme from '@/constants/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface StatBadge {
  label: string;
  value: string;
  icon: string;
  color: string;
}

interface StatsBadgesProps {
  stats: StatBadge[];
}

export default function StatsBadges({ stats }: StatsBadgesProps) {
  return (
    <View style={styles.badgeStatsContainer}>
      {stats.map((stat, index) => (
        <View key={index} style={[styles.statBadge, { backgroundColor: stat.color }]}>
          <Text style={styles.badgeLabel}>{stat.label.toUpperCase()}</Text>
          <View style={styles.badgeInner}>
            <Text style={styles.badgeIcon}>{stat.icon}</Text>
            <Text style={styles.badgeValue}>{stat.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Badge Style Stats
  badgeStatsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
  },
  statBadge: {
    width: '48%',
    borderRadius: Theme.borderRadius.large,
    padding: 3,
    minHeight: 85,
    justifyContent: 'space-between',
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background.primary,
    letterSpacing: 1.2,
    marginBottom: Theme.spacing.xs,
    textAlign: 'center',
  },
  badgeInner: {
    backgroundColor: Theme.colors.background.primary,
    borderRadius: Theme.borderRadius.medium,
    padding: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  badgeIcon: {
    fontSize: 24,
  },
  badgeValue: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
}); 