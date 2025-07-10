import Theme from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface StreakDisplayProps {
  visible: boolean;
  streakInfo: {
    currentStreak: number;
    longestStreak: number;
    lastStreakWeek: string | null;
  } | null;
  onClose: () => void;
}

export default function StreakDisplay({ visible, streakInfo, onClose }: StreakDisplayProps) {
  const currentStreak = streakInfo?.currentStreak || 0;
  const longestStreak = streakInfo?.longestStreak || 0;

  // Helper to compute week start (Monday as default)
  const getWeekStart = (date: Date): Date => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, …
    const diff = day === 0 ? 6 : day - 1; // Monday start
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  };

  // Determine if user has logged a run this week.
  // Treat as current week if the stored lastStreakWeek date falls within the last 7 days.
  const hasRunThisWeek = (() => {
    if (!streakInfo?.lastStreakWeek) return false;
    const lastDate = new Date(streakInfo.lastStreakWeek);
    const today = new Date();
    const diffDays = (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays < 7 && diffDays >= 0;
  })();

  // Grey-out styles when no run yet
  const inactiveStyle = !hasRunThisWeek ? styles.inactiveStreak : null;

  const getStreakMessage = () => {
    if (!hasRunThisWeek && currentStreak > 0) {
      return "Run this week to maintain your streak!";
    }
    if (currentStreak >= 24) {
      return "You've been consistent for 6 months!";
    } else if (currentStreak >= 12) {
      return "You've been consistent for almost 3 months!";
    } else if (currentStreak >= 4) {
      return "You're building an incredible habit!";
    } else if (currentStreak >= 2) {
      return "Great momentum! Keep hitting your weekly goals!";
    } else if (currentStreak > 0) {
      return "Keep going to build your weekly streak!";
    }
    return "Hit your weekly goal to start your streak!";
  };

  const getWeekNumbers = () => {
    // Show 8 weeks, with current streak filled
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
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Your Weekly Streak</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.streakContainer}>
            <Image
              source={require('@/assets/images/icons/streak.png')}
              style={[styles.streakFlameIcon, inactiveStyle]}
            />
            <View style={styles.streakDisplay}>
              <Text style={[styles.streakMainNumber, inactiveStyle]}>{currentStreak}</Text>
              {hasRunThisWeek ? (
                <Text style={[styles.streakMainLabel, inactiveStyle]}>week{currentStreak !== 1 ? 's' : ''} streak!</Text>
              ) : (
                <Text style={[styles.streakMainLabel, inactiveStyle]}>your streak is at risk!</Text>
              )}
            </View>
          </View>
          <View style={styles.streakWeekView}>
            {getWeekNumbers().map((week) => (
              <View key={week.weekNumber} style={styles.streakWeekColumn}>
                <Text style={styles.streakWeekName}>W{week.weekNumber}</Text>
                <View style={[
                  styles.streakWeekCircle,
                  week.isCompleted ? styles.streakWeekCompleted : styles.streakWeekIncomplete
                ]}>
                  {week.isCompleted && (
                    <Text style={styles.streakCheckmark}>✓</Text>
                  )}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.streakInfo}>
            <Text style={[styles.streakMessage]}>{getStreakMessage()}</Text>
            {longestStreak > 0 && (
              <Text style={styles.longestStreak}>
                Longest streak: {longestStreak} week{longestStreak !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
  },
  container: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.lg,
  },
  title: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  closeButton: {
    padding: Theme.spacing.xs,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  streakDisplay: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginLeft: 10,
    marginBottom: Theme.spacing.sm,
    // shadowColor: Theme.colors.special.primary.streak,
    // shadowOffset: { width: 0, height: 0 },
    // shadowOpacity: 0.5,
    // shadowRadius: 4,
    // elevation: 10,
  },
  streakFlameIcon: {
    marginTop: 10,
    width: 100,
    height: 100,
  },
  streakMainNumber: {
    zIndex: 1,
    marginTop: 20,
    fontSize: 50,
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
    marginBottom: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.sm,
  },
  streakWeekColumn: {
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  streakWeekName: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  streakWeekCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background.primary,
  },
  streakInfo: {
    alignItems: 'center',
    gap: Theme.spacing.xs,
    paddingTop: Theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border.primary,
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
  inactiveStreak: {
    opacity: 0.4,
  },
}); 