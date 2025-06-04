import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import LevelingService, { LevelInfo } from '@/services/LevelingService';
import { useAuthActions } from "@convex-dev/auth/react";
import { FontAwesome5 } from '@expo/vector-icons';
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();

  // Convex queries and mutations
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const weekProgress = useQuery(api.userProfile.getCurrentWeekProgress);
  const updateWeeklyGoal = useMutation(api.userProfile.updateWeeklyGoal);

  const [isLoading, setIsLoading] = useState(true);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [newWeeklyGoal, setNewWeeklyGoal] = useState('');
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [showLevelDetails, setShowLevelDetails] = useState(false);

  // Update loading state and level info when profile data is available
  useEffect(() => {
    if (profile) {
      setIsLoading(false);

      // Calculate level info from profile
      const userLevelInfo = LevelingService.calculateLevelInfo(profile.totalDistance);
      setLevelInfo(userLevelInfo);

      // Set initial goal value for editing
      if (!newWeeklyGoal) {
        setNewWeeklyGoal((profile.weeklyGoal / 1000).toString());
      }
    }
  }, [profile]);

  const handleSaveWeeklyGoal = async () => {
    const goalInMeters = parseFloat(newWeeklyGoal) * 1000; // Convert km to meters

    if (isNaN(goalInMeters) || goalInMeters <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid Goal', 'Please enter a valid weekly goal in kilometers');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      await updateWeeklyGoal({ weeklyGoal: goalInMeters });

      setIsEditingGoal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Weekly goal updated!');
    } catch (error) {
      console.error('Error updating weekly goal:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update weekly goal');
    }
  };

  const formatDistance = (meters: number) => {
    const kilometers = meters / 1000;
    return `${kilometers.toFixed(1)} km`;
  };

  const calculateWeeklyProgress = () => {
    if (!weekProgress) return 0;
    return weekProgress.goalDistance > 0
      ? (weekProgress.actualDistance / weekProgress.goalDistance) * 100
      : 0;
  };

  // Get next 4 levels for progression display
  const getUpcomingLevels = () => {
    if (!levelInfo) return [];

    const levels = [];
    for (let i = 0; i < 6; i++) { // Show more levels when expanded
      const level = levelInfo.level + i;
      const levelRequirements = LevelingService.getLevelRequirements();
      const levelReq = levelRequirements.find(req => req.level === level);

      if (levelReq) {
        const isCurrentLevel = level === levelInfo.level;
        const isCompleted = levelInfo.totalDistance >= levelReq.distance;
        const progress = isCurrentLevel ? levelInfo.progressToNextLevel : (isCompleted ? 1 : 0);

        levels.push({
          level,
          title: levelReq.title,
          emoji: levelReq.emoji,
          distance: levelReq.distance,
          isCurrentLevel,
          isCompleted,
          progress
        });
      }
    }
    return levels;
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/settings');
          }}
          activeOpacity={0.7}
        >
          <FontAwesome5 name="cog" size={20} color={Theme.colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.contentScrollView}>
        {/* Level Progression - Simplified */}
        {levelInfo && (
          <TouchableOpacity
            style={styles.levelSection}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowLevelDetails(!showLevelDetails);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.currentLevelHeader}>
              <View style={styles.currentLevelInfo}>
                <Text style={styles.currentLevelEmoji}>{LevelingService.getLevelEmoji(levelInfo.level)}</Text>
                <View style={styles.currentLevelTextContainer}>
                  <Text style={styles.currentLevelTitle}>{LevelingService.getLevelTitle(levelInfo.level)}</Text>
                  <Text style={styles.currentLevelNumber}>Level {levelInfo.level}</Text>
                  <Text style={styles.currentLevelDistance}>{LevelingService.formatDistance(levelInfo.totalDistance)} total</Text>
                </View>
              </View>
              <View style={styles.nextLevelInfo}>
                <Text style={styles.nextLevelText}>{LevelingService.formatDistance(levelInfo.remainingDistanceForNextLevel)} to next level</Text>
                <Text style={styles.expandHint}>Tap to {showLevelDetails ? 'hide' : 'view'} all levels</Text>
              </View>
            </View>

            {/* Simple Progress Bar */}
            <View style={styles.simpleProgressContainer}>
              <View style={styles.simpleProgressBar}>
                <View
                  style={[
                    styles.simpleProgressFill,
                    { width: `${levelInfo.progressToNextLevel * 100}%` }
                  ]}
                />
              </View>
              <Text style={styles.simpleProgressText}>
                {Math.round(levelInfo.progressToNextLevel * 100)}% to Level {levelInfo.level + 1}
              </Text>
            </View>

            {/* Detailed Level Progression - Expandable */}
            {showLevelDetails && (
              <View style={styles.progressionContainer}>
                <Text style={styles.progressionTitle}>All Levels</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.levelTrackScroll}>
                  <View style={styles.levelTrack}>
                    {getUpcomingLevels().map((levelData, index) => (
                      <View key={levelData.level} style={styles.levelNode}>
                        {/* Level Circle */}
                        <View style={[
                          styles.levelCircle,
                          levelData.isCurrentLevel && styles.levelCircleCurrent,
                          levelData.isCompleted && styles.levelCircleCompleted
                        ]}>
                          <Text style={[
                            styles.levelCircleText,
                            levelData.isCurrentLevel && styles.levelCircleTextCurrent,
                            levelData.isCompleted && styles.levelCircleTextCompleted
                          ]}>
                            {levelData.level}
                          </Text>
                        </View>

                        {/* Progress Fill for Current Level */}
                        {levelData.isCurrentLevel && (
                          <View style={styles.currentLevelProgressContainer}>
                            <View style={styles.currentLevelProgress}>
                              <View style={[
                                styles.currentLevelProgressFill,
                                { width: `${levelData.progress * 100}%` }
                              ]} />
                            </View>
                            <Text style={styles.progressPercentageText}>
                              {Math.round(levelData.progress * 100)}%
                            </Text>
                          </View>
                        )}

                        {/* Level Info */}
                        <View style={styles.levelNodeInfo}>
                          <Text style={styles.levelNodeEmoji}>{levelData.emoji}</Text>
                          <Text style={styles.levelNodeTitle} numberOfLines={2}>{levelData.title}</Text>
                          <Text style={styles.levelNodeDistance}>{LevelingService.formatDistance(levelData.distance)}</Text>
                        </View>

                        {/* Connection Line to Next Level */}
                        {index < getUpcomingLevels().length - 1 && (
                          <View style={[
                            styles.connectionLine,
                            levelData.isCompleted && styles.connectionLineCompleted
                          ]} />
                        )}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* User Statistics */}
        {profile && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Statistics</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{formatDistance(profile.totalDistance)}</Text>
                <Text style={styles.statLabel}>Total Distance</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{profile.totalWorkouts}</Text>
                <Text style={styles.statLabel}>Total Workouts</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{profile.totalCalories}</Text>
                <Text style={styles.statLabel}>Total Calories</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>🪙 {profile.coins ?? 0}</Text>
                <Text style={styles.statLabel}>Coins Earned</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{formatDistance(profile.weeklyGoal)}</Text>
                <Text style={styles.statLabel}>Weekly Goal</Text>
              </View>
            </View>
          </View>
        )}

        {/* Weekly Progress */}
        {weekProgress && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>This Week's Progress</Text>
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                {formatDistance(weekProgress.actualDistance)} / {formatDistance(weekProgress.goalDistance)}
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(calculateWeeklyProgress(), 100)}%` }
                  ]}
                />
              </View>
              <Text style={styles.progressPercentage}>
                {calculateWeeklyProgress().toFixed(0)}% complete
              </Text>
              <Text style={styles.workoutCount}>
                {weekProgress.workoutCount} workouts this week
              </Text>
            </View>
          </View>
        )}

        {/* Weekly Goal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Goal</Text>
          {isEditingGoal ? (
            <View style={styles.editGoalContainer}>
              <TextInput
                style={styles.goalInput}
                value={newWeeklyGoal}
                onChangeText={setNewWeeklyGoal}
                placeholder="Enter goal in km"
                keyboardType="numeric"
                autoFocus
              />
              <View style={styles.goalButtons}>
                <TouchableOpacity
                  style={[styles.goalButton, styles.cancelButton]}
                  onPress={() => {
                    setIsEditingGoal(false);
                    setNewWeeklyGoal(profile ? (profile.weeklyGoal / 1000).toString() : '10');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.goalButton, styles.saveButton]}
                  onPress={handleSaveWeeklyGoal}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.goalDisplayContainer}>
              <Text style={styles.goalValue}>
                {profile ? formatDistance(profile.weeklyGoal) : '10.0 km'}
              </Text>
              <TouchableOpacity
                style={styles.editGoalButton}
                onPress={() => setIsEditingGoal(true)}
              >
                <Text style={styles.editGoalButtonText}>Edit Goal</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Sync Information */}
        {profile?.lastSyncDate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Sync</Text>
            <Text style={styles.syncInfo}>
              Last synced: {new Date(profile.lastSyncDate).toLocaleString()}
            </Text>
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
  contentScrollView: {
    flex: 1,
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: 0, // Content starts right below the header
  },
  header: {
    paddingTop: 60, // Safe area / top spacing
    paddingHorizontal: Theme.spacing.xl,
    backgroundColor: Theme.colors.background.primary, // Match container background
    zIndex: 1, // Ensure header stays on top
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  title: {
    fontSize: 32,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  loadingText: {
    marginTop: Theme.spacing.lg,
    fontSize: 16,
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.medium,
  },
  section: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    marginBottom: Theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statBox: {
    width: '48%',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
    padding: Theme.spacing.md,
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.medium,
  },
  statValue: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Theme.colors.text.tertiary,
    marginTop: 4,
    fontFamily: Theme.fonts.medium,
    textAlign: 'center',
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.md,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.xs,
    marginBottom: Theme.spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.colors.status.success,
    borderRadius: Theme.borderRadius.xs,
  },
  progressPercentage: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.status.success,
    marginBottom: 4,
  },
  workoutCount: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.tertiary,
  },
  goalDisplayContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalValue: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
  },
  editGoalButton: {
    backgroundColor: Theme.colors.accent.primary,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.small,
  },
  editGoalButtonText: {
    color: Theme.colors.text.primary,
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
  },
  editGoalContainer: {
    alignItems: 'stretch',
  },
  goalInput: {
    borderWidth: 1,
    borderColor: Theme.colors.border.secondary,
    borderRadius: Theme.borderRadius.small,
    padding: Theme.spacing.md,
    fontSize: 16,
    fontFamily: Theme.fonts.regular,
    marginBottom: Theme.spacing.md,
    backgroundColor: Theme.colors.background.tertiary,
    color: Theme.colors.text.primary,
  },
  goalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  goalButton: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.small,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: Theme.colors.background.tertiary,
    borderWidth: 1,
    borderColor: Theme.colors.border.secondary,
  },
  cancelButtonText: {
    color: Theme.colors.text.primary,
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
  },
  saveButton: {
    backgroundColor: Theme.colors.accent.primary,
  },
  saveButtonText: {
    color: Theme.colors.text.primary,
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
  },
  syncInfo: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.tertiary,
  },
  levelSection: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    marginBottom: Theme.spacing.xl,
  },
  currentLevelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  currentLevelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentLevelEmoji: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  currentLevelTextContainer: {
    marginLeft: Theme.spacing.lg,
  },
  currentLevelTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
  },
  currentLevelNumber: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.tertiary,
  },
  currentLevelDistance: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.tertiary,
  },
  nextLevelInfo: {
    marginLeft: Theme.spacing.lg,
  },
  nextLevelText: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.tertiary,
  },
  expandHint: {
    fontSize: 12,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.tertiary,
  },
  simpleProgressContainer: {
    alignItems: 'center',
  },
  simpleProgressBar: {
    width: '100%',
    height: 8,
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.xs,
    marginBottom: Theme.spacing.sm,
  },
  simpleProgressFill: {
    height: '100%',
    backgroundColor: Theme.colors.status.success,
    borderRadius: Theme.borderRadius.xs,
  },
  simpleProgressText: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
  },
  progressionContainer: {
    marginBottom: Theme.spacing.xl,
  },
  progressionTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.lg,
  },
  levelTrackScroll: {
    flexDirection: 'row',
  },
  levelTrack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelNode: {
    alignItems: 'center',
    marginRight: 24,
    width: 100,
  },
  connectionLine: {
    position: 'absolute',
    right: -24,
    width: 24,
    height: 2,
    backgroundColor: Theme.colors.background.tertiary,
    top: 16,
  },
  connectionLineCompleted: {
    backgroundColor: Theme.colors.status.success,
  },
  levelCircle: {
    width: 32,
    height: 32,
    borderRadius: Theme.borderRadius.large,
    backgroundColor: Theme.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  levelCircleCurrent: {
    backgroundColor: Theme.colors.status.success,
  },
  levelCircleCompleted: {
    backgroundColor: Theme.colors.status.success,
  },
  levelCircleText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
  },
  levelCircleTextCurrent: {
    color: Theme.colors.text.primary,
  },
  levelCircleTextCompleted: {
    color: Theme.colors.text.primary,
  },
  currentLevelProgressContainer: {
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  currentLevelProgress: {
    width: 80,
    height: 4,
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.xs,
  },
  currentLevelProgressFill: {
    height: '100%',
    backgroundColor: Theme.colors.status.success,
    borderRadius: Theme.borderRadius.xs,
  },
  progressPercentageText: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.status.success,
    marginTop: 4,
  },
  levelNodeInfo: {
    alignItems: 'center',
  },
  levelNodeEmoji: {
    fontSize: 18,
    marginBottom: 4,
  },
  levelNodeTitle: {
    fontSize: 12,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: 2,
  },
  levelNodeDistance: {
    fontSize: 11,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  settingsButton: {
    position: 'absolute',
    right: Theme.spacing.xl,
    top: 70,
  },
}); 