import { ActivityGrid } from '@/components/ActivityGrid';
import LoadingScreen from '@/components/LoadingScreen';
import AchievementCelebrationModal from '@/components/modals/AchievementCelebrationModal';
import AchievementProgressModal from '@/components/modals/AchievementProgressModal';
import StreakDisplay from '@/components/modals/StreakDisplay';
import WeekRewardModal from '@/components/modals/WeekRewardModal';
import XPInfoModal from '@/components/modals/XPInfoModal';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAnalytics } from '@/provider/AnalyticsProvider';
import LevelingService from '@/services/LevelingService';
import { useAuthActions } from "@convex-dev/auth/react";
import { FontAwesome5 } from '@expo/vector-icons';
import { useConvexAuth, useQuery } from "convex/react";
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const analytics = useAnalytics();
  const currentUser = useQuery(api.userProfile.currentUser);
  // Convex queries
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const profileStats = useQuery(api.activities.getProfileStats);
  const activities = useQuery(api.activities.getUserActivitiesForYear, {
    year: new Date().getFullYear(),
  });
  const currentPlan = useQuery(api.trainingPlan.getActiveTrainingPlan);
  const weekRewards = useQuery(api.weekRewards.getWeekRewardsWithCards,
    currentPlan && currentUser ? {
      userId: currentUser._id,
      planId: currentPlan._id
    } : 'skip'
  );
  // Get latest completed challenges for profile display
  // TODO: Re-enable when achievements API is implemented
  // const latestChallenges = useQuery(api.achievements.getLatestCompletedChallenges, {
  //   limit: 3,
  //   isMetric: (profile?.metricSystem ?? "metric") === "metric"
  // });
  const latestChallenges: any[] = []; // Placeholder until achievements are implemented

  // const claimReward = useMutation(api.achievements.claimAchievementReward);
  const claimReward = async (challengeId: string) => { }; // Placeholder until achievements are implemented

  // State for modals
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [showLevelModal, setShowLevelModal] = useState(false);

  // Achievement modal states
  const [selectedChallenge, setSelectedChallenge] = useState<any>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);

  // Coach card modal states
  const [showCoachCardModal, setShowCoachCardModal] = useState(false);
  const [selectedCoachCard, setSelectedCoachCard] = useState<any>(null);
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number>(0);

  const isLoading = profile === undefined || profileStats === undefined;

  // Get level info if profile exists
  const levelInfo = profile ? LevelingService.calculateLevelInfo(profile.totalXP || 0) : null;

  const calculateStreak = () => {
    // Use real streak data from streakInfo
    return profile?.currentStreak || 0;
  };

  const handleChallengePress = (challenge: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedChallenge(challenge);

    if (challenge.isCompleted && challenge.isNew && !challenge.rewardClaimed) {
      analytics.track({ name: 'challenge_celebration_viewed', properties: { challenge_id: challenge.id } });
      // Show celebration modal for newly completed challenges
      setShowCelebrationModal(true);
    } else {
      analytics.track({ name: 'challenge_progress_viewed', properties: { challenge_id: challenge.id } });
      // Show progress modal for other challenges
      setShowProgressModal(true);
    }
  };

  const handleClaimReward = async (challengeId: string) => {
    try {
      analytics.track({ name: 'challenge_reward_claimed', properties: { challenge_id: challengeId } });
      await claimReward(challengeId);
      setShowCelebrationModal(false);
      setSelectedChallenge(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error claiming reward:', error);
    }
  };

  const handleCloseModals = () => {
    setShowProgressModal(false);
    setShowCelebrationModal(false);
    setSelectedChallenge(null);
  };

  const handleCoachCardPress = (weekReward: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCoachCard(weekReward.card);
    setSelectedWeekNumber(weekReward.weekNumber);
    setShowCoachCardModal(true);
    analytics.track({
      name: 'coach_card_viewed_from_profile',
      properties: {
        week_number: weekReward.weekNumber,
        card_id: weekReward.card?._id
      }
    });
  };

  const handleCloseCoachCardModal = () => {
    setShowCoachCardModal(false);
    setSelectedCoachCard(null);
    setSelectedWeekNumber(0);
  };

  if (isLoading || !profileStats) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => {
            analytics.track({ name: 'settings_screen_viewed' });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/settings');
          }}
          activeOpacity={0.7}
        >
          <FontAwesome5 name="cog" size={24} color={Theme.colors.text.primary} />
        </TouchableOpacity>

        {/* Profile Info Section */}
        <View style={styles.profileInfoSection}>
          {/* User Info */}
          <Text style={styles.userName}>{profile?.firstName + " " + profile?.lastName || currentUser?.name || 'Anonymous Runner'}</Text>
          <Text style={styles.userMeta}>Joined {new Date(profile?._creationTime || '').toLocaleDateString()}</Text>
        </View>

        {/* Overview Section */}
        <View style={styles.overviewSection}>

          {/* Main Stats - Duolingo Style 2x2 Grid */}
          <View style={styles.duolingoStatsContainer}>
            <View style={styles.duolingoStatsRow}>
              <View style={styles.duolingoStatCard}>
                <Text style={styles.duolingoStatIcon}>🛣️</Text>
                <View style={styles.duolingoStatText}>
                  <Text style={styles.duolingoStatNumber}>
                    {(profile?.metricSystem ?? "metric") === "metric"
                      ? Math.round(profileStats.totalDistance / 1000)
                      : Math.round(profileStats.totalDistance * 0.000621371)
                    }
                  </Text>
                  <Text style={styles.duolingoStatLabel}>
                    Total {(profile?.metricSystem ?? "metric") === "metric" ? "Km" : "Mi"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.duolingoStatCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowStreakModal(true);
                }}
                activeOpacity={0.7}
              >
                <Image source={require('@/assets/images/icons/streak.png')} style={styles.streakIcon} />
                <View style={styles.duolingoStatText}>
                  <Text style={styles.duolingoStatNumber}>{calculateStreak()}</Text>
                  <Text style={styles.duolingoStatLabel}>Streak</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.duolingoStatsRow}>
              <View style={styles.duolingoStatCard}>
                <Text style={styles.duolingoStatIcon}>🏃‍♂️</Text>
                <View style={styles.duolingoStatText}>
                  <Text style={styles.duolingoStatNumber}>{profileStats.totalWorkouts}</Text>
                  <Text style={styles.duolingoStatLabel}>Runs</Text>
                </View>
              </View>

              <View style={styles.duolingoStatCard}>
                <Text style={styles.duolingoStatIcon}>🍕</Text>
                <View style={styles.duolingoStatText}>
                  <Text style={styles.duolingoStatNumber}>{Math.round(profileStats.totalCalories / 1000)}</Text>
                  <Text style={styles.duolingoStatLabel}>{Math.round(profileStats.totalCalories / 1000) > 1 ? 'Pizzas' : 'Pizza'}</Text>
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
            <TouchableOpacity
              style={styles.currentLevelCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowLevelModal(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.levelHeader}>
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
                  {LevelingService.formatXP(levelInfo.remainingXPForNextLevel, true)} to Level {levelInfo.level + 1}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Coach Cards Collection */}
        {weekRewards && weekRewards.length > 0 && (
          <View style={styles.coachCardsSection}>
            <View style={styles.coachCardsHeader}>
              <Text style={styles.sectionTitle}>Coach Cards</Text>
              <Text style={styles.coachCardsCount}>{weekRewards.length} earned</Text>
            </View>
            <View style={styles.coachCardsGrid}>
              {weekRewards.map((weekReward) => (
                <TouchableOpacity
                  key={`${weekReward.weekNumber}-${weekReward.cardId}`}
                  style={styles.coachCardItem}
                  onPress={() => handleCoachCardPress(weekReward)}
                  activeOpacity={0.7}
                >
                  <View style={styles.coachCardIconContainer}>
                    <Text style={styles.coachCardEmoji}>{weekReward.card?.iconEmoji || '✨'}</Text>
                  </View>
                  <View style={styles.coachCardInfo}>
                    <Text style={styles.coachCardTitle} numberOfLines={2}>
                      {weekReward.card?.title || 'Coaching Tip'}
                    </Text>
                    <Text style={styles.coachCardWeek}>Week {weekReward.weekNumber}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Activity Grid */}
        <View style={styles.activityGridContainer}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <ActivityGrid activities={activities || []} />
        </View>

        {/* Level Info Modal */}
        {showLevelModal && (
          <XPInfoModal
            visible={showLevelModal}
            onClose={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowLevelModal(false);
            }}
            levelInfo={levelInfo}
            metricSystem={profile?.metricSystem || 'metric'}
          />
        )}

        {/* Streak Display Modal */}
        {showStreakModal && (
          <StreakDisplay
            visible={showStreakModal}
            streakInfo={profile ? {
              currentStreak: profile.currentStreak,
              longestStreak: profile.longestStreak,
              lastStreakWeek: profile.lastStreakWeek || null,
            } : null}
            onClose={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowStreakModal(false);
            }}
          />
        )}

        {/* Coach Card Modal */}
        {showCoachCardModal && selectedCoachCard && (
          <WeekRewardModal
            visible={showCoachCardModal}
            weekNumber={selectedWeekNumber}
            card={selectedCoachCard}
            startFlipped={true}
            onClose={handleCloseCoachCardModal}
          />
        )}

        {/* Challenges Section */}
        {/* <View style={styles.achievementsSection}>
          <View style={styles.achievementsHeader}>
            <Text style={styles.sectionTitle}>Latest Challenges</Text>
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
          <View style={styles.achievementsGrid}>
            {latestChallenges && latestChallenges.length > 0 ? (
              latestChallenges
                .filter((challenge): challenge is NonNullable<typeof challenge> => challenge !== null)
                .map((challenge, index) => (
                  <TouchableOpacity
                    key={challenge.id}
                    style={[
                      styles.challengeCard,
                      challenge.isCompleted && styles.challengeCardCompleted
                    ]}
                    onPress={() => handleChallengePress(challenge)}
                    activeOpacity={0.7}
                  >
                    {challenge.isNew && challenge.isCompleted && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>NEW</Text>
                      </View>
                    )}
                    <Text style={styles.challengeEmoji}>{challenge.emoji}</Text>
                    <Text style={styles.challengeName}>{challenge.name}</Text>
                    <Text style={styles.challengeProgress}>
                      {challenge.progress} of {challenge.maxProgress}
                    </Text>
                  </TouchableOpacity>
                ))
            ) : (
              // Loading state - show 3 placeholder cards
              Array.from({ length: 3 }, (_, index) => (
                <View key={`placeholder-${index}`} style={styles.challengeCard}>
                  <Text style={styles.challengeEmoji}>⏳</Text>
                  <Text style={styles.challengeProgress}>Loading...</Text>
                </View>
              ))
            )}
          </View>
        </View> */}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Achievement Modals */}
      {selectedChallenge && (
        <>
          <AchievementProgressModal
            visible={showProgressModal}
            challenge={selectedChallenge}
            onClose={handleCloseModals}
          />

          <AchievementCelebrationModal
            visible={showCelebrationModal}
            challenge={selectedChallenge}
            onClose={handleCloseModals}
            onClaimReward={handleClaimReward}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: Theme.spacing.xl,
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
    top: 10, // Position below status bar
    right: 10,
    padding: 8,
    zIndex: 10,
  },
  profileInfoSection: {
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
  overviewSection: {
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 16,
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
    color: Theme.colors.text.tertiary,
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    marginBottom: 16,
  },
  achievementsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  challengeCard: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  challengeCardCompleted: {
    backgroundColor: Theme.colors.accent.primary + '20',
    borderWidth: 2,
    borderColor: Theme.colors.accent.primary,
  },
  challengeEmoji: {
    fontSize: 32,
    marginBottom: Theme.spacing.sm,
  },
  challengeName: {
    fontSize: 11,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  challengeProgress: {
    fontSize: 9,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  // Duolingo Style Stats
  duolingoStatsContainer: {
    marginBottom: 20,
  },
  duolingoStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: Theme.spacing.xl,
  },
  duolingoStatCard: {
    // backgroundColor: Theme.colors.background.secondary,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    borderWidth: 4,
    borderColor: Theme.colors.background.tertiary,
  },
  duolingoStatIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  streakIcon: {
    width: 24,
    height: 24,
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
  newBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Theme.colors.special.primary.exp,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
  },
  newBadgeText: {
    fontSize: 8,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background.primary,
    letterSpacing: 0.5,
  },
  bottomSpacer: {
    height: 100,
  },
  // Level Section Styles
  levelSection: {
  },
  currentLevelCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 4,
    borderColor: Theme.colors.background.tertiary,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.colors.special.primary.exp,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  activityGridContainer: {
  },
  // Coach Cards Section Styles
  coachCardsSection: {
    marginBottom: 20,
  },
  coachCardsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  coachCardsCount: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  coachCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  coachCardItem: {
    width: '48%',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Theme.colors.background.tertiary,
  },
  coachCardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  coachCardEmoji: {
    fontSize: 20,
  },
  coachCardInfo: {
    flex: 1,
  },
  coachCardTitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    marginBottom: 4,
    lineHeight: 18,
  },
  coachCardWeek: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
}); 