import Theme from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface RestWorkoutCardProps {
  restActivity: {
    _id: string;
    date: string;
    completedAt: string;
    xpGained: number;
    coinsGained: number;
    notes?: string;
  };
  onPress?: () => void;
}

export default function RestWorkoutCard({ restActivity, onPress }: RestWorkoutCardProps) {
  // Format completion time
  const formatCompletionTime = (completedAt: string): string => {
    const completedDate = new Date(completedAt);
    const hours = completedDate.getHours();
    const minutes = completedDate.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <Image source={require('@/assets/images/blaze/blaze-sleep-icon.png')} style={styles.imageEmoji} resizeMode='contain' />
          <View style={styles.titleText}>
            <Text style={styles.title}>Rest Day Completed</Text>
          </View>
        </View>
        {/* <View style={styles.timeSection}>
          <Text style={styles.timeText}>{formatCompletionTime(restActivity.completedAt)}</Text>
        </View> */}
      </View>

      {/* Stats Section */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>+{restActivity.xpGained}</Text>
          <Ionicons name="flash" size={16} color={Theme.colors.special.primary.exp} />
        </View>
      </View>

      {/* Motivational Message */}
      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>
          Great job taking time to recover!
        </Text>
      </View>

      {/* Notes if available */}
      {restActivity.notes && (
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>Notes:</Text>
          <Text style={styles.notesText}>{restActivity.notes}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.background.primary,
    width: '100%',
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  imageEmoji: {
    width: 40,
    height: 40,
    marginRight: Theme.spacing.sm,
  },
  emoji: {
    fontSize: 24,
    marginRight: Theme.spacing.sm,
  },
  titleText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.tertiary,
  },
  timeSection: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    // backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.medium,
    paddingVertical: Theme.spacing.md,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginRight: Theme.spacing.sm,
  },
  statLabel: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Theme.colors.border.secondary,
  },
  coinIcon: {
    width: 16,
    height: 16,
  },
  messageContainer: {
    backgroundColor: Theme.colors.background.primary,
    borderRadius: Theme.borderRadius.small,
    padding: Theme.spacing.sm,
  },
  messageText: {
    fontSize: 18,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
  },
  notesContainer: {
    backgroundColor: Theme.colors.background.primary,
    borderRadius: Theme.borderRadius.small,
    padding: Theme.spacing.sm,
  },
  notesLabel: {
    fontSize: 14,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.tertiary,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  notesText: {
    fontSize: 16,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.secondary,
    lineHeight: 22,
  },
}); 