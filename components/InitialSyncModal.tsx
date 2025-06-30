import Theme from '@/constants/theme';
import LevelingService from '@/services/LevelingService';
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

interface InitialSyncModalProps {
  visible: boolean;
  syncResult: {
    created: number;
    updated: number;
    skipped: number;
    distanceGained: number;
    leveledUp?: boolean;
    newLevel?: number;
    oldLevel?: number;
  } | null;
  onClose: () => void;
  metricSystem?: 'metric' | 'imperial';
}

export default function InitialSyncModal({
  visible,
  syncResult,
  onClose,
  metricSystem = 'metric',
}: InitialSyncModalProps) {
  const [currentStep, setCurrentStep] = useState<'sync' | 'xp' | 'level'>('sync');

  // Reanimated values for all animations
  const stepScale = useSharedValue(0);
  const stepOpacity = useSharedValue(0);
  const xpCounterValue = useSharedValue(0);
  const progressValue = useSharedValue(0);
  const levelIconScale = useSharedValue(0);

  // Live counter states
  const [animatedXPValue, setAnimatedXPValue] = useState(0);
  const [animatedProgress, setAnimatedProgress] = useState(0);

  // Animated reactions for counters
  useAnimatedReaction(
    () => xpCounterValue.value,
    (value) => {
      runOnJS(setAnimatedXPValue)(Math.floor(value));
    },
    []
  );

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

  const xpBadgeAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{
        scale: interpolate(
          stepOpacity.value,
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

  const levelIconAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: levelIconScale.value }]
    };
  });

  useEffect(() => {
    if (visible && syncResult) {
      // Reset all animations when modal opens
      stepScale.value = 0;
      stepOpacity.value = 0;
      xpCounterValue.value = 0;
      progressValue.value = 0;
      levelIconScale.value = 0;

      setAnimatedXPValue(0);
      setAnimatedProgress(0);

      // Reset to first step when modal opens
      setCurrentStep('sync');

      // Initial entrance animation
      animateStepEntrance();

      // Success haptic for modal opening
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [visible, syncResult]);

  useEffect(() => {
    if (visible && syncResult) {
      animateStepEntrance();
    }
  }, [currentStep]);

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
    if (currentStep === 'xp') {
      animateXPCounter();
      animateProgressBar();
    } else if (currentStep === 'level') {
      animateLevelIcon();
    }
  };

  const animateXPCounter = () => {
    if (!syncResult) return;

    const targetXP = LevelingService.distanceToXP(syncResult.distanceGained);

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

    // Add periodic light haptics during counting
    const hapticInterval = setInterval(() => {
      Haptics.selectionAsync();
    }, 150);

    setTimeout(() => {
      clearInterval(hapticInterval);
    }, 1500);
  };

  const animateProgressBar = () => {
    if (!syncResult) return;

    // Calculate actual progress percentage based on user's level progression
    const currentLevel = syncResult.oldLevel || 1;
    const newLevel = syncResult.newLevel || currentLevel;

    // Calculate XP gained from sync
    const xpGained = LevelingService.distanceToXP(syncResult.distanceGained);

    // Get level info for current level to understand progress
    const currentLevelInfo = LevelingService.calculateLevelInfo((currentLevel - 1) * 500); // Rough estimate for current level base XP
    const nextLevelInfo = LevelingService.calculateLevelInfo(currentLevelInfo.xpForNextLevel);

    // Calculate progress percentage
    let progressPercentage = 0;
    if (syncResult.leveledUp && newLevel > currentLevel) {
      // If leveled up, show 100% progress
      progressPercentage = 100;
    } else {
      // Show progress based on XP gained relative to what's needed for next level
      // Use a reasonable percentage based on XP gained
      const xpForNextLevelGap = currentLevelInfo.remainingXPForNextLevel || 500; // Fallback to 500 if no data
      progressPercentage = Math.min(100, (xpGained / xpForNextLevelGap) * 100);

      // Ensure at least 20% progress is shown if they gained any XP
      if (xpGained > 0 && progressPercentage < 20) {
        progressPercentage = 20;
      }
    }

    console.log('[InitialSyncModal] Progress calculation:', {
      currentLevel,
      newLevel,
      xpGained,
      progressPercentage,
      leveledUp: syncResult.leveledUp,
      remainingXPForNextLevel: currentLevelInfo.remainingXPForNextLevel
    });

    progressValue.value = withTiming(progressPercentage, {
      duration: 1000,
    });
  };

  const animateLevelIcon = () => {
    // Icon entrance with bounce
    levelIconScale.value = withSpring(1, {
      damping: 15,
      stiffness: 100,
    });

    // Heavy haptic for level up
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const handleContinue = () => {
    if (currentStep === 'sync') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setCurrentStep('xp');
    } else if (currentStep === 'xp') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      if (syncResult?.leveledUp) {
        setCurrentStep('level');
      } else {
        handleClose();
      }
    } else if (currentStep === 'level') {
      handleClose();
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Exit animation
    stepScale.value = withTiming(0, {
      duration: 200,
    });

    stepOpacity.value = withTiming(0, {
      duration: 200,
    });

    // Use setTimeout for cleanup instead of animation callback
    setTimeout(() => {
      setCurrentStep('sync');
      onClose();
    }, 200);
  };

  const formatDistance = (meters: number) => {
    return LevelingService.formatDistance(meters, metricSystem || 'metric');
  };

  const getCurrentYear = () => {
    return new Date().getFullYear();
  };

  if (!visible || !syncResult) return null;

  const renderSyncStep = () => (
    <Reanimated.View style={[stepAnimatedStyle, styles.stepContent]}>
      <View style={styles.centeredGroup}>
        <View style={styles.headerSection}>
          <Text style={styles.headerEmoji}>🎉</Text>
          <Text style={styles.headerTitle}>Strava Connected!</Text>
        </View>

        <View style={styles.contentSection}>
          <View style={styles.syncStatsContainer}>
            <View style={styles.syncStatCard}>
              <Text style={styles.syncStatNumber}>{(syncResult.created || 0) + (syncResult.updated || 0)}</Text>
              <Text style={styles.syncStatLabel}>total runs synced</Text>
            </View>

            <View style={styles.syncStatCard}>
              <Text style={styles.syncStatNumber}>{formatDistance(syncResult.distanceGained)}</Text>
              <Text style={styles.syncStatLabel}>total distance</Text>
            </View>
          </View>

          <Text style={styles.syncDescription}>
            {syncResult.created > 0
              ? "We've imported all your runs from Strava! Let's see how much XP you've earned!"
              : "We've synced your existing runs with the latest data. Let's see your XP!"
            }
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={handleContinue}
        activeOpacity={0.8}
      >
        <Text style={styles.actionButtonText}>Show My XP</Text>
      </TouchableOpacity>
    </Reanimated.View>
  );

  const renderXpStep = () => (
    <Reanimated.View style={[stepAnimatedStyle, styles.stepContent]}>
      <View style={styles.centeredGroup}>
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>XP Gained!</Text>
        </View>

        <View style={styles.contentSection}>
          <View style={styles.centerContent}>
            <Reanimated.View style={[styles.xpBadge, xpBadgeAnimatedStyle]}>
              <Text style={styles.xpValue}>+{animatedXPValue}</Text>
              <Text style={styles.xpLabel}>XP</Text>
            </Reanimated.View>

            <Text style={styles.xpDescription}>
              You've earned {LevelingService.distanceToXP(syncResult.distanceGained)} XP from your previous runs!
            </Text>

            <View style={styles.progressSection}>
              <Text style={styles.progressLabel}>lvl {Math.max(1, syncResult.oldLevel || 1)}</Text>
              <View style={styles.progressBar}>
                <Reanimated.View style={[styles.progressFill, progressAnimatedStyle]} />
              </View>
              <Text style={styles.progressLabel}>
                lvl {Math.max(syncResult.oldLevel || 1, syncResult.newLevel || syncResult.oldLevel || 1)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: Theme.colors.special.primary.exp, borderBottomColor: Theme.colors.special.secondary.exp }]}
        onPress={handleContinue}
        activeOpacity={0.8}
      >
        <Text style={styles.actionButtonText}>
          {syncResult.leveledUp ? 'Level Up!' : 'Continue'}
        </Text>
      </TouchableOpacity>
    </Reanimated.View>
  );

  const renderLevelStep = () => (
    <Reanimated.View style={[stepAnimatedStyle, styles.stepContent]}>
      <View style={styles.centeredGroup}>
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Level Up!</Text>
        </View>

        <View style={styles.contentSection}>
          <View style={styles.centerContent}>
            <Reanimated.View style={[styles.levelBadge, levelIconAnimatedStyle]}>
              <Text style={styles.levelNumber}>{Math.max(1, syncResult.newLevel || 1)}</Text>
            </Reanimated.View>

            <Text style={styles.levelTitle}>
              {LevelingService.getLevelTitle(Math.max(1, syncResult.newLevel || 1))}
            </Text>

            <Text style={styles.levelDescription}>
              {syncResult.newLevel && syncResult.oldLevel && syncResult.newLevel > syncResult.oldLevel
                ? `You jumped from level ${syncResult.oldLevel} to level ${syncResult.newLevel}!`
                : `You've reached level ${Math.max(1, syncResult.newLevel || 1)}!`
              }
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: Theme.colors.accent.primary }]}
        onPress={handleClose}
        activeOpacity={0.8}
      >
        <Text style={styles.actionButtonText}>Let's Go!</Text>
      </TouchableOpacity>
    </Reanimated.View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'sync':
        return renderSyncStep();
      case 'xp':
        return renderXpStep();
      case 'level':
        return renderLevelStep();
      default:
        return renderSyncStep();
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
  },

  // Content Section
  contentSection: {
  },
  centerContent: {
    alignItems: 'center',
  },

  // Sync Stats Section
  syncStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: Theme.spacing.xxxl,
    gap: Theme.spacing.lg,
  },
  syncStatCard: {
    flex: 1,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border.primary,
  },
  syncStatNumber: {
    fontSize: 32,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
    marginBottom: Theme.spacing.sm,
  },
  syncStatLabel: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  syncDescription: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Theme.spacing.lg,
  },

  // XP Section
  xpBadge: {
    paddingHorizontal: Theme.spacing.xxxl,
    paddingVertical: Theme.spacing.xl,
    marginBottom: Theme.spacing.xl,
    backgroundColor: Theme.colors.special.primary.exp + '20',
    borderRadius: Theme.borderRadius.large,
    borderWidth: 2,
    borderColor: Theme.colors.special.primary.exp + '40',
    alignItems: 'center',
  },
  xpValue: {
    fontSize: 48,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.special.primary.exp,
    textAlign: 'center',
    textShadowColor: Theme.colors.special.primary.exp + '30',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  xpLabel: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.special.primary.exp,
    textAlign: 'center',
    marginTop: Theme.spacing.sm,
  },
  xpDescription: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Theme.spacing.lg,
    marginBottom: Theme.spacing.xxxl,
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

  // Level Section
  levelBadge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Theme.colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.xl,
    borderWidth: 4,
    borderColor: Theme.colors.accent.secondary,
  },
  levelNumber: {
    fontSize: 48,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background.primary,
  },
  levelTitle: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.lg,
  },
  levelDescription: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
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
  actionButtonText: {
    fontSize: 16,
    textTransform: 'uppercase',
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background.primary,
  },
}); 