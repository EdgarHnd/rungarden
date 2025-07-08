import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { FontAwesome, FontAwesome6 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery } from 'convex/react';
import React, { useEffect, useState } from 'react';
import { FlatList, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const ICONS = {
  contacts: require('@/assets/images/icons/apple-health.png'), // Placeholder, replace with contacts icon
  search: require('@/assets/images/icons/strava.png'), // Placeholder, replace with search icon
  share: require('@/assets/images/blaze/blazefriends.png'),
};

export default function AddFriendScreen() {
  const [query, setQuery] = useState('');
  const [searchText, setSearchText] = useState('');
  const [step, setStep] = useState<'main' | 'search'>('main');
  const navigation = useNavigation();
  // Debounce input 300ms
  useEffect(() => {
    const id = setTimeout(() => {
      setSearchText(query.trim());
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  // Friend suggestions (for demo, use top 3 from search or mock)
  const suggestions = useQuery(api.userProfile.searchProfiles, { text: '' })?.slice(0, 3) || [];

  // For search/add UI
  const results = useQuery(api.userProfile.searchProfiles, { text: searchText });
  const incomingRequests = useQuery(api.friends.getPendingFriendRequests);
  const outgoingRequests = useQuery(api.friends.getSentFriendRequests);
  const sendRequest = useMutation(api.friends.sendFriendRequest);
  const respondRequest = useMutation(api.friends.respondToFriendRequest);

  const handleAdd = async (userId: string) => {
    try {
      await sendRequest({ toUserId: userId as any });
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRespond = async (requestId: string, accept: boolean) => {
    try {
      await respondRequest({ requestId: requestId as any, accept });
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleShareInvite = async () => {
    try {
      const shareUrl = 'https://blaze.run';
      const message = 'Join me on Blaze! Download the app here:';
      await Share.share({
        message: `${message} ${shareUrl}`,
        url: shareUrl,
        title: 'Join Blaze - Running & Fitness App',
      });
    } catch (error) {
      console.error('Error sharing invite:', error);
    }
  };

  // --- MAIN SCREEN ---
  if (step === 'main') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.headerContainer}>
          <Text style={styles.header}>Find your friends</Text>
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.optionsContainer}>
          {/* <TouchableOpacity style={styles.optionCard} onPress={() => { }}>
            <FontAwesome name="user" size={24} color={Theme.colors.text.primary} />
            <Text style={styles.optionText}>Choose from contacts</Text>
          </TouchableOpacity> */}
          <TouchableOpacity style={styles.optionCard} onPress={() => setStep('search')}>
            <FontAwesome name="search" size={24} color={Theme.colors.text.primary} />
            <Text style={styles.optionText}>Search by name</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareButton} onPress={handleShareInvite}>
            <FontAwesome6 name="arrow-up-from-bracket" size={24} color={Theme.colors.accent.primary} />
            <Text style={styles.shareButtonText}>Share invite link</Text>
          </TouchableOpacity>
        </View>
        {/* <Text style={styles.suggestionsHeader}>Friend suggestions <Text style={styles.viewAll}>VIEW ALL</Text></Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll} contentContainerStyle={{ paddingVertical: 8 }}>
          {suggestions.map((item) => (
            <View key={item.userId} style={styles.suggestionCard}>
              <Image source={ICONS.share} style={styles.suggestionAvatar} />
              <Text style={styles.suggestionName}>{item.name}</Text>
              <Text style={styles.suggestionSubtext}>You may know each other</Text>
              <TouchableOpacity style={styles.suggestionFollowBtn} onPress={() => handleAdd(item.userId)}>
                <Text style={styles.suggestionFollowText}>FOLLOW</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView> */}
        {/* Incoming Requests Section (only if any) */}
        {incomingRequests && incomingRequests.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Incoming Requests</Text>
            <FlatList
              data={incomingRequests}
              keyExtractor={(item) => item._id as string}
              renderItem={({ item }) => (
                <View style={styles.requestRow}>
                  <Text style={styles.resultName}>{item.name}</Text>
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
          </>
        )}
      </ScrollView>
    );
  }

  // --- SEARCH/ADD FRIEND SCREEN ---
  return (
    <View style={styles.container}>
      <View style={styles.addFriendHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep('main')}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Add Friends</Text>
      </View>
      <View style={styles.searchRow}>
        <TextInput
          placeholder="Search by name"
          placeholderTextColor={Theme.colors.text.tertiary}
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={() => setQuery('')}>
            <FontAwesome6 name="xmark" size={24} color={Theme.colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={results || []}
        keyExtractor={(item) => item.userId}
        renderItem={({ item }) => (
          <View style={styles.resultRow}>
            <Text style={styles.resultName}>{item.name}</Text>
            {(() => {
              const alreadySent = outgoingRequests?.some((r: any) => r.userId === item.userId);
              return (
                <TouchableOpacity
                  style={[styles.addButton, alreadySent && styles.addButtonDisabled]}
                  onPress={() => alreadySent ? null : handleAdd(item.userId as string)}
                  disabled={alreadySent}
                >
                  <Text style={styles.addButtonText}>{alreadySent ? 'Sent' : 'Add'}</Text>
                </TouchableOpacity>
              );
            })()}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.noResults}>No results</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
    padding: Theme.spacing.lg,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Theme.borderRadius.large,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Theme.colors.accent.primary,
    paddingVertical: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg,
    gap: Theme.spacing.lg,
  },
  shareButtonText: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  closeButton: {
    marginBottom: Theme.spacing.lg,
    marginTop: Theme.spacing.sm,
  },
  closeButtonText: {
    fontSize: 32,
    color: Theme.colors.text.tertiary,
  },
  header: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'left',
    marginBottom: Theme.spacing.xl,
    marginLeft: 2,
  },
  optionsContainer: {
    marginBottom: Theme.spacing.xl,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Theme.borderRadius.large,
    backgroundColor: Theme.colors.background.secondary,
    borderWidth: 2,
    borderColor: Theme.colors.border.primary,
    borderBottomWidth: 4,
    paddingVertical: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg,
    gap: Theme.spacing.lg,
  },
  optionIcon: {
    width: 40,
    height: 40,
    marginRight: Theme.spacing.lg,
  },
  optionText: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  suggestionsHeader: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.md,
    marginTop: Theme.spacing.lg,
  },
  viewAll: {
    color: Theme.colors.accent.primary,
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    marginLeft: Theme.spacing.md,
  },
  suggestionsScroll: {
    marginBottom: Theme.spacing.xl,
  },
  suggestionCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    borderWidth: 2,
    borderColor: Theme.colors.border.primary,
    borderBottomWidth: 4,
    alignItems: 'center',
    padding: Theme.spacing.lg,
    marginRight: Theme.spacing.lg,
    width: 140,
  },
  suggestionAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: Theme.spacing.md,
  },
  suggestionName: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 2,
  },
  suggestionSubtext: {
    fontSize: 12,
    color: Theme.colors.text.tertiary,
    marginBottom: Theme.spacing.md,
  },
  suggestionFollowBtn: {
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.medium,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
  },
  suggestionFollowText: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 14,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: Theme.spacing.lg,
  },
  backButtonText: {
    fontSize: 32,
    color: Theme.colors.text.tertiary,
  },
  addFriendHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    backgroundColor: Theme.colors.background.secondary,
    borderWidth: 2,
    borderColor: Theme.colors.border.primary,
    borderBottomWidth: 4,
    borderRadius: Theme.borderRadius.medium,
    padding: Theme.spacing.md,
    color: Theme.colors.text.primary,
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    flex: 1,
  },
  clearButton: {
    marginLeft: Theme.spacing.sm,
    padding: Theme.spacing.sm,
  },
  clearButtonText: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.tertiary,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Theme.spacing.lg,
  },
  resultName: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
  },
  addButton: {
    backgroundColor: Theme.colors.accent.primary,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.medium,
  },
  addButtonDisabled: {
    backgroundColor: Theme.colors.background.tertiary,
  },
  addButtonText: {
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginTop: Theme.spacing.lg,
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
  noResults: {
    textAlign: 'center',
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    marginTop: Theme.spacing.xl,
    color: Theme.colors.text.tertiary,
  },
}); 