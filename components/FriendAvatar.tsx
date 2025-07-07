import Theme from '@/constants/theme';
import { formatDistance } from '@/utils/formatters';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

interface FriendAvatarProps {
  entry: {
    userId: string;
    name: string;
    totalDistance: number;
    level: number;
    totalWorkouts: number;
  };
  metricSystem?: 'metric' | 'imperial';
  isCurrent?: boolean;
}

const getAvatarImage = (level: number) => {
  if (level >= 30) return require('@/assets/images/flame/age4.png');
  if (level >= 20) return require('@/assets/images/flame/age3.png');
  if (level >= 10) return require('@/assets/images/flame/age2.png');
  if (level >= 5) return require('@/assets/images/flame/age1.png');
  return require('@/assets/images/flame/age0.png');
};

export default function FriendAvatar({ entry, metricSystem = 'metric', isCurrent = false }: FriendAvatarProps) {
  const xp = Math.floor(entry.totalDistance * 0.1); // Approx XP gained from distance

  return (
    <View style={styles.container}>
      {isCurrent && <Text style={styles.youLabel}> (You)</Text>}
      <Text style={styles.xpLabel}>+{xp}xp</Text>
      <Image source={getAvatarImage(entry.level)} style={styles.avatarImage} resizeMode="contain" />
      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {entry.name}
        {entry.level > 0 && <Text style={styles.levelSup}> lvl{entry.level}</Text>}
      </Text>
      <View style={styles.distanceContainer}>
        <Text style={styles.distance}>{formatDistance(entry.totalDistance, metricSystem)}</Text>
        <Text style={styles.runs}>{entry.totalWorkouts} runs</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    margin: Theme.spacing.lg,
    width: 90,
  },
  youLabel: {
    color: Theme.colors.text.primary,
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    marginBottom: Theme.spacing.xs,
  },
  xpLabel: {
    color: Theme.colors.special.primary.exp,
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    marginBottom: Theme.spacing.xs,
  },
  avatarImage: {
    width: 70,
    height: 70,
    marginBottom: Theme.spacing.sm,
  },
  name: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },
  levelSup: {
    fontSize: 10,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.tertiary,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  distance: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
  },
  runs: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
}); 