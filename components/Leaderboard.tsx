import Theme from '@/constants/theme';
import LevelingService from '@/services/LevelingService';
import { useQuery } from "convex/react";
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../convex/_generated/api';

interface LeaderboardProps {
  onError?: (message: string) => void;
}

type Period = "all" | "week" | "month";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  totalDistance: number;
  level: number;
  totalWorkouts: number;
}

interface UserRankInfo {
  rank: number | null;
  totalUsers: number;
  userStats: LeaderboardEntry | null;
}

export default function Leaderboard({ onError }: LeaderboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("all");
  const [previousData, setPreviousData] = useState<{
    leaderboard: LeaderboardEntry[] | null;
    userRank: UserRankInfo | null;
  }>({ leaderboard: null, userRank: null });
  const [fadeAnim] = useState(new Animated.Value(1));

  // Direct convex queries
  const leaderboard = useQuery(api.leaderboard.getLeaderboard, {
    period: selectedPeriod,
    limit: 10,
  });

  const userRank = useQuery(api.leaderboard.getUserRank, {
    period: selectedPeriod,
  });

  const isLoading = leaderboard === undefined || userRank === undefined;
  const hasData = leaderboard !== undefined && userRank !== undefined;

  // Update previous data when new data arrives
  useEffect(() => {
    if (hasData) {
      setPreviousData({ leaderboard, userRank });
    }
  }, [hasData, leaderboard, userRank]);

  // Handle smooth transitions when period changes
  useEffect(() => {
    if (isLoading && previousData.leaderboard) {
      // Fade out current data
      Animated.timing(fadeAnim, {
        toValue: 0.6,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else if (hasData) {
      // Fade in new data
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isLoading, hasData, fadeAnim, previousData.leaderboard]);

  const formatDistance = (meters: number) => {
    const km = meters / 1000;
    return `${km.toFixed(1)} km`;
  };

  const getPeriodTitle = (period: Period) => {
    switch (period) {
      case "all": return "All Time";
      case "week": return "This Week";
      case "month": return "This Month";
    }
  };

  const handlePeriodChange = (period: Period) => {
    setSelectedPeriod(period);
  };

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1: return styles.rank1;
      case 2: return styles.rank2;
      case 3: return styles.rank3;
      default: return null;
    }
  };

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return null;
    }
  };

  // Use current data if available, otherwise use previous data
  const displayData = hasData ? { leaderboard, userRank } : previousData;

  // Show initial loading only if we have no data at all
  if (!displayData.leaderboard && isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.accent.primary} />
        <Text style={styles.loadingText}>Loading leaderboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {(["all", "week", "month"] as Period[]).map((period) => (
          <TouchableOpacity
            key={period}
            style={[
              styles.periodButton,
              selectedPeriod === period && styles.periodButtonActive
            ]}
            onPress={() => handlePeriodChange(period)}
            disabled={isLoading}
          >
            <View style={styles.periodButtonContent}>
              <Text style={[
                styles.periodButtonText,
                selectedPeriod === period && styles.periodButtonTextActive
              ]}>
                {getPeriodTitle(period)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
        {/* Current User Rank */}
        {displayData.userRank && displayData.userRank.rank && (
          <View style={styles.userRankContainer}>
            <Text style={styles.userRankTitle}>Your Rank</Text>
            <View style={styles.userRankBox}>
              <View style={styles.userRankHeader}>
                <Text style={styles.userRankNumber}>#{displayData.userRank.rank}</Text>
                {displayData.userRank.rank <= 3 && (
                  <Text style={styles.userRankEmoji}>{getRankEmoji(displayData.userRank.rank)}</Text>
                )}
              </View>
              <Text style={styles.userRankText}>out of {displayData.userRank.totalUsers} runners</Text>
              {displayData.userRank.userStats && (
                <View style={styles.userRankStats}>
                  <Text style={styles.userRankDistance}>
                    {formatDistance(displayData.userRank.userStats.totalDistance)}
                  </Text>
                  <Text style={styles.userRankLevel}>
                    {LevelingService.getLevelEmoji(displayData.userRank.userStats.level)} Level {displayData.userRank.userStats.level}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Leaderboard */}
        <ScrollView style={styles.leaderboardContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.leaderboardHeader}>
            <Text style={styles.leaderboardTitle}>Top Runners</Text>
            {isLoading && (
              <ActivityIndicator
                size="small"
                color={Theme.colors.accent.primary}
                style={styles.headerLoadingIndicator}
              />
            )}
          </View>

          {!displayData.leaderboard || displayData.leaderboard.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateEmoji}>🏃‍♂️</Text>
              <Text style={styles.emptyStateText}>No runners yet for {getPeriodTitle(selectedPeriod).toLowerCase()}</Text>
              <Text style={styles.emptyStateSubtext}>Start running to claim your spot!</Text>
            </View>
          ) : (
            displayData.leaderboard.map((entry) => (
              <View
                key={`${entry.userId}-${selectedPeriod}`}
                style={[
                  styles.leaderboardEntry,
                  entry.rank <= 3 && getRankStyle(entry.rank)
                ]}
              >
                <View style={styles.rankContainer}>
                  <Text style={[
                    styles.rankNumber,
                    entry.rank <= 3 && styles.topRankNumber
                  ]}>
                    #{entry.rank}
                  </Text>
                  {entry.rank <= 3 && (
                    <Text style={styles.trophy}>{getRankEmoji(entry.rank)}</Text>
                  )}
                </View>

                <View style={styles.entryContent}>
                  <View style={styles.entryHeader}>
                    <Text style={styles.entryName}>{entry.name}</Text>
                    {entry.level > 0 && (
                      <View style={styles.levelBadge}>
                        <Text style={styles.levelEmoji}>{LevelingService.getLevelEmoji(entry.level)}</Text>
                        <Text style={styles.levelText}>Lv. {entry.level}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.entryStats}>
                    <View style={styles.entryStatsLeft}>
                      <Text style={styles.entryDistance}>{formatDistance(entry.totalDistance)}</Text>
                      <Text style={styles.entryDistanceLabel}>total distance</Text>
                    </View>
                    <View style={styles.entryStatsRight}>
                      <Text style={styles.entryWorkouts}>{entry.totalWorkouts}</Text>
                      <Text style={styles.entryWorkoutsLabel}>runs</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Theme.spacing.xxxl,
  },
  loadingText: {
    marginTop: Theme.spacing.lg,
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xs,
    marginBottom: Theme.spacing.xl,
  },
  periodButton: {
    flex: 1,
    borderRadius: Theme.borderRadius.medium,
  },
  periodButtonActive: {
    backgroundColor: Theme.colors.accent.primary,
  },
  periodButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
  },
  periodButtonText: {
    fontSize: 12,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.muted,
    textAlign: 'center',
  },
  periodButtonTextActive: {
    color: Theme.colors.text.primary,
  },
  periodLoadingIndicator: {
    marginLeft: Theme.spacing.xs,
  },
  contentContainer: {
    flex: 1,
  },
  userRankContainer: {
    marginBottom: Theme.spacing.xl,
  },
  userRankTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.md,
  },
  userRankBox: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Theme.colors.border.primary,
  },
  userRankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  userRankNumber: {
    fontSize: 32,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
  },
  userRankEmoji: {
    fontSize: 24,
    marginLeft: Theme.spacing.sm,
  },
  userRankText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    marginBottom: Theme.spacing.md,
  },
  userRankStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.lg,
  },
  userRankDistance: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  userRankLevel: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.special.level,
  },
  leaderboardContainer: {
    flex: 1,
  },
  leaderboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  leaderboardTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    flex: 1,
  },
  headerLoadingIndicator: {
    marginLeft: Theme.spacing.sm,
  },
  emptyState: {
    padding: Theme.spacing.xxxl,
    alignItems: 'center',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    borderWidth: 2,
    borderColor: Theme.colors.border.primary,
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: Theme.spacing.lg,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },
  emptyStateSubtext: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  leaderboardEntry: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    borderWidth: 2,
    borderColor: Theme.colors.border.primary,
  },
  rank1: {
    borderColor: Theme.colors.special.level,
    backgroundColor: Theme.colors.background.secondary,
    borderWidth: 2,
  },
  rank2: {
    borderColor: Theme.colors.text.muted,
    backgroundColor: Theme.colors.background.secondary,
    borderWidth: 2,
  },
  rank3: {
    borderColor: Theme.colors.special.coin,
    backgroundColor: Theme.colors.background.secondary,
    borderWidth: 2,
  },
  rankContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.lg,
    minWidth: 60,
  },
  rankNumber: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.muted,
  },
  topRankNumber: {
    fontSize: 18,
    color: Theme.colors.text.primary,
  },
  trophy: {
    fontSize: 20,
    marginTop: Theme.spacing.xs,
  },
  entryContent: {
    flex: 1,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  entryName: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    flex: 1,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.medium,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.colors.border.primary,
  },
  levelEmoji: {
    fontSize: 14,
    marginRight: Theme.spacing.xs,
  },
  levelText: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  entryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.md,
  },
  entryStatsLeft: {
    alignItems: 'flex-start',
  },
  entryStatsRight: {
    alignItems: 'flex-end',
  },
  entryDistance: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
  },
  entryDistanceLabel: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  entryWorkouts: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  entryWorkoutsLabel: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  progressLevelContainer: {
    marginTop: Theme.spacing.sm,
  },
  progressLevelBar: {
    height: 6,
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.xs,
    marginBottom: Theme.spacing.xs,
  },
  progressLevelFill: {
    height: '100%',
    borderRadius: Theme.borderRadius.xs,
  },
  progressLevelText: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
}); 