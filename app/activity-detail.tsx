import StatsBadges from '@/components/StatsBadges';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { RunningActivity } from '@/services/HealthService';
import LevelingService from '@/services/LevelingService';
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

interface PlannedWorkout {
  scheduledDate: string;
  type: string;
  duration?: string;
  distance?: number;
  description: string;
  target?: string;
  status: string;
  workoutId?: string | null;
  isDefault?: boolean;
}

// Helper function to extract simple workout name
const getSimpleWorkoutName = (type: string, description: string): string => {
  // For C25K workouts, extract the week/day info
  if (type === 'run-walk') {
    if (description.includes('Week 1')) return 'C25K Week 1';
    if (description.includes('Week 2')) return 'C25K Week 2';
    if (description.includes('Week 3')) return 'C25K Week 3';
    if (description.includes('Week 4')) return 'C25K Week 4';
    if (description.includes('Week 5')) return 'C25K Week 5';
    if (description.includes('Week 6')) return 'C25K Week 6';
    if (description.includes('Week 7')) return 'C25K Week 7';
    if (description.includes('Week 8')) return 'C25K Week 8';
    if (description.includes('Week 9')) return 'C25K Week 9';
    return 'Run-Walk Training';
  }

  // For other workout types, use a simple display name
  const typeNames: Record<string, string> = {
    'easy': 'Easy Run',
    'tempo': 'Tempo Run',
    'intervals': 'Interval Training',
    'long': 'Long Run',
    'recovery': 'Recovery Run',
    'cross-train': 'Cross Training',
    'rest': 'Rest Day'
  };

  return typeNames[type] || type.charAt(0).toUpperCase() + type.slice(1) + ' Run';
};

// Helper function to parse workout phases from description
interface WorkoutPhase {
  title: string;
  description: string;
  duration?: string;
}

const getWorkoutPhases = (description: string): WorkoutPhase[] => {
  const phases: WorkoutPhase[] = [];

  // Default phases for any workout
  phases.push({
    title: "Warm-up",
    description: "5 minutes of brisk walking to prepare your body",
    duration: "5 min"
  });

  // Parse the main workout from description
  if (description.includes('alternate')) {
    if (description.includes('60 seconds jogging and 90 seconds walking')) {
      phases.push({
        title: "Main Workout",
        description: "Alternate 60 seconds jogging with 90 seconds walking (8 cycles)",
        duration: "20 min"
      });
    } else if (description.includes('90 seconds jogging and 2 minutes walking')) {
      phases.push({
        title: "Main Workout",
        description: "Alternate 90 seconds jogging with 2 minutes walking (6 cycles)",
        duration: "20 min"
      });
    }
  } else if (description.includes('jog for 20 minutes')) {
    phases.push({
      title: "Main Workout",
      description: "Run continuously for 20 minutes without walking",
      duration: "20 min"
    });
  } else if (description.includes('jog for 25 minutes')) {
    phases.push({
      title: "Main Workout",
      description: "Run continuously for 25 minutes",
      duration: "25 min"
    });
  } else if (description.includes('jog for 30 minutes')) {
    phases.push({
      title: "Main Workout",
      description: "Run continuously for 30 minutes - Congratulations!",
      duration: "30 min"
    });
  } else if (description.includes('two repetitions')) {
    phases.push({
      title: "Main Workout",
      description: "Two repetitions: 90s jog, 90s walk, 3min jog, 3min walk",
      duration: "18 min"
    });
  } else {
    // Fallback for other workouts
    phases.push({
      title: "Main Workout",
      description: description.replace(/5min warmup walk, then /, ''),
      duration: "20+ min"
    });
  }

  phases.push({
    title: "Cool-down",
    description: "5 minutes of slow walking and gentle stretching",
    duration: "5 min"
  });

  return phases;
};

