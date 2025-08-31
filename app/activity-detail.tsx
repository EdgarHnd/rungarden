import StatsBadges from '@/components/StatsBadges';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

// Helper function to get image source from path
const getImageSource = (imagePath: string) => {
  // Map image paths to actual require statements
  const imageMap: { [key: string]: any } = {
    'assets/images/plants/01.png': require('../assets/images/plants/01.png'),
    'assets/images/plants/carrot.png': require('../assets/images/plants/carrot.png'),
    'assets/images/plants/sakura.png': require('../assets/images/plants/sakura.png'),
  };

  return imageMap[imagePath] || null;
};

// Helper function to get plant display (image or emoji)
const getPlantDisplay = (plantType: any) => {
  const imagePath = plantType?.imagePath;
  const imageSource = imagePath ? getImageSource(imagePath) : null;

  if (imageSource) {
    return (
      <Image
        source={imageSource}
        style={styles.plantImage}
        resizeMode="contain"
      />
    );
  } else {
    return (
      <Text style={styles.plantEmoji}>
        {plantType?.emoji || '🌱'}
      </Text>
    );
  }
};

export default function ActivityDetailScreen() {
  const params = useLocalSearchParams();
  const [activity, setActivity] = useState<any | null>(null);
  const deleteActivity = useMutation(api.activities.deleteActivity);
  const [linkedPlannedWorkout, setLinkedPlannedWorkout] = useState<any | null>(null);
  const scaleAnim = useSharedValue(0);

  // Animated style for entrance animation
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scaleAnim.value }],
    };
  });

  // Get user profile for metric system preference
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const isMetric = (profile?.metricSystem ?? 'metric') === 'metric';

  // Helper functions for workout display
  const getWorkoutEmoji = (type: string): string => {
    const emojiMap: Record<string, string> = {
      'easy': '🏃‍♂️',
      'tempo': '🔥',
      'interval': '⚡',
      'intervals': '⚡',
      'long': '🏃‍♂️',
      'recovery': '🧘‍♀️',
      'cross-train': '🚴‍♂️',
      'strength': '💪',
      'rest': '😴',
      'race': '🏆',
      'run': '🏃‍♂️'
    };
    return emojiMap[type] || '🏃‍♂️';
  };

  const getWorkoutDisplayName = (type: string): string => {
    const displayNames: Record<string, string> = {
      'easy': 'Easy Run',
      'tempo': 'Tempo Run',
      'interval': 'Interval Training',
      'intervals': 'Interval Training',
      'long': 'Long Run',
      'recovery': 'Recovery Run',
      'cross-train': 'Cross Training',
      'strength': 'Strength Training',
      'rest': 'Rest Day',
      'race': 'Race Day',
      'run': 'Run'
    };
    return displayNames[type] || type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ');
  };

  // TODO: Re-enable achievements when achievements.ts is uncommented
  // const achievementsForActivity = useQuery(
  //   api.achievements.getAchievementsForActivityByUuid,
  //   activity ? {
  //     healthKitUuid: activity.uuid,
  //     isMetric: isMetric,
  //   } : "skip"
  // );

  // Placeholder for achievements - replace with actual query when achievements are enabled
  const achievementsForActivity: Array<{
    id: string;
    name: string;
    emoji: string;
    reward: string;
  }> = [];

  const activityFromId = useQuery(api.activities.getActivityById, params.id ? { activityId: params.id as any } : "skip");

  // Get plant associated with the activity
  const plantEarned = useQuery(api.plants.getPlantByActivityId, activity?._id ? { activityId: activity._id } : "skip");

  useEffect(() => {
    if (activityFromId) {
      setActivity(activityFromId as any);
    }
    if (params.activity) {
      try {
        const activityData = JSON.parse(params.activity as string);
        setActivity(activityData);
        setLinkedPlannedWorkout(activityData.plannedWorkout || null);

        // Entrance animation
        scaleAnim.value = withSpring(1, {
          damping: 15,
          stiffness: 150,
        });
      } catch (error) {
        console.error('Error parsing activity data:', error);
        router.back();
      }
    }
  }, [params.activity, activityFromId]);

  const formatDistance = (meters: number) => {
    if (isMetric) {
      const kilometers = meters / 1000;
      return `${kilometers.toFixed(2)}`;
    } else {
      const miles = (meters / 1000) * 0.621371;
      return `${miles.toFixed(2)}`;
    }
  };

  const getDistanceUnit = () => {
    return isMetric ? 'km' : 'mi';
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}min`;
  };

  const formatDetailedDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculatePace = (duration: number, distance: number) => {
    const paceMinPerKm = (duration / (distance / 1000));
    return paceMinPerKm;
  };

  const formatPace = (pace: number) => {
    let adjustedPace = pace;
    let unit = '/km';

    if (!isMetric) {
      // Convert pace from min/km to min/mile
      // Since 1 mile = 1.609344 km, pace per mile should be pace per km divided by 1.609344
      adjustedPace = pace / 1.609344;
      unit = '/mi';
    }

    const minutes = Math.floor(adjustedPace);
    const seconds = Math.round((adjustedPace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}${unit}`;
  };

  const getRunScore = () => {
    if (!activity) return 0;
    const distance = activity.distance / 1000;
    const pace = calculatePace(activity.duration, activity.distance);

    // Score based on distance and pace
    let score = Math.round(distance * 100);
    if (pace < 6) score += 50; // Speed bonus
    if (distance >= 5) score += 100; // Distance bonus
    if (distance >= 10) score += 200; // Long distance bonus

    return score;
  };

  const getRunRank = () => {
    const score = getRunScore();
    if (score >= 1000) return { rank: 'LEGENDARY', color: '#FFD700', emoji: '👑' };
    if (score >= 700) return { rank: 'EPIC', color: '#9945FF', emoji: '⚡' };
    if (score >= 500) return { rank: 'AWESOME', color: '#3B82F6', emoji: '🔥' };
    if (score >= 300) return { rank: 'GREAT', color: '#10B981', emoji: '⭐' };
    return { rank: 'GOOD', color: '#F59E0B', emoji: '👍' };
  };

  if (!activity) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading activity...</Text>
      </View>
    );
  }

  const runRank = getRunRank();
  const achievements = achievementsForActivity || [];

  const handleDelete = () => {
    if (!activity?._id) return;
    Alert.alert('Delete Run', 'Are you sure you want to delete this activity?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteActivity({ activityId: activity._id });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete activity');
          }
        }
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.back();
        }} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Theme.colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {new Date(activity.startDate).toLocaleDateString('en-US', { weekday: 'long' })}
          </Text>
          <Text style={styles.headerSubtitle}>
            {new Date(activity.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {new Date(activity.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </Text>
        </View>
        <TouchableOpacity onPress={handleDelete} style={styles.backButton}>
          <Ionicons name="trash" size={24} color={Theme.colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        {/* <Animated.View style={[styles.heroSection, { transform: [{ scale: scaleAnim }] }]}>
          <Image source={require('@/assets/images/blaze/blazelove.png')} style={styles.heroImage} resizeMode="contain" />
          <Text style={styles.heroTitle}>{`${runRank.rank} Run!`}</Text>
        </Animated.View> */}



        {/* Plant Earned Section */}
        {plantEarned && (
          <View style={styles.plantSection}>
            <View style={styles.plantCard}>
              {/* Plant Visual */}
              <View style={styles.plantVisualContainer}>
                {getPlantDisplay(plantEarned.plantType)}
              </View>

              {/* New Plant Badge */}
              <View style={styles.newPlantBadge}>
                <Text style={styles.newPlantBadgeText}>New Plant Unlocked!</Text>
              </View>
            </View>
          </View>
        )}

        {/* Main Stats - Badge Style */}
        <View style={styles.statsSection}>
          <StatsBadges stats={[
            {
              label: 'Distance',
              value: `${formatDistance(activity.distance)} ${getDistanceUnit()}`,
              icon: '🛣️',
              color: Theme.colors.text.primary
            },
            {
              label: 'Duration',
              value: formatDuration(activity.duration),
              icon: '🕒',
              color: Theme.colors.text.primary
            },
            {
              label: 'Pace',
              value: formatPace(calculatePace(activity.duration, activity.distance)),
              icon: '⚡️',
              color: Theme.colors.text.primary
            },
            ...(activity.calories ? [{
              label: 'Calories',
              value: Math.round(activity.calories).toString(),
              icon: '🍦',
              color: Theme.colors.text.primary
            }] : [])
          ]} />
        </View>

        {/* Rewards Section */}
        {/* <View style={styles.rewardsSection}>
          <Text style={styles.sectionTitle}>🎁 Rewards Earned</Text>
          <View style={styles.rewardsGrid}>
            <View style={styles.rewardCard}>
              <Ionicons name="flash" size={24} style={styles.rewardEmoji} color={Theme.colors.special.primary.exp} />
              <Text style={[styles.rewardValue, { color: Theme.colors.special.primary.exp }]}>+{activity.xpEarned || 500}</Text>
              <Text style={styles.rewardLabel}>Activity XP</Text>
            </View>
            <View style={styles.rewardCard}>
              <Image
                source={require('@/assets/images/icons/coal.png')}
                style={styles.rewardImage}
              />
              <Text style={[styles.rewardValue, { color: Theme.colors.special.primary.coin }]}>+{Math.floor(activity.distance / 100)}</Text>
              <Text style={styles.rewardLabel}>Embers</Text>
            </View>
          </View>
        </View> */}

        {/* Achievements Section - Now using real data */}
        {achievements.length > 0 && (
          <View style={styles.achievementsSection}>
            <Text style={styles.sectionTitle}>🏆 Achievements Unlocked</Text>
            <View style={styles.achievementsGrid}>
              {achievements.map((achievement, index) => (
                <View key={achievement.id} style={[styles.achievementCard, { borderColor: Theme.colors.accent.primary }]}>
                  <Text style={styles.achievementEmoji}>{achievement.emoji}</Text>
                  <Text style={styles.achievementName}>{achievement.name}</Text>
                  <Text style={styles.achievementReward}>{achievement.reward}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Planned Workout Info Section */}
        {linkedPlannedWorkout && (
          <View style={styles.plannedWorkoutSection}>
            <Text style={styles.sectionTitle}>📋 Training Plan Completed</Text>
            <TouchableOpacity style={styles.plannedWorkoutCard} onPress={() => {
              // TODO: Add training detail navigation when route is available
              console.log('Navigate to training detail:', linkedPlannedWorkout._id);
            }}>
              <View style={styles.plannedWorkoutHeader}>
                <Text style={styles.plannedWorkoutType}>
                  {getWorkoutEmoji(linkedPlannedWorkout.workout?.type || linkedPlannedWorkout.type)}
                  {' '}{getWorkoutDisplayName(linkedPlannedWorkout.workout?.type || linkedPlannedWorkout.type)}
                </Text>
                <View style={styles.completedBadge}>
                  <Text style={styles.completedBadgeText}>COMPLETED</Text>
                </View>
              </View>
              {linkedPlannedWorkout.workout?.description && (
                <Text style={styles.plannedWorkoutDescription}>
                  {linkedPlannedWorkout.workout.description}
                </Text>
              )}
              <Text style={styles.plannedWorkoutDate}>
                Scheduled: {new Date(linkedPlannedWorkout.scheduledDate).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
  headerTitleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.tertiary,
    marginTop: 2,
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
  heroImage: {
    width: 150,
    height: 150,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.full,
    marginBottom: Theme.spacing.lg,
  },
  rankEmoji: {
    fontSize: 20,
    marginRight: Theme.spacing.sm,
  },
  rankText: {
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
    textTransform: 'capitalize',
  },
  heroSubtitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    marginBottom: Theme.spacing.xxl,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
    letterSpacing: 1,
    marginBottom: Theme.spacing.xs,
  },
  scoreValue: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  rewardsSection: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.xl,
  },
  rewardsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rewardCard: {
    flex: 1,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  rewardEmoji: {
    fontSize: 28,
    marginBottom: Theme.spacing.sm,
  },
  rewardValue: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
    marginBottom: Theme.spacing.sm,
  },
  rewardLabel: {
    fontSize: 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  rewardImage: {
    width: 28,
    height: 28,
    marginBottom: Theme.spacing.sm,
  },
  statsSection: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl,
  },
  mainStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.xl,
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
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.md,
  },
  statValue: {
    fontSize: 24,
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

  powerSection: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl,
  },
  powerCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
  },
  powerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  powerTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
  },
  powerScore: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
  },
  powerDescription: {
    fontSize: 14,
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.regular,
    lineHeight: 20,
    marginBottom: Theme.spacing.xl,
  },
  performanceIndicators: {
    gap: Theme.spacing.md,
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
  technicalSection: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: 100,
  },
  technicalTitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.muted,
    marginBottom: Theme.spacing.sm,
  },
  technicalText: {
    fontSize: 12,
    color: Theme.colors.text.disabled,
    fontFamily: 'Menlo, Monaco, monospace',
  },
  loading: {
    fontSize: 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    marginTop: 100,
  },
  achievementsSection: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  achievementCard: {
    width: '48%',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  achievementEmoji: {
    fontSize: 32,
    marginBottom: Theme.spacing.sm,
  },
  achievementName: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },
  achievementReward: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    marginTop: 4,
  },

  // Planned Workout Styles
  plannedWorkoutSection: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl,
  },
  plannedWorkoutCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
  },
  plannedWorkoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.md,
  },
  plannedWorkoutType: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    flex: 1,
  },
  completedBadge: {
    backgroundColor: Theme.colors.status.success,
    borderRadius: Theme.borderRadius.full,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
  },
  completedBadgeText: {
    fontSize: 10,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background.primary,
    letterSpacing: 1,
  },
  plannedWorkoutDescription: {
    fontSize: 14,
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.regular,
    lineHeight: 20,
    marginBottom: Theme.spacing.md,
  },
  plannedWorkoutDate: {
    fontSize: 12,
    color: Theme.colors.text.muted,
    fontFamily: Theme.fonts.medium,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  headerActionButton: {
    padding: Theme.spacing.sm,
  },
  plannedWorkoutHero: {
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.xl,
    alignItems: 'center',
  },
  scheduleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    marginBottom: Theme.spacing.lg,
  },
  scheduleText: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
    letterSpacing: 1,
  },
  workoutTitle: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },
  workoutSubtitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    marginBottom: Theme.spacing.lg,
  },
  workoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  metaText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  actionButtonsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.xl,
  },
  actionButtonLarge: {
    flex: 1,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    marginHorizontal: 4,
    minHeight: 80,
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginTop: Theme.spacing.xs,
  },
  actionButtonSubtext: {
    fontSize: 10,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    marginTop: 2,
  },
  descriptionSection: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: 100,
  },
  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.lg,
  },
  descriptionTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  surfaceToggle: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.full,
    padding: 4,
    marginBottom: Theme.spacing.xl,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
    borderRadius: Theme.borderRadius.full,
  },
  toggleButtonActive: {
    backgroundColor: Theme.colors.text.primary,
  },
  toggleButtonText: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.tertiary,
  },
  toggleButtonActiveText: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background.primary,
  },
  workoutStructure: {
    gap: Theme.spacing.lg,
    marginBottom: Theme.spacing.xl,
  },
  workoutPhase: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.lg,
  },
  phaseLabel: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.tertiary,
    marginBottom: Theme.spacing.md,
    textTransform: 'uppercase',
  },
  phaseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.background.tertiary,
  },
  phaseNumber: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    width: 32,
    textAlign: 'center',
  },
  phaseContent: {
    flex: 1,
  },
  phaseNumberText: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  phaseTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 2,
  },
  phaseDescription: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  phaseDuration: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },

  // New workout structure styles
  workoutStructureSection: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl,
  },
  workoutStructureCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
  },
  workoutOverview: {
    marginBottom: Theme.spacing.xl,
  },
  workoutOverviewTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.sm,
  },
  workoutOverviewDescription: {
    fontSize: 14,
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.regular,
    lineHeight: 20,
  },
  workoutPhases: {
    marginBottom: Theme.spacing.xl,
  },
  phasesSectionTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.lg,
  },
  actionButtonsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
  },
  actionButtonSmall: {
    flex: 1,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.md,
    alignItems: 'center',
    minHeight: 60,
    justifyContent: 'center',
  },

  // Plant Section Styles
  plantSection: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl,
  },
  plantCard: {
    // backgroundColor: '#F5F5F5',
    //borderRadius: 20,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    // borderWidth: 3,
    // borderColor: '#000000',
  },
  plantTimeText: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#666666',
    textAlign: 'center',
    marginBottom: 16,
  },
  plantVisualContainer: {
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  plantEmoji: {
    fontSize: 120,
  },
  plantImage: {
    width: 120,
    height: 120,
  },
  newPlantBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 32,
  },
  newPlantBadgeText: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#000000',
    textAlign: 'center',
  },

}); 