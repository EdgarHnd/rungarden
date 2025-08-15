import Theme from '@/constants/theme';
import { Doc } from '@/convex/_generated/dataModel';
import { useAnalytics } from '@/provider/AnalyticsProvider';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Image, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  interpolate,
  default as Reanimated,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';

interface WeekRewardModalProps {
  visible: boolean;
  weekNumber: number;
  card: Doc<"coachCards"> | null;
  startFlipped?: boolean; // For viewing already claimed rewards
  onClaim?: () => void;
  onClose: () => void;
}

export default function WeekRewardModal({
  visible,
  weekNumber,
  card,
  startFlipped = false,
  onClaim,
  onClose
}: WeekRewardModalProps) {
  const [cardFlipped, setCardFlipped] = useState(false);
  const analytics = useAnalytics();

  // Animation values
  const modalScale = useSharedValue(0);
  const modalOpacity = useSharedValue(0);
  const cardRotateY = useSharedValue(0);
  const cardScale = useSharedValue(0.8);

  useEffect(() => {
    if (visible) {
      // Reset animations
      modalScale.value = 0;
      modalOpacity.value = 0;
      cardRotateY.value = startFlipped ? 1 : 0;
      cardScale.value = 0.8;
      setCardFlipped(startFlipped);

      analytics.track({
        name: 'week_reward_modal_viewed',
        properties: {
          week_number: weekNumber,
          card_id: card?._id,
          start_flipped: startFlipped,
        },
      });

      // Entry animation
      modalScale.value = withSpring(1, {
        damping: 15,
        stiffness: 100,
      });
      modalOpacity.value = withTiming(1, { duration: 300 });

      // Card entrance
      setTimeout(() => {
        cardScale.value = withSpring(1, {
          damping: 12,
          stiffness: 80,
        });
      }, 200);

      // Success haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [visible, startFlipped]);

  const modalAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: modalScale.value }],
      opacity: modalOpacity.value,
    };
  });

  const cardAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: cardScale.value },
        {
          rotateY: `${interpolate(
            cardRotateY.value,
            [0, 0.5, 1],
            [0, 90, 180]
          )}deg`,
        },
      ],
    };
  });

  const cardBackAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: cardScale.value },
        {
          rotateY: `${interpolate(
            cardRotateY.value,
            [0, 0.5, 1],
            [180, 90, 0]
          )}deg`,
        },
      ],
      opacity: interpolate(cardRotateY.value, [0, 0.5, 1], [0, 0, 1]),
    };
  });

  const playSuccessHaptic = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleCardPress = () => {
    if (!cardFlipped && card) {
      // Flip the card to reveal content
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      cardRotateY.value = withTiming(1, {
        duration: 800,
      }, (finished) => {
        if (finished) {
          runOnJS(setCardFlipped)(true);
          runOnJS(playSuccessHaptic)();
        }
      });

      analytics.track({
        name: 'week_reward_card_flipped',
        properties: {
          week_number: weekNumber,
          card_id: card._id,
        },
      });
    }
  };

  const handleClaim = () => {
    if (onClaim) {
      analytics.track({
        name: 'week_reward_claimed',
        properties: {
          week_number: weekNumber,
          card_id: card?._id,
        },
      });
      onClaim();
      // Close modal after claiming
      handleClose();
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    analytics.track({
      name: 'week_reward_modal_closed',
      properties: {
        week_number: weekNumber,
        card_flipped: cardFlipped,
      },
    });

    // Exit animation
    modalScale.value = withTiming(0, { duration: 200 });
    modalOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
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
          <Reanimated.View style={[styles.stepContent, modalAnimatedStyle]}>
            <View style={styles.centeredGroup}>
              {/* Header */}
              <View style={styles.headerSection}>
                <Text style={styles.headerTitle}>
                  {startFlipped ? `Week ${weekNumber} Reward` : `Week ${weekNumber} Complete!`}
                </Text>
                <Text style={styles.subtitle}>
                  {startFlipped ? 'Coaching Tip' : "You've earned a coaching tip!"}
                </Text>
              </View>

              {/* Card */}
              <View style={styles.contentSection}>
                <View style={styles.cardContainer}>
                  {/* Card Front (Face Down) */}
                  <Reanimated.View style={[styles.card, styles.cardFront, cardAnimatedStyle]}>
                    <TouchableOpacity
                      style={styles.cardTouchable}
                      onPress={handleCardPress}
                      disabled={cardFlipped || !card}
                      activeOpacity={0.8}
                    >
                      <View style={styles.cardInstructionContainer}>
                        {!cardFlipped && !card && (
                          <Text style={styles.cardInstructionText}>Loading card...</Text>
                        )}
                        {!cardFlipped && card && (
                          <Text style={styles.cardInstructionText}>Tap to reveal</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  </Reanimated.View>

                  {/* Card Back (Content) */}
                  <Reanimated.View style={[styles.card, styles.cardBack, cardBackAnimatedStyle]}>
                    <View style={styles.cardContent}>
                      <View style={styles.cardIconContainer}>
                        {((card as any)?.iconImageUrl) ? (
                          <Image
                            source={{ uri: (card as any).iconImageUrl }}
                            style={styles.cardImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <Text style={styles.cardEmoji}>{card?.iconEmoji || '✨'}</Text>
                        )}
                        <View style={styles.cardCategory}>
                          <Text style={styles.cardCategoryText}>{card?.category?.toUpperCase() || 'TIP'}</Text>
                        </View>
                      </View>
                      <Text style={styles.cardTitle}>{card?.title || 'Loading...'}</Text>
                      <Text style={styles.cardText}>{card?.content || 'Loading card content...'}</Text>
                    </View>
                  </Reanimated.View>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            {cardFlipped && card && !startFlipped && (
              <TouchableOpacity
                style={[styles.actionButton, styles.claimButton]}
                onPress={handleClaim}
                activeOpacity={0.8}
              >
                <Text style={styles.actionButtonText}>Claim</Text>
              </TouchableOpacity>
            )}

            {cardFlipped && startFlipped && (
              <TouchableOpacity
                style={[styles.actionButton, styles.viewButton]}
                onPress={handleClose}
                activeOpacity={0.8}
              >
                <Text style={styles.actionButtonText}>Got It!</Text>
              </TouchableOpacity>
            )}

            {!cardFlipped && (
              <TouchableOpacity
                style={[styles.actionButton, styles.skipButton]}
                onPress={handleClose}
                activeOpacity={0.8}
              >
                <Text style={[styles.actionButtonText, styles.skipButtonText]}>Close</Text>
              </TouchableOpacity>
            )}
          </Reanimated.View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Base Layout (matching RunCelebrationModal)
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
  image: {
    width: 150,
    height: 150,
    marginBottom: Theme.spacing.lg,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
  },

  // Content Section
  contentSection: {
    marginVertical: Theme.spacing.xl,
  },

  // Card (inspired by the reference image)
  cardContainer: {
    width: 320,
    height: 450,
    alignSelf: 'center',
    position: 'relative',
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backfaceVisibility: 'hidden',
    shadowColor: Theme.colors.special.primary.exp,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  cardFront: {
    borderTopLeftRadius: 20,
    backgroundColor: Theme.colors.background.tertiary,
    borderWidth: 0,
  },
  cardBack: {
    backgroundColor: Theme.colors.text.primary,
    borderWidth: 0,
  },
  cardTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
  },
  cardBackPattern: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Theme.spacing.lg,
  },
  cardPatternRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
  },
  cardPatternEmoji: {
    fontSize: 40,
    opacity: 0.6,
  },
  cardInstructionContainer: {
    alignItems: 'center',
  },
  cardInstructionText: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    textTransform: 'uppercase',
    textShadowColor: Theme.colors.text.muted,
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 4,

  },
  cardContent: {
    flex: 1,
    padding: Theme.spacing.md,
    justifyContent: 'space-between',
  },
  cardIconContainer: {
    borderRadius: 20,
    height: 200,
    backgroundColor: Theme.colors.text.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
    overflow: 'hidden',
  },
  cardEmoji: {
    fontSize: 50,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardTitle: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: Theme.spacing.lg,
    lineHeight: 28,
  },
  cardText: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.xxl
  },
  cardCategory: {
    position: 'absolute',
    width: '50%',
    bottom: 0,
    backgroundColor: Theme.colors.text.primary,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.medium,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  cardCategoryText: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
    letterSpacing: 1,
    textAlign: 'center',
  },

  // Action Button
  actionButton: {
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
    marginHorizontal: Theme.spacing.xl,
  },
  claimButton: {
    backgroundColor: Theme.colors.special.primary.plan,
    borderBottomColor: Theme.colors.special.secondary.plan,
  },
  viewButton: {
    backgroundColor: Theme.colors.accent.primary,
    borderBottomColor: Theme.colors.accent.secondary,
  },
  skipButton: {
    backgroundColor: Theme.colors.background.tertiary,
    borderBottomColor: Theme.colors.background.secondary,
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textTransform: 'uppercase',
  },
  skipButtonText: {
    color: Theme.colors.text.tertiary,
  },
});