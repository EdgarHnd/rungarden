import StatsBadges from '@/components/StatsBadges';
import Theme from '@/constants/theme';
import { DatabaseActivity } from '@/services/DatabaseHealthService';
import LevelingService from '@/services/LevelingService';
import RunFeelingService, { FeelingType } from '@/services/RunFeelingService';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Image, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface RunCelebrationModalProps {
  visible: boolean;
  runData: DatabaseActivity | null;
  rewards: {
    distanceGained: number;
    coinsGained: number;
    leveledUp?: boolean;
    newLevel?: number;
    oldLevel?: number;
    challengesUnlocked?: string[];
  };
  onClose: () => void;
  metricSystem?: 'metric' | 'imperial';
  streakInfo?: {
    currentStreak: number;
    longestStreak: number;
  };
}

interface Feeling {
  type: FeelingType;
  emoji: string;
  label: string;
  color: string;
}

const feelings: Feeling[] = [
  { type: 'dead', emoji: '💀', label: 'Dead', color: '#EF4444' },
  { type: 'tough', emoji: '😤', label: 'Tough', color: '#F59E0B' },
  { type: 'okay', emoji: '👍', label: 'Okay', color: '#3B82F6' },
  { type: 'good', emoji: '😊', label: 'Good', color: '#10B981' },
  { type: 'amazing', emoji: '🔥', label: 'Amazing', color: '#FF6B35' },
];

