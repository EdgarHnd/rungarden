import PrimaryButton from '@/components/PrimaryButton';
import Theme from '@/constants/theme';
import { useAnalytics } from '@/provider/AnalyticsProvider';
import { formatPlantDistance } from '@/utils/formatters';
import { getImageSource } from '@/utils/plantImageMapping';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Dimensions, Image, Modal, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
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

interface PlantEarned {
  count: number;
  plantType: {
    _id: string;
    name: string;
    emoji: string;
    distanceRequired: number;
    rarity: string;
    category: string;
    imagePath?: string;
  };
}

interface InitialSyncModalProps {
  visible: boolean;
  syncResult: {
    created: number;
    updated: number;
    skipped: number;
    distanceGained: number;
    plantsAwarded?: number;
    plantsEarned?: PlantEarned[];
  } | null;
  onClose: () => Promise<void>;
  onPlantAll: () => Promise<void>;
  metricSystem?: 'metric' | 'imperial';
  source?: 'strava' | 'healthkit';
}

export default function InitialSyncModal({
  visible,
  syncResult,
  onClose,
  onPlantAll,
  metricSystem = 'metric',
  source = 'strava',
}: InitialSyncModalProps) {
  const [currentStep, setCurrentStep] = useState<'sync' | 'plants' | 'details'>('sync');
  const [isPlanting, setIsPlanting] = useState(false);
  const analytics = useAnalytics();

  // Reanimated values for all animations
  const stepScale = useSharedValue(0);
  const stepOpacity = useSharedValue(0);
  const plantCounterValue = useSharedValue(0);
  const plantsListOpacity = useSharedValue(0);

  // Live counter states
  const [animatedPlantCount, setAnimatedPlantCount] = useState(0);
  const [visiblePlantsCount, setVisiblePlantsCount] = useState(0);

  // Animated reactions for counters
  useAnimatedReaction(
    () => plantCounterValue.value,
    (value) => {
      runOnJS(setAnimatedPlantCount)(Math.floor(value));
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

  const plantBadgeAnimatedStyle = useAnimatedStyle(() => {
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

  const plantsListAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: plantsListOpacity.value,
      transform: [{
        translateY: interpolate(
          plantsListOpacity.value,
          [0, 1],
          [20, 0]
        )
      }]
    };
  });

  useEffect(() => {
    if (visible && syncResult) {

      // Reset all animations when modal opens
      stepScale.value = 0;
      stepOpacity.value = 0;
      plantCounterValue.value = 0;
      plantsListOpacity.value = 0;
      setAnimatedPlantCount(0);
      setVisiblePlantsCount(0);

      analytics.track({
        name: 'initial_sync_modal_viewed',
        properties: {
          runs_synced: syncResult.created + syncResult.updated,
          plants_awarded: syncResult.plantsAwarded,
          source
        }
      });

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
    plantsListOpacity.value = 0;

    // Entrance animation with bounce
    stepScale.value = withSpring(1, {
      damping: 15,
      stiffness: 100,
    });
    stepOpacity.value = withTiming(1, {
      duration: 300,
    });

    // Step-specific animations
    if (currentStep === 'plants') {
      animatePlantCounter();
    } else if (currentStep === 'details') {
      animatePlantsList();
    }
  };

  const animatePlantCounter = () => {
    if (!syncResult?.plantsAwarded) return;

    // Heavy haptic for plant counting start
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Fast animated counter
    plantCounterValue.value = withTiming(syncResult.plantsAwarded, {
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

  const animatePlantsList = () => {
    if (!syncResult?.plantsEarned?.length) {
      return;
    }

    // Animate plants list appearing immediately
    plantsListOpacity.value = withTiming(1, {
      duration: 600,
    });

    // Animate plants appearing one by one
    const plants = syncResult.plantsEarned || [];
    plants.forEach((_, index) => {
      setTimeout(() => {
        setVisiblePlantsCount(prev => prev + 1);
        Haptics.selectionAsync();
      }, index * 200);
    });
  };

  const handleContinue = () => {
    const hasRuns = totalRuns > 0;
    const plantsEarned = syncResult?.plantsEarned || [];
    const hasPlants = plantsEarned.length > 0;

    analytics.track({
      name: 'initial_sync_continue_clicked',
      properties: {
        current_step: currentStep,
        source
      },
    });

    if (currentStep === 'sync') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setCurrentStep('plants');
    } else if (currentStep === 'plants') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      // Skip details step if no runs or no detailed plants to show
      if (hasRuns && hasPlants) {
        setCurrentStep('details');
      } else {
        handlePlantAll();
      }
    } else if (currentStep === 'details') {
      handlePlantAll();
    }
  };

  const handlePlantAll = async () => {
    try {
      setIsPlanting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      analytics.track({
        name: 'initial_sync_plant_all_clicked',
        properties: {
          plants_to_plant: syncResult?.plantsAwarded || 0,
          source
        }
      });

      await onPlantAll();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleClose();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsPlanting(false);
    }
  };

  const handleClose = async () => {
    analytics.track({
      name: 'initial_sync_closed',
      properties: {
        closed_at_step: currentStep,
        source
      },
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Close immediately without animations
    await onClose();

    // Reset step after modal is closed
    setTimeout(() => {
      setCurrentStep('sync');
    }, 50);
  };

  const formatDistance = (meters: number) => {
    if (metricSystem === 'imperial') {
      const miles = meters * 0.000621371;
      return `${miles.toFixed(1)} miles`;
    } else {
      const km = meters / 1000;
      return `${km.toFixed(1)} km`;
    }
  };

  const getCurrentYear = () => {
    return new Date().getFullYear();
  };

  if (!visible || !syncResult) return null;

  const totalRuns = syncResult.created + syncResult.updated;
  const plantsAwarded = syncResult.plantsAwarded || 0;

  const renderSyncStep = () => {
    const hasRuns = totalRuns > 0;

    return (
      <Reanimated.View style={[stepAnimatedStyle, styles.stepContent]}>
        <View style={styles.centeredGroup}>
          <View style={styles.headerSection}>
            <Text style={styles.headerEmoji}>{hasRuns ? '🎉' : '🌱'}</Text>
            <Text style={styles.headerTitle}>
              {hasRuns
                ? `Your ${getCurrentYear()} Runs Synced!`
                : 'Ready to Start Running!'
              }
            </Text>
          </View>

          <View style={styles.contentSection}>
            {hasRuns ? (
              <>
                <View style={styles.syncStatsContainer}>
                  <View style={styles.syncStatCard}>
                    <Text style={styles.syncStatNumber}>{totalRuns}</Text>
                    <Text style={styles.syncStatLabel}>runs this year</Text>
                  </View>

                  <View style={styles.syncStatCard}>
                    <Text style={styles.syncStatNumber}>{formatDistance(syncResult.distanceGained)}</Text>
                    <Text style={styles.syncStatLabel}>total distance</Text>
                  </View>
                </View>

                <Text style={styles.syncDescription}>
                  {source === 'strava'
                    ? `We've imported all your ${getCurrentYear()} runs from Strava! Now let's see how many plants you've earned.`
                    : `We've imported all your ${getCurrentYear()} runs from Apple Health! Now let's see how many plants you've earned.`
                  }
                </Text>
              </>
            ) : (
              <Text style={styles.syncDescription}>
                {source === 'strava'
                  ? `Great! We've connected to your Strava account. You don't have any runs from ${getCurrentYear()} yet, but every run you complete will earn you plants for your garden!`
                  : `Perfect! We've connected to Apple Health. You don't have any runs from ${getCurrentYear()} yet, but every run you complete will earn you plants for your garden!`
                }
              </Text>
            )}
          </View>
        </View>

        <PrimaryButton
          title={hasRuns ? "Show My Plants" : "Start My Garden"}
          onPress={handleContinue}
          size="large"
          fullWidth
          textTransform="none"
        />
      </Reanimated.View>
    );
  };

  const renderPlantsStep = () => {
    const plantsEarned = syncResult?.plantsEarned || [];
    const hasPlants = plantsEarned.length > 0;
    const hasRuns = totalRuns > 0;

    return (
      <Reanimated.View style={[stepAnimatedStyle, styles.stepContent]}>
        <View style={styles.centeredGroup}>
          <View style={styles.headerSection}>
            <Text style={styles.headerTitle}>
              {hasRuns ? 'Plants Earned!' : 'Your Garden Awaits!'}
            </Text>
          </View>

          <View style={styles.contentSection}>
            <View style={styles.centerContent}>
              {hasRuns ? (
                <>
                  <Reanimated.View style={[styles.plantBadge, plantBadgeAnimatedStyle]}>
                    <Image
                      source={require('@/assets/images/logo.png')}
                      style={styles.plantImage}
                    />
                    <Text style={styles.plantValue}>{animatedPlantCount}</Text>
                    <Text style={styles.plantLabel}>plants</Text>
                  </Reanimated.View>

                  <Text style={styles.plantDescription}>
                    {hasPlants
                      ? `Amazing! You've unlocked ${plantsEarned.length} different plant type${plantsEarned.length === 1 ? '' : 's'} from your ${getCurrentYear()} runs.`
                      : `Amazing! You've earned ${plantsAwarded} plants from your ${getCurrentYear()} runs.`
                    }
                  </Text>
                </>
              ) : (
                <>
                  <Reanimated.View style={[styles.plantBadge, plantBadgeAnimatedStyle]}>
                    <Image
                      source={require('@/assets/images/logo.png')}
                      style={styles.plantImage}
                    />
                    <Text style={styles.plantValue}>0</Text>
                    <Text style={styles.plantLabel}>plants</Text>
                  </Reanimated.View>

                  <Text style={styles.plantDescription}>
                    Your garden is ready and waiting! Complete your first run to earn your first plant and start growing your beautiful running garden.
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>

        <PrimaryButton
          title={hasRuns ? (hasPlants ? 'See Plant Details' : 'Plant All in Garden') : 'Start Running'}
          onPress={hasRuns ? handleContinue : handleClose}
          size="large"
          fullWidth
          disabled={isPlanting}
          textTransform="none"
        />
      </Reanimated.View>
    );
  };

  const renderDetailsStep = () => {
    const plantsEarned = syncResult?.plantsEarned || [];

    return (
      <Reanimated.View style={[stepAnimatedStyle, styles.stepContent]}>
        <View style={styles.centeredGroup}>
          <View style={styles.headerSection}>
            <Text style={styles.headerTitle}>Plant Details</Text>
          </View>

          <View style={styles.contentSection}>
            <Reanimated.View style={[styles.plantsListContainer, plantsListAnimatedStyle]}>
              <ScrollView
                style={styles.plantsScrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.plantsScrollContent}
              >
                {plantsEarned.slice(0, visiblePlantsCount).map((plantData, index) => {
                  return (
                    <View key={plantData.plantType._id} style={styles.plantItem}>
                      <View style={styles.plantItemContent}>
                        <Image
                          source={getImageSource(plantData.plantType.imagePath, plantData.plantType.distanceRequired)}
                          style={styles.plantItemImage}
                        />
                        <View style={styles.plantItemInfo}>
                          <Text style={styles.plantItemName}>{plantData.plantType.name}</Text>
                          <Text style={styles.plantItemDistance}>
                            {formatPlantDistance(plantData.plantType.distanceRequired, metricSystem)}
                          </Text>
                        </View>
                        <View style={styles.plantItemCount}>
                          <Text style={styles.plantItemCountText}>×{plantData.count}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </Reanimated.View>

            <Text style={styles.plantDescriptionDetails}>
              Let's plant them all in your garden!
            </Text>
          </View>
        </View>

        <PrimaryButton
          title={isPlanting ? 'Planting...' : 'Plant All in Garden'}
          onPress={handleContinue}
          size="large"
          fullWidth
          disabled={isPlanting}
          textTransform="none"
        />
      </Reanimated.View>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'sync':
        return renderSyncStep();
      case 'plants':
        return renderPlantsStep();
      case 'details':
        return renderDetailsStep();
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
  },
  container: {
    flex: 1,
    width: '100%',
  },
  stepContent: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Theme.spacing.xxl,
    paddingBottom: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.xl,
  },
  centeredGroup: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },

  // Header Section
  headerSection: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xxl,
  },
  headerEmoji: {
    fontSize: 64,
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  centerContent: {
    alignItems: 'center',
    width: '100%',
  },

  // Sync Stats Section
  syncStatsContainer: {
    flexDirection: 'column',
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.xxl,
    gap: Theme.spacing.lg,
    width: '100%',
  },
  syncStatCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
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
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Theme.spacing.lg,
    marginTop: Theme.spacing.md,
  },

  // Plant Section
  plantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.lg,
    marginBottom: Theme.spacing.xl,
    backgroundColor: Theme.colors.accent.primary + '15',
    borderRadius: Theme.borderRadius.large,
    borderWidth: 2,
    borderColor: Theme.colors.accent.primary + '30',
  },
  plantImage: {
    width: 48,
    height: 48,
    marginBottom: Theme.spacing.sm,
  },
  plantValue: {
    fontSize: 48,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
    textAlign: 'center',
    textShadowColor: Theme.colors.accent.primary + '30',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  plantLabel: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
    textAlign: 'center',
    marginTop: Theme.spacing.sm,
  },
  plantDescription: {
    fontSize: 16,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
  },
  plantDescriptionDetails: {
    fontSize: 16,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Theme.spacing.md,
    marginTop: Theme.spacing.lg,
  },

  // Plants List Section
  plantsListContainer: {
    width: '100%',
    maxHeight: Dimensions.get('window').height * 0.5,
    marginVertical: Theme.spacing.xl,
  },
  plantsScrollView: {
    // ensure ScrollView doesn't collapse or over-expand in this layout
  },
  plantsScrollContent: {
    paddingBottom: Theme.spacing.sm,
  },
  plantItem: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    marginBottom: Theme.spacing.md,
    borderWidth: 2,
    borderColor: Theme.colors.border.primary,
  },
  plantItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.lg,
  },
  plantItemImage: {
    width: 32,
    height: 32,
    marginRight: Theme.spacing.md,
  },
  plantItemInfo: {
    flex: 1,
  },
  plantItemName: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    marginBottom: 2,
  },
  plantItemDistance: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  plantItemCount: {
    backgroundColor: Theme.colors.accent.primary + '15',
    borderRadius: Theme.borderRadius.small,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderWidth: 1,
    borderColor: Theme.colors.accent.primary + '30',
  },
  plantItemCountText: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
  },

});
