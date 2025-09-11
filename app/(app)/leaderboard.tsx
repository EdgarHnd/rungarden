import FriendGarden from '@/components/FriendGarden';
import LoadingScreen from '@/components/LoadingScreen';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { FontAwesome5 } from '@expo/vector-icons';
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import { Dimensions, FlatList, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Friend {
  _id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

const { width: screenWidth } = Dimensions.get('window');

export default function FriendsScreen() {
  const { isAuthenticated } = useConvexAuth();
  const friendsWithGardens = useQuery(api.friends.getFriendsWithGardens);
  const incomingRequests = useQuery(api.friends.getIncomingFriendRequests);
  const respondRequest = useMutation(api.friends.respondToFriendRequest);

  if (!isAuthenticated) {
    return <LoadingScreen />;
  }

  const handleInviteFriend = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/add-friend');
  };

  const handleRespond = async (requestId: string, accept: boolean) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await respondRequest({ requestId: requestId as any, accept });
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Calculate garden size based on screen width for 2x2 grid
  const gardenSize = (screenWidth - 60) / 2; // 60 = padding + margins

  const renderFriendsGrid = () => {
    if (!friendsWithGardens || friendsWithGardens.length === 0) {
      return null;
    }

    // Create rows of 2 friends each
    const rows = [];
    for (let i = 0; i < friendsWithGardens.length; i += 2) {
      const rowFriends = friendsWithGardens.slice(i, i + 2);
      rows.push(rowFriends);
    }

    return (
      <View style={styles.friendsGrid}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.friendsRow}>
            {row.map((friendData) => {
              if (!friendData || !friendData.user) return null;

              const displayName = (friendData.user as any).name ||
                (friendData.user as any).firstName ||
                'Friend';
              return (
                <FriendGarden
                  key={friendData.user._id}
                  friendName={displayName}
                  friendId={friendData.user._id}
                  plants={friendData.plants as any}
                  size={gardenSize}
                />
              );
            })}
            {/* Add empty space if odd number of friends in last row */}
            {row.length === 1 && <View style={{ width: gardenSize }} />}
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Friends</Text>
        <TouchableOpacity
          style={styles.inviteButton}
          onPress={handleInviteFriend}
          activeOpacity={0.8}
        >
          <FontAwesome5 name="user-plus" size={18} color={Theme.colors.background.primary} />
          <Text style={styles.inviteButtonText}>Invite</Text>
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
                <Text style={styles.requestName}>{(item as any).fromUser?.name || (item as any).fromUser?.firstName || 'Unknown User'}</Text>
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
            scrollEnabled={false}
            style={styles.requestsList}
          />
        </View>
      )}

      {/* Friends Grid */}
      {friendsWithGardens === undefined ? (
        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.friendsGrid}>
            {/* Skeleton loading - 2x2 grid */}
            <View style={styles.friendsRow}>
              <View style={[styles.skeletonGarden, { width: gardenSize, height: gardenSize }]}>
                <View style={styles.skeletonContent} />
              </View>
              <View style={[styles.skeletonGarden, { width: gardenSize, height: gardenSize }]}>
                <View style={styles.skeletonContent} />
              </View>
            </View>
            <View style={styles.friendsRow}>
              <View style={[styles.skeletonGarden, { width: gardenSize, height: gardenSize }]}>
                <View style={styles.skeletonContent} />
              </View>
              <View style={[styles.skeletonGarden, { width: gardenSize, height: gardenSize }]}>
                <View style={styles.skeletonContent} />
              </View>
            </View>
          </View>
        </ScrollView>
      ) : friendsWithGardens && friendsWithGardens.length > 0 ? (
        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {renderFriendsGrid()}
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <FontAwesome5
            name="user-friends"
            size={64}
            color={Theme.colors.text.muted}
          />
          <Text style={styles.emptyTitle}>No friends yet!</Text>
          <Text style={styles.emptySubtitle}>
            Invite friends to join your running journey and grow gardens together 🌱
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={handleInviteFriend}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyButtonText}>Invite Friends</Text>
          </TouchableOpacity>
        </View>
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontFamily: 'SF-Pro-Rounded-Black',
    color: Theme.colors.text.primary,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.accent.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    ...Theme.shadows.small,
  },
  inviteButtonText: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: Theme.colors.background.primary,
    marginLeft: 6,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100, // Space for tab bar
  },
  friendsGrid: {
    paddingTop: 16,
  },
  friendsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  skeletonGarden: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
    ...Theme.shadows.small,
    margin: 8,
  },
  skeletonContent: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    margin: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 24,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: Theme.colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyButton: {
    backgroundColor: Theme.colors.accent.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    ...Theme.shadows.small,
  },
  emptyButtonText: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: Theme.colors.background.primary,
  },
  requestsContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: Theme.colors.text.primary,
    marginBottom: 12,
  },
  requestsList: {
    maxHeight: 200, // Limit height to avoid taking too much space
  },
  requestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    ...Theme.shadows.small,
  },
  requestName: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: Theme.colors.text.primary,
    flex: 1,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  requestButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: Theme.colors.accent.primary,
  },
  rejectButton: {
    backgroundColor: Theme.colors.text.tertiary,
  },
  requestButtonText: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: Theme.colors.background.primary,
  },
});
