import Theme from '@/constants/theme';
import { DatabaseActivity } from '@/services/DatabaseHealthService';
import LevelingService from '@/services/LevelingService';
import RunFeelingService, { FeelingType } from '@/services/RunFeelingService';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
}

interface Feeling {
  type: FeelingType;
  emoji: string;
  label: string;
  color: string;
}

const feelings: Feeling[] = [
  { type: 'amazing', emoji: '🔥', label: 'Amazing', color: '#FF6B35' },
  { type: 'good', emoji: '😊', label: 'Good', color: '#10B981' },
  { type: 'okay', emoji: '👍', label: 'Okay', color: '#3B82F6' },
  { type: 'tough', emoji: '😤', label: 'Tough', color: '#F59E0B' },
  { type: 'struggled', emoji: '😅', label: 'Struggled', color: '#EF4444' },
];

export default function RunCelebrationModal({
  visible,
  runData,
  rewards,
  onClose
}: RunCelebrationModalProps) {
  const [currentStep, setCurrentStep] = useState<'stats' | 'rewards'>('stats');
  const [selectedFeeling, setSelectedFeeling] = useState<FeelingType | null>(null);

  const handleFeelingSelect = (feeling: FeelingType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFeeling(feeling);
  };

  const handleContinue = () => {
    if (selectedFeeling && runData) {
      // Record the user's feeling for this run
      RunFeelingService.recordFeeling(runData.healthKitUuid, selectedFeeling);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCurrentStep('rewards');
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentStep('stats');
    setSelectedFeeling(null);
    onClose();
  };

  const formatDistance = (meters: number) => {
    const kilometers = meters / 1000;
    return kilometers < 1 ? `${Math.round(meters)}m` : `${kilometers.toFixed(2)}km`;
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
    if (distance >= 21) return '🏆'; // Half marathon+
    if (distance >= 10) return '🥇'; // 10K+
    if (distance >= 5) return '⭐'; // 5K+
    if (distance >= 1) return '🔥'; // 1K+
    return '🏃‍♂️';
  };

  const getCelebrationMessage = () => {
    if (!runData) return 'Great Run!';
    const distance = runData.distance / 1000;
    const pace = runData.distance > 0 ? (runData.duration / distance) : 0;

    if (distance >= 21) return 'Epic Achievement!';
    if (distance >= 10) return 'Outstanding Run!';
    if (distance >= 5) return 'Fantastic Effort!';
    if (pace < 5 && distance >= 1) return 'Speed Demon!';
    if (distance >= 1) return 'Great Run!';
    return 'Keep Going!';
  };

  const getCelebrationSubtitle = () => {
    if (!runData) return 'You just crushed it out there';
    const distance = runData.distance / 1000;

    if (distance >= 21) return 'You\'re absolutely unstoppable!';
    if (distance >= 10) return 'That\'s some serious distance!';
    if (distance >= 5) return 'You\'re building amazing endurance!';
    if (distance >= 1) return 'Every step counts towards your goals!';
    return 'You\'re making progress, keep it up!';
  };

  if (!visible || !runData) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {currentStep === 'stats' ? (
            // First screen: Run stats and feeling
            <>
              <View style={styles.header}>
                <Text style={styles.emoji}>{getRunEmoji()}</Text>
                <Text style={styles.title}>{getCelebrationMessage()}</Text>
                <Text style={styles.subtitle}>{getCelebrationSubtitle()}</Text>
              </View>

              <View style={styles.statsContainer}>
                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{formatDistance(runData.distance)}</Text>
                    <Text style={styles.statLabel}>Distance</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{formatDuration(runData.duration)}</Text>
                    <Text style={styles.statLabel}>Duration</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{formatPace(runData.duration, runData.distance)}</Text>
                    <Text style={styles.statLabel}>Pace</Text>
                  </View>
                </View>

                {runData.calories > 0 && (
                  <View style={styles.caloriesContainer}>
                    <Text style={styles.caloriesText}>🔥 {Math.round(runData.calories)} calories burned</Text>
                  </View>
                )}
              </View>

              <View style={styles.feelingContainer}>
                <Text style={styles.feelingTitle}>How did you feel?</Text>
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

              <TouchableOpacity
                style={[
                  styles.continueButton,
                  !selectedFeeling && styles.continueButtonDisabled
                ]}
                onPress={handleContinue}
                disabled={!selectedFeeling}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.continueButtonText,
                  !selectedFeeling && styles.continueButtonTextDisabled
                ]}>
                  Continue
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color={selectedFeeling ? '#fff' : '#ccc'}
                />
              </TouchableOpacity>
            </>
          ) : (
            // Second screen: Rewards
            <>
              <View style={styles.header}>
                <Text style={styles.emoji}>🎉</Text>
                <Text style={styles.title}>Rewards Earned!</Text>
                <Text style={styles.subtitle}>Your hard work is paying off</Text>
              </View>

              <View style={styles.rewardsContainer}>
                {/* Distance/XP Gained */}
                <View style={styles.rewardItem}>
                  <View style={styles.rewardIcon}>
                    <Text style={styles.rewardEmoji}>📏</Text>
                  </View>
                  <View style={styles.rewardContent}>
                    <Text style={styles.rewardTitle}>Distance Added</Text>
                    <Text style={styles.rewardValue}>+{LevelingService.formatDistance(rewards.distanceGained)}</Text>
                  </View>
                </View>

                {/* Coins Gained */}
                {rewards.coinsGained > 0 && (
                  <View style={styles.rewardItem}>
                    <View style={styles.rewardIcon}>
                      <Text style={styles.rewardEmoji}>🪙</Text>
                    </View>
                    <View style={styles.rewardContent}>
                      <Text style={styles.rewardTitle}>Coins Earned</Text>
                      <Text style={styles.rewardValue}>+{rewards.coinsGained}</Text>
                    </View>
                  </View>
                )}

                {/* Level Up */}
                {rewards.leveledUp && rewards.newLevel && rewards.oldLevel && (
                  <View style={[styles.rewardItem, styles.levelUpItem]}>
                    <View style={styles.rewardIcon}>
                      <Text style={styles.rewardEmoji}>{LevelingService.getLevelEmoji(rewards.newLevel)}</Text>
                    </View>
                    <View style={styles.rewardContent}>
                      <Text style={styles.rewardTitle}>Level Up!</Text>
                      <Text style={styles.rewardValue}>
                        Level {rewards.oldLevel} → {rewards.newLevel}
                      </Text>
                      <Text style={styles.levelTitle}>
                        {LevelingService.getLevelTitle(rewards.newLevel)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Challenges Unlocked */}
                {rewards.challengesUnlocked && rewards.challengesUnlocked.length > 0 && (
                  <View style={styles.challengesContainer}>
                    <View style={styles.rewardItem}>
                      <View style={styles.rewardIcon}>
                        <Text style={styles.rewardEmoji}>🏅</Text>
                      </View>
                      <View style={styles.rewardContent}>
                        <Text style={styles.rewardTitle}>Challenges Unlocked!</Text>
                        <Text style={styles.rewardValue}>
                          {rewards.challengesUnlocked.length} new challenge{rewards.challengesUnlocked.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>

                    {/* Individual challenge cards */}
                    <View style={styles.challengesList}>
                      {rewards.challengesUnlocked.map((challengeName, index) => (
                        <View key={index} style={styles.challengeItem}>
                          <Text style={styles.challengeEmoji}>🎉</Text>
                          <Text style={styles.challengeName}>{challengeName}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.doneButton}
                onPress={handleClose}
                activeOpacity={0.8}
              >
                <Text style={styles.doneButtonText}>Awesome!</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Theme.colors.background.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: Theme.colors.background.primary,
    borderRadius: Theme.borderRadius.xl,
    margin: Theme.spacing.xl,
    padding: Theme.spacing.xxxl,
    width: '90%',
    maxHeight: '80%',
    ...Theme.shadows.large,
    borderWidth: 1,
    borderColor: Theme.colors.border.primary,
  },
  header: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xxl,
  },
  emoji: {
    fontSize: 64,
    marginBottom: Theme.spacing.lg,
  },
  title: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  statsContainer: {
    marginBottom: Theme.spacing.xxl,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
    marginBottom: Theme.spacing.xs,
  },
  statLabel: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  caloriesContainer: {
    backgroundColor: Theme.colors.background.secondary,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.medium,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border.primary,
  },
  caloriesText: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.status.error,
  },
  feelingContainer: {
    marginBottom: Theme.spacing.xxl,
  },
  feelingTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.lg,
  },
  feelingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    marginBottom: Theme.spacing.sm,
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
  continueButton: {
    backgroundColor: Theme.colors.accent.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.medium,
    gap: Theme.spacing.sm,
  },
  continueButtonDisabled: {
    backgroundColor: Theme.colors.background.tertiary,
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
  },
  continueButtonTextDisabled: {
    color: Theme.colors.text.muted,
  },
  rewardsContainer: {
    marginBottom: Theme.spacing.xxl,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.border.primary,
  },
  levelUpItem: {
    backgroundColor: Theme.colors.background.secondary,
    borderWidth: 2,
    borderColor: Theme.colors.accent.primary,
  },
  rewardIcon: {
    width: 48,
    height: 48,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Theme.colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.lg,
    ...Theme.shadows.small,
  },
  rewardEmoji: {
    fontSize: 24,
  },
  rewardContent: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    marginBottom: 2,
  },
  rewardValue: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
  },
  levelTitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    marginTop: 2,
  },
  doneButton: {
    backgroundColor: Theme.colors.status.success,
    paddingVertical: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.medium,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
  },
  challengesContainer: {
    marginBottom: Theme.spacing.md,
  },
  challengesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: Theme.spacing.md,
  },
  challengeItem: {
    width: '48%',
    borderRadius: Theme.borderRadius.medium,
    backgroundColor: Theme.colors.background.secondary,
    borderWidth: 1,
    borderColor: Theme.colors.accent.primary,
    padding: Theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
  },
  challengeEmoji: {
    fontSize: 16,
    marginBottom: Theme.spacing.xs,
  },
  challengeName: {
    fontSize: 12,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.accent.primary,
    textAlign: 'center',
  },
}); 