import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
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

interface Activity {
  type: string;
  title: string;
  description: string;
  duration: string;
  distance?: number;
  emoji: string;
  date?: string;
  workoutSections?: WorkoutSection[];
}

interface WorkoutSection {
  id: number;
  type: 'warmup' | 'run' | 'rest' | 'repeat' | 'cooldown';
  title: string;
  subtitle?: string;
  duration?: string;
  distance?: string;
  pace?: string;
  repeats?: number;
}

export default function TrainingDetailScreen() {
  const params = useLocalSearchParams();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [scaleAnim] = useState(new Animated.Value(0));

  // Get user profile for metric system preference
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const isMetric = (profile?.metricSystem ?? 'metric') === 'metric';

  // Get training profile for workout style preference
  const trainingProfile = useQuery(api.trainingProfile.getTrainingProfile);
  const preferTimeOverDistance = trainingProfile?.preferTimeOverDistance ?? true;

  // Helper function to format distance based on metric system preference
  const formatDistanceForDisplay = (distanceKm: number): string => {
    if (isMetric) {
      return `${distanceKm}km`;
    } else {
      const miles = distanceKm * 0.621371;
      return `${miles.toFixed(1)}mi`;
    }
  };

  useEffect(() => {
    if (params.activity) {
      try {
        const activityData = JSON.parse(params.activity as string);
        console.log('Activity data:', activityData); // Debug log
        console.log('Activity date:', activityData.date); // Debug log
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

  const getSimpleRewards = (activity: Activity) => {
    // Simple reward calculation based on workout type
    const baseDistance = activity.distance ? Math.round(activity.distance / 1000 * 10) / 10 : 0;

    // Rest days get minimal rewards, running days get full rewards
    if (activity.type === 'rest') {
      return {
        distance: 0,
        coins: 1, // Small reward for rest day completion
        xp: 50,   // Small XP for recovery
        progress: 'Recovery',
      };
    }

    const coins = Math.max(1, Math.floor(baseDistance * 10));  // 10 coins per km
    const xp = Math.max(5, Math.floor(baseDistance * 1000));   // 1000 XP per km

    return {
      distance: baseDistance,
      coins: coins,
      xp: xp,
      progress: 'Fitness',
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

  const formatWorkoutDate = (dateStr?: string) => {
    console.log('Formatting date:', dateStr); // Debug log

    if (!dateStr) {
      console.log('No date provided, using today'); // Debug log
      return new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }).toUpperCase();
    }

    try {
      const date = new Date(dateStr);
      console.log('Parsed date:', date); // Debug log

      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.log('Invalid date, using today'); // Debug log
        return new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }).toUpperCase();
      }

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }).toUpperCase();
    } catch (error) {
      console.log('Error parsing date:', error); // Debug log
      return new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }).toUpperCase();
    }
  };

  const isComplexWorkout = (activity: Activity) => {
    return activity.workoutSections && activity.workoutSections.length > 0;
  };

  const getSectionIcon = (type: string) => {
    switch (type) {
      case 'warmup':
        return 'flame-outline';
      case 'run':
        return 'fitness-outline';
      case 'rest':
        return 'pause-outline';
      case 'repeat':
        return 'repeat-outline';
      case 'cooldown':
        return 'snow-outline';
      default:
        return 'ellipse-outline';
    }
  };

  const getSectionColor = (type: string) => {
    switch (type) {
      case 'warmup':
        return '#FF9500';
      case 'run':
        return '#007AFF';
      case 'rest':
        return '#8E8E93';
      case 'repeat':
        return '#FF3B30';
      case 'cooldown':
        return '#30D158';
      default:
        return Theme.colors.text.tertiary;
    }
  };

  const renderWorkoutBreakdown = () => {
    if (!activity) return null;

    return (
      <View style={styles.workoutBreakdownSection}>
        <View style={styles.descriptionHeader}>
          <View style={styles.descriptionHeaderLeft}>
            <Ionicons name="clipboard-outline" size={24} color={Theme.colors.text.primary} />
            <Text style={styles.descriptionHeaderText}>Description</Text>
          </View>
          {/* <View style={styles.workoutTypeButtons}>
            <View style={[styles.workoutTypeButton, styles.workoutTypeButtonActive]}>
              <Text style={styles.workoutTypeButtonText}>OUTDOOR</Text>
            </View>
            <View style={styles.workoutTypeButton}>
              <Text style={[styles.workoutTypeButtonText, styles.workoutTypeButtonInactive]}>TREADMILL</Text>
            </View>
          </View> */}
        </View>

        {/* If complex workout, show all sections */}
        {isComplexWorkout(activity) ? (
          activity.workoutSections!.map((section, index) => (
            <View key={section.id} style={styles.workoutSectionContainer}>
              {section.type === 'repeat' && (
                <View style={styles.repeatBanner}>
                  <Ionicons name="repeat-outline" size={20} color="#fff" />
                  <Text style={styles.repeatText}>Repeat x{section.repeats || 4}</Text>
                </View>
              )}

              {section.type !== 'repeat' && (
                <View style={styles.workoutSection}>
                  <Text style={styles.sectionNumber}>{index + 1}</Text>
                  <View style={styles.sectionDivider} />
                  <View style={styles.sectionContent}>
                    <Text style={styles.workoutSectionTitle}>{section.title}</Text>
                    {section.subtitle && (
                      <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
                    )}
                  </View>
                  <View style={styles.sectionType}>
                    <Ionicons
                      name={getSectionIcon(section.type) as any}
                      size={20}
                      color={Theme.colors.text.tertiary}
                    />
                    <Text style={styles.sectionTypeText}>
                      {section.type.toUpperCase()}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ))
        ) : (
          /* If simple activity, show as single workout section */
          <View style={styles.workoutSectionContainer}>
            <View style={styles.workoutSection}>
              <Text style={styles.sectionNumber}>1</Text>
              <View style={styles.sectionDivider} />
              <View style={styles.sectionContent}>
                <Text style={styles.workoutSectionTitle}>
                  {preferTimeOverDistance
                    ? `${activity.duration} at a conversational pace`
                    : (rewards.distance > 0 ? `${formatDistanceForDisplay(rewards.distance)} at a conversational pace` : activity.title)
                  }
                </Text>
                {activity.description && (
                  <Text style={styles.sectionSubtitle}>{activity.description}</Text>
                )}
              </View>
              <View style={styles.sectionType}>
                <Ionicons
                  name="fitness-outline"
                  size={20}
                  color={Theme.colors.text.tertiary}
                />
                <Text style={styles.sectionTypeText}>RUN</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    );
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
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerDate}>
            {activity.date ?
              formatWorkoutDate(activity.date) :
              formatWorkoutDate()
            }
          </Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <Animated.View style={[styles.heroSection, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.workoutTypeContainer}>
            <Text style={styles.workoutType}>{activity.title.toUpperCase()}</Text>
            <Text style={styles.workoutSubtitle}>
              {workoutInfo.subtitle}
              {preferTimeOverDistance
                ? (activity.duration && ` • ${activity.duration}`)
                : (rewards.distance > 0 && ` • ${formatDistanceForDisplay(rewards.distance)}`)
              }
            </Text>
          </View>
        </Animated.View>

        {/* Main Training Info */}
        <View style={styles.mainInfoSection}>
          <Text style={styles.sectionTitle}>Training Details</Text>
          <View style={styles.mainInfoGrid}>
            {/* Show either duration OR distance based on user preference */}
            {preferTimeOverDistance ? (
              <View style={styles.mainInfoCard}>
                <View style={[styles.mainInfoIcon, { backgroundColor: Theme.colors.special.primary.level }]}>
                  <Ionicons name="time-outline" size={28} color="#fff" />
                </View>
                <Text style={styles.mainInfoValue}>{activity.duration}</Text>
                <Text style={styles.mainInfoLabel}>Duration</Text>
              </View>
            ) : (
              rewards.distance > 0 && (
                <View style={styles.mainInfoCard}>
                  <View style={[styles.mainInfoIcon, { backgroundColor: getWorkoutTypeColor(activity.type) }]}>
                    <Ionicons name="location-outline" size={28} color="#fff" />
                  </View>
                  <Text style={styles.mainInfoValue}>{formatDistanceForDisplay(rewards.distance)}</Text>
                  <Text style={styles.mainInfoLabel}>Distance</Text>
                </View>
              )
            )}
          </View>
        </View>

        {/* Workout Description/Breakdown */}
        {renderWorkoutBreakdown()}

        {/* Expected Rewards */}
        <View style={styles.rewardsSection}>
          <Text style={styles.sectionTitle}>Expected Rewards</Text>
          <View style={styles.rewardsGrid}>
            <View style={styles.rewardCard}>
              <Text style={styles.rewardEmoji}>⚡</Text>
              <Text style={styles.rewardExpValue}>+{rewards.xp}</Text>
              <Text style={styles.rewardLabel}>XP</Text>
            </View>
            <View style={styles.rewardCard}>
              <Text style={styles.rewardEmoji}>🍃</Text>
              <Text style={styles.rewardLeavesValue}>+{rewards.coins}</Text>
              <Text style={styles.rewardLabel}>Leaves</Text>
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

        {/* Start Workout Button */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.startButton}
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
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerDate: {
    fontSize: 16,
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
  workoutTypeContainer: {
    alignItems: 'center',
  },
  workoutType: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    letterSpacing: 1,
    marginBottom: Theme.spacing.sm,
    textAlign: 'center',
  },
  workoutSubtitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  mainInfoSection: {
    paddingHorizontal: Theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.xl,
  },
  mainInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Theme.spacing.xl,
  },
  mainInfoCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    minWidth: 120,
    flex: 1,
    marginHorizontal: Theme.spacing.sm,
  },
  mainInfoIcon: {
    width: 56,
    height: 56,
    borderRadius: Theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.md,
  },
  mainInfoValue: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.xs,
  },
  mainInfoLabel: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
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
    textAlign: 'center',
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
    padding: Theme.spacing.lg,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  rewardEmoji: {
    fontSize: 32,
    marginBottom: Theme.spacing.md,
  },
  rewardExpValue: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.special.primary.exp,
    marginBottom: Theme.spacing.xs,
  },
  rewardLeavesValue: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.special.primary.coin,
    marginBottom: Theme.spacing.xs,
  },
  rewardLabel: {
    fontSize: 12,
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
  actionSection: {
    paddingHorizontal: Theme.spacing.xl,
    paddingBottom: 100,
  },
  startButton: {
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.lg,
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: Theme.colors.accent.secondary,
  },
  startButtonText: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background.primary,
    letterSpacing: 1,
  },
  loading: {
    fontSize: 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    marginTop: 100,
  },

  workoutBreakdownSection: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl,
  },
  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.xl,
  },
  descriptionHeaderText: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  descriptionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  workoutTypeButtons: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.large,
    padding: 2,
  },
  workoutTypeButton: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.medium,
    minWidth: 80,
    alignItems: 'center',
  },
  workoutTypeButtonActive: {
    backgroundColor: Theme.colors.background.primary,
  },
  workoutTypeButtonText: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  workoutTypeButtonInactive: {
    color: Theme.colors.text.tertiary,
  },
  workoutSectionContainer: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
  },
  repeatBanner: {
    backgroundColor: '#FF6B35',
    borderRadius: Theme.borderRadius.large,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatText: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: '#fff',
    marginLeft: Theme.spacing.sm,
  },
  workoutSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
  },
  sectionNumber: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    width: 40,
    textAlign: 'center',
  },
  sectionDivider: {
    width: 2,
    backgroundColor: Theme.colors.text.tertiary,
    height: 50,
    marginHorizontal: Theme.spacing.lg,
  },
  sectionContent: {
    flex: 1,
  },
  workoutSectionTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    lineHeight: 18,
  },
  sectionType: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  sectionTypeText: {
    fontSize: 10,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.tertiary,
    marginTop: 4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
}); 