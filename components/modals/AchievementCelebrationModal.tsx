import Theme from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  default as Reanimated,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';

interface Challenge {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: string;
  maxProgress: number;
  progressUnit: string;
  reward: string;
  progress: number;
  isCompleted: boolean;
  unlockedAt?: string;
}

interface AchievementCelebrationModalProps {
  visible: boolean;
  challenge: Challenge | null;
  onClose: () => void;
  onClaimReward: (challengeId: string) => void;
}

export default function AchievementCelebrationModal({
  visible,
  challenge,
  onClose,
  onClaimReward
}: AchievementCelebrationModalProps) {
  const scaleValue = useSharedValue(0);
  const opacityValue = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Celebration haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Entrance animation
      scaleValue.value = withSpring(1, {
        damping: 15,
        stiffness: 100,
      });
      opacityValue.value = withTiming(1, { duration: 300 });
    } else {
      scaleValue.value = withTiming(0, { duration: 200 });
      opacityValue.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scaleValue.value }],
      opacity: opacityValue.value,
    };
  });

  const handleClaimReward = () => {
    if (challenge) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      onClaimReward(challenge.id);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).toUpperCase();
  };

  if (!visible || !challenge) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <Reanimated.View style={[styles.stepContent, animatedStyle]}>
            <View style={styles.centeredGroup}>
              <View style={styles.headerSection}>
                <Text style={styles.headerEmoji}>{challenge.emoji}</Text>
                <Text style={styles.headerTitle}>Achievement Unlocked!</Text>
              </View>

              <View style={styles.contentSection}>
                <View style={styles.centerContent}>
                  {/* Date earned */}
                  <Text style={styles.dateText}>
                    {formatDate(challenge.unlockedAt)}
                  </Text>

                  {/* Success message */}
                  <Text style={styles.congratsText}>
                    You earned {challenge.name} by {challenge.description.toLowerCase()}!
                  </Text>

                  {/* Reward info */}
                  <View style={styles.rewardContainer}>
                    <Text style={styles.rewardText}>
                      🎁 {challenge.reward}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Claim button */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleClaimReward}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>CLAIM REWARD</Text>
            </TouchableOpacity>
          </Reanimated.View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  headerSection: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  headerEmoji: {
    fontSize: 80,
    marginBottom: Theme.spacing.lg,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },
  contentSection: {
  },
  centerContent: {
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.tertiary,
    letterSpacing: 1.5,
    marginBottom: Theme.spacing.xl,
  },
  congratsText: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: Theme.spacing.xxxl,
    paddingHorizontal: Theme.spacing.lg,
  },
  rewardContainer: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    paddingHorizontal: Theme.spacing.xxxl,
    paddingVertical: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl,
    borderWidth: 2,
    borderColor: Theme.colors.border.primary,
  },
  rewardText: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },
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