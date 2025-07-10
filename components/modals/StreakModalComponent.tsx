import Theme from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
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
    /*
      Show a sliding window of the last 8 weeks (or fewer if the streak is < 8).
      Example:
        currentStreak = 5  => weeks 1-5
        currentStreak = 9  => weeks 2-9  (latest 8)
        currentStreak = 15 => weeks 8-15 (latest 8)
    */

    const visibleWeeks = 8;

    // Calculate the start and end week numbers for the window
    const endWeek = currentStreak;
    const startWeek = Math.max(1, endWeek - visibleWeeks + 1);

    const weeks: { weekNumber: number; isCompleted: boolean }[] = [];
    for (let week = startWeek; week <= endWeek; week++) {
      weeks.push({
        weekNumber: week,
        isCompleted: week <= currentStreak,
      });
    }

    // If the streak is less than the visible window, prepend missing weeks so that
    // the total count always equals `visibleWeeks`. This keeps spacing consistent.
    while (weeks.length < visibleWeeks) {
      // If weeks is empty, it's because currentStreak is 0.
      // The "latest" week in this case is 0, so we start prepending from -1.
      const firstWeekNumber = weeks.length > 0 ? weeks[0].weekNumber : 1;
      const missingWeekNumber = firstWeekNumber - 1;
      weeks.unshift({
        weekNumber: missingWeekNumber,
        isCompleted: false,
      });
    }

    return weeks;
  };

  return (
    <View style={styles.centeredGroup}>
      <Reanimated.View style={[styles.streakDisplay, streakAnimatedStyle]}>
        <Image source={require('@/assets/images/icons/streak.png')} style={styles.streakFlameIcon} />
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
    marginBottom: Theme.spacing.xl,
    // shadowColor: Theme.colors.special.primary.streak,
    // shadowOffset: { width: 0, height: 0 },
    // shadowOpacity: 0.5,
    // shadowRadius: 4,
    // elevation: 10,
  },
  streakFlameIcon: {
    width: 120,
    height: 120,
  },
  streakMainNumber: {
    fontSize: 72,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
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
    width: 30,
    height: 30,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakWeekCompleted: {
    backgroundColor: Theme.colors.special.primary.streak,
  },
  streakWeekIncomplete: {
    backgroundColor: Theme.colors.background.tertiary,
  },
  streakCheckmark: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background.primary,
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