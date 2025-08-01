import XpDisplayComponent from '@/components/modals/XpDisplayComponent';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAnalytics } from '@/provider/AnalyticsProvider';
import { useMutation } from "convex/react";
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Image, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  const [currentStep, setCurrentStep] = useState<'info' | 'rewards'>('info');
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionResult, setCompletionResult] = useState<any>(null);
  const [hasAttemptedCompletion, setHasAttemptedCompletion] = useState(false);
  const analytics = useAnalytics();

  // Convex mutation
  const completeRestDay = useMutation(api.userProfile.completeRestDay);

  // Reanimated values
  const stepScale = useSharedValue(0);
  const stepOpacity = useSharedValue(0);
  const rewardScale = useSharedValue(0);
  const xpCounterValue = useSharedValue(0);
  const progressValue = useSharedValue(0);


  // Live counter state
  const [animatedXPValue, setAnimatedXPValue] = useState(0);
  const [animatedProgress, setAnimatedProgress] = useState(0);

  // XP counter animation
  useAnimatedReaction(
    () => xpCounterValue.value,
    (value) => {
      runOnJS(setAnimatedXPValue)(Math.floor(value));
    },
    []
  );

  // Progress counter animation
  useAnimatedReaction(
    () => progressValue.value,
    (value) => {
      runOnJS(setAnimatedProgress)(value);
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

  const progressAnimatedStyle = useAnimatedStyle(() => {
    return {
      width: `${interpolate(
        progressValue.value,
        [0, 100],
        [0, 100]
      )}%` as const
    };
  });

  useEffect(() => {
    if (visible) {
      analytics.track({ name: 'rest_celebration_viewed' });
      // Reset all values
      setCurrentStep('info');
      setIsCompleting(false);
      setCompletionResult(null);
      setHasAttemptedCompletion(false);
      stepScale.value = 0;
      stepOpacity.value = 0;
      rewardScale.value = 0;
      xpCounterValue.value = 0;
      progressValue.value = 0;
      setAnimatedXPValue(0);
      setAnimatedProgress(0);

      // Initial entrance animation
      animateStepEntrance();

      // Success haptic for modal opening
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      animateStepEntrance();
      if (currentStep === 'rewards') {
        analytics.track({ name: 'rest_celebration_rewards_viewed' });
      }
    }
  }, [visible, currentStep]);

  const animateStepEntrance = () => {
    // Reset step animations
    stepScale.value = 0;
    stepOpacity.value = 0;

    // Entrance animation with bounce
    stepScale.value = withSpring(1, {
      damping: 15,
      stiffness: 100,
    });
    stepOpacity.value = withTiming(1, {
      duration: 300,
    });

    // Step-specific animations
    if (currentStep === 'rewards') {
      setTimeout(() => {
        animateRewardDisplay();
        animateXPCounter();
        animateProgressBar();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 300);
    }
  };

  const animateRewardDisplay = () => {
    rewardScale.value = withSpring(1, {
      damping: 15,
      stiffness: 100,
    });
  };

  const animateXPCounter = () => {
    const targetXP = completionResult?.rewards?.xpGained || 100;

    // Heavy haptic for XP start
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Fast animated counter
    xpCounterValue.value = withTiming(targetXP, {
      duration: 1500,
    });

    // Success haptic when animation finishes
    setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 1500);
  };

  const animateProgressBar = () => {
    // Calculate actual progress based on level progression
    const oldLevel = completionResult?.rewards?.oldLevel || 1;
    const newLevel = completionResult?.rewards?.newLevel || oldLevel;
    const leveledUp = newLevel > oldLevel;

    // If leveled up, show 100% (completed current level)
    // If not leveled up, calculate actual progress within current level
    let progressTarget = 60; // fallback
    if (leveledUp) {
      progressTarget = 100;
    } else {
      // Calculate progress based on rest XP gained
      const restXP = completionResult?.rewards?.xpGained || 100;
      progressTarget = Math.min(80, 20 + (restXP / 10)); // Proportional progress
    }

    progressValue.value = withTiming(progressTarget, {
      duration: 1000,
    });
  };

  const handleContinue = async () => {
    if (currentStep === 'info') {
      analytics.track({ name: 'rest_celebration_complete_clicked' });
      // Prevent multiple attempts
      if (isCompleting || hasAttemptedCompletion) return;

      setIsCompleting(true);
      setHasAttemptedCompletion(true);

      try {
        const result = await completeRestDay({
          date: new Date().toLocaleDateString('en-CA'),
          notes: undefined // Could add note support in the future
        });

        if (result.success) {
          analytics.track({ name: 'rest_day_completed_successfully_from_modal' });
          setCompletionResult(result);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setCurrentStep('rewards');
        } else if (result.alreadyCompleted) {
          analytics.track({ name: 'rest_day_already_completed_from_modal' });
          // Handle the "already completed" case from backend
          console.log('Rest day already completed, using returned data');
          setCompletionResult(result);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setCurrentStep('rewards');
        }
      } catch (error: any) {
        analytics.track({ name: 'rest_day_completion_failed_from_modal', properties: { error: error.message } });
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
          setCurrentStep('rewards');
        } else {
          // Handle other errors
          console.error('Unexpected rest day error:', error);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          handleClose();
        }
      } finally {
        setIsCompleting(false);
      }
    } else if (currentStep === 'rewards') {
      handleClose();
    }
  };

  const cleanupAfterClose = () => {
    onClose();
    // local state resets will happen in useEffect after modal closes
  };

  // Reset local state once the modal is actually closed
  useEffect(() => {
    if (!visible) {
      setCurrentStep('info');
      setIsCompleting(false);
      setCompletionResult(null);
      setHasAttemptedCompletion(false);
    }
  }, [visible]);

  const handleClose = () => {
    analytics.track({ name: 'rest_celebration_closed', properties: { closed_at_step: currentStep } });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Exit animation
    stepScale.value = withTiming(0, {
      duration: 200,
    });

    // Animate opacity and trigger cleanup once the animation has finished
    stepOpacity.value = withTiming(0, {
      duration: 200,
    }, (finished) => {
      if (finished) {
        runOnJS(cleanupAfterClose)();
      }
    });
  };

  const renderInfoStep = () => (
    <Reanimated.View style={[stepAnimatedStyle, styles.stepContent]}>
      <View style={styles.centeredGroup}>
        <View style={styles.headerSection}>
          <Image
            source={require('@/assets/images/blaze/blaze-sleep-icon.png')}
            style={styles.image}
            resizeMode="contain"
          />
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
            <View style={styles.infoList}>
              <Text style={styles.infoItem}>Gentle stretching, light yoga, meditation, or a walk</Text>
            </View>
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
          {isCompleting ? 'COMPLETING REST...' : hasAttemptedCompletion ? 'CONTINUE' : 'COMPLETE REST DAY'}
        </Text>
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
          <XpDisplayComponent
            animatedXPValue={animatedXPValue}
            animatedProgress={animatedProgress}
            currentLevel={completionResult?.rewards?.oldLevel || 1}
            nextLevel={(completionResult?.rewards?.oldLevel || 1) + 1}
            showProgressBar={true}
            badgeAnimatedStyle={rewardAnimatedStyle}
            progressAnimatedStyle={progressAnimatedStyle}
          />

          <Text style={styles.rewardsMessage}>
            Taking care of your body earns rewards too!
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: Theme.colors.special.primary.exp, borderBottomColor: Theme.colors.special.secondary.exp }]}
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
  imageContainer: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  image: {
    width: 150,
    height: 150,
  },
  // Rewards Section
  rewardsTitle: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
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