import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { FontAwesome5 } from '@expo/vector-icons';
import { useQuery } from "convex/react";
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function FriendsScreen() {
  const router = useRouter();

  // Queries for friends data
  const friends = useQuery(api.friends.getFriends);
  const pendingRequests = useQuery(api.friends.getIncomingFriendRequests);

  const handleAddFriend = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/add-friend');
  };

  const renderFriendCard = (friend: any, index: number) => (
    <View key={friend._id || index} style={styles.friendCard}>
      <View style={styles.friendAvatar}>
        <Text style={styles.friendAvatarText}>
          {friend.name?.charAt(0).toUpperCase() || '?'}
        </Text>
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{friend.name || 'Friend'}</Text>
        <Text style={styles.friendSubtitle}>Garden Runner 🌱</Text>
      </View>
      <TouchableOpacity style={styles.visitButton}>
        <FontAwesome5 name="eye" size={16} color={Theme.colors.primary} />
        <Text style={styles.visitButtonText}>Visit Garden</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Friends</Text>
          <Text style={styles.subtitle}>Share your garden journey</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleAddFriend}>
          <FontAwesome5 name="user-plus" size={18} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Pending Friend Requests */}
        {pendingRequests && pendingRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Requests ({pendingRequests.length})</Text>
            {pendingRequests.map((request: any, index: number) => (
              <View key={request._id || index} style={styles.pendingCard}>
                <Text style={styles.pendingName}>
                  {request.fromUser?.name || 'Friend Request'}
                </Text>
                <View style={styles.pendingActions}>
                  <TouchableOpacity style={styles.acceptButton}>
                    <Text style={styles.acceptText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.declineButton}>
                    <Text style={styles.declineText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Friends Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            My Garden Friends ({friends?.length || 0})
          </Text>

          {friends && friends.length > 0 ? (
            <View style={styles.friendsGrid}>
              {friends.map(renderFriendCard)}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🌱</Text>
              <Text style={styles.emptyTitle}>No friends yet</Text>
              <Text style={styles.emptyDescription}>
                Add friends to share your garden progress and motivate each other!
              </Text>
              <TouchableOpacity style={styles.emptyButton} onPress={handleAddFriend}>
                <Text style={styles.emptyButtonText}>Add Friends</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Coming Soon Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coming Soon</Text>
          <View style={styles.featureCard}>
            <FontAwesome5 name="trophy" size={24} color={Theme.colors.accent} />
            <View style={styles.featureInfo}>
              <Text style={styles.featureTitle}>Garden Competitions</Text>
              <Text style={styles.featureDescription}>
                Compete with friends in monthly running challenges
              </Text>
            </View>
          </View>
          <View style={styles.featureCard}>
            <FontAwesome5 name="gift" size={24} color={Theme.colors.secondary} />
            <View style={styles.featureInfo}>
              <Text style={styles.featureTitle}>Plant Gifts</Text>
              <Text style={styles.featureDescription}>
                Send rare plants to friends as rewards
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Theme.colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: Theme.colors.textSecondary,
    marginTop: 4,
  },
  addButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 12,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Theme.colors.text,
    marginBottom: 12,
  },
  pendingCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pendingName: {
    fontSize: 16,
    color: Theme.colors.text,
    flex: 1,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  acceptText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  declineButton: {
    backgroundColor: Theme.colors.error,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  declineText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  friendsGrid: {
    gap: 12,
  },
  friendCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  friendSubtitle: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  visitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.primaryBackground,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  visitButtonText: {
    color: Theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Theme.colors.text,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  emptyButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  featureCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureInfo: {
    flex: 1,
    marginLeft: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    lineHeight: 18,
  },
});