import LevelingService from '@/services/LevelingService';
import { useQuery } from "convex/react";
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

  // Direct convex queries - much cleaner!
  const leaderboard = useQuery(api.leaderboard.getLeaderboard, {
    period: selectedPeriod,
    limit: 10,
  });

  const userRank = useQuery(api.leaderboard.getUserRank, {
    period: selectedPeriod,
  });

  const isLoading = leaderboard === undefined || userRank === undefined;

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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
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
          >
            <Text style={[
              styles.periodButtonText,
              selectedPeriod === period && styles.periodButtonTextActive
            ]}>
              {getPeriodTitle(period)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Current User Rank */}
      {userRank && userRank.rank && (
        <View style={styles.userRankContainer}>
          <Text style={styles.userRankTitle}>Your Rank</Text>
          <View style={styles.userRankBox}>
            <Text style={styles.userRankNumber}>#{userRank.rank}</Text>
            <Text style={styles.userRankText}>out of {userRank.totalUsers} runners</Text>
            {userRank.userStats && (
              <Text style={styles.userRankDistance}>
                {formatDistance(userRank.userStats.totalDistance)}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Leaderboard */}
      <ScrollView style={styles.leaderboardContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.leaderboardTitle}>Top Runners</Text>

        {!leaderboard || leaderboard.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No data available for {getPeriodTitle(selectedPeriod).toLowerCase()}</Text>
          </View>
        ) : (
          leaderboard.map((entry) => (
            <View
              key={entry.userId}
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
                {entry.rank === 1 && <Text style={styles.trophy}>🏆</Text>}
                {entry.rank === 2 && <Text style={styles.trophy}>🥈</Text>}
                {entry.rank === 3 && <Text style={styles.trophy}>🥉</Text>}
              </View>

              <View style={styles.entryContent}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryName}>{entry.name}</Text>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelEmoji}>{LevelingService.getLevelEmoji(entry.level)}</Text>
                    <Text style={styles.levelText}>L{entry.level}</Text>
                  </View>
                </View>

                <View style={styles.entryStats}>
                  <Text style={styles.entryDistance}>{formatDistance(entry.totalDistance)}</Text>
                  <Text style={styles.entryWorkouts}>{entry.totalWorkouts} runs</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#007AFF',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  userRankContainer: {
    marginBottom: 24,
  },
  userRankTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  userRankBox: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  userRankNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
  },
  userRankText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  userRankDistance: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  leaderboardContainer: {
    flex: 1,
  },
  leaderboardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  leaderboardEntry: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  rank1: {
    borderColor: '#FFD700',
    backgroundColor: '#fffbf0',
  },
  rank2: {
    borderColor: '#C0C0C0',
    backgroundColor: '#f8f8f8',
  },
  rank3: {
    borderColor: '#CD7F32',
    backgroundColor: '#faf9f7',
  },
  rankContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    minWidth: 50,
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#666',
  },
  topRankNumber: {
    color: '#333',
  },
  trophy: {
    fontSize: 16,
    marginTop: 4,
  },
  entryContent: {
    flex: 1,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  levelEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  entryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  entryDistance: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
  },
  entryWorkouts: {
    fontSize: 14,
    color: '#666',
    alignSelf: 'flex-end',
  },
}); 