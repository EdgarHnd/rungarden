import Theme from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  default as Reanimated,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface StreakModalComponentProps {
  currentStreak: number;
  streakIncreased?: boolean;
  customMessage?: string;
}

export default function StreakModalComponent({
  currentStreak,
  streakIncreased = false,
  customMessage,
}: StreakModalComponentProps) {
  const streakScale = useSharedValue(0);

  useEffect(() => {
    // Animate streak display on mount
    streakScale.value = withSpring(1, {
      damping: 15,
      stiffness: 80,
    });

    // Heavy haptic for streak emphasis
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Sequential light haptics for each week
    for (let i = 0; i < Math.min(currentStreak, 8); i++) {
      setTimeout(() => {
        Haptics.selectionAsync();
      }, i * 300);
    }
  }, [currentStreak]);

  const streakAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: streakScale.value }]
    };
  });

  const getWeekNumbers = () => {
    // Show last 8 weeks, with current streak filled
    const weeks = [];
    for (let i = 0; i < 8; i++) {
      weeks.push({
        weekNumber: i + 1,
        isCompleted: i < currentStreak
      });
    }
    return weeks;
  };

  return (
    <View style={styles.centeredGroup}>
      <Reanimated.View style={[styles.streakDisplay, streakAnimatedStyle]}>
        <Text style={styles.streakFlameIcon}>🔥</Text>
        <Text style={styles.streakMainNumber}>{currentStreak}</Text>
        <Text style={styles.streakMainLabel}>week{currentStreak !== 1 ? 's' : ''} streak</Text>
      </Reanimated.View>

      <View style={styles.streakWeekView}>
        {getWeekNumbers().map((week) => (
          <Reanimated.View
            key={week.weekNumber}
            style={styles.streakWeekColumn}
          >
            <Text style={styles.streakWeekName}>W{week.weekNumber}</Text>
            <View style={[
              styles.streakWeekCircle,
              week.isCompleted ? styles.streakWeekCompleted : styles.streakWeekIncomplete
            ]}>
              {week.isCompleted && (
                <Text style={styles.streakCheckmark}>✓</Text>
              )}
            </View>
          </Reanimated.View>
        ))}
      </View>

      <Text style={styles.streakEncouragement}>
        {customMessage || (
          streakIncreased
            ? "Weekly goal achieved! Consistency builds champions! 🌟"
            : "Keep hitting your weekly goals to build your streak! 🎯"
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centeredGroup: {
    flex: 1,
    justifyContent: 'center',
  },
  streakDisplay: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xxxl,
  },
  streakFlameIcon: {
    fontSize: 120,
    marginBottom: Theme.spacing.lg,
  },
  streakMainNumber: {
    fontSize: 72,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.sm,
  },
  streakMainLabel: {
    fontSize: 24,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.xxxl,
  },
  streakWeekView: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.xxxl,
    paddingHorizontal: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  streakWeekColumn: {
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  streakWeekName: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    marginBottom: Theme.spacing.sm,
  },
  streakWeekCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakWeekCompleted: {
    backgroundColor: Theme.colors.accent.primary,
  },
  streakWeekIncomplete: {
    backgroundColor: Theme.colors.background.tertiary,
  },
  streakCheckmark: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  streakEncouragement: {
    fontSize: 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Theme.spacing.lg,
  },
}); 