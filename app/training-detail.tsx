import Theme from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Rive from 'rive-react-native';

interface Activity {
  type: 'run' | 'rest';
  title: string;
  description: string;
  duration: string;
  intensity: 'Easy' | 'Medium' | 'Hard';
  emoji: string;
}

export default function TrainingDetailScreen() {
  const params = useLocalSearchParams();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [scaleAnim] = useState(new Animated.Value(0));
  const [riveUrl] = useState("https://deafening-mule-576.convex.cloud/api/storage/fcdc254a-5fb8-421b-b22e-85af6b3f765a");

  useEffect(() => {
    if (params.activity) {
      try {
        const activityData = JSON.parse(params.activity as string);
        setActivity(activityData);

        // Entrance animation
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }).start();
      } catch (error) {
        console.error('Error parsing training data:', error);
        router.back();
      }
    }
  }, [params.activity]);

  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case 'Easy': return Theme.colors.status.success;
      case 'Medium': return Theme.colors.special.coin;
      case 'Hard': return Theme.colors.status.error;
      default: return Theme.colors.text.muted;
    }
  };

  const getIntensityInfo = (intensity: string) => {
    switch (intensity) {
      case 'Easy': return { level: 'EASY', emoji: '🌿', subtitle: 'Gentle & Relaxed' };
      case 'Medium': return { level: 'MODERATE', emoji: '⚡', subtitle: 'Balanced Training' };
      case 'Hard': return { level: 'CHALLENGING', emoji: '🔥', subtitle: 'Push Your Limits' };
      default: return { level: 'CUSTOM', emoji: '⭐', subtitle: 'Personalized' };
    }
  };

  const getWorkoutDescription = (activity: Activity) => {
    switch (activity.type) {
      case 'run':
        switch (activity.intensity) {
          case 'Easy':
            return 'A gentle run focused on building your endurance foundation. Perfect for recovery and steady progress without stress.';
          case 'Medium':
            return 'A balanced training session that will challenge you while maintaining good form and building strength progressively.';
          case 'Hard':
            return 'An intense workout designed to push your limits and build mental resilience. Take it step by step!';
          default:
            return 'A personalized workout tailored to your current fitness level and training goals.';
        }
      case 'rest':
        return 'A restorative session focused on recovery and flexibility. This will help your body repair and prepare for future workouts.';
      default:
        return 'A specialized training session designed to help you reach your running goals safely and effectively.';
    }
  };

  const getExpectedRewards = (activity: Activity) => {
    const baseXP = activity.type === 'run' ? 100 : 50;
    const intensityMultiplier = activity.intensity === 'Hard' ? 2 : activity.intensity === 'Medium' ? 1.5 : 1;
    const xp = Math.round(baseXP * intensityMultiplier);
    const coins = Math.round(xp / 10);

    return {
      xp,
      coins,
      endurance: activity.type === 'run' ? '+5' : '+2',
      recovery: activity.type === 'rest' ? '+10' : '+3',
      strength: activity.intensity === 'Hard' ? '+8' : activity.intensity === 'Medium' ? '+5' : '+2',
    };
  };

  const getHelpfulTips = (activity: Activity) => {
    switch (activity.type) {
      case 'run':
        return [
          { icon: '🔥', tip: 'Start with a 5-10 minute warm-up to prepare your muscles', category: 'Warm-up' },
          { icon: '💧', tip: 'Stay hydrated before, during, and after your run', category: 'Hydration' },
          { icon: '👂', tip: 'Listen to your body and adjust your pace as needed', category: 'Pacing' },
          { icon: '🧘', tip: 'Finish with gentle stretching to aid recovery', category: 'Cool-down' },
        ];
      case 'rest':
        return [
          { icon: '🌬️', tip: 'Focus on deep, slow breathing to relax your muscles', category: 'Breathing' },
          { icon: '⏰', tip: 'Hold each stretch for 20-30 seconds for best results', category: 'Technique' },
          { icon: '🎯', tip: 'Stretch to the point of tension, not pain', category: 'Safety' },
          { icon: '😌', tip: 'Take your time and enjoy this moment of self-care', category: 'Mindset' },
        ];
      default:
        return [];
    }
  };

  const getDifficultyLevel = (intensity: string) => {
    switch (intensity) {
      case 'Easy': return 2;
      case 'Medium': return 5;
      case 'Hard': return 8;
      default: return 1;
    }
  };

  if (!activity) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading workout...</Text>
      </View>
    );
  }

  const intensityInfo = getIntensityInfo(activity.intensity);
  const expectedRewards = getExpectedRewards(activity);
  const helpfulTips = getHelpfulTips(activity);
  const difficultyLevel = getDifficultyLevel(activity.intensity);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.back();
        }} style={styles.backButton}>
          <Ionicons name="chevron-back-outline" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{activity.type.toUpperCase()} WORKOUT</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <Animated.View style={[styles.heroSection, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.workoutTypeContainer}>
            <View style={styles.animationContainer}>
              <Rive
                url={riveUrl}
                style={styles.animation}
                autoplay={true}
              />
            </View>
            <Text style={styles.workoutType}>{activity.title}</Text>
            <View style={[styles.levelBadge, { backgroundColor: getIntensityColor(activity.intensity) }]}>
              <Text style={styles.levelEmoji}>{intensityInfo.emoji}</Text>
              <Text style={styles.levelText}>{intensityInfo.level}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Workout Details */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Workout Details</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: Theme.colors.special.level }]}>
                <Ionicons name="time-outline" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{activity.duration}</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: getIntensityColor(activity.intensity) }]}>
                <Ionicons name="flash-outline" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{activity.intensity}</Text>
              <Text style={styles.statLabel}>Intensity</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: Theme.colors.accent.primary }]}>
                <Ionicons name="analytics-outline" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{difficultyLevel}/10</Text>
              <Text style={styles.statLabel}>Challenge</Text>
            </View>
          </View>
        </View>

        {/* Workout Description */}
        <View style={styles.descriptionSection}>
          <Text style={styles.sectionTitle}>About This Workout</Text>
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionText}>{getWorkoutDescription(activity)}</Text>
            <View style={styles.originalDescription}>
              <Text style={styles.originalDescriptionLabel}>Training Focus:</Text>
              <Text style={styles.originalDescriptionText}>{activity.description}</Text>
            </View>
          </View>
        </View>

        {/* Expected Progress */}
        <View style={styles.rewardsSection}>
          <Text style={styles.sectionTitle}>Expected Progress</Text>
          <View style={styles.rewardsGrid}>
            <View style={styles.rewardCard}>
              <Text style={styles.rewardEmoji}>⭐</Text>
              <Text style={styles.rewardValue}>+{expectedRewards.xp}</Text>
              <Text style={styles.rewardLabel}>XP Points</Text>
            </View>
            <View style={styles.rewardCard}>
              <Text style={styles.rewardEmoji}>🪙</Text>
              <Text style={styles.rewardValue}>+{expectedRewards.coins}</Text>
              <Text style={styles.rewardLabel}>Coins</Text>
            </View>
            <View style={styles.rewardCard}>
              <Text style={styles.rewardEmoji}>💪</Text>
              <Text style={styles.rewardValue}>{expectedRewards.endurance}</Text>
              <Text style={styles.rewardLabel}>Endurance</Text>
            </View>
            <View style={styles.rewardCard}>
              <Text style={styles.rewardEmoji}>❤️</Text>
              <Text style={styles.rewardValue}>{expectedRewards.recovery}</Text>
              <Text style={styles.rewardLabel}>Recovery</Text>
            </View>
          </View>
        </View>

        {/* Training Impact */}
        <View style={styles.impactSection}>
          <Text style={styles.sectionTitle}>Training Impact</Text>
          <View style={styles.impactCard}>
            <View style={styles.impactHeader}>
              <Text style={styles.impactTitle}>Fitness Benefits</Text>
              <Text style={styles.impactScore}>{expectedRewards.xp} XP</Text>
            </View>

            <View style={styles.impactIndicators}>
              <View style={styles.indicator}>
                <Text style={styles.indicatorLabel}>Endurance</Text>
                <View style={styles.indicatorBar}>
                  <View style={[
                    styles.indicatorFill,
                    {
                      width: `${Math.min(100, (difficultyLevel * 10))}%`,
                      backgroundColor: Theme.colors.status.success
                    }
                  ]} />
                </View>
                <Text style={styles.indicatorValue}>{expectedRewards.endurance}</Text>
              </View>

              <View style={styles.indicator}>
                <Text style={styles.indicatorLabel}>Strength</Text>
                <View style={styles.indicatorBar}>
                  <View style={[
                    styles.indicatorFill,
                    {
                      width: `${Math.min(100, (difficultyLevel * 10))}%`,
                      backgroundColor: Theme.colors.status.error
                    }
                  ]} />
                </View>
                <Text style={styles.indicatorValue}>{expectedRewards.strength}</Text>
              </View>

              <View style={styles.indicator}>
                <Text style={styles.indicatorLabel}>Recovery</Text>
                <View style={styles.indicatorBar}>
                  <View style={[
                    styles.indicatorFill,
                    {
                      width: `${Math.min(100, activity.type === 'rest' ? 90 : 30)}%`,
                      backgroundColor: Theme.colors.special.level
                    }
                  ]} />
                </View>
                <Text style={styles.indicatorValue}>{expectedRewards.recovery}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Helpful Tips */}
        <View style={styles.tipsSection}>
          <Text style={styles.sectionTitle}>Helpful Tips</Text>
          {helpfulTips.map((tip, index) => (
            <View key={index} style={styles.tipCard}>
              <View style={styles.tipIcon}>
                <Text style={styles.tipIconText}>{tip.icon}</Text>
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipCategory}>{tip.category}</Text>
                <Text style={styles.tipText}>{tip.tip}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Weekly Progress */}
        <View style={styles.progressSection}>
          <Text style={styles.sectionTitle}>Weekly Progress</Text>
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>This Week's Training</Text>
              <Text style={styles.progressLevel}>Day 4/7</Text>
            </View>
            <Text style={styles.progressDescription}>
              Complete this workout to keep your weekly training streak going!
            </Text>
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: '60%' }]} />
              </View>
              <Text style={styles.progressLabel}>4 of 7 workouts completed</Text>
            </View>

            {/* Upcoming Workouts */}
            <View style={styles.upcomingChain}>
              <Text style={styles.upcomingChainTitle}>Coming Up Next</Text>
              <View style={styles.upcomingChainItems}>
                <View style={styles.upcomingChainItem}>
                  <Text style={styles.upcomingChainEmoji}>🏃‍♂️</Text>
                  <Text style={styles.upcomingChainText}>Tempo Run</Text>
                </View>
                <View style={styles.upcomingChainItem}>
                  <Text style={styles.upcomingChainEmoji}>🧘‍♀️</Text>
                  <Text style={styles.upcomingChainText}>Recovery</Text>
                </View>
                <View style={styles.upcomingChainItem}>
                  <Text style={styles.upcomingChainEmoji}>🏆</Text>
                  <Text style={styles.upcomingChainText}>Long Run</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Start Workout Button */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              // Could navigate to a timer or tracking screen
              router.back();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.startButtonText}>🏃‍♂️ START WORKOUT</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: 60,
    paddingBottom: Theme.spacing.xl,
  },
  backButton: {
    padding: Theme.spacing.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textTransform: 'capitalize',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
    paddingBottom: Theme.spacing.xxxl,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.full,
  },
  levelEmoji: {
    fontSize: 20,
    marginRight: Theme.spacing.sm,
  },
  levelText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  heroTitle: {
    fontSize: 36,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },
  heroSubtitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    marginBottom: Theme.spacing.xl,
  },
  workoutTypeContainer: {
    alignItems: 'center',
  },
  animationContainer: {
    width: 150,
    height: 150,
    marginBottom: Theme.spacing.sm,
  },
  animation: {
    width: '100%',
    height: '100%',
  },
  workoutType: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    letterSpacing: 1,
    marginBottom: Theme.spacing.md,
    textTransform: 'uppercase',
  },
  statsSection: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.xl,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: Theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.md,
  },
  statValue: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  descriptionSection: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl,
  },
  descriptionCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
  },
  descriptionText: {
    fontSize: 16,
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.medium,
    lineHeight: 24,
    marginBottom: Theme.spacing.lg,
  },
  originalDescription: {
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.medium,
    padding: Theme.spacing.md,
  },
  originalDescriptionLabel: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
    marginBottom: Theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  originalDescriptionText: {
    fontSize: 14,
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.regular,
    lineHeight: 20,
  },
  rewardsSection: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl,
  },
  rewardsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rewardCard: {
    flex: 1,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.md,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  rewardEmoji: {
    fontSize: 24,
    marginBottom: Theme.spacing.sm,
  },
  rewardValue: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
    marginBottom: Theme.spacing.xs,
  },
  rewardLabel: {
    fontSize: 10,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  impactSection: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl,
  },
  impactCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
  },
  impactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  impactTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
  },
  impactScore: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
  },
  impactIndicators: {
    gap: Theme.spacing.lg,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  indicatorLabel: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    width: 80,
  },
  indicatorBar: {
    flex: 1,
    height: 8,
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.xs,
  },
  indicatorFill: {
    height: '100%',
    borderRadius: Theme.borderRadius.xs,
  },
  indicatorValue: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    width: 30,
    textAlign: 'right',
  },
  tipsSection: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    alignItems: 'flex-start',
  },
  tipIcon: {
    width: 40,
    height: 40,
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  tipIconText: {
    fontSize: 20,
  },
  tipContent: {
    flex: 1,
  },
  tipCategory: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
    marginBottom: Theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tipText: {
    fontSize: 14,
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.regular,
    lineHeight: 20,
  },
  progressSection: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl,
  },
  progressCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  progressTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
  },
  progressLevel: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
  },
  progressDescription: {
    fontSize: 14,
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.regular,
    lineHeight: 20,
    marginBottom: Theme.spacing.lg,
  },
  progressBarContainer: {
    marginBottom: Theme.spacing.xl,
  },
  progressBar: {
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.small,
    height: 8,
    marginBottom: Theme.spacing.sm,
  },
  progressFill: {
    backgroundColor: Theme.colors.special.level,
    borderRadius: Theme.borderRadius.small,
    height: '100%',
  },
  progressLabel: {
    fontSize: 12,
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.medium,
    textAlign: 'center',
  },
  upcomingChain: {
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border.primary,
    paddingTop: Theme.spacing.lg,
  },
  upcomingChainTitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.md,
  },
  upcomingChainItems: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  upcomingChainItem: {
    alignItems: 'center',
    flex: 1,
  },
  upcomingChainEmoji: {
    fontSize: 24,
    marginBottom: Theme.spacing.xs,
  },
  upcomingChainText: {
    fontSize: 10,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  actionSection: {
    paddingHorizontal: Theme.spacing.xl,
    paddingBottom: 100,
  },
  startButton: {
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.lg,
    alignItems: 'center',
    ...Theme.shadows.medium,
  },
  startButtonText: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    letterSpacing: 1,
  },
  loading: {
    fontSize: 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    marginTop: 100,
  },
}); 