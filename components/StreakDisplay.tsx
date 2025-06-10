import Theme from '@/constants/theme';
import StreakService from '@/services/StreakService';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface StreakDisplayProps {
  streakInfo: {
    currentStreak: number;
    longestStreak: number;
    lastStreakDate: string | null;
    plannedWorkouts: Array<{
      scheduledDate: string;
      type: string;
      status: 'scheduled' | 'completed' | 'skipped' | 'missed';
    }>;
  } | null;
  onPress?: () => void;
}

interface DayStatus {
  date: string;
  type: 'completed' | 'rest' | 'missed' | 'scheduled';
  isTrainingDay: boolean;
}

export default function StreakDisplay({ streakInfo, onPress }: StreakDisplayProps) {
  // Generate the last 7 days for display
  const generateWeekDays = (): DayStatus[] => {
    const days: DayStatus[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateString = date.toISOString().split('T')[0];

      // Find planned workout for this date
      const plannedWorkout = streakInfo?.plannedWorkouts.find(
        w => w.scheduledDate === dateString
      );

      let dayType: 'completed' | 'rest' | 'missed' | 'scheduled';
      let isTrainingDay = false;

      if (plannedWorkout) {
        isTrainingDay = plannedWorkout.type !== 'rest' && plannedWorkout.type !== 'cross-train';

        if (plannedWorkout.status === 'completed') {
          dayType = 'completed';
        } else if (plannedWorkout.type === 'rest' || plannedWorkout.type === 'cross-train') {
          dayType = 'rest';
        } else if (plannedWorkout.status === 'missed' || plannedWorkout.status === 'skipped') {
          dayType = 'missed';
        } else {
          dayType = 'scheduled';
        }
      } else {
        // No planned workout - assume rest day
        dayType = 'rest';
        isTrainingDay = false;
      }

      days.push({
        date: dateString,
        type: dayType,
        isTrainingDay
      });
    }

    return days;
  };

  const weekDays = generateWeekDays();
  const currentStreak = streakInfo?.currentStreak || 0;
  const longestStreak = streakInfo?.longestStreak || 0;

  // Calculate streak status
  const calculatedStreakInfo = streakInfo ?
    StreakService.calculateStreakInfo(
      streakInfo.plannedWorkouts,
      currentStreak,
      longestStreak,
      streakInfo.lastStreakDate
    ) : null;

  const getFlameIcon = (day: DayStatus) => {
    if (!day.isTrainingDay) {
      // Rest days get a different icon
      return (
        <View style={[styles.flameContainer, styles.restDay]}>
          <Ionicons name="bed-outline" size={16} color={Theme.colors.text.tertiary} />
        </View>
      );
    }

    switch (day.type) {
      case 'completed':
        return (
          <View style={[styles.flameContainer, styles.completedDay]}>
            <Ionicons name="flash" size={20} color={Theme.colors.accent.primary} />
          </View>
        );
      case 'missed':
        return (
          <View style={[styles.flameContainer, styles.missedDay]}>
            <Ionicons name="flash-outline" size={20} color={Theme.colors.status.error} />
          </View>
        );
      case 'scheduled':
        const isToday = day.date === new Date().toISOString().split('T')[0];
        return (
          <View style={[styles.flameContainer, isToday ? styles.todayDay : styles.scheduledDay]}>
            <Ionicons
              name="flash-outline"
              size={20}
              color={isToday ? Theme.colors.accent.primary : Theme.colors.text.secondary}
            />
          </View>
        );
      default:
        return (
          <View style={[styles.flameContainer, styles.scheduledDay]}>
            <Ionicons name="flash-outline" size={20} color={Theme.colors.text.secondary} />
          </View>
        );
    }
  };

  const getStreakMessage = () => {
    if (calculatedStreakInfo) {
      return StreakService.getStreakMessage(calculatedStreakInfo);
    }
    return "Start your training streak today! 🔥";
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Streaks This Week</Text>
        <View style={styles.currentStreakBadge}>
          <Ionicons name="flash" size={16} color={Theme.colors.text.primary} />
          <Text style={styles.currentStreakText}>{currentStreak}</Text>
        </View>
      </View>

      <View style={styles.weekContainer}>
        <View style={styles.daysContainer}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName, index) => (
            <View key={dayName} style={styles.dayColumn}>
              {getFlameIcon(weekDays[index])}
              <Text style={styles.dayLabel}>{dayName}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <Ionicons name="flash" size={16} color={Theme.colors.accent.primary} />
          <Text style={styles.legendText}>Completed</Text>
        </View>
        <View style={styles.legendItem}>
          <Ionicons name="bed-outline" size={16} color={Theme.colors.text.tertiary} />
          <Text style={styles.legendText}>Rest</Text>
        </View>
        <View style={styles.legendItem}>
          <Ionicons name="flash-outline" size={16} color={Theme.colors.status.error} />
          <Text style={styles.legendText}>Missed</Text>
        </View>
      </View>

      <View style={styles.streakInfo}>
        <Text style={styles.streakMessage}>{getStreakMessage()}</Text>
        {longestStreak > 0 && (
          <Text style={styles.longestStreak}>
            Longest streak: {longestStreak} days 🏆
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    marginVertical: Theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.lg,
  },
  title: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  currentStreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.full,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    gap: Theme.spacing.xs,
  },
  currentStreakText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  weekContainer: {
    marginBottom: Theme.spacing.lg,
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayColumn: {
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  flameContainer: {
    width: 36,
    height: 36,
    borderRadius: Theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedDay: {
    backgroundColor: Theme.colors.transparent.accent20,
  },
  restDay: {
    backgroundColor: Theme.colors.background.tertiary,
  },
  missedDay: {
    backgroundColor: Theme.colors.background.tertiary,
    borderWidth: 1,
    borderColor: Theme.colors.status.error,
  },
  scheduledDay: {
    backgroundColor: Theme.colors.background.tertiary,
  },
  todayDay: {
    backgroundColor: Theme.colors.transparent.accent20,
    borderWidth: 2,
    borderColor: Theme.colors.accent.primary,
  },
  dayLabel: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border.primary,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  legendText: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  streakInfo: {
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  streakMessage: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },
  longestStreak: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
}); 