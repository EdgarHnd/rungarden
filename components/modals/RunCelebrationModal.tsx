import StatsBadges from '@/components/StatsBadges';
import StreakModalComponent from '@/components/modals/StreakModalComponent';
import XpDisplayComponent from '@/components/modals/XpDisplayComponent';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';
import { useAnalytics } from '@/provider/AnalyticsProvider';
import LevelingService from '@/services/LevelingService';
import { useMutation } from 'convex/react';
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

interface RunCelebrationModalProps {
  visible: boolean;
  runData: Doc<"activities"> | null;
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
  isInitialSync?: boolean;
}

export type FeelingType = 'amazing' | 'good' | 'okay' | 'tough' | 'struggled' | 'dead';

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
  streakInfo,
  isInitialSync
}: RunCelebrationModalProps) {
  const [currentStep, setCurrentStep] = useState<'stats' | 'xp' | 'streak'>('stats');
  const [selectedFeeling, setSelectedFeeling] = useState<FeelingType | null>(null);
  const analytics = useAnalytics();
  const recordFeeling = useMutation(api.activities.recordActivityFeeling);

  // Reanimated values for all animations
  const stepScale = useSharedValue(0);
  const stepOpacity = useSharedValue(0);
  const xpCounterValue = useSharedValue(0);

  const progressValue = useSharedValue(0);
  const streakScale = useSharedValue(0);

  // Reanimated values for feeling buttons
  const feelingScales: Record<FeelingType, Reanimated.SharedValue<number>> = {
    dead: useSharedValue(0.8),
    tough: useSharedValue(0.8),
    okay: useSharedValue(0.8),
    good: useSharedValue(0.8),
    amazing: useSharedValue(0.8),
    struggled: useSharedValue(0.8),
  };

  // Live counter states
  const [animatedXPValue, setAnimatedXPValue] = useState(0);
  const [animatedProgress, setAnimatedProgress] = useState(0);

  // Fast counter animations with useAnimatedReaction (safer syntax)
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

  const streakAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: streakScale.value }]
    };
  });

  const streakDayAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{
        scale: interpolate(
          stepOpacity.value,
          [0, 1],
          [0.3, 1]
        )
      }]
    };
  });



  useEffect(() => {
    if (visible) {
      // Reset all animations when modal opens
      stepScale.value = 0;
      stepOpacity.value = 0;
      xpCounterValue.value = 0;
      progressValue.value = 0;
      streakScale.value = 0;

      analytics.track({
        name: 'run_celebration_viewed',
        properties: {
          run_id: runData?._id,
          is_initial_sync: isInitialSync,
        },
      });

      // Reset feeling button scales
      Object.values(feelingScales).forEach(scale => {
        scale.value = 0.8;
      });

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
    }
  }, [currentStep]);

  useEffect(() => {
    // Animate feeling buttons when step changes or selection changes
    if (currentStep === 'stats' && visible) {
      feelings.forEach((feeling, index) => {
        setTimeout(() => {
          feelingScales[feeling.type].value = withSpring(1, {
            damping: 15,
            stiffness: 150,
          });
        }, index * 100);
      });
    }
  }, [currentStep, visible]);

  useEffect(() => {
    // Handle selection animation
    feelings.forEach(feeling => {
      if (selectedFeeling === feeling.type) {
        feelingScales[feeling.type].value = withSpring(1.1, {
          damping: 10,
          stiffness: 200,
        });
      } else {
        feelingScales[feeling.type].value = withSpring(1, {
          damping: 15,
          stiffness: 150,
        });
      }
    });
  }, [selectedFeeling]);

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
    } else if (currentStep === 'streak') {
      animateStreakDisplay();
    }
  };

  const animateXPCounter = () => {
    const targetXP = LevelingService.distanceToXP(rewards.distanceGained);

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
    // Calculate actual progress based on level progression
    const oldLevel = rewards.oldLevel || 1;
    const newLevel = rewards.newLevel || oldLevel;
    const leveledUp = newLevel > oldLevel;

    // If leveled up, show 100% (completed current level)
    // If not leveled up, show partial progress based on distance gained
    let progressTarget = 60; // fallback
    if (leveledUp) {
      progressTarget = 100;
    } else {
      // Calculate progress based on distance/XP gained for this run
      const xpGained = LevelingService.distanceToXP(rewards.distanceGained);
      // Show proportional progress - more distance = more progress shown
      progressTarget = Math.min(85, 25 + (xpGained / 20));
    }

    progressValue.value = withTiming(progressTarget, {
      duration: 1000,
    });
  };

  const animateStreakDisplay = () => {
    // Bounce in the streak flame
    streakScale.value = withSpring(1, {
      damping: 15,
      stiffness: 80,
    });

    // Heavy haptic for streak emphasis
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Sequential light haptics for each day
    const streakDays = streakInfo?.currentStreak || 0;
    for (let i = 0; i < streakDays; i++) {
      setTimeout(() => {
        Haptics.selectionAsync();
      }, i * 200);
    }
  };



  const handleFeelingSelect = (feeling: FeelingType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedFeeling(feeling);

    analytics.track({
      name: 'run_celebration_feeling_selected',
      properties: {
        feeling: feeling,
        run_id: runData?._id,
      },
    });

    // Extra haptic for special feelings
    if (feeling === 'amazing') {
      setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 100);
    } else if (feeling === 'dead') {
      setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }, 100);
    }
  };

  const handleContinue = async () => {
    analytics.track({
      name: 'run_celebration_continue_clicked',
      properties: {
        current_step: currentStep,
        run_id: runData?._id,
      }
    });
    if (currentStep === 'stats') {
      if (selectedFeeling && runData) {
        try {
          await recordFeeling({
            activityId: runData._id,
            feeling: selectedFeeling,
          });
        } catch (error) {
          console.error('Failed to record feeling:', error);
        }
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setCurrentStep('xp');
    } else if (currentStep === 'xp') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      if (isInitialSync) {
        handleClose(); // Skip streak for initial sync
      } else {
        setCurrentStep('streak');
      }
    } else if (currentStep === 'streak') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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
      setCurrentStep('stats');
      setSelectedFeeling(null);
    }
  }, [visible]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    analytics.track({
      name: 'run_celebration_closed',
      properties: {
        closed_at_step: currentStep,
        run_id: runData?._id,
      }
    });

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
    if (distance >= 5) return '🎉';
    if (distance >= 1) return '🙌';
    return '🏃‍♂️';
  };

  if (!visible || !runData) return null;

  // Animated Feeling Button Component
  const AnimatedFeelingButton = ({ feeling }: { feeling: Feeling }) => {
    const animatedStyle = useAnimatedStyle(() => {
      return {
        transform: [{ scale: feelingScales[feeling.type].value }],
      };
    });

    return (
      <Reanimated.View style={animatedStyle}>
        <TouchableOpacity
          style={[
            styles.feelingButton,
            selectedFeeling === feeling.type && {
              backgroundColor: Theme.colors.background.primary,
              borderColor: feeling.color,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 6,
              elevation: 8,
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
      </Reanimated.View>
    );
  };

  const renderStatsStep = () => (
    <Reanimated.View style={[stepAnimatedStyle, styles.stepContent]}>
      <View style={styles.centeredGroup}>
        <View style={styles.headerSection}>
          <Image source={require('@/assets/images/blaze/blazelove.png')} style={styles.image} resizeMode="contain" />
          <Text style={styles.headerTitle}>Congrats on your run!</Text>
        </View>

        <View style={styles.contentSection}>
          <View style={styles.statsContainer}>
            <StatsBadges stats={[
              {
                label: 'Distance',
                value: formatDistance(runData.distance),
                icon: '🏃',
                color: Theme.colors.text.primary
              },
              {
                label: 'Duration',
                value: formatDuration(runData.duration),
                icon: '⏱️',
                color: Theme.colors.text.primary
              },
              {
                label: 'Pace',
                value: formatPace(runData.duration, runData.distance),
                icon: '⚡',
                color: Theme.colors.text.primary
              },
              {
                label: 'Calories',
                value: Math.round(runData.calories).toString(),
                icon: '🍦',
                color: Theme.colors.text.primary
              }
            ]} />
          </View>
          <View style={styles.feelingSection}>
            <Text style={styles.sectionTitle}>How did you feel?</Text>
            <View style={styles.feelingsGrid}>
              {feelings.map((feeling, index) => (
                <AnimatedFeelingButton key={feeling.type} feeling={feeling} />
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
    </Reanimated.View>
  );

  const renderXpStep = () => (
    <Reanimated.View style={[stepAnimatedStyle, styles.stepContent]}>
      <View style={styles.centeredGroup}>
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>More XP!</Text>
        </View>

        <View style={styles.contentSection}>
          <XpDisplayComponent
            animatedXPValue={animatedXPValue}
            animatedProgress={animatedProgress}
            currentLevel={rewards.oldLevel || 1}
            nextLevel={(rewards.oldLevel || 1) + 1}
            showProgressBar={true}
            badgeAnimatedStyle={xpBadgeAnimatedStyle}
            progressAnimatedStyle={progressAnimatedStyle}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: Theme.colors.special.primary.exp, borderBottomColor: Theme.colors.special.secondary.exp }]}
        onPress={handleContinue}
        activeOpacity={0.8}
      >
        <Text style={styles.actionButtonText}>Claim XP</Text>
      </TouchableOpacity>
    </Reanimated.View>
  );

  const renderStreakStep = () => (
    <Reanimated.View style={[stepAnimatedStyle, styles.stepContent]}>
      <StreakModalComponent
        currentStreak={streakInfo?.currentStreak || 0}
      />

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: Theme.colors.special.primary.streak, borderBottomColor: Theme.colors.special.secondary.streak }]}
        onPress={handleContinue}
        activeOpacity={0.8}
      >
        <Text style={styles.actionButtonText}>I'M COMMITTED</Text>
      </TouchableOpacity>
    </Reanimated.View>
  );



  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'stats':
        return renderStatsStep();
      case 'xp':
        return renderXpStep();
      case 'streak':
        return renderStreakStep();
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
  image: {
    width: 150,
    height: 150,
  },

  // Content Section
  contentSection: {
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.xl,
  },
  statsContainer: {
    marginVertical: Theme.spacing.xxxl,
  },
  // Feelings Section
  feelingSection: {
    marginBottom: Theme.spacing.xl,
  },
  feelingsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 10,
  },
  feelingButton: {
    width: 60,
    height: 75,
    borderRadius: Theme.borderRadius.large,
    borderWidth: 3,
    borderColor: Theme.colors.border.primary,
    backgroundColor: Theme.colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feelingEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  feelingLabel: {
    fontSize: 11,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 13,
  },
  feelingLabelSelected: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.semibold,
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
    textShadowColor: Theme.colors.special.primary.coin + '30',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
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
  rewardSubtitle: {
    fontSize: 18,
    marginTop: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
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