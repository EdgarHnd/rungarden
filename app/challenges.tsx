import AchievementCelebrationModal from '@/components/AchievementCelebrationModal';
import AchievementProgressModal from '@/components/AchievementProgressModal';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Challenge {
  id: string;
  emoji: string;
  name: string;
  description: string;
  reward: string;
  category: string;
  maxProgress: number;
  progressUnit: string;
  progress: number;
  isCompleted: boolean;
  isNew: boolean;
  unlockedAt?: string;
  rewardClaimed: boolean;
}

export default function ChallengesModal() {
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const isMetric = (profile?.metricSystem ?? "metric") === "metric";

  // Get challenges with progress
  // const challengesWithProgress = useQuery(api.achievements.getChallengesWithProgress, {
  //   isMetric: isMetric
  // });
  const challengesWithProgress: Challenge[] = [];

  // const claimReward = useMutation(api.achievements.claimAchievementReward);

  // Modal states
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleChallengePress = (challenge: Challenge) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedChallenge(challenge);

    if (challenge.isCompleted && challenge.isNew && !challenge.rewardClaimed) {
      // Show celebration modal for newly completed challenges
      setShowCelebrationModal(true);
    } else {
      // Show progress modal for other challenges
      setShowProgressModal(true);
    }
  };

  const handleClaimReward = async (challengeId: string) => {
    try {
      // await claimReward({ challengeId });
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🏅 Challenges</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {challengesWithProgress?.map((challenge) => (
            <TouchableOpacity
              key={challenge.id}
              style={[
                styles.challengeCard,
                challenge.isCompleted && styles.challengeCardCompleted,
              ]}
              onPress={() => handleChallengePress(challenge)}
              activeOpacity={0.7}
            >
              {/* NEW badge */}
              {challenge.isNew && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>NEW</Text>
                </View>
              )}

              <Text style={styles.challengeEmoji}>{challenge.emoji}</Text>
              <Text style={styles.challengeName}>{challenge.name}</Text>

              {/* Progress indicator */}
              <Text style={styles.progressText}>
                {challenge.progress} of {challenge.maxProgress}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>🚀 More Coming Soon!</Text>
          <Text style={styles.footerSubtitle}>
            New challenges added regularly. Keep running!
          </Text>
        </View>
      </ScrollView>

      {/* Achievement Modals */}
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
    </SafeAreaView>
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
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border.primary,
  },
  backButton: {
    padding: Theme.spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  placeholder: {
    width: 40, // Same width as back button for center alignment
  },
  content: {
    flex: 1,
    paddingHorizontal: Theme.spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: Theme.spacing.xl,
  },
  challengeCard: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.medium,
    marginBottom: Theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  challengeCardCompleted: {
    backgroundColor: Theme.colors.accent.primary + '20',
    borderWidth: 2,
    borderColor: Theme.colors.accent.primary,
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
  progressText: {
    fontSize: 9,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    padding: Theme.spacing.xl,
    marginTop: Theme.spacing.xl,
    marginBottom: 40,
  },
  footerTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.sm,
    textAlign: 'center',
  },
  footerSubtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
}); 