export default function RunCelebrationModal({
  visible,
  runData,
  rewards,
  onClose,
  metricSystem = 'metric',
  streakInfo
}: RunCelebrationModalProps) {
  const [currentStep, setCurrentStep] = useState<'stats' | 'xp' | 'streak' | 'coins'>('stats');
  const [selectedFeeling, setSelectedFeeling] = useState<FeelingType | null>(null);

  const handleFeelingSelect = (feeling: FeelingType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFeeling(feeling);
  };

  const handleContinue = () => {
    if (currentStep === 'stats') {
      if (selectedFeeling && runData) {
        RunFeelingService.recordFeeling(runData._id, selectedFeeling);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCurrentStep('xp');
    } else if (currentStep === 'xp') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCurrentStep('streak');
    } else if (currentStep === 'streak') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCurrentStep('coins');
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentStep('stats');
    setSelectedFeeling(null);
    onClose();
  };

  const formatDistance = (meters: number) => {
    return LevelingService.formatDistance(meters, metricSystem || 'metric');
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatPace = (duration: number, distance: number) => {
    if (distance === 0) return '--:--';
    const paceMinPerKm = (duration / (distance / 1000));
    const minutes = Math.floor(paceMinPerKm);
    const seconds = Math.round((paceMinPerKm - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getRunEmoji = () => {
    if (!runData) return '🏃‍♂️';
    const distance = runData.distance / 1000;
    if (distance >= 21) return '🏆';
    if (distance >= 10) return '🥇';
    if (distance >= 5) return '⭐';
    if (distance >= 1) return '🔥';
    return '🏃‍♂️';
  };

  if (!visible || !runData) return null;

  const renderStatsStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.centeredGroup}>
        <View style={styles.headerSection}>
          <Text style={styles.headerEmoji}>{getRunEmoji()}</Text>
          <Text style={styles.headerTitle}>Congrats on your run!</Text>
        </View>

        <View style={styles.contentSection}>
          <StatsBadges stats={[
            {
              label: 'Distance',
              value: formatDistance(runData.distance),
              icon: '🏃',
              color: '#3B82F6'
            },
            {
              label: 'Duration',
              value: formatDuration(runData.duration),
              icon: '⏱️',
              color: '#10B981'
            },
            {
              label: 'Pace',
              value: formatPace(runData.duration, runData.distance),
              icon: '⚡',
              color: '#FFB800'
            },
            {
              label: 'Calories',
              value: Math.round(runData.calories).toString(),
              icon: '🍦',
              color: '#EF4444'
            }
          ]} />

          <View style={styles.feelingSection}>
            <Text style={styles.sectionTitle}>How did you feel?</Text>
            <View style={styles.feelingsGrid}>
              {feelings.map((feeling) => (
                <TouchableOpacity
                  key={feeling.type}
                  style={[
                    styles.feelingButton,
                    selectedFeeling === feeling.type && {
                      backgroundColor: feeling.color,
                      borderColor: feeling.color,
                    }
                  ]}
                  onPress={() => handleFeelingSelect(feeling.type)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.feelingEmoji}>{feeling.emoji}</Text>
                  <Text style={[
                    styles.feelingLabel,
                    selectedFeeling === feeling.type && styles.feelingLabelSelected
                  ]}>
                    {feeling.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.actionButton,
          !selectedFeeling && styles.actionButtonDisabled
        ]}
        onPress={handleContinue}
        disabled={!selectedFeeling}
        activeOpacity={0.8}
      >
        <Text style={[
          styles.actionButtonText,
          !selectedFeeling && styles.actionButtonTextDisabled
        ]}>
          Continue
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderXpStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.centeredGroup}>
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>More XP!</Text>
        </View>

        <View style={styles.contentSection}>
          <View style={styles.centerContent}>
            <View style={styles.xpBadge}>
              <Text style={styles.xpValue}>+{LevelingService.distanceToXP(rewards.distanceGained)}xp</Text>
            </View>

            <View style={styles.progressSection}>
              <Text style={styles.progressLabel}>lvl {rewards.oldLevel || 1}</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: '60%' }]} />
              </View>
              <Text style={styles.progressLabel}>lvl {(rewards.oldLevel || 1) + 1}</Text>
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: Theme.colors.special.primary.exp, borderBottomColor: Theme.colors.special.secondary.exp }]}
        onPress={handleContinue}
        activeOpacity={0.8}
      >
        <Text style={styles.actionButtonText}>Claim XP</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStreakStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.centeredGroup}>
        <View style={styles.streakDisplay}>
          <Text style={styles.streakFlameIcon}>🔥</Text>
          <Text style={styles.streakMainNumber}>{streakInfo?.currentStreak || 0}</Text>
          <Text style={styles.streakMainLabel}>day streak</Text>
        </View>

        <View style={styles.streakWeekView}>
          {['Th', 'Fr', 'Sa', 'Su', 'Mo', 'Tu', 'We'].map((dayName, index) => (
            <View key={dayName} style={styles.streakDayColumn}>
              <Text style={styles.streakDayName}>{dayName}</Text>
              <View style={[
                styles.streakDayCircle,
                index < (streakInfo?.currentStreak || 0) ? styles.streakDayCompleted : styles.streakDayIncomplete
              ]}>
                {index < (streakInfo?.currentStreak || 0) && (
                  <Text style={styles.streakCheckmark}>✓</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.streakEncouragement}>
          {(streakInfo?.currentStreak || 0) >= 6 ?
            "You've been learning for almost a week straight!" :
            (streakInfo?.currentStreak || 0) >= 3 ?
              "You're building an amazing habit!" :
              "Keep going to build your streak!"
          }
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: Theme.colors.accent.primary }]}
        onPress={handleContinue}
        activeOpacity={0.8}
      >
        <Text style={styles.actionButtonText}>I'M COMMITTED</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCoinsStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.centeredGroup}>
        <View style={styles.headerSection}>
          <Text style={styles.rewardAmount}>+{rewards.coinsGained}</Text>
        </View>
        <View style={styles.contentSection}>
          <View style={styles.centerContent}>
            <Image source={require('@/assets/images/icons/eucaleaf.png')} style={styles.rewardIcon} />
            <Text style={styles.rewardMessage}>You earned {rewards.coinsGained} leaves!</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: Theme.colors.special.primary.coin, borderBottomColor: Theme.colors.special.secondary.coin }]}
        onPress={handleClose}
        activeOpacity={0.8}
      >
        <Text style={styles.actionButtonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'stats':
        return renderStatsStep();
      case 'xp':
        return renderXpStep();
      case 'streak':
        return renderStreakStep();
      case 'coins':
        return renderCoinsStep();
      default:
        return renderStatsStep();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          {renderCurrentStep()}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Base Layout
  overlay: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
  },
  stepContent: {
    flex: 1,
    paddingTop: Theme.spacing.xxxl,
    paddingBottom: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.xxl,

  },
  centeredGroup: {
    flex: 1,
    justifyContent: 'center',
  },

  // Header Section
  headerSection: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xxxl,
  },
  headerEmoji: {
    fontSize: 64,
    marginBottom: Theme.spacing.lg,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },

  // Content Section
  contentSection: {
  },
  centerContent: {
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.lg,
  },
  // Feelings Section
  feelingSection: {
    marginTop: Theme.spacing.xxxl,
    marginBottom: Theme.spacing.xl,
  },
  feelingsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  feelingButton: {
    width: '18%',
    aspectRatio: 1,
    borderRadius: Theme.borderRadius.medium,
    borderWidth: 2,
    borderColor: Theme.colors.border.primary,
    backgroundColor: Theme.colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feelingEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  feelingLabel: {
    fontSize: 10,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  feelingLabelSelected: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.semibold,
  },

  // XP Section
  xpBadge: {
    paddingHorizontal: Theme.spacing.xxxl,
    paddingVertical: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl,
  },
  xpValue: {
    fontSize: 48,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.special.primary.exp,
    textAlign: 'center',
  },

  // Progress Section
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: Theme.spacing.lg,
  },
  progressLabel: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    marginHorizontal: Theme.spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: Theme.colors.background.secondary,
    borderWidth: 1,
    borderColor: Theme.colors.border.primary,
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: Theme.colors.special.primary.exp,
  },

  // Streak Section
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

  // Rewards Section
  rewardAmount: {
    fontSize: 48,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.special.primary.coin,
    textAlign: 'center',
  },
  rewardIcon: {
    width: 120,
    height: 120,
    marginBottom: Theme.spacing.xl,
  },
  rewardMessage: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },

  // Action Button
  actionButton: {
    backgroundColor: Theme.colors.accent.primary,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
    borderBottomColor: Theme.colors.accent.secondary,
  },
  actionButtonDisabled: {
    backgroundColor: Theme.colors.background.tertiary,
    borderBottomColor: Theme.colors.background.secondary
  },
  actionButtonText: {
    fontSize: 16,
    textTransform: 'uppercase',
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background.primary,
  },
  actionButtonTextDisabled: {
    color: Theme.colors.text.muted,
  },
}); 