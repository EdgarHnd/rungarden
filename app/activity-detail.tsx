import Theme from '@/constants/theme';
import { RunningActivity } from '@/services/HealthService';
import LevelingService from '@/services/LevelingService';
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

export default function ActivityDetailScreen() {
  const params = useLocalSearchParams();
  const [activity, setActivity] = useState<RunningActivity | null>(null);
  const [scaleAnim] = useState(new Animated.Value(0));

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
        console.error('Error parsing activity data:', error);
        router.back();
      }
    }
  }, [params.activity]);

  const formatDistance = (meters: number) => {
    const kilometers = meters / 1000;
    return `${kilometers.toFixed(2)}`;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
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
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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

  const getAchievements = () => {
    if (!activity) return [];

    const achievements = [];
    const distance = activity.distance / 1000;
    const pace = calculatePace(activity.duration, activity.distance);
    const runDate = new Date(activity.startDate);

    // Distance achievements
    if (distance >= 21) achievements.push({ name: 'Marathon Hero', emoji: '🏆', color: '#FFD700' });
    else if (distance >= 10) achievements.push({ name: '10K Champion', emoji: '🥇', color: '#FFD700' });
    else if (distance >= 5) achievements.push({ name: '5K Star', emoji: '⭐', color: '#3B82F6' });
    else if (distance >= 1) achievements.push({ name: 'Kilometer Club', emoji: '🎯', color: '#10B981' });

    // Speed achievements
    if (pace < 4) achievements.push({ name: 'Speed Demon', emoji: '⚡', color: '#9945FF' });
    else if (pace < 5) achievements.push({ name: 'Fast Runner', emoji: '💨', color: '#3B82F6' });

    // Time achievements
    if (runDate.getHours() < 7) achievements.push({ name: 'Early Bird', emoji: '🐓', color: '#F59E0B' });
    if (runDate.getHours() >= 20) achievements.push({ name: 'Night Owl', emoji: '🦉', color: '#6B46C1' });

    // Endurance achievements
    if (activity.duration >= 60) achievements.push({ name: 'Endurance Master', emoji: '💪', color: '#EF4444' });

    return achievements;
  };

  if (!activity) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading run...</Text>
      </View>
    );
  }

  const runRank = getRunRank();
  const achievements = getAchievements();
  const xpGained = Math.floor(activity.distance / 100); // 1 XP per 100m
  const coinsEarned = Math.floor(activity.distance / 1000); // 1 coin per km

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
        <Text style={styles.headerTitle}>{formatDetailedDate(activity.startDate)}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <Animated.View style={[styles.heroSection, { transform: [{ scale: scaleAnim }] }]}>
          {/* <View style={[styles.rankBadge, { backgroundColor: runRank.color }]}>
            <Text style={styles.rankEmoji}>{runRank.emoji}</Text>
            <Text style={styles.rankText}>{runRank.rank}</Text>
          </View> */}
          <Text style={styles.heroTitle}>{runRank.rank} Run!</Text>
          {/* <Text style={styles.heroSubtitle}>{formatDetailedDate(activity.startDate)}</Text> */}
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>RUN SCORE</Text>
            <Text style={styles.scoreValue}>{getRunScore().toLocaleString()}</Text>
          </View>
        </Animated.View>

        {/* Rewards Section */}
        <View style={styles.rewardsSection}>
          <Text style={styles.sectionTitle}>🎁 Rewards Earned</Text>
          <View style={styles.rewardsGrid}>
            <View style={styles.rewardCard}>
              <Text style={styles.rewardEmoji}>📏</Text>
              <Text style={styles.rewardValue}>+{LevelingService.formatDistance(activity.distance)}</Text>
              <Text style={styles.rewardLabel}>Distance XP</Text>
            </View>
            <View style={styles.rewardCard}>
              <Text style={styles.rewardEmoji}>🪙</Text>
              <Text style={styles.rewardValue}>+{coinsEarned}</Text>
              <Text style={styles.rewardLabel}>Coins</Text>
            </View>
            <View style={styles.rewardCard}>
              <Text style={styles.rewardEmoji}>🔥</Text>
              <Text style={styles.rewardValue}>{Math.round(activity.calories)}</Text>
              <Text style={styles.rewardLabel}>Calories</Text>
            </View>
          </View>
        </View>

        {/* Main Stats - Game Style */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>📊 Run Stats</Text>
          <View style={styles.mainStatsContainer}>
            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <Ionicons name="speedometer-outline" size={24} color="#3B82F6" />
              </View>
              <Text style={styles.statValue}>{formatDistance(activity.distance)} km</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <Ionicons name="time-outline" size={24} color="#10B981" />
              </View>
              <Text style={styles.statValue}>{formatDuration(activity.duration)}</Text>
              <Text style={styles.statLabel}>Time Adventuring</Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <Ionicons name="flash-outline" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.statValue}>{formatPace(calculatePace(activity.duration, activity.distance))}</Text>
              <Text style={styles.statLabel}>Pace /km</Text>
            </View>

            {activity.averageHeartRate && (
              <View style={styles.statCard}>
                <View style={styles.statIcon}>
                  <Ionicons name="heart-outline" size={24} color="#EF4444" />
                </View>
                <Text style={styles.statValue}>{Math.round(activity.averageHeartRate)}</Text>
                <Text style={styles.statLabel}>Avg Heart Rate</Text>
              </View>
            )}
          </View>
        </View>

        {/* Achievements Section */}
        {achievements.length > 0 && (
          <View style={styles.achievementsSection}>
            <Text style={styles.sectionTitle}>🏆 Achievements Unlocked</Text>
            <View style={styles.achievementsGrid}>
              {achievements.map((achievement, index) => (
                <View key={index} style={[styles.achievementCard, { borderColor: achievement.color }]}>
                  <Text style={styles.achievementEmoji}>{achievement.emoji}</Text>
                  <Text style={styles.achievementName}>{achievement.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Power Level Section */}
        <View style={styles.powerSection}>
          <Text style={styles.sectionTitle}>⚡ Power Analysis</Text>
          <View style={styles.powerCard}>
            <View style={styles.powerHeader}>
              <Text style={styles.powerTitle}>Run Summary</Text>
              <Text style={styles.powerScore}>{getRunScore()} pts</Text>
            </View>
            <Text style={styles.powerDescription}>
              You conquered {formatDistance(activity.distance)}km in {formatDuration(activity.duration)}
              with an average pace of {formatPace(calculatePace(activity.duration, activity.distance))}/km!
              {activity.calories && ` Your epic journey burned ${Math.round(activity.calories)} calories and earned you ${coinsEarned} coins!`}
            </Text>

            {/* Performance Indicators */}
            <View style={styles.performanceIndicators}>
              <View style={styles.indicator}>
                <Text style={styles.indicatorLabel}>Speed</Text>
                <View style={styles.indicatorBar}>
                  <View style={[
                    styles.indicatorFill,
                    {
                      width: `${Math.min(100, (10 - calculatePace(activity.duration, activity.distance)) * 20)}%`,
                      backgroundColor: '#3B82F6'
                    }
                  ]} />
                </View>
              </View>

              <View style={styles.indicator}>
                <Text style={styles.indicatorLabel}>Endurance</Text>
                <View style={styles.indicatorBar}>
                  <View style={[
                    styles.indicatorFill,
                    {
                      width: `${Math.min(100, (activity.distance / 1000) * 10)}%`,
                      backgroundColor: '#10B981'
                    }
                  ]} />
                </View>
              </View>

              <View style={styles.indicator}>
                <Text style={styles.indicatorLabel}>Power</Text>
                <View style={styles.indicatorBar}>
                  <View style={[
                    styles.indicatorFill,
                    {
                      width: `${Math.min(100, activity.calories / 10)}%`,
                      backgroundColor: '#EF4444'
                    }
                  ]} />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Activity ID (for debugging/technical info) */}
        <View style={styles.technicalSection}>
          <Text style={styles.technicalTitle}>Run Log ID</Text>
          <Text style={styles.technicalText}>{activity.uuid}</Text>
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
    fontSize: 48,
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
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  rewardEmoji: {
    fontSize: 24,
    marginBottom: Theme.spacing.sm,
  },
  rewardValue: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
    marginBottom: Theme.spacing.xs,
  },
  rewardLabel: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
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
}); 