export default function ActivityDetailScreen() {
  const params = useLocalSearchParams();
  const [activity, setActivity] = useState<RunningActivity | null>(null);
  const [isPlannedWorkout, setIsPlannedWorkout] = useState(false);
  const [isRestDay, setIsRestDay] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(0));

  // Fetch planned workout if we have an ID
  const plannedWorkout = useQuery(
    api.plannedWorkouts.getById,
    params.plannedWorkoutId ? { id: params.plannedWorkoutId as Id<"plannedWorkouts"> } : "skip"
  );

  useEffect(() => {
    if (params.isPlannedWorkout === 'true') {
      if (params.isRestDay === 'true') {
        // Handle rest day
        setIsRestDay(true);
        setIsPlannedWorkout(true);

        // Entrance animation
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }).start();
      } else if (params.plannedWorkoutId) {
        // Handle actual planned workout - will be fetched by useQuery
        setIsPlannedWorkout(true);
        setIsRestDay(false);

        // Entrance animation
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }).start();
      }
    } else if (params.activity) {
      try {
        const activityData = JSON.parse(params.activity as string);
        setActivity(activityData);
        setIsPlannedWorkout(false);
        setIsRestDay(false);

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
  }, [params.activity, params.plannedWorkoutId, params.isPlannedWorkout, params.isRestDay]);

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

  if (!activity && !plannedWorkout && !isRestDay) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  // For planned workouts, we'll render a different UI instead of transforming to activity
  if (isPlannedWorkout) {
    // Handle rest days with hardcoded data
    if (isRestDay) {
      const restDayWorkout = {
        scheduledDate: params.scheduledDate as string,
        type: 'rest',
        duration: '15-30 min',
        description: 'Take it easy today! Focus on stretching, foam rolling, or gentle mobility work. Your body needs recovery to get stronger.',
        target: 'Active recovery - keep it light and relaxing',
        status: 'scheduled',
        isDefault: true
      };

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
            <Text style={styles.headerTitle}>Rest Day</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Hero Section for Rest Day */}
            <View style={styles.heroSection}>
              <View style={styles.scheduleBadge}>
                <Ionicons name="heart" size={16} color={Theme.colors.accent.primary} />
                <Text style={styles.scheduleText}>REST DAY</Text>
              </View>

              <Text style={styles.heroTitle}>Rest & Recovery</Text>

              <View style={styles.scoreContainer}>
                <Text style={styles.scoreLabel}>SCHEDULED FOR</Text>
                <Text style={styles.scoreValue}>
                  {new Date(restDayWorkout.scheduledDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric'
                  })}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.powerSection}>
              <Text style={styles.sectionTitle}>⚡ Recovery Activities</Text>
              <View style={styles.actionButtonsGrid}>
                <TouchableOpacity style={styles.actionButtonSmall}>
                  <Ionicons name="body" size={20} color={Theme.colors.text.primary} />
                  <Text style={styles.actionButtonText}>Stretch</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButtonSmall}>
                  <Ionicons name="fitness" size={20} color={Theme.colors.text.primary} />
                  <Text style={styles.actionButtonText}>Foam Roll</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButtonSmall}>
                  <Ionicons name="walk" size={20} color={Theme.colors.text.primary} />
                  <Text style={styles.actionButtonText}>Gentle Walk</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButtonSmall}>
                  <Ionicons name="checkmark" size={20} color={Theme.colors.text.primary} />
                  <Text style={styles.actionButtonText}>Complete</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Workout Structure Section */}
            <View style={styles.workoutStructureSection}>
              <Text style={styles.sectionTitle}>🧘‍♀️ Recovery Plan</Text>
              <View style={styles.workoutStructureCard}>
                <View style={styles.workoutOverview}>
                  <Text style={styles.workoutOverviewTitle}>Today's Focus</Text>
                  <Text style={styles.workoutOverviewDescription}>{restDayWorkout.description}</Text>
                </View>

                <View style={styles.workoutOverview}>
                  <Text style={styles.workoutOverviewTitle}>Target</Text>
                  <Text style={styles.workoutOverviewDescription}>{restDayWorkout.target}</Text>
                </View>

                <View style={styles.workoutPhases}>
                  <Text style={styles.phasesSectionTitle}>Recovery Activities</Text>
                  <View style={styles.phaseItem}>
                    <View style={styles.phaseNumber}>
                      <Text style={styles.phaseNumberText}>1</Text>
                    </View>
                    <View style={styles.phaseContent}>
                      <Text style={styles.phaseTitle}>Gentle Stretching</Text>
                      <Text style={styles.phaseDescription}>Focus on major muscle groups: hamstrings, quads, calves, and hip flexors</Text>
                      <Text style={styles.phaseDuration}>⏱️ 10-15 min</Text>
                    </View>
                  </View>
                  <View style={styles.phaseItem}>
                    <View style={styles.phaseNumber}>
                      <Text style={styles.phaseNumberText}>2</Text>
                    </View>
                    <View style={styles.phaseContent}>
                      <Text style={styles.phaseTitle}>Foam Rolling</Text>
                      <Text style={styles.phaseDescription}>Light pressure on IT band, quads, and calves to improve circulation</Text>
                      <Text style={styles.phaseDuration}>⏱️ 5-10 min</Text>
                    </View>
                  </View>
                  <View style={styles.phaseItem}>
                    <View style={styles.phaseNumber}>
                      <Text style={styles.phaseNumberText}>3</Text>
                    </View>
                    <View style={styles.phaseContent}>
                      <Text style={styles.phaseTitle}>Hydration & Reflection</Text>
                      <Text style={styles.phaseDescription}>Drink water and think about your recent training progress</Text>
                      <Text style={styles.phaseDuration}>⏱️ 5 min</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      );
    }

    // Handle actual planned workouts from database
    if (!plannedWorkout) {
      return (
        <View style={styles.container}>
          <Text style={styles.loading}>Loading workout...</Text>
        </View>
      );
    }

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
          <Text style={styles.headerTitle}>Planned Workout</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero Section for Planned Workout */}
          <View style={styles.heroSection}>
            <View style={styles.scheduleBadge}>
              <Ionicons name="calendar" size={16} color={Theme.colors.accent.primary} />
              <Text style={styles.scheduleText}>PLANNED WORKOUT</Text>
            </View>

            <Text style={styles.heroTitle}>
              {getSimpleWorkoutName(plannedWorkout.type, plannedWorkout.description)}
            </Text>

            <View style={styles.scoreContainer}>
              <Text style={styles.scoreLabel}>SCHEDULED FOR</Text>
              <Text style={styles.scoreValue}>
                {new Date(plannedWorkout.scheduledDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric'
                })}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.powerSection}>
            <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
            <View style={styles.actionButtonsGrid}>
              <TouchableOpacity style={styles.actionButtonSmall}>
                <Ionicons name="play" size={20} color={Theme.colors.text.primary} />
                <Text style={styles.actionButtonText}>Start</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButtonSmall}>
                <Ionicons name="close" size={20} color={Theme.colors.text.primary} />
                <Text style={styles.actionButtonText}>Skip</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButtonSmall}>
                <Ionicons name="calendar" size={20} color={Theme.colors.text.primary} />
                <Text style={styles.actionButtonText}>Reschedule</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButtonSmall}>
                <Ionicons name="checkmark" size={20} color={Theme.colors.text.primary} />
                <Text style={styles.actionButtonText}>Complete</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Workout Structure Section */}
          <View style={styles.workoutStructureSection}>
            <Text style={styles.sectionTitle}>📋 Workout Breakdown</Text>
            <View style={styles.workoutStructureCard}>
              <View style={styles.workoutOverview}>
                <Text style={styles.workoutOverviewTitle}>Today's Plan</Text>
                <Text style={styles.workoutOverviewDescription}>{plannedWorkout.description}</Text>
              </View>

              {plannedWorkout.target && (
                <View style={styles.workoutOverview}>
                  <Text style={styles.workoutOverviewTitle}>Target</Text>
                  <Text style={styles.workoutOverviewDescription}>{plannedWorkout.target}</Text>
                </View>
              )}

              <View style={styles.workoutPhases}>
                <Text style={styles.phasesSectionTitle}>Workout Phases</Text>
                {getWorkoutPhases(plannedWorkout.description).map((phase, index) => (
                  <View key={index} style={styles.phaseItem}>
                    <View style={styles.phaseNumber}>
                      <Text style={styles.phaseNumberText}>{index + 1}</Text>
                    </View>
                    <View style={styles.phaseContent}>
                      <Text style={styles.phaseTitle}>{phase.title}</Text>
                      <Text style={styles.phaseDescription}>{phase.description}</Text>
                      {phase.duration && (
                        <Text style={styles.phaseDuration}>⏱️ {phase.duration}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Quick Stats */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>📊 Workout Details</Text>
            <View style={styles.mainStatsContainer}>
              {plannedWorkout.duration && (
                <View style={styles.statCard}>
                  <View style={styles.statIcon}>
                    <Ionicons name="time-outline" size={24} color="#10B981" />
                  </View>
                  <Text style={styles.statValue}>{plannedWorkout.duration}</Text>
                  <Text style={styles.statLabel}>Duration</Text>
                </View>
              )}

              {plannedWorkout.distance && (
                <View style={styles.statCard}>
                  <View style={styles.statIcon}>
                    <Ionicons name="speedometer-outline" size={24} color="#3B82F6" />
                  </View>
                  <Text style={styles.statValue}>{(plannedWorkout.distance / 1000).toFixed(1)} km</Text>
                  <Text style={styles.statLabel}>Distance</Text>
                </View>
              )}

              <View style={styles.statCard}>
                <View style={styles.statIcon}>
                  <Ionicons name="fitness-outline" size={24} color="#F59E0B" />
                </View>
                <Text style={styles.statValue}>{plannedWorkout.type.replace('-', ' ')}</Text>
                <Text style={styles.statLabel}>Type</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Unified activity view logic
  if (!activity) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading activity...</Text>
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
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {formatDetailedDate(activity.startDate)}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <Animated.View style={[styles.heroSection, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.heroTitle}>{`${runRank.rank} Run!`}</Text>

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

        {/* Main Stats - Badge Style */}
        <View style={styles.statsSection}>
          <StatsBadges stats={[
            {
              label: 'Distance',
              value: formatDistance(activity.distance),
              icon: '🏃',
              color: '#FFB800'
            },
            {
              label: 'Duration',
              value: formatDuration(activity.duration),
              icon: '⏱️',
              color: '#10B981'
            },
            {
              label: 'Pace',
              value: formatPace(calculatePace(activity.duration, activity.distance)),
              icon: '⚡',
              color: '#3B82F6'
            },
            ...(activity.calories ? [{
              label: 'Calories',
              value: Math.round(activity.calories).toString(),
              icon: '🔥',
              color: '#EF4444'
            }] : [])
          ]} />
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
              You conquered {formatDistance(activity.distance)}km in {formatDuration(activity.duration)} with an average pace of {formatPace(calculatePace(activity.duration, activity.distance))}/km! {activity.calories ? `Your epic journey burned ${Math.round(activity.calories)} calories and earned you ${coinsEarned} coins!` : ''}
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

  // Planned Workout Styles
  plannedWorkoutHeader: {
    backgroundColor: Theme.colors.background.primary,
  },
  plannedWorkoutHeaderTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
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
}); 