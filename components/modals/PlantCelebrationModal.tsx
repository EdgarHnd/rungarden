import StatsBadges from '@/components/StatsBadges';
import Theme from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';

interface PlantCelebrationModalProps {
  visible: boolean;
  runData: {
    distance: number;
    duration: number;
    calories: number;
    startDate: string;
  } | null;
  plantData: {
    emoji: string;
    name: string;
  } | null;
  onClose: () => void;
  metricSystem?: 'metric' | 'imperial';
  streakInfo?: {
    currentStreak: number;
    longestStreak: number;
  };
}

export default function PlantCelebrationModal({
  visible,
  runData,
  plantData,
  onClose,
  metricSystem = 'metric',
  streakInfo
}: PlantCelebrationModalProps) {
  const [currentStep, setCurrentStep] = useState<'plant-stats' | 'streak'>('plant-stats');

  // Reanimated values for animations
  const stepScale = useSharedValue(0);
  const stepOpacity = useSharedValue(0);
  const plantScale = useSharedValue(0);
  const streakScale = useSharedValue(0);

  // Animated styles
  const stepAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: stepScale.value }],
      opacity: stepOpacity.value
    };
  });

  const plantAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: plantScale.value }],
    };
  });

  const streakAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: streakScale.value }]
    };
  });

  useEffect(() => {
    if (visible) {
      // Reset all animations when modal opens
      stepScale.value = 0;
      stepOpacity.value = 0;
      plantScale.value = 0;
      streakScale.value = 0;

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
    if (currentStep === 'plant-stats') {
      animatePlantReveal();
    } else if (currentStep === 'streak') {
      animateStreakDisplay();
    }
  };

  const animatePlantReveal = () => {
    // Bounce in the plant with delay
    setTimeout(() => {
      plantScale.value = withSpring(1, {
        damping: 15,
        stiffness: 80,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 200);
  };

  const animateStreakDisplay = () => {
    // Bounce in the streak display
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

  const handleContinue = () => {
    if (currentStep === 'plant-stats') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      if (streakInfo && streakInfo.currentStreak > 0) {
        setCurrentStep('streak');
      } else {
        handleClose();
      }
    } else if (currentStep === 'streak') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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

    // Close after animation
    setTimeout(() => {
      onClose();
      setCurrentStep('plant-stats');
    }, 200);
  };

  const formatDistance = (meters: number) => {
    if (metricSystem === 'metric') {
      const kilometers = meters / 1000;
      return `${kilometers.toFixed(2)} km`;
    } else {
      const miles = (meters / 1000) * 0.621371;
      return `${miles.toFixed(2)} mi`;
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatPace = (duration: number, distance: number) => {
    if (distance === 0) return '--:--';
    const paceMinPerKm = (duration / (distance / 1000));
    let adjustedPace = paceMinPerKm;
    let unit = '/km';

    if (metricSystem !== 'metric') {
      adjustedPace = paceMinPerKm / 1.609344;
      unit = '/mi';
    }

    const minutes = Math.floor(adjustedPace);
    const seconds = Math.round((adjustedPace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}${unit}`;
  };

  if (!visible || !runData || !plantData) return null;

  const renderPlantStatsStep = () => (
    <Animated.View style={[stepAnimatedStyle, styles.stepContent]}>
      <View style={styles.centeredGroup}>
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>
            {new Date(runData.startDate).toLocaleDateString('en-US', { weekday: 'long' })}
          </Text>
          <Text style={styles.headerSubtitle}>
            {new Date(runData.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {new Date(runData.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </Text>
        </View>

        <View style={styles.plantSection}>
          <Animated.View style={[styles.plantVisualContainer, plantAnimatedStyle]}>
            <Text style={styles.plantEmoji}>{plantData.emoji}</Text>
          </Animated.View>

          <View style={styles.newPlantBadge}>
            <Text style={styles.newPlantBadgeText}>New Plant Unlocked!</Text>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <StatsBadges stats={[
            {
              label: 'Distance',
              value: formatDistance(runData.distance),
              icon: '🛣️',
              color: Theme.colors.text.primary
            },
            {
              label: 'Duration',
              value: formatDuration(runData.duration),
              icon: '🕒',
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
      </View>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={handleContinue}
        activeOpacity={0.8}
      >
        <Text style={styles.actionButtonText}>
          {streakInfo && streakInfo.currentStreak > 0 ? 'CLAIM' : 'CLAIM'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderStreakStep = () => (
    <Animated.View style={[stepAnimatedStyle, styles.stepContent]}>
      <View style={styles.centeredGroup}>
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Your Streak</Text>
        </View>

        <Animated.View style={[styles.streakDisplay, streakAnimatedStyle]}>
          <Text style={styles.streakFlameIcon}>🔥</Text>
          <Text style={styles.streakMainNumber}>{streakInfo?.currentStreak || 0}</Text>
          <Text style={styles.streakMainLabel}>
            {(streakInfo?.currentStreak || 0) === 1 ? 'Day Streak' : 'Days Streak'}
          </Text>

          {streakInfo && streakInfo.currentStreak > streakInfo.longestStreak && (
            <Text style={styles.streakEncouragement}>
              🎉 New personal best streak!
            </Text>
          )}
        </Animated.View>
      </View>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: '#FF6B35' }]}
        onPress={handleContinue}
        activeOpacity={0.8}
      >
        <Text style={styles.actionButtonText}>Keep It Going!</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'plant-stats':
        return renderPlantStatsStep();
      case 'streak':
        return renderStreakStep();
      default:
        return renderPlantStatsStep();
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
    paddingTop: Theme.spacing.lg,
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
    marginBottom: Theme.spacing.lg,
    paddingTop: Theme.spacing.xl,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },

  // Plant Section
  plantSection: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  plantVisualContainer: {
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  plantEmoji: {
    fontSize: 120,
  },
  newPlantBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 0,
  },
  newPlantBadgeText: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#000000',
    textAlign: 'center',
  },

  // Stats Section
  statsContainer: {
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.xl,
  },

  // Streak Section
  streakDisplay: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xxxl,
  },
  streakFlameIcon: {
    fontSize: 80,
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
    marginBottom: Theme.spacing.xl,
  },
  streakEncouragement: {
    fontSize: 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
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
  actionButtonText: {
    fontSize: 16,
    textTransform: 'uppercase',
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background.primary,
  },
});