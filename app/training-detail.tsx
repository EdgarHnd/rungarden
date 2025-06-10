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
  type: string;
  title: string;
  description: string;
  duration: string;
  distance?: number;
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

  const getWorkoutTypeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      'easy': '#4CAF50',          // Green
      'long': '#9C27B0',          // Purple  
      'rest': '#757575',          // Gray
      'race': '#FF5722',          // Deep orange
    };
    return colorMap[type] || colorMap['rest'];
  };

  const getWorkoutTypeInfo = (type: string) => {
    const infoMap: Record<string, { level: string; emoji: string; subtitle: string }> = {
      'easy': { level: 'EASY RUN', emoji: '🏃‍♂️', subtitle: 'Comfortable Pace' },
      'long': { level: 'LONG RUN', emoji: '🏃‍♂️', subtitle: 'Endurance Building' },
      'rest': { level: 'REST DAY', emoji: '😴', subtitle: 'Recovery Time' },
      'race': { level: 'RACE DAY', emoji: '🏆', subtitle: 'Give Your Best' },
    };
    return infoMap[type] || { level: 'WORKOUT', emoji: '⭐', subtitle: 'Training Session' };
  };

  const getWorkoutDescription = (activity: Activity) => {
    switch (activity.type) {
      case 'easy':
        return 'A comfortable run at conversational pace. This builds your aerobic base and helps with recovery between harder sessions.';
      case 'long':
        return 'A longer endurance run to build your stamina. Take it steady and focus on completing the distance rather than speed.';
      case 'rest':
        return 'A complete rest day or light stretching/mobility work. Recovery is just as important as training for your progress.';
      case 'race':
        return 'Race day! Time to put your training to the test. Trust your preparation and enjoy the experience.';
      default:
        return 'A training session designed to help you progress toward your running goals.';
    }
  };

  const getSimpleRewards = (activity: Activity) => {
    // Simple reward calculation based on workout type
    const baseDistance = activity.distance ? Math.round(activity.distance / 1000 * 10) / 10 : 0;
    const coins = Math.max(1, Math.floor(baseDistance));

    return {
      distance: baseDistance,
      coins: coins,
      progress: activity.type === 'rest' ? 'Recovery' : 'Fitness',
    };
  };

  const getHelpfulTips = (activity: Activity) => {
    switch (activity.type) {
      case 'easy':
        return [
          { icon: '💬', tip: 'You should be able to hold a conversation while running', category: 'Pacing' },
          { icon: '🔥', tip: 'Start with a gentle 5-minute warm-up walk', category: 'Warm-up' },
          { icon: '💧', tip: 'Stay hydrated throughout your run', category: 'Hydration' },
        ];
      case 'long':
        return [
          { icon: '🐌', tip: 'Start slower than you think you need to', category: 'Pacing' },
          { icon: '💪', tip: 'Focus on staying strong and steady', category: 'Form' },
          { icon: '🎯', tip: 'The goal is distance, not speed', category: 'Mindset' },
        ];
      case 'rest':
        return [
          { icon: '😴', tip: 'Get plenty of sleep for optimal recovery', category: 'Rest' },
          { icon: '🧘', tip: 'Try gentle stretching or yoga', category: 'Mobility' },
          { icon: '💧', tip: 'Stay hydrated and eat nutritious foods', category: 'Nutrition' },
        ];
      case 'race':
        return [
          { icon: '🎯', tip: 'Trust your training and stick to your plan', category: 'Strategy' },
          { icon: '😊', tip: 'Smile and enjoy the experience', category: 'Mindset' },
          { icon: '⚡', tip: 'Save energy for a strong finish', category: 'Pacing' },
        ];
      default:
        return [];
    }
  };

  if (!activity) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading workout...</Text>
      </View>
    );
  }

  const workoutInfo = getWorkoutTypeInfo(activity.type);
  const rewards = getSimpleRewards(activity);
  const helpfulTips = getHelpfulTips(activity);

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
        <Text style={styles.headerTitle}>{workoutInfo.level}</Text>
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
            <View style={[styles.levelBadge, { backgroundColor: getWorkoutTypeColor(activity.type) }]}>
              <Text style={styles.levelEmoji}>{workoutInfo.emoji}</Text>
              <Text style={styles.levelText}>{workoutInfo.level}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Workout Details */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Workout Details</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: Theme.colors.special.primary.level }]}>
                <Ionicons name="time-outline" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{activity.duration}</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>

            {rewards.distance > 0 && (
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: getWorkoutTypeColor(activity.type) }]}>
                  <Ionicons name="location-outline" size={24} color="#fff" />
                </View>
                <Text style={styles.statValue}>{rewards.distance}km</Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
            )}

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: Theme.colors.accent.primary }]}>
                <Ionicons name="fitness-outline" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{rewards.progress}</Text>
              <Text style={styles.statLabel}>Focus</Text>
            </View>
          </View>
        </View>

        {/* Workout Description */}
        <View style={styles.descriptionSection}>
          <Text style={styles.sectionTitle}>About This Workout</Text>
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionText}>{getWorkoutDescription(activity)}</Text>
            <View style={styles.originalDescription}>
              <Text style={styles.originalDescriptionLabel}>Training Notes:</Text>
              <Text style={styles.originalDescriptionText}>{activity.description}</Text>
            </View>
          </View>
        </View>

        {/* Expected Progress */}
        <View style={styles.rewardsSection}>
          <Text style={styles.sectionTitle}>Progress Tracking</Text>
          <View style={styles.rewardsGrid}>
            {rewards.distance > 0 && (
              <View style={styles.rewardCard}>
                <Text style={styles.rewardEmoji}>📏</Text>
                <Text style={styles.rewardValue}>{rewards.distance}km</Text>
                <Text style={styles.rewardLabel}>Distance</Text>
              </View>
            )}
            <View style={styles.rewardCard}>
              <Text style={styles.rewardEmoji}>🪙</Text>
              <Text style={styles.rewardValue}>+{rewards.coins}</Text>
              <Text style={styles.rewardLabel}>Coins</Text>
            </View>
            <View style={styles.rewardCard}>
              <Text style={styles.rewardEmoji}>💪</Text>
              <Text style={styles.rewardValue}>+1</Text>
              <Text style={styles.rewardLabel}>Workout</Text>
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
              <Text style={styles.progressLevel}>Keep Going!</Text>
            </View>
            <Text style={styles.progressDescription}>
              Every workout brings you closer to your goal. Stay consistent!
            </Text>
          </View>
        </View>

        {/* Start Workout Button */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: getWorkoutTypeColor(activity.type) }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              router.back();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.startButtonText}>
              {activity.type === 'rest' ? '😴 TAKE REST' : '🏃‍♂️ START WORKOUT'}
            </Text>
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
    textAlign: 'center',
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
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    marginHorizontal: 4,
    minWidth: 100,
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