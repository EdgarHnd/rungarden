import LoadingScreen from '@/components/LoadingScreen';
import Theme from '@/constants/theme';
import { UserRankInfo } from '@/convex/leaderboard';
import { useAnalytics } from '@/provider/AnalyticsProvider';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../convex/_generated/api';
import FriendAvatar from './FriendAvatar';

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

export default function Leaderboard({ onError }: LeaderboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("week");
  const selectedScope = "friends" as const;
  const [previousData, setPreviousData] = useState<{
    leaderboard: LeaderboardEntry[] | null;
    userRank: UserRankInfo | null;
  }>({ leaderboard: null, userRank: null });
  const [fadeAnim] = useState(new Animated.Value(1));
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const router = useRouter();
  const analytics = useAnalytics();

  // Direct convex queries
  const leaderboard = useQuery(api.leaderboard.getLeaderboard, {
    period: selectedPeriod,
    scope: "friends",
    limit: 20,
  });

  const userRank = useQuery(api.leaderboard.getUserRank, {
    period: selectedPeriod,
    scope: "friends",
  });

  const profile = useQuery(api.userProfile.getOrCreateProfile);

  const incomingRequests = useQuery(api.friends.getIncomingFriendRequests);
  const respondRequest = useMutation(api.friends.respondToFriendRequest);

  const isLoading = leaderboard === undefined || userRank === undefined;
  const hasData = leaderboard !== undefined && userRank !== undefined;

  // Update previous data when new data arrives
  useEffect(() => {
    if (hasData) {
      setPreviousData({ leaderboard, userRank });
    }
  }, [hasData, leaderboard, userRank]);

  const handleRespond = async (requestId: string, accept: boolean) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      analytics.track({
        name: 'friend_request_responded',
        properties: { request_id: requestId, accepted: accept, from_screen: 'leaderboard' },
      });
      await respondRequest({ requestId: requestId as any, accept });
    } catch (e: any) {
      if (onError) {
        onError(e.message);
      } else {
        alert(e.message);
      }
    }
  };

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
    if ((profile?.metricSystem ?? "metric") === "metric") {
      const km = meters / 1000;
      return `${km.toFixed(1)} km`;
    } else {
      const miles = meters * 0.000621371;
      return `${miles.toFixed(1)} mi`;
    }
  };

  const getPeriodTitle = (period: Period) => {
    switch (period) {
      case "all": return "All Time";
      case "month": return "This Month";
      case "week": return "This Week";
    }
  };

  const handlePeriodChange = (period: Period) => {
    Haptics.selectionAsync();
    setSelectedPeriod(period);
    setShowPeriodMenu(false);
    analytics.track({
      name: 'leaderboard_period_changed',
      properties: {
        period: period,
      }
    });
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
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
        {/* Overlay to close dropdown */}
        {showPeriodMenu && (
          <Pressable style={styles.overlay} onPress={() => setShowPeriodMenu(false)} />
        )}

        {/* Header with dropdown (same layout for both scopes) */}
        <View style={styles.leaderboardHeader}>
          <View style={styles.dropdownWrapperCentered}>
            <TouchableOpacity style={styles.timeDropdown} onPress={() => setShowPeriodMenu((v) => !v)}>
              <Text style={styles.timeDropdownText}>{getPeriodTitle(selectedPeriod)}</Text>
              <Ionicons name="chevron-down" size={24} color={Theme.colors.text.primary} />
            </TouchableOpacity>
            {showPeriodMenu && (
              <View style={styles.dropdownMenuCentered}>
                {(['week', 'month', 'all'] as Period[]).map((p) => (
                  <TouchableOpacity key={p} style={styles.dropdownItem} onPress={() => handlePeriodChange(p)}>
                    <Text style={[styles.dropdownItemText, selectedPeriod === p && styles.dropdownItemTextActive]}>
                      {getPeriodTitle(p)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.addFriendButton}
            onPress={() => {
              Haptics.selectionAsync();
              analytics.track({ name: 'leaderboard_add_friend_clicked' });
              router.push('/add-friend');
            }}
          >
            <FontAwesome5 name="user-plus" size={20} color={Theme.colors.special.primary.exp} />
            <Text style={styles.addFriendButtonText}>Add Friends</Text>
          </TouchableOpacity>
        </View>
        {/* Friend Requests */}
        {incomingRequests && incomingRequests.length > 0 && (
          <View style={styles.requestsContainer}>
            <Text style={styles.sectionTitle}>Friend Requests</Text>
            <FlatList
              data={incomingRequests}
              keyExtractor={(item) => item._id as string}
              renderItem={({ item }) => (
                <View style={styles.requestRow}>
                  <Text style={styles.requestName}>{item.fromUser?.name || item.fromUser?.firstName || 'Unknown User'}</Text>
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={[styles.acceptButton, styles.requestButton]}
                      onPress={() => handleRespond(item._id as string, true)}
                    >
                      <Text style={styles.requestButtonText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.rejectButton, styles.requestButton]}
                      onPress={() => handleRespond(item._id as string, false)}
                    >
                      <Text style={styles.requestButtonText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          </View>
        )}
        {/* Leaderboard */}
        <FlatList
          data={displayData.leaderboard || []}
          numColumns={3}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => (
            <FriendAvatar
              entry={item}
              isCurrent={item.userId === displayData.userRank?.userStats?.userId}
              metricSystem={profile?.metricSystem ?? 'metric'}
            />
          )}
          contentContainerStyle={styles.friendsGrid}
          columnWrapperStyle={{ gap: Theme.spacing.xxl }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No friends yet</Text>
              <Text style={styles.emptyStateSubtext}>Add friends to see their progress</Text>
            </View>
          )}
        />
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
  contentContainer: {
    flex: 1,
  },
  leaderboardContainer: {
    flex: 1,
  },
  leaderboardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.xl,
    position: 'relative',
  },
  leaderboardTitle: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    flex: 1,
  },
  emptyState: {
    padding: Theme.spacing.xxxl,
    alignItems: 'center',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    borderWidth: 2,
    borderColor: Theme.colors.border.primary,
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
    alignItems: 'center',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    borderWidth: 2,
    borderColor: Theme.colors.border.primary,
  },
  rank1: {
    borderColor: Theme.colors.special.primary.level,
    backgroundColor: Theme.colors.background.secondary,
    borderWidth: 2,
  },
  rank2: {
    borderColor: Theme.colors.special.primary.coin,
    backgroundColor: Theme.colors.background.secondary,
    borderWidth: 2,
  },
  rank3: {
    borderColor: Theme.colors.special.primary.coin,
    backgroundColor: Theme.colors.background.secondary,
    borderWidth: 2,
  },
  rankContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexDirection: 'row',
    marginRight: Theme.spacing.md,
    minWidth: 60,
  },
  rankNumber: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.muted,
  },
  entryName: {
    flex: 1,
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'left',
  },
  entryStatsRight: {
    alignItems: 'flex-end',
  },
  entryDistance: {
    fontSize: 20,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    textAlign: 'right',
  },
  entryWorkouts: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.muted,
    textAlign: 'right',
  },
  friendsGrid: {
    paddingVertical: Theme.spacing.md,
  },
  timeDropdown: {
    marginTop: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeDropdownText: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginRight: Theme.spacing.sm,
  },
  dotsSeparator: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  dotsText: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  userEntry: {
    borderColor: Theme.colors.text.primary,
    borderWidth: 3,
    backgroundColor: Theme.colors.background.secondary,
  },
  rankEmoji: {
    fontSize: 20,
    marginRight: Theme.spacing.sm,
  },
  dropdownMenu: {
    position: 'absolute',
    right: 0,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: Theme.colors.border.primary,
    zIndex: 10,
  },
  dropdownMenuCentered: {
    position: 'absolute',
    top: 40,
    left: 0,
    backgroundColor: Theme.colors.background.primary,
    borderRadius: Theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: Theme.colors.border.primary,
    zIndex: 10,
    minWidth: 150,
  },
  dropdownItem: {
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    alignItems: 'flex-start',
  },
  dropdownItemText: {
    fontSize: 20,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.muted,
  },
  dropdownItemTextActive: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
  },
  dropdownWrapperCentered: {
    position: 'relative',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  addFriendButton: {
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.borderRadius.medium,
    borderWidth: 2,
    borderColor: Theme.colors.border.primary,
    borderBottomWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  addFriendButtonText: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    textTransform: 'uppercase',
    color: Theme.colors.special.primary.exp,
  },
  requestsContainer: {
    marginBottom: Theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.sm,
  },
  requestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderColor: Theme.colors.border.primary,
  },
  requestName: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
  },
  requestActions: {
    flexDirection: 'row',
    flexShrink: 0,
  },
  requestButton: {
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.borderRadius.medium,
    marginLeft: Theme.spacing.sm,
  },
  acceptButton: {
    backgroundColor: Theme.colors.accent.primary,
  },
  rejectButton: {
    backgroundColor: Theme.colors.background.tertiary,
  },
  requestButtonText: {
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
}); 