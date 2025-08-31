import FriendAvatar from '@/components/FriendAvatar';
import LoadingScreen from '@/components/LoadingScreen';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { FontAwesome5 } from '@expo/vector-icons';
import { useConvexAuth, useQuery } from "convex/react";
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Friend {
  _id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

export default function FriendsScreen() {
  const { isAuthenticated } = useConvexAuth();
  const friends = useQuery(api.friends.getFriends);

  if (!isAuthenticated) {
    return <LoadingScreen />;
  }

  const handleInviteFriend = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/add-friend');
  };

  const renderFriend = ({ item }: { item: Friend }) => {
    const displayName = item.name || `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Friend';

    return (
      <View style={styles.friendItem}>
        <FriendAvatar
          name={displayName}
          size={48}
        />
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{displayName}</Text>
          <Text style={styles.friendSubtitle}>Garden Runner 🌱</Text>
        </View>
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

      <FlatList
        data={friends || []}
        keyExtractor={(item) => item._id}
        renderItem={renderFriend}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
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
        }
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100, // Space for tab bar
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    ...Theme.shadows.small,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  friendName: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: Theme.colors.text.primary,
    marginBottom: 2,
  },
  friendSubtitle: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: Theme.colors.text.secondary,
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
});
