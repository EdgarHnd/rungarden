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

    // Sequential light haptics for each day
    for (let i = 0; i < currentStreak; i++) {
      setTimeout(() => {
        Haptics.selectionAsync();
      }, i * 200);
    }
  }, [currentStreak]);

  const streakAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: streakScale.value }]
    };
  });

  return (
    <View style={styles.centeredGroup}>
      <Reanimated.View style={[styles.streakDisplay, streakAnimatedStyle]}>
        <Text style={styles.streakFlameIcon}>🔥</Text>
        <Text style={styles.streakMainNumber}>{currentStreak}</Text>
        <Text style={styles.streakMainLabel}>day streak</Text>
      </Reanimated.View>

      <View style={styles.streakWeekView}>
        {['Th', 'Fr', 'Sa', 'Su', 'Mo', 'Tu', 'We'].map((dayName, index) => (
          <Reanimated.View
            key={dayName}
            style={styles.streakDayColumn}
          >
            <Text style={styles.streakDayName}>{dayName}</Text>
            <View style={[
              styles.streakDayCircle,
              index < currentStreak ? styles.streakDayCompleted : styles.streakDayIncomplete
            ]}>
              {index < currentStreak && (
                <Text style={styles.streakCheckmark}>✓</Text>
              )}
            </View>
          </Reanimated.View>
        ))}
      </View>

      <Text style={styles.streakEncouragement}>
        {customMessage || (
          streakIncreased
            ? "Streak continued! Consistency is key! 🌟"
            : "Keep going to build your streak! 🎯"
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
  },
  streakDayColumn: {
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  streakDayName: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    marginBottom: Theme.spacing.sm,
  },
  streakDayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakDayCompleted: {
    backgroundColor: Theme.colors.accent.primary,
  },
  streakDayIncomplete: {
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