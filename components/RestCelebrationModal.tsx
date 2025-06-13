import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from "convex/react";
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  interpolate,
  default as Reanimated,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import StreakModalComponent from './StreakModalComponent';

interface RestCelebrationModalProps {
  visible: boolean;
  onClose: () => void;
  streakInfo?: {
    currentStreak: number;
    longestStreak: number;
  };
}

export default function RestCelebrationModal({
  visible,
  onClose,
  streakInfo
}: RestCelebrationModalProps) {
  const [currentStep, setCurrentStep] = useState<'info' | 'streak' | 'rewards'>('info');
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionResult, setCompletionResult] = useState<any>(null);
  const [hasAttemptedCompletion, setHasAttemptedCompletion] = useState(false);

  // Convex mutation
  const completeRestDay = useMutation(api.userProfile.completeRestDay);

  // Reanimated values
  const stepScale = useSharedValue(0);
  const stepOpacity = useSharedValue(0);
  const rewardScale = useSharedValue(0);
  const xpCounterValue = useSharedValue(0);

  // Live counter state
  const [animatedXPValue, setAnimatedXPValue] = useState(0);

  // XP counter animation
  useAnimatedReaction(
    () => xpCounterValue.value,
    (value) => {
      runOnJS(setAnimatedXPValue)(Math.floor(value));
    },
    []
  );

  // Animated styles
  const stepAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: stepScale.value }],
      opacity: stepOpacity.value
    };
  });

  const rewardAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{
        scale: interpolate(
          rewardScale.value,
          [0, 1],
          [0.5, 1]
        )
      }]
    };
  });

  useEffect(() => {
    if (visible) {
      // Reset all values
      setCurrentStep('info');
      setIsCompleting(false);
      setCompletionResult(null);
      setHasAttemptedCompletion(false);
      stepScale.value = 0;
      stepOpacity.value = 0;
      rewardScale.value = 0;
      xpCounterValue.value = 0;
      setAnimatedXPValue(0);

      // Success haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      animateStepEntrance();
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      animateStepEntrance();
    }
  }, [currentStep]);

  const animateStepEntrance = () => {
    stepScale.value = 0;
    stepOpacity.value = 0;

    stepScale.value = withSpring(1, { damping: 15, stiffness: 100 });
    stepOpacity.value = withTiming(1, { duration: 300 });

    if (currentStep === 'rewards') {
      setTimeout(() => {
        rewardScale.value = withSpring(1, { damping: 12, stiffness: 100 });
        // Animate XP counter
        xpCounterValue.value = withTiming(100, { duration: 1500 });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 300);
    }
  };

  const handleRestCompletion = async () => {
    if (isCompleting) return;

    try {
      setIsCompleting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      const today = new Date().toISOString().split('T')[0];
      const result = await completeRestDay({ date: today });

      if (result.success) {
        setCompletionResult(result);
        setCurrentStep('streak');
      }
    } catch (error: any) {
      console.error('Failed to complete rest day:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // Show error and close modal
      if (error.message?.includes('already completed')) {
        // Already completed, just close
        onClose();
      }
    } finally {
      setIsCompleting(false);
    }
  };

  const handleContinue = async () => {
    if (currentStep === 'info') {
      // Prevent multiple attempts
      if (isCompleting || hasAttemptedCompletion) return;

      setIsCompleting(true);
      setHasAttemptedCompletion(true);

      try {
        const result = await completeRestDay({
          date: new Date().toISOString().split('T')[0]
        });

        if (result.success) {
          setCompletionResult(result);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setCurrentStep('streak');
        } else if (result.alreadyCompleted) {
          // Handle the "already completed" case from backend
          console.log('Rest day already completed, using returned data');
          setCompletionResult(result);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setCurrentStep('streak');
        }
      } catch (error: any) {
        console.log('Rest day completion error:', error);

        // Check if it's the "already completed" error - be more flexible with error message detection
        const errorMessage = error?.message || error?.toString() || '';
        if (errorMessage.includes('already completed') || errorMessage.includes('Rest day already completed')) {
          console.log('Rest day already completed, showing celebration anyway');
          // Show modal anyway with default values to let user see the celebration
          setCompletionResult({
            success: true,
            rewards: {
              xpGained: 100,
              coinsGained: 10
            },
            streak: {
              currentStreak: streakInfo?.currentStreak || 0,
              streakIncreased: false
            }
          });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setCurrentStep('streak');
        } else {
          // Handle other errors
          console.error('Unexpected rest day error:', error);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          handleClose();
        }
      } finally {
        setIsCompleting(false);
      }
    } else if (currentStep === 'streak') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setCurrentStep('rewards');
    } else if (currentStep === 'rewards') {
      handleClose();
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    stepScale.value = withTiming(0, { duration: 200 });
    stepOpacity.value = withTiming(0, { duration: 200 });

    setTimeout(() => {
      onClose();
    }, 200);
  };

  const renderInfoStep = () => (
    <Reanimated.View style={[stepAnimatedStyle, styles.stepContent]}>
      <View style={styles.centeredGroup}>
        <View style={styles.headerSection}>
          <Text style={styles.headerEmoji}>🧘‍♂️</Text>
          <Text style={styles.headerTitle}>Today is Rest Day</Text>
          <Text style={styles.headerSubtitle}>Recovery is part of training</Text>
        </View>

        <View style={styles.contentSection}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Why rest matters:</Text>
            <View style={styles.infoList}>
              <Text style={styles.infoItem}>🔄 Muscle recovery and growth</Text>
              <Text style={styles.infoItem}>🧠 Mental restoration</Text>
              <Text style={styles.infoItem}>💪 Prevents injury and burnout</Text>
              <Text style={styles.infoItem}>⚡ Restores energy for next workout</Text>
            </View>
          </View>

          <View style={styles.restActivities}>
            <Text style={styles.restTitle}>Perfect rest day activities:</Text>
            <Text style={styles.restText}>
              Gentle stretching • Light yoga • Meditation • Reading •
              Quality sleep • Hydration • Healthy nutrition
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.actionButton, (isCompleting || hasAttemptedCompletion) && styles.actionButtonDisabled]}
        onPress={handleContinue}
        disabled={isCompleting || hasAttemptedCompletion}
        activeOpacity={0.8}
      >
        <Text style={[styles.actionButtonText, (isCompleting || hasAttemptedCompletion) && styles.actionButtonTextDisabled]}>
          {isCompleting ? 'COMPLETING REST...' : hasAttemptedCompletion ? 'CONTINUE' : '🧘‍♂️ COMPLETE REST DAY'}
        </Text>
      </TouchableOpacity>
    </Reanimated.View>
  );

  const renderStreakStep = () => (
    <Reanimated.View style={[stepAnimatedStyle, styles.stepContent]}>
      <StreakModalComponent
        currentStreak={completionResult?.streak?.currentStreak || streakInfo?.currentStreak || 0}
        streakIncreased={completionResult?.streak?.streakIncreased}
      />

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: Theme.colors.accent.primary }]}
        onPress={handleContinue}
        activeOpacity={0.8}
      >
        <Text style={styles.actionButtonText}>VIEW REWARDS</Text>
      </TouchableOpacity>
    </Reanimated.View>
  );

  const renderRewardsStep = () => (
    <Reanimated.View style={[stepAnimatedStyle, styles.stepContent]}>
      <View style={styles.centeredGroup}>
        <View style={styles.headerSection}>
          <Text style={styles.rewardsTitle}>Rest Rewards</Text>
        </View>

        <View style={styles.contentSection}>
          <Reanimated.View style={[styles.rewardsGrid, rewardAnimatedStyle]}>
            <View style={styles.rewardCard}>
              <Ionicons name="flash" size={24} color={Theme.colors.special.primary.exp} />
              <Text style={[styles.rewardValue, styles.rewardExpValue]}>+{animatedXPValue}</Text>
              <Text style={styles.rewardLabel}>XP</Text>
            </View>
            <View style={styles.rewardCard}>
              <Reanimated.Image
                source={require('@/assets/images/icons/eucaleaf.png')}
                style={styles.leafIcon}
              />
              <Text style={[styles.rewardValue, styles.rewardLeavesValue]}>+10</Text>
              <Text style={styles.rewardLabel}>Leaves</Text>
            </View>
          </Reanimated.View>

          <Text style={styles.rewardsMessage}>
            Taking care of your body earns rewards too!
            Come back tomorrow to continue your streak! 💪
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: Theme.colors.special.primary.coin, borderBottomColor: Theme.colors.special.secondary.coin }]}
        onPress={handleClose}
        activeOpacity={0.8}
      >
        <Text style={styles.actionButtonText}>CONTINUE</Text>
      </TouchableOpacity>
    </Reanimated.View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'info':
        return renderInfoStep();
      case 'streak':
        return renderStreakStep();
      case 'rewards':
        return renderRewardsStep();
      default:
        return renderInfoStep();
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
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
    marginBottom: Theme.spacing.xl,
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
    marginBottom: Theme.spacing.sm,
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },

  // Content Section
  contentSection: {
    marginBottom: Theme.spacing.xl,
  },

  // Info Step
  infoCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    marginBottom: Theme.spacing.lg,
  },
  infoTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.md,
  },
  infoList: {
    gap: Theme.spacing.sm,
  },
  infoItem: {
    fontSize: 15,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.primary,
    lineHeight: 22,
  },
  restActivities: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
  },
  restTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.accent.primary,
    marginBottom: Theme.spacing.sm,
  },
  restText: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.primary,
    lineHeight: 20,
  },

  // Rewards Section
  rewardsTitle: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },
  rewardsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Theme.spacing.xl,
  },
  rewardCard: {
    alignItems: 'center',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.xxl,
    minWidth: 120,
  },
  rewardEmoji: {
    fontSize: 40,
    marginBottom: Theme.spacing.md,
  },
  leafIcon: {
    width: 40,
    height: 40,
    marginBottom: Theme.spacing.md,
  },
  rewardValue: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    marginBottom: Theme.spacing.xs,
  },
  rewardExpValue: {
    color: Theme.colors.special.primary.exp,
  },
  rewardLeavesValue: {
    color: Theme.colors.special.primary.coin,
  },
  rewardLabel: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  rewardsMessage: {
    fontSize: 16,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Theme.spacing.lg,
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