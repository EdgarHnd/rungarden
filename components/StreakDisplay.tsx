import Theme from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

  const getStreakMessage = () => {
    if (currentStreak >= 12) {
      return "You've been consistent for almost 3 months! Amazing!";
    } else if (currentStreak >= 4) {
      return "You're building an incredible habit!";
    } else if (currentStreak >= 2) {
      return "Great momentum! Keep hitting your weekly goals!";
    } else if (currentStreak > 0) {
      return "Keep going to build your weekly streak!";
    }
    return "Hit your weekly goal to start your streak! 🔥";
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

          <View style={styles.streakDisplay}>
            <Text style={styles.streakFlameIcon}>🔥</Text>
            <Text style={styles.streakMainNumber}>{currentStreak}</Text>
            <Text style={styles.streakMainLabel}>week{currentStreak !== 1 ? 's' : ''} streak</Text>
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
            <Text style={styles.streakMessage}>{getStreakMessage()}</Text>
            {longestStreak > 0 && (
              <Text style={styles.longestStreak}>
                Longest streak: {longestStreak} week{longestStreak !== 1 ? 's' : ''} 🏆
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
  streakDisplay: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  streakFlameIcon: {
    fontSize: 80,
    marginBottom: Theme.spacing.md,
  },
  streakMainNumber: {
    fontSize: 48,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.xs,
  },
  streakMainLabel: {
    fontSize: 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.lg,
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
    backgroundColor: Theme.colors.accent.primary,
  },
  streakWeekIncomplete: {
    backgroundColor: Theme.colors.background.tertiary,
  },
  streakCheckmark: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
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
}); 