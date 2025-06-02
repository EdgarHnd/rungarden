import DatabaseHealthService, { UserProfile } from '@/services/DatabaseHealthService';
import LevelingService, { LevelInfo } from '@/services/LevelingService';
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex, useConvexAuth } from "convex/react";
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const convex = useConvex();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [newWeeklyGoal, setNewWeeklyGoal] = useState('');
  const [weekProgress, setWeekProgress] = useState<any>(null);
  const [healthService, setHealthService] = useState<DatabaseHealthService | null>(null);
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [showLevelDetails, setShowLevelDetails] = useState(false);

  useEffect(() => {
    if (isAuthenticated && convex) {
      const service = new DatabaseHealthService(convex);
      setHealthService(service);
      loadProfileData(service);
    }
  }, [isAuthenticated, convex]);

  const loadProfileData = async (service: DatabaseHealthService) => {
    try {
      setIsLoading(true);

      const profileData = await service.getUserProfile();
      const progressData = await service.getCurrentWeekProgress();
      const levelData = await service.getUserLevelInfo();

      setProfile(profileData);
      setWeekProgress(progressData);
      setLevelInfo(levelData);

      if (profileData) {
        setNewWeeklyGoal((profileData.weeklyGoal / 1000).toString()); // Convert to km for display
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await signOut();
      // No need to manually navigate - Convex auth will handle this
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to sign out");
      console.error("Sign out error:", error);
    }
  };

  const handleSaveWeeklyGoal = async () => {
    if (!healthService) return;

    const goalInMeters = parseFloat(newWeeklyGoal) * 1000; // Convert km to meters

    if (isNaN(goalInMeters) || goalInMeters <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid Goal', 'Please enter a valid weekly goal in kilometers');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await healthService.updateWeeklyGoal(goalInMeters);
      await loadProfileData(healthService);
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
          <Text style={styles.title}>Profile & Settings</Text>
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
        <Text style={styles.title}>Profile & Settings</Text>
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

        {/* Sign Out Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentScrollView: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 0, // Content starts right below the header
  },
  header: {
    paddingTop: 60, // Safe area / top spacing
    paddingHorizontal: 20,
    backgroundColor: '#f5f5f5', // Match container background
    zIndex: 1, // Ensure header stays on top
  },
  title: {
    fontSize: 32,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#111827',
    marginBottom: 30,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontFamily: 'SF-Pro-Rounded-Medium',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#374151',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statBox: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontFamily: 'SF-Pro-Rounded-Medium',
    textAlign: 'center',
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#333',
    marginBottom: 12,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Medium',
    color: '#10b981',
    marginBottom: 4,
  },
  workoutCount: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#666',
  },
  goalDisplayContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalValue: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#333',
  },
  editGoalButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editGoalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Medium',
  },
  editGoalContainer: {
    alignItems: 'stretch',
  },
  goalInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Regular',
    marginBottom: 12,
  },
  goalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  goalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Medium',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Medium',
  },
  syncInfo: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#666',
  },
  signOutButton: {
    backgroundColor: '#FF3B30',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  signOutButtonText: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: 'white',
  },
  levelSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  currentLevelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  currentLevelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentLevelEmoji: {
    fontSize: 24,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#333',
  },
  currentLevelTextContainer: {
    marginLeft: 16,
  },
  currentLevelTitle: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#333',
  },
  currentLevelNumber: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#666',
  },
  currentLevelDistance: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#666',
  },
  nextLevelInfo: {
    marginLeft: 16,
  },
  nextLevelText: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#666',
  },
  expandHint: {
    fontSize: 12,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#666',
  },
  simpleProgressContainer: {
    alignItems: 'center',
  },
  simpleProgressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginBottom: 8,
  },
  simpleProgressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  simpleProgressText: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Medium',
    color: '#333',
  },
  progressionContainer: {
    marginBottom: 20,
  },
  progressionTitle: {
    fontSize: 20,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#374151',
    marginBottom: 16,
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
    backgroundColor: '#e5e7eb',
    top: 16,
  },
  connectionLineCompleted: {
    backgroundColor: '#10b981',
  },
  levelCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelCircleCurrent: {
    backgroundColor: '#10b981',
  },
  levelCircleCompleted: {
    backgroundColor: '#10b981',
  },
  levelCircleText: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Medium',
    color: '#333',
  },
  levelCircleTextCurrent: {
    color: '#fff',
  },
  levelCircleTextCompleted: {
    color: '#fff',
  },
  currentLevelProgressContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  currentLevelProgress: {
    width: 80,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
  },
  currentLevelProgressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 2,
  },
  progressPercentageText: {
    fontSize: 12,
    fontFamily: 'SF-Pro-Rounded-Medium',
    color: '#10b981',
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
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 2,
  },
  levelNodeDistance: {
    fontSize: 11,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#666',
    textAlign: 'center',
  },
}); 