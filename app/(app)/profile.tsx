import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import ChallengeService from '@/services/ChallengeService';
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

  // Rive animation state
  const [riveUrl, setRiveUrl] = useState("https://fast-dragon-309.convex.cloud/api/storage/122e4793-89da-41de-9e4f-ed67741def2e");

  const RIVE_URLS = [
    "https://fast-dragon-309.convex.cloud/api/storage/04bf0340-7d79-4865-8dd6-2966b4befaff",
    "https://deafening-mule-576.convex.cloud/api/storage/fcdc254a-5fb8-421b-b22e-85af6b3f765a",
    "https://fast-dragon-309.convex.cloud/api/storage/122e4793-89da-41de-9e4f-ed67741def2e"
  ];

  const toggleRiveUrl = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRiveUrl(prevUrl => {
      const currentIndex = RIVE_URLS.indexOf(prevUrl);
      const nextIndex = (currentIndex + 1) % RIVE_URLS.length;
      return RIVE_URLS[nextIndex];
    });
  };

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
    const goalInMeters = parseFloat(newWeeklyGoal) * 1000;

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

  const calculateStreak = () => {
    // For now, return a placeholder. You can implement actual streak logic later
    return Math.floor(Math.random() * 30) + 1;
  };

  const getCurrentWeek = () => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const pastDaysOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#58CC02" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Character Section with Green Background - Goes to top */}
        <View style={styles.characterSection}>
          {/* Settings Button positioned in top right */}
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/settings');
            }}
            activeOpacity={0.7}
          >
            <FontAwesome5 name="cog" size={24} color={Theme.colors.text.primary} />
          </TouchableOpacity>

          {/* Rive Character */}
          {/* <TouchableOpacity style={styles.characterContainer} onPress={toggleRiveUrl} activeOpacity={0.8}>
            <Rive
              url={riveUrl}
              style={styles.riveAvatar}
              autoplay={true}
            />
          </TouchableOpacity> */}
        </View>

        {/* Profile Info Section */}
        <View style={styles.profileInfoSection}>
          {/* User Info */}
          <Text style={styles.userName}>Edgar Hnd</Text>
          <Text style={styles.userMeta}>@EdgarHnd • Joined December 2024</Text>

          {/* Stats Row */}
          {/* <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile?.totalWorkouts || 0}</Text>
              <Text style={styles.statLabel}>Runs</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>2</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>2</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
          </View> */}

          {/* Add Friends Button */}
          {/* <TouchableOpacity style={styles.addFriendsButton} activeOpacity={0.8}>
            <FontAwesome5 name="user-plus" size={16} color="#FFFFFF" style={styles.addFriendsIcon} />
            <Text style={styles.addFriendsText}>ADD FRIENDS</Text>
          </TouchableOpacity> */}
        </View>

        {/* Complete Profile Section - Hidden for now */}
        {/* <View style={styles.completeProfileSection}>
          <View style={styles.completeProfileContent}>
            <View style={styles.completeProfileText}>
              <Text style={styles.completeProfileTitle}>Finish your profile!</Text>
              <Text style={styles.completeProfileSteps}>1 STEP LEFT</Text>
            </View>
            <View style={styles.mascotContainer}>
              <Text style={styles.mascot}>🏃‍♂️</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.completeProfileButton}
            onPress={() => setIsEditingGoal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.completeProfileButtonText}>COMPLETE PROFILE</Text>
          </TouchableOpacity>
        </View> */}

        {/* Overview Section */}
        <View style={styles.overviewSection}>
          <Text style={styles.sectionTitle}>Overview</Text>

          {/* Main Stats - Duolingo Style 2x2 Grid */}
          <View style={styles.duolingoStatsContainer}>
            <View style={styles.duolingoStatsRow}>
              <View style={styles.duolingoStatCard}>
                <Text style={styles.duolingoStatIcon}>🛣️</Text>
                <View style={styles.duolingoStatText}>
                  <Text style={styles.duolingoStatNumber}>{Math.round((profile?.totalDistance || 0) / 100)}</Text>
                  <Text style={styles.duolingoStatLabel}>Total Km</Text>
                </View>
              </View>

              <View style={styles.duolingoStatCard}>
                <Text style={styles.duolingoStatIcon}>⚡️</Text>
                <View style={styles.duolingoStatText}>
                  <Text style={styles.duolingoStatNumber}>{calculateStreak()}</Text>
                  <Text style={styles.duolingoStatLabel}>Streak</Text>
                </View>
              </View>
            </View>

            <View style={styles.duolingoStatsRow}>
              <View style={styles.duolingoStatCard}>
                <Text style={styles.duolingoStatIcon}>🏃‍♂️</Text>
                <View style={styles.duolingoStatText}>
                  <Text style={styles.duolingoStatNumber}>{profile?.totalWorkouts || 0}</Text>
                  <Text style={styles.duolingoStatLabel}>Activities</Text>
                </View>
              </View>

              <View style={styles.duolingoStatCard}>
                <Text style={styles.duolingoStatIcon}>🔥</Text>
                <View style={styles.duolingoStatText}>
                  <Text style={styles.duolingoStatNumber}>{profile?.totalCalories || 0}</Text>
                  <Text style={styles.duolingoStatLabel}>Calories</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Level Section */}
        {levelInfo && (
          <View style={styles.levelSection}>
            <Text style={styles.sectionTitle}>Level Progress</Text>
            {/* Current Level Display */}
            <View style={styles.currentLevelCard}>
              <View style={styles.levelHeader}>
                <Text style={styles.currentLevelEmoji}>{LevelingService.getLevelEmoji(levelInfo.level)}</Text>
                <View style={styles.levelTextInfo}>
                  <Text style={styles.currentLevelTitle}>{LevelingService.getLevelTitle(levelInfo.level)}</Text>
                  <Text style={styles.currentLevelNumber}>Level {levelInfo.level}</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${levelInfo.progressToNextLevel * 100}%` }
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {Math.round(levelInfo.progressToNextLevel * 100)}% to Level {levelInfo.level + 1}
                </Text>
              </View>
            </View>

            {/* Upcoming Levels */}
            <View style={styles.upcomingLevelsContainer}>
              <Text style={styles.upcomingLevelsTitle}>Upcoming Levels</Text>
              <View style={styles.upcomingLevelsRow}>
                {[1, 2, 3].map((offset) => {
                  const nextLevel = levelInfo.level + offset;
                  const levelRequirements = LevelingService.getLevelRequirements();
                  const levelReq = levelRequirements.find(req => req.level === nextLevel);

                  if (!levelReq) return null;

                  return (
                    <View key={nextLevel} style={styles.upcomingLevelCard}>
                      <Text style={styles.upcomingLevelEmoji}>{levelReq.emoji}</Text>
                      <Text style={styles.upcomingLevelNumber}>Level {nextLevel}</Text>
                      <Text style={styles.upcomingLevelTitle} numberOfLines={2}>{levelReq.title}</Text>
                      <Text style={styles.upcomingLevelDistance}>{LevelingService.formatDistance(levelReq.distance)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Friend Streaks Section */}
        {/* <View style={styles.friendStreaksSection}>
          <Text style={styles.sectionTitle}>Friend Streaks</Text>
          <View style={styles.friendStreaksRow}>
            {[...Array(5)].map((_, index) => (
              <TouchableOpacity key={index} style={styles.friendStreakItem} activeOpacity={0.7}>
                <View style={styles.friendStreakCircle}>
                  <FontAwesome5 name="plus" size={20} color="#7C8DB0" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View> */}

        {/* Challenges Section */}
        <View style={styles.achievementsSection}>
          <View style={styles.achievementsHeader}>
            <Text style={styles.sectionTitle}>Challenges</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/challenges');
              }}
            >
              <Text style={styles.viewAllText}>VIEW ALL</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.achievementsRow}>
            {ChallengeService.getAllChallenges().slice(0, 3).map((challenge, index) => (
              <View key={challenge.id} style={styles.achievementBadge}>
                <TouchableOpacity
                  style={styles.challengeCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    Alert.alert(
                      challenge.name,
                      `${challenge.description}\n\nReward: ${challenge.reward}`,
                      [{ text: 'Got it!', style: 'default' }]
                    );
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.challengeEmoji}>{challenge.emoji}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Weekly Goal Editor */}
        {isEditingGoal && (
          <View style={styles.goalModal}>
            <View style={styles.goalModalContent}>
              <Text style={styles.goalModalTitle}>Set Weekly Goal</Text>
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
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
  },
  scrollView: {
    flex: 1,
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
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.medium,
  },

  settingsButton: {
    position: 'absolute',
    top: 50, // Position below status bar
    right: 20,
    padding: 8,
    zIndex: 10,
  },
  characterSection: {
    //backgroundColor: Theme.colors.accent.primary, // Green background like Duolingo
    alignItems: 'center',
    paddingTop: 10, // Account for status bar
    paddingBottom: 40,
    marginBottom: 20,
    position: 'relative',
  },
  characterContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfoSection: {
    paddingHorizontal: 20,
    //marginBottom: 32,
  },
  riveAvatar: {
    width: 180,
    height: 180,
  },
  userName: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 4,
  },
  userMeta: {
    fontSize: 14,
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.medium,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statNumber: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Theme.colors.text.secondary,
    fontFamily: Theme.fonts.medium,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: Theme.colors.background.tertiary,
  },
  addFriendsButton: {
    backgroundColor: Theme.colors.accent.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  addFriendsIcon: {
    marginRight: 8,
  },
  addFriendsText: {
    color: Theme.colors.text.primary,
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    letterSpacing: 0.5,
  },
  completeProfileSection: {
    backgroundColor: Theme.colors.background.secondary,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  completeProfileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  completeProfileText: {
    flex: 1,
  },
  completeProfileTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 4,
  },
  completeProfileSteps: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: Theme.fonts.medium,
    letterSpacing: 1,
  },
  mascotContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mascot: {
    fontSize: 40,
  },
  completeProfileButton: {
    backgroundColor: Theme.colors.accent.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  completeProfileButtonText: {
    color: Theme.colors.text.primary,
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    letterSpacing: 0.5,
  },
  overviewSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 16,
  },
  mainStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  mainStatCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 6,
    borderWidth: 3,
    borderColor: Theme.colors.background.tertiary,
  },
  mainStatIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  mainStatNumber: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 4,
  },
  mainStatLabel: {
    fontSize: 12,
    color: Theme.colors.text.secondary,
    fontFamily: Theme.fonts.medium,
  },
  friendStreaksSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  friendStreaksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  friendStreakItem: {
    alignItems: 'center',
  },
  friendStreakCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Theme.colors.background.secondary,
    borderWidth: 2,
    borderColor: Theme.colors.background.tertiary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  achievementsSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  achievementsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    color: Theme.colors.accent.primary,
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
  },
  achievementsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  achievementBadge: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  achievementEarned: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Theme.colors.special.level,
    justifyContent: 'center',
    alignItems: 'center',
  },
  achievementLocked: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Theme.colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  achievementIcon: {
    fontSize: 32,
  },
  goalModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Theme.colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  goalModalContent: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 300,
  },
  goalModalTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: 20,
  },
  goalInput: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.regular,
    marginBottom: 20,
    textAlign: 'center',
  },
  goalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  goalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: Theme.colors.background.secondary,
  },
  cancelButtonText: {
    color: Theme.colors.text.primary,
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
  },
  saveButton: {
    backgroundColor: Theme.colors.accent.primary,
  },
  saveButtonText: {
    color: Theme.colors.text.primary,
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
  },
  bottomSpacer: {
    height: 100,
  },
  // Level Section Styles
  levelSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  currentLevelCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: Theme.colors.background.tertiary,
    backgroundColor: Theme.colors.background.secondary,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  currentLevelEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  levelTextInfo: {
    flex: 1,
  },
  currentLevelTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 4,
  },
  currentLevelNumber: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: Theme.colors.background.primary,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.colors.special.level,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  upcomingLevelsContainer: {
    marginTop: 8,
  },
  upcomingLevelsTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    marginBottom: 12,
  },
  upcomingLevelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  upcomingLevelCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  upcomingLevelEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  upcomingLevelNumber: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 4,
  },
  upcomingLevelTitle: {
    fontSize: 10,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 4,
    minHeight: 32, // Ensure consistent height
  },
  upcomingLevelDistance: {
    fontSize: 10,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  // Challenge Styles
  challengeCard: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Theme.colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeEmoji: {
    fontSize: 32,
  },
  // Duolingo Style Stats
  duolingoStatsContainer: {
    marginBottom: 20,
  },
  duolingoStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  duolingoStatCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 6,
  },
  duolingoStatIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  duolingoStatText: {
    flex: 1,
  },
  duolingoStatNumber: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 2,
  },
  duolingoStatLabel: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
  },
}); 