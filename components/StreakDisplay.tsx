import Theme from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface StreakDisplayProps {
  visible: boolean;
  streakInfo: {
    currentStreak: number;
    longestStreak: number;
    lastStreakDate: string | null;
  } | null;
  onClose: () => void;
}

export default function StreakDisplay({ visible, streakInfo, onClose }: StreakDisplayProps) {
  const currentStreak = streakInfo?.currentStreak || 0;
  const longestStreak = streakInfo?.longestStreak || 0;

  const getStreakMessage = () => {
    if (currentStreak >= 6) {
      return "You've been training for almost a week straight!";
    } else if (currentStreak >= 3) {
      return "You're building an amazing habit!";
    } else if (currentStreak > 0) {
      return "Keep going to build your streak!";
    }
    return "Start your training streak today! 🔥";
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
            <Text style={styles.title}>Your Streak</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.streakDisplay}>
            <Text style={styles.streakFlameIcon}>🔥</Text>
            <Text style={styles.streakMainNumber}>{currentStreak}</Text>
            <Text style={styles.streakMainLabel}>day streak</Text>
          </View>

          <View style={styles.streakWeekView}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName, index) => (
              <View key={dayName} style={styles.streakDayColumn}>
                <Text style={styles.streakDayName}>{dayName}</Text>
                <View style={[
                  styles.streakDayCircle,
                  index < currentStreak ? styles.streakDayCompleted : styles.streakDayIncomplete
                ]}>
                  {index < currentStreak && (
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
                Longest streak: {longestStreak} days 🏆
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
  streakDayColumn: {
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  streakDayName: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  streakDayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
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