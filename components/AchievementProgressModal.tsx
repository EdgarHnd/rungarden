import Theme from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  default as Reanimated,
  useAnimatedStyle,
  useSharedValue,
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
}

interface AchievementProgressModalProps {
  visible: boolean;
  challenge: Challenge | null;
  onClose: () => void;
}

export default function AchievementProgressModal({
  visible,
  challenge,
  onClose
}: AchievementProgressModalProps) {
  const progressValue = useSharedValue(0);

  React.useEffect(() => {
    if (visible && challenge) {
      progressValue.value = withTiming(
        (challenge.progress / challenge.maxProgress) * 100,
        { duration: 800 }
      );
    } else {
      progressValue.value = withTiming(0, { duration: 300 });
    }
  }, [visible, challenge]);

  const progressAnimatedStyle = useAnimatedStyle(() => {
    return {
      width: `${progressValue.value}%` as const,
    };
  });

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  if (!visible || !challenge) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.stepContent}>
            {/* Close button */}
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={24} color={Theme.colors.text.primary} />
            </TouchableOpacity>

            <View style={styles.centeredGroup}>
              <View style={styles.headerSection}>
                <Text style={styles.headerEmoji}>{challenge.emoji}</Text>
                <Text style={styles.headerTitle}>{challenge.name}</Text>
              </View>

              <View style={styles.contentSection}>
                <View style={styles.centerContent}>
                  {/* Progress indicator */}
                  <View style={styles.progressSection}>
                    <Text style={styles.progressText}>
                      {challenge.progress}/{challenge.maxProgress}
                    </Text>
                    <View style={styles.progressBar}>
                      <Reanimated.View style={[styles.progressFill, progressAnimatedStyle]} />
                    </View>
                  </View>

                  {/* Description */}
                  <Text style={styles.description}>
                    {challenge.isCompleted ?
                      `Great job! You completed this challenge and earned: ${challenge.reward}` :
                      `${challenge.description.replace(/\d+/, challenge.maxProgress.toString())}`
                    }
                  </Text>

                  {/* Progress encouragement */}
                  {!challenge.isCompleted && (
                    <Text style={styles.encouragement}>
                      {challenge.maxProgress - challenge.progress === 1 ?
                        "You're almost there! One more to go!" :
                        `${challenge.maxProgress - challenge.progress} more ${challenge.progressUnit} to go!`
                      }
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Base Layout - Same as RunCelebrationModal
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
    position: 'relative',
  },
  centeredGroup: {
    flex: 1,
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: Theme.spacing.xl,
    right: Theme.spacing.xl,
    zIndex: 10,
    padding: Theme.spacing.sm,
  },

  // Header Section
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

  // Content Section
  contentSection: {
  },
  centerContent: {
    alignItems: 'center',
  },
  progressSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  progressText: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
    marginBottom: Theme.spacing.lg,
  },
  progressBar: {
    width: '100%',
    height: 16,
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: 8,
  },
  description: {
    fontSize: 20,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.lg,
  },
  encouragement: {
    fontSize: 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 24,
  },
}